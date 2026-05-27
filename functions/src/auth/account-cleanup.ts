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
 * - cashbox transactions (created_by) → anonymize created_by_name (#1961)
 * - location reviews (user_id) → anonymize user_name (#1963)
 * - groups (ownerId + members[].userName) → anonymize denormalized PII (#1965)
 * - activities (targetUserId) → anonymize targetUserName + targetUserPhoto (#1968)
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
        // FIX #1280: `let` em vez de `const` para permitir reatribuição
        // após cada commit. Sem isso, após o primeiro commitBatch() o batch
        // fica em estado "committed" e qualquer batch.delete() subsequente
        // lança "Cannot modify a WriteBatch that has been committed" →
        // trigger aborta com dados pessoais residuais (violação LGPD Art. 18 VI).
        // Padrão espelhado de functions/src/notifications/batch-sender.ts.
        let batch = db.batch();
        let batchOps = 0;

        // FIX #652-B3 + #1280: helper to commit batch and recreate instance
        const commitBatch = async () => {
          if (batchOps > 0) {
            await batch.commit();
            // FIX #1280: recriar batch após commit — WriteBatch não pode ser
            // reutilizado após committed (firebase-admin semântica imutável).
            batch = db.batch();
            batchOps = 0;
          }
        };

        // FIX #1292: guard de limite centralizado. Antes, a checagem
        // `batchOps >= 450` só existia DENTRO dos loops; deletes avulsos
        // (users, users_private, cpf_index, sessions) incrementavam batchOps
        // sem checar limite. Padrão frágil: adicionar novas coleções avulsas
        // poderia estourar o teto de 500 ops/batch do Firestore e abortar o
        // cleanup com dados pessoais residuais (LGPD Art. 18 VI). Todo delete
        // passa por aqui agora.
        const queueDelete = async (
          ref: admin.firestore.DocumentReference
        ) => {
          batch.delete(ref);
          batchOps++;
          if (batchOps >= 450) await commitBatch();
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
        await queueDelete(userRef);
        logger.info(`[ACCOUNT_CLEANUP] Deletando users/${uid} (inclui fcm_token)`);

        // 2. Remove users_private/{uid} (PII data + cpfHash lookup)
        const userPrivateRef = db.doc(`users_private/${uid}`);
        const userPrivateSnap = await userPrivateRef.get();
        const cpfHash = userPrivateSnap.data()?.cpfHash as string | undefined;

        if (userPrivateSnap.exists) {
          await queueDelete(userPrivateRef);
          logger.info(`[ACCOUNT_CLEANUP] Deletando users_private/${uid}`);
        }

        // 3. Remove cpf_index/{cpfHash} → libera dedup para re-registro
        if (cpfHash) {
          await queueDelete(db.doc(`cpf_index/${cpfHash}`));
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando cpf_index/${cpfHash} ` +
            `do usuário ${uid}`
          );
        }

        // 4. FIX #652-B3 + #994: Cleanup audit_logs (target_user_id == uid)
        // LGPD Art. 18 VI — loopa até esgotar (era limit 500 sem loop, deixava
        // docs órfãos para usuários com mais de 500 audit_logs)
        let auditLogsTotal = 0;
        while (true) {
          const auditLogsSnap = await db
            .collection("audit_logs")
            .where("target_user_id", "==", uid)
            .limit(500)
            .get();
          if (auditLogsSnap.empty) break;
          for (const doc of auditLogsSnap.docs) {
            await queueDelete(doc.ref);
          }
          auditLogsTotal += auditLogsSnap.size;
          if (auditLogsSnap.size < 500) break;
        }
        if (auditLogsTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${auditLogsTotal} audit_logs ` +
            `do usuário ${uid}`
          );
        }

        // 5. FIX #652-B3: Cleanup sessions/{uid}
        await queueDelete(db.doc(`sessions/${uid}`));
        logger.info(`[ACCOUNT_CLEANUP] Deletando sessions/${uid}`);

        // 6. FIX #652-B3 + #994: Cleanup verification_failures (loop)
        let verifyFailTotal = 0;
        while (true) {
          const verifyFailSnap = await db
            .collection("verification_failures")
            .where("uid", "==", uid)
            .limit(500)
            .get();
          if (verifyFailSnap.empty) break;
          for (const doc of verifyFailSnap.docs) {
            await queueDelete(doc.ref);
          }
          verifyFailTotal += verifyFailSnap.size;
          if (verifyFailSnap.size < 500) break;
        }
        if (verifyFailTotal > 0) {
          logger.info(
            "[ACCOUNT_CLEANUP] Deletando " +
            `${verifyFailTotal} ` +
            `verification_failures do usuário ${uid}`
          );
        }

        // 7. FIX #652-B3 + #994: Cleanup notifications (recipient) (loop)
        let notificationsTotal = 0;
        while (true) {
          const notificationsSnap = await db
            .collection("notifications")
            .where("recipient_id", "==", uid)
            .limit(500)
            .get();
          if (notificationsSnap.empty) break;
          for (const doc of notificationsSnap.docs) {
            await queueDelete(doc.ref);
          }
          notificationsTotal += notificationsSnap.size;
          if (notificationsSnap.size < 500) break;
        }
        if (notificationsTotal > 0) {
          logger.info(
            "[ACCOUNT_CLEANUP] Deletando " +
            `${notificationsTotal} ` +
            `notifications do usuário ${uid}`
          );
        }

        // FIX #786: LGPD Art. 18 VI — coleções de gameplay/social faltantes.
        // confirmations, mvp_votes, xp_logs, statistics, season_participation,
        // activities, user_badges — dados pessoais que devem ser apagados.

        // 8. FIX #786: confirmations (user_id == uid) — loop to handle >500
        let confirmationsTotal = 0;
        while (true) {
          const confirmationsSnap = await db
            .collection("confirmations")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (confirmationsSnap.empty) break;
          for (const doc of confirmationsSnap.docs) {
            await queueDelete(doc.ref);
          }
          confirmationsTotal += confirmationsSnap.size;
          if (confirmationsSnap.size < 500) break;
        }
        if (confirmationsTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${confirmationsTotal} ` +
            `confirmations do usuário ${uid}`
          );
        }

        // 9. FIX #786: mvp_votes (voter_id == uid) — loop to handle >500
        let mvpVotesTotal = 0;
        while (true) {
          const mvpVotesSnap = await db
            .collection("mvp_votes")
            .where("voter_id", "==", uid)
            .limit(500)
            .get();
          if (mvpVotesSnap.empty) break;
          for (const doc of mvpVotesSnap.docs) {
            await queueDelete(doc.ref);
          }
          mvpVotesTotal += mvpVotesSnap.size;
          if (mvpVotesSnap.size < 500) break;
        }
        if (mvpVotesTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${mvpVotesTotal} ` +
            `mvp_votes do usuário ${uid}`
          );
        }

        // 10. FIX #786: xp_logs (user_id == uid) — loop to handle >500
        let xpLogsTotal = 0;
        while (true) {
          const xpLogsSnap = await db
            .collection("xp_logs")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (xpLogsSnap.empty) break;
          for (const doc of xpLogsSnap.docs) {
            await queueDelete(doc.ref);
          }
          xpLogsTotal += xpLogsSnap.size;
          if (xpLogsSnap.size < 500) break;
        }
        if (xpLogsTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${xpLogsTotal} ` +
            `xp_logs do usuário ${uid}`
          );
        }

        // 11. FIX #786: statistics (user_id == uid) — loop to handle >500
        let statisticsTotal = 0;
        while (true) {
          const statisticsSnap = await db
            .collection("statistics")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (statisticsSnap.empty) break;
          for (const doc of statisticsSnap.docs) {
            await queueDelete(doc.ref);
          }
          statisticsTotal += statisticsSnap.size;
          if (statisticsSnap.size < 500) break;
        }
        if (statisticsTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${statisticsTotal} ` +
            `statistics do usuário ${uid}`
          );
        }

        // 12. FIX #786: season_participation (user_id == uid) — loop to handle >500
        let seasonPartTotal = 0;
        while (true) {
          const seasonPartSnap = await db
            .collection("season_participation")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (seasonPartSnap.empty) break;
          for (const doc of seasonPartSnap.docs) {
            await queueDelete(doc.ref);
          }
          seasonPartTotal += seasonPartSnap.size;
          if (seasonPartSnap.size < 500) break;
        }
        if (seasonPartTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${seasonPartTotal} ` +
            `season_participation do usuário ${uid}`
          );
        }

        // 13. FIX #786: activities (user_id == uid) — loop to handle >500
        let activitiesTotal = 0;
        while (true) {
          const activitiesSnap = await db
            .collection("activities")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (activitiesSnap.empty) break;
          for (const doc of activitiesSnap.docs) {
            await queueDelete(doc.ref);
          }
          activitiesTotal += activitiesSnap.size;
          if (activitiesSnap.size < 500) break;
        }
        if (activitiesTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${activitiesTotal} ` +
            `activities do usuário ${uid}`
          );
        }

        // 14. FIX #786: user_badges (user_id == uid) — loop to handle >500
        let userBadgesTotal = 0;
        while (true) {
          const userBadgesSnap = await db
            .collection("user_badges")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (userBadgesSnap.empty) break;
          for (const doc of userBadgesSnap.docs) {
            await queueDelete(doc.ref);
          }
          userBadgesTotal += userBadgesSnap.size;
          if (userBadgesSnap.size < 500) break;
        }
        if (userBadgesTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${userBadgesTotal} ` +
            `user_badges do usuário ${uid}`
          );
        }

        // 15. FIX #1841: user_streaks/{uid} — LGPD Art. 18 VI
        // Dados de streak (current_streak, longest_streak, last_game_date)
        // devem ser apagados junto com os demais dados pessoais.
        await queueDelete(db.doc(`user_streaks/${uid}`));
        logger.info(`[ACCOUNT_CLEANUP] Deletando user_streaks/${uid}`);

        await commitBatch();

        // FIX #1961: cashbox transactions — anonymize created_by_name (LGPD Art. 18 VI)
        // Transactions are subcollections inside cashbox documents.
        // Requires composite index on collectionGroup(transactions): created_by ASC, __name__ ASC
        try {
          let cashboxTotal = 0;
          while (true) {
            const cashboxSnap = await db
              .collectionGroup("transactions")
              .where("created_by", "==", uid)
              .limit(500)
              .get();
            if (cashboxSnap.empty) break;
            const cashboxBatch = db.batch();
            cashboxSnap.forEach((doc) => {
              cashboxBatch.update(doc.ref, {
                created_by_name: "Usuário removido",
              });
            });
            await cashboxBatch.commit();
            cashboxTotal += cashboxSnap.size;
            if (cashboxSnap.size < 500) break;
          }
          if (cashboxTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${cashboxTotal} ` +
                `cashbox transactions do usuário ${uid}`
            );
          }
        } catch (cashboxError) {
          logger.warn(
            `[ACCOUNT_CLEANUP] Erro ao anonimizar cashbox transactions para ${uid} (non-fatal):`,
            cashboxError
          );
        }

        // FIX #1963: location reviews — anonymize user_name (LGPD Art. 18 VI)
        // Reviews are subcollections inside location documents.
        // Requires composite index on collectionGroup(reviews): user_id ASC, __name__ ASC
        try {
          let reviewsTotal = 0;
          while (true) {
            const reviewsSnap = await db
              .collectionGroup("reviews")
              .where("user_id", "==", uid)
              .limit(500)
              .get();
            if (reviewsSnap.empty) break;
            const reviewsBatch = db.batch();
            reviewsSnap.forEach((doc) => {
              reviewsBatch.update(doc.ref, {
                user_name: "Usuário removido",
              });
            });
            await reviewsBatch.commit();
            reviewsTotal += reviewsSnap.size;
            if (reviewsSnap.size < 500) break;
          }
          if (reviewsTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${reviewsTotal} ` +
                `location reviews do usuário ${uid}`
            );
          }
        } catch (reviewsError) {
          logger.warn(
            `[ACCOUNT_CLEANUP] Erro ao anonimizar location reviews para ${uid} (non-fatal):`,
            reviewsError
          );
        }

        // FIX #1965: groups — anonymize ownerName + members[].userName (LGPD Art. 18 VI)
        // Owner name and member names are denormalized and retain PII after deletion.
        try {
          let groupsTotal = 0;
          let lastDoc: admin.firestore.DocumentSnapshot | null = null;
          while (true) {
            let query = db.collection("groups").limit(500);
            if (lastDoc) query = query.startAfter(lastDoc);
            const groupsSnap = await query.get();
            if (groupsSnap.empty) break;
            const groupsBatch = db.batch();
            let batchOps = 0;
            for (const doc of groupsSnap.docs) {
              const data = doc.data();
              let modified = false;
              const updates: Record<string, unknown> = {};

              if (data.ownerId === uid && data.ownerName) {
                updates.ownerName = "Usuário removido";
                modified = true;
              }

              if (data.members && Array.isArray(data.members)) {
                const updatedMembers = data.members.map(
                  (m: Record<string, unknown>) =>
                    m.userId === uid ?
                      {...m, userName: "Usuário removido"} :
                      m
                );
                // Only update if something actually changed
                const hasChange = data.members.some(
                  (m: Record<string, unknown>, i: number) =>
                    m.userId === uid &&
                    m.userName !== updatedMembers[i].userName
                );
                if (hasChange) {
                  updates.members = updatedMembers;
                  modified = true;
                }
              }

              if (modified) {
                groupsBatch.update(doc.ref, updates);
                batchOps++;
                groupsTotal++;
              }
            }
            if (batchOps > 0) {
              await groupsBatch.commit();
            }
            lastDoc = groupsSnap.docs[groupsSnap.docs.length - 1];
            if (groupsSnap.size < 500) break;
          }
          if (groupsTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${groupsTotal} ` +
                `grupos com PII do usuário ${uid}`
            );
          }
        } catch (groupsError) {
          logger.warn(
            `[ACCOUNT_CLEANUP] Erro ao anonimizar grupos para ${uid} (non-fatal):`,
            groupsError
          );
        }

        // FIX #1968: activities — anonymize targetUserName + targetUserPhoto (LGPD Art. 18 VI)
        // Activities where the deleted user is referenced as a target (by other users).
        // Requires composite index on collectionGroup(activities): targetUserId ASC, __name__ ASC
        try {
          let targetActivitiesTotal = 0;
          while (true) {
            const activitiesSnap = await db
              .collectionGroup("activities")
              .where("targetUserId", "==", uid)
              .limit(500)
              .get();
            if (activitiesSnap.empty) break;
            const activitiesBatch = db.batch();
            activitiesSnap.forEach((doc) => {
              activitiesBatch.update(doc.ref, {
                targetUserName: "Usuário removido",
                targetUserPhoto: null,
              });
            });
            await activitiesBatch.commit();
            targetActivitiesTotal += activitiesSnap.size;
            if (activitiesSnap.size < 500) break;
          }
          if (targetActivitiesTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${targetActivitiesTotal} ` +
                `activities com target PII do usuário ${uid}`
            );
          }
        } catch (activitiesError) {
          logger.warn(
            `[ACCOUNT_CLEANUP] Erro ao anonimizar activities target para ${uid} (non-fatal):`,
            activitiesError
          );
        }
        logger.info(
          `[ACCOUNT_CLEANUP] Cleanup completo para usuário ${uid}`
        );

        // 20. Limpar arquivos órfãos do Storage (profile photos + thumbnails)
        try {
          const storage = getStorage();
          const bucketName =
            process.env.STORAGE_BUCKET ||
            `${process.env.GCLOUD_PROJECT}.appspot.com`;
          const bucket = storage.bucket(bucketName);
          const prefixes = [
            `users/${uid}/`, // current upload path
            `profile_photos/thumbnails/${uid}_thumb`, // legacy thumbnail
            `profile_photos/${uid}.`, // legacy profile photo
          ];
          for (const prefix of prefixes) {
            try {
              const [files] = await bucket.getFiles({prefix});
              if (files.length > 0) {
                for (const file of files) {
                  await file.delete();
                  logger.info(
                    `[ACCOUNT_CLEANUP] Arquivo orfao deletado: ${file.name}`
                  );
                }
              }
            } catch {
              // Non-fatal: some prefixes may not exist
            }
          }
        } catch (storageError) {
          logger.warn(
            "[ACCOUNT_CLEANUP] Erro ao limpar Storage " +
            `para ${uid} (non-fatal):`,
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
