/**
 * ACCOUNT CLEANUP — FIX #619
 *
 * Trigger: Firebase Auth onDelete (v1)
 *
 * Quando uma conta é deletada, limpa:
 * - cpf_index/{cpfHash} → libera dedup para re-registro
 * - users_private/{uid} → LGPD Art. 18 VI (direito ao apagamento)
 *
 * Usuários sem CPF verificado (sem users_private) são no-op silencioso.
 *
 * NOTA: usa firebase-functions/v1 pois v2 ainda não suporta
 * Auth triggers (onDelete). Padrão idêntico ao onUserCreate em
 * user-management.ts.
 */

import {auth} from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {Storage} from "@google-cloud/storage";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();
const getStorage = () => new Storage();

/**
 * Cloud Function: onUserDeleted
 *
 * Trigger: Firebase Auth onDelete
 * Purpose: Limpa cpf_index/{cpfHash} e users_private/{uid}
 * quando o usuário é deletado.
 *
 * LGPD Art. 18 VI: direito ao apagamento de dados pessoais.
 * Sem esse cleanup: re-registro com mesmo CPF fica bloqueado
 * permanentemente (dedup block).
 *
 * @param {admin.auth.UserRecord} user - Registro do usuário deletado
 * @return {Promise<void>}
 */
export const onUserDeleted = auth
  .user()
  .onDelete(
    async (user: admin.auth.UserRecord) => {
      const uid = user.uid;
      logger.info(
        `[ACCOUNT_CLEANUP] Usuário ${uid} deletado — iniciando cleanup`
      );

      const db = getDb();

      try {
        // Lê users_private para encontrar cpfHash
        const userPrivateRef = db.doc(`users_private/${uid}`);
        const userPrivateSnap = await userPrivateRef.get();

        if (!userPrivateSnap.exists) {
          // Usuário sem CPF verificado — sem dados para limpar
          logger.info(
            `[ACCOUNT_CLEANUP] users_private/${uid} não existe, ` +
            "nenhum dado a limpar (no-op)."
          );
          return;
        }

        const data = userPrivateSnap.data();
        const cpfHash = data?.cpfHash as string | undefined;

        const batch = db.batch();

        // 1. Remove cpf_index/{cpfHash} → libera dedup para re-registro
        if (cpfHash) {
          const cpfIndexRef = db.doc(`cpf_index/${cpfHash}`);
          batch.delete(cpfIndexRef);
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando cpf_index/${cpfHash} ` +
            `do usuário ${uid}`
          );
        } else {
          logger.warn(
            `[ACCOUNT_CLEANUP] users_private/${uid} existe mas ` +
            "não tem cpfHash — apenas users_private será deletado."
          );
        }

        // 2. Remove users_private/{uid} → LGPD cleanup de dados PII
        batch.delete(userPrivateRef);
        logger.info(
          `[ACCOUNT_CLEANUP] Deletando users_private/${uid}`
        );

        await batch.commit();
        logger.info(
          `[ACCOUNT_CLEANUP] Cleanup completo para usuário ${uid}`
        );

        // 3. Limpar thumbnails orfaos do Storage
        // (profile_photos/thumbnails/{uid}_thumb.*)
        try {
          const storage = getStorage();
          const bucketName =
            process.env.STORAGE_BUCKET ||
            `${process.env.GCLOUD_PROJECT}.appspot.com`;
          const bucket = storage.bucket(bucketName);
          const [thumbFiles] = await bucket.getFiles({
            prefix: `profile_photos/thumbnails/${uid}_thumb`,
          });
          if (thumbFiles.length > 0) {
            for (const file of thumbFiles) {
              await file.delete();
              logger.info(
                `[ACCOUNT_CLEANUP] Thumbnail orfao deletado: ${file.name}`
              );
            }
          }
        } catch (storageError) {
          logger.warn(
            "[ACCOUNT_CLEANUP] Erro ao limpar thumbnails " +
            `do Storage para ${uid} (non-fatal):`,
            storageError
          );
        }
      } catch (error) {
        logger.error(
          `[ACCOUNT_CLEANUP] Erro no cleanup do usuário ${uid}:`,
          error
        );
        // Re-throw para acionar retry automático do Firebase
        throw error;
      }
    }
  );
