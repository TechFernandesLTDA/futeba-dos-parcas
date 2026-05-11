/**
 * ACCOUNT CLEANUP — FIX #619 / #652-B3
 *
 * Trigger: Firebase Auth onDelete (v1)
 *
 * Quando uma conta é deletada, limpa:
 * - cpf_index/{cpfHash} → libera dedup para re-registro
 * - users_private/{uid} → LGPD Art. 18 VI (direito ao apagamento)
 * - audit_logs (target_user_id=uid) → LGPD cleanup
 * - sessions/{uid} → LGPD session cleanup
 * - verification_failures (uid=uid) → LGPD cleanup
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
        const batch = db.batch();
        let batchOps = 0;

        // FIX #652-B3: helper to commit batch and refresh
        const commitBatch = async () => {
          if (batchOps > 0) {
            await batch.commit();
            batchOps = 0;
          }
        };

        // FIX #935: Tokens FCM ficam no campo `fcm_token` de users/{uid}.
        // Ao deletar o documento abaixo, o campo é removido implicitamente,
        // impedindo envio de notificações ao dispositivo do ex-usuário.
        // NOTA: revokeRefreshTokens(uid) NÃO pode ser chamado aqui porque o
        // trigger onDelete dispara APÓS o Auth user ser deletado — a chamada
        // lançaria auth/user-not-found. Os refresh tokens já foram invalidados
        // pelo próprio Firebase ao deletar a conta.

        // 1. Remove users/{uid} (user profile + fcm_token implícito)
        const userRef = db.doc(`users/${uid}`);
        batch.delete(userRef);
        batchOps++;
        logger.info(`[ACCOUNT_CLEANUP] Deletando users/${uid} (inclui fcm_token)`);

        // 2. Remove users_private/{uid} (PII data + cpfHash lookup)
        const userPrivateRef = db.doc(`users_private/${uid}`);
        const userPrivateSnap = await userPrivateRef.get();
        const cpfHash = userPrivateSnap.data()?.cpfHash as string | undefined;

        if (userPrivateSnap.exists) {
          batch.delete(userPrivateRef);
          batchOps++;
          logger.info(`[ACCOUNT_CLEANUP] Deletando users_private/${uid}`);
        }

        // 3. Remove cpf_index/{cpfHash} → libera dedup para re-registro
        if (cpfHash) {
          batch.delete(db.doc(`cpf_index/${cpfHash}`));
          batchOps++;
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando cpf_index/${cpfHash} ` +
            `do usuário ${uid}`
          );
        }

        // 4. FIX #652-B3: Cleanup audit_logs (target_user_id == uid)
        const auditLogsSnap = await db
          .collection("audit_logs")
          .where("target_user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of auditLogsSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (auditLogsSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${auditLogsSnap.size} audit_logs ` +
            `do usuário ${uid}`
          );
        }

        // 5. FIX #652-B3: Cleanup sessions/{uid}
        batch.delete(db.doc(`sessions/${uid}`));
        batchOps++;
        logger.info(`[ACCOUNT_CLEANUP] Deletando sessions/${uid}`);

        // 6. FIX #652-B3: Cleanup verification_failures
        const verifyFailSnap = await db
          .collection("verification_failures")
          .where("uid", "==", uid)
          .limit(500)
          .get();
        for (const doc of verifyFailSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (verifyFailSnap.size > 0) {
          logger.info(
            "[ACCOUNT_CLEANUP] Deletando " +
            `${verifyFailSnap.size} ` +
            `verification_failures do usuário ${uid}`
          );
        }

        // 7. FIX #652-B3: Cleanup notifications (recipient)
        const notificationsSnap = await db
          .collection("notifications")
          .where("recipient_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of notificationsSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (notificationsSnap.size > 0) {
          logger.info(
            "[ACCOUNT_CLEANUP] Deletando " +
            `${notificationsSnap.size} ` +
            `notifications do usuário ${uid}`
          );
        }

        // FIX #786: LGPD Art. 18 VI — coleções de gameplay/social faltantes.
        // confirmations, mvp_votes, xp_logs, statistics, season_participation,
        // activities, user_badges — dados pessoais que devem ser apagados.

        // 8. FIX #786: confirmations (user_id == uid)
        const confirmationsSnap = await db
          .collection("confirmations")
          .where("user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of confirmationsSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (confirmationsSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${confirmationsSnap.size} ` +
            `confirmations do usuário ${uid}`
          );
        }

        // 9. FIX #786: mvp_votes (voter_id == uid)
        const mvpVotesSnap = await db
          .collection("mvp_votes")
          .where("voter_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of mvpVotesSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (mvpVotesSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${mvpVotesSnap.size} ` +
            `mvp_votes do usuário ${uid}`
          );
        }

        // 10. FIX #786: xp_logs (user_id == uid)
        const xpLogsSnap = await db
          .collection("xp_logs")
          .where("user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of xpLogsSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (xpLogsSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${xpLogsSnap.size} ` +
            `xp_logs do usuário ${uid}`
          );
        }

        // 11. FIX #786: statistics (user_id == uid)
        const statisticsSnap = await db
          .collection("statistics")
          .where("user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of statisticsSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (statisticsSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${statisticsSnap.size} ` +
            `statistics do usuário ${uid}`
          );
        }

        // 12. FIX #786: season_participation (user_id == uid)
        const seasonPartSnap = await db
          .collection("season_participation")
          .where("user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of seasonPartSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (seasonPartSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${seasonPartSnap.size} ` +
            `season_participation do usuário ${uid}`
          );
        }

        // 13. FIX #786: activities (user_id == uid)
        const activitiesSnap = await db
          .collection("activities")
          .where("user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of activitiesSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (activitiesSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${activitiesSnap.size} ` +
            `activities do usuário ${uid}`
          );
        }

        // 14. FIX #786: user_badges (user_id == uid)
        const userBadgesSnap = await db
          .collection("user_badges")
          .where("user_id", "==", uid)
          .limit(500)
          .get();
        for (const doc of userBadgesSnap.docs) {
          batch.delete(doc.ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
        }
        if (userBadgesSnap.size > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${userBadgesSnap.size} ` +
            `user_badges do usuário ${uid}`
          );
        }

        await commitBatch();
        logger.info(
          `[ACCOUNT_CLEANUP] Cleanup completo para usuário ${uid}`
        );

        // 15. Limpar thumbnails órfãos do Storage
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
        throw error;
      }
    }
  );
