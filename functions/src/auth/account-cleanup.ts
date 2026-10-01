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

import {runWith} from "firebase-functions/v1";
import type {EventContext} from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {Storage} from "@google-cloud/storage";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();
const getStorage = () => new Storage();

/**
 * FIX #2323: guarda de segurança contra loop infinito na anonimização LGPD.
 * Com limit(500) por página, 1000 iterações = até 500k docs anonimizados —
 * folga mais que suficiente para qualquer usuário real. Se exceder, é sinal de
 * loop sem avanço de cursor → aborta com logger.error em vez de travar até o
 * timeout da função (e disparar retry infinito).
 */
const MAX_ANON_ITERATIONS = 1000;

/**
 * FIX #3897: teto de idade do evento de exclusão. `failurePolicy: true`
 * reenfileira com backoff por até 7 dias — sem teto, uma falha permanente
 * (dado malformado, objeto de Storage com 403, quota) vira 7 dias de
 * tentativas, cada uma varrendo ~16 coleções + 2 collectionGroup e
 * reescrevendo todos os alvos de anonimização. Acima de 24h abortamos com
 * `return` (nunca `throw` — ver comentário no handler).
 */
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * FIX #3897: distingue falha transitória (rede, quota, indisponibilidade —
 * outra tentativa pode resolver) de falha permanente (dado malformado,
 * permissão, argumento inválido — nunca vai se resolver sozinha) antes de
 * ligar `anonFailed`. Só a primeira justifica forçar o retry da limpeza
 * inteira via failurePolicy; a segunda, se forçada a repetir, apenas
 * reamplifica writes sem chance de sucesso — as etapas de anonimização
 * atualizam documentos no lugar sem estreitar o filtro, então os mesmos
 * documentos voltam a casar na query da próxima tentativa.
 *
 * Firestore/gRPC expõe `error.code` como status numérico
 * (google-gax Status). Sem código estruturado (erro genérico de JS, ex.:
 * TypeError em dado inesperado) tratamos como permanente — repetir a mesma
 * lógica sobre o mesmo dado produz o mesmo erro.
 */
const TRANSIENT_GRPC_CODES = new Set([
  1, // CANCELLED
  2, // UNKNOWN
  4, // DEADLINE_EXCEEDED
  8, // RESOURCE_EXHAUSTED
  10, // ABORTED
  13, // INTERNAL
  14, // UNAVAILABLE
]);

/**
 * Verifica se um erro capturado nos blocos de anonimização de
 * `onUserDeleted` é transitório (justifica forçar retry via `anonFailed`)
 * ou permanente (não justifica).
 *
 * @param {unknown} error - Erro capturado no bloco catch
 * @return {boolean} true se o código gRPC indicar falha transitória
 */
function isTransientFirestoreError(error: unknown): boolean {
  const code = (error as {code?: unknown} | null | undefined)?.code;
  return typeof code === "number" && TRANSIENT_GRPC_CODES.has(code);
}

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
// FIX #3877: failurePolicy habilita retry real em background functions v1.
// Sem ele, o `throw` de "PII anonymization incomplete" era no-op (só log) —
// falha parcial deixava users_private (telefone, cpfHash) e índices
// cpf_index/phone_index órfãos para sempre. Espelha o `retry: true` dos
// triggers v2 (ex.: pii-migration.ts).
// FIX #3897: o #3877 ligou failurePolicy sem ajustar timeout/memória — a
// função é a mais pesada do módulo de auth (~16 loops paginados + 2
// collectionGroup + Storage sequencial) e ficou no default de 60s.
// timeoutSeconds/memory alinhados com pii-migration.ts (mesma família
// PII/LGPD). NOTA: memory usa sintaxe v1 ("512MB"), não v2 ("512MiB").
export const onUserDeleted = runWith({
  failurePolicy: true,
  timeoutSeconds: 540,
  memory: "512MB",
})
  .auth
  .user()
  .onDelete(
    async (user: admin.auth.UserRecord, context: EventContext) => {
      const uid = user.uid;

      // FIX #3897: teto de idade do evento. failurePolicy reenfileira com
      // backoff por até 7 dias — sem este teto, uma falha permanente (dado
      // malformado, 403 no Storage, quota) vira 7 dias de tentativas, cada
      // uma reexecutando a limpeza inteira do zero. Abortamos com `return` —
      // NUNCA `throw` aqui: lançar rearmaria exatamente o retry que este
      // teto existe para cortar.
      const eventAgeMs = Date.now() - new Date(context.timestamp).getTime();
      if (eventAgeMs > MAX_EVENT_AGE_MS) {
        logger.error(
          `[ACCOUNT_CLEANUP] Evento de exclusão do usuário ${uid} tem ` +
          `${Math.round(eventAgeMs / 3_600_000)}h (acima do teto de 24h) — ` +
          "abortando sem novo retry. Falha permanente: requer intervenção " +
          "manual para completar o cleanup LGPD."
        );
        return;
      }

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
        const queuedDeletePaths = new Set<string>();

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
          if (queuedDeletePaths.has(ref.path)) return;
          queuedDeletePaths.add(ref.path);
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

        // 1. Remove users/{uid} imediatamente. O registro push lê esse doc na
        // mesma transação de escrita; portanto uma chamada em voo conflita,
        // repete e passa a falhar antes de recriar dados após o cleanup LGPD.
        const userRef = db.doc(`users/${uid}`);
        await userRef.delete();
        queuedDeletePaths.add(userRef.path);
        logger.info(`[ACCOUNT_CLEANUP] Deletando users/${uid} (inclui fcm_token)`);

        // Tokens push privados também são dados pessoais e ficam fora de
        // users/{uid}. Paginar evita deixar instalações residuais após o
        // direito de exclusão LGPD.
        for (const collectionName of ["push_tokens", "push_token_devices"]) {
          let deletedPushRecords = 0;
          while (true) {
            const pushSnapshot = await db.collection(collectionName)
              .where("userId", "==", uid)
              .limit(500)
              .get();
            if (pushSnapshot.empty) break;
            for (const document of pushSnapshot.docs) {
              await queueDelete(document.ref);
            }
            deletedPushRecords += pushSnapshot.size;
            if (pushSnapshot.size < 500) break;
          }
          if (deletedPushRecords > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Deletando ${deletedPushRecords} ` +
              `${collectionName} do usuário ${uid}`
            );
          }
        }

        // 2. Remove users_private/{uid} (PII data + cpfHash lookup)
        const userPrivateRef = db.doc(`users_private/${uid}`);
        const userPrivateSnap = await userPrivateRef.get();
        const cpfHash = userPrivateSnap.data()?.cpfHash as string | undefined;
        const phoneHash = userPrivateSnap.data()?.phoneHash as string | undefined;

        if (userPrivateSnap.exists) {
          await queueDelete(userPrivateRef);
          logger.info(`[ACCOUNT_CLEANUP] Deletando users_private/${uid}`);
        }

        // 3. Remove cpf_index/{cpfHash} → libera dedup para re-registro
        if (cpfHash) {
          const cpfIndexRef = db.doc(`cpf_index/${cpfHash}`);
          const cpfIndexSnap = await cpfIndexRef.get();
          if (cpfIndexSnap.data()?.uid === uid) {
            await queueDelete(cpfIndexRef);
            logger.info(
              `[ACCOUNT_CLEANUP] Deletando cpf_index/${cpfHash} ` +
              `do usuário ${uid}`
            );
          }
        }

        // 3b. Libera telefone somente se o índice ainda pertencer ao UID
        // removido. A guarda evita apagar o índice da identidade canônica
        // depois de uma união/reconciliação.
        if (phoneHash) {
          const phoneIndexRef = db.doc(`phone_index/${phoneHash}`);
          const phoneIndexSnap = await phoneIndexRef.get();
          if (phoneIndexSnap.data()?.uid === uid) {
            await queueDelete(phoneIndexRef);
            logger.info(
              `[ACCOUNT_CLEANUP] Deletando phone_index/${phoneHash} ` +
              `do usuário ${uid}`
            );
          }
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

        // 4b. FIX #2081: Cleanup audit_logs (actor_user_id == uid)
        // LGPD Art. 18 VI — cobre logs em que o usuário deletado foi o ator.
        let auditActorLogsTotal = 0;
        while (true) {
          const auditActorLogsSnap = await db
            .collection("audit_logs")
            .where("actor_user_id", "==", uid)
            .limit(500)
            .get();
          if (auditActorLogsSnap.empty) break;
          for (const doc of auditActorLogsSnap.docs) {
            await queueDelete(doc.ref);
          }
          auditActorLogsTotal += auditActorLogsSnap.size;
          if (auditActorLogsSnap.size < 500) break;
        }
        if (auditActorLogsTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${auditActorLogsTotal} ` +
            `audit_logs por actor_user_id do usuário ${uid}`
          );
        }

        // 4c. FIX #2081: Cleanup rate_limits tied to the deleted UID.
        // New buckets include user_id; legacy buckets are addressed by known
        // key prefixes because older docs used only `${prefix}_${uid}` IDs.
        let rateLimitsTotal = 0;
        while (true) {
          const rateLimitsSnap = await db
            .collection("rate_limits")
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (rateLimitsSnap.empty) break;
          for (const doc of rateLimitsSnap.docs) {
            await queueDelete(doc.ref);
          }
          rateLimitsTotal += rateLimitsSnap.size;
          if (rateLimitsSnap.size < 500) break;
        }

        const legacyRateLimitPrefixes = [
          "default",
          "mvp_vote",
          "mvp_conclude",
          "checkin",
          "soft_delete_game",
          "soft_delete_group",
          "restore_game",
          "restore_group",
          "setRole",
          "migrate",
          "deleteLoc",
          "autoRate",
          "recalcAllRatings",
          "leaderboard",
          "migrate_invites",
          "enqueue_notif",
          "verify_cpf",
          "log_verif_fail",
          "send_test_notif",
          "fake_game_notif",
          "seed_db",
        ];
        for (const prefix of legacyRateLimitPrefixes) {
          await queueDelete(db.doc(`rate_limits/${prefix}_${uid}`));
          rateLimitsTotal++;
        }

        if (rateLimitsTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${rateLimitsTotal} ` +
            `rate_limits do usuário ${uid}`
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
            // FIX #3877: o escritor (notifications/helpers.ts) grava
            // `user_id`, não `recipient_id` — o campo errado fazia a query
            // voltar sempre vazia e as notificações sobreviverem à exclusão
            // da conta (PII: user_id, sender_name, title/body). Alinhado com
            // account-merge.ts que já usa `user_id`.
            .where("user_id", "==", uid)
            .limit(500)
            .get();
          if (notificationsSnap.empty) break;
          for (const doc of notificationsSnap.docs) {
            await queueDelete(doc.ref);
          }
          notificationsTotal += notificationsSnap.size;
          if (notificationsSnap.size < 500) break;
        }
        // FIX #3877: log incondicional (inclusive 0) — o log condicionado a
        // > 0 escondia a limpeza que nunca apagava nada.
        logger.info(
          "[ACCOUNT_CLEANUP] Deletando " +
          `${notificationsTotal} ` +
          `notifications do usuário ${uid}`
        );

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

        // 15b. FIX #4120 (LGPD): anonimiza DMs — chats/{id}/messages com
        // sender_id == uid perdem nome/foto; o texto fica (o interlocutor
        // ainda leu), mas sem PII remanescente do titular excluído.
        try {
          let chatsAnonymized = 0;
          const chatsSnap = await db.collection("chats")
            .where("participants", "array-contains", uid)
            .limit(100)
            .get();
          for (const chatDoc of chatsSnap.docs) {
            let msgTotal = 0;
            let msgLastDoc:
              admin.firestore.QueryDocumentSnapshot | null = null;
            let msgIterations = 0;
            while (msgIterations < 20) {
              let msgQuery: admin.firestore.Query = chatDoc.ref
                .collection("messages")
                .where("sender_id", "==", uid)
                .limit(300);
              if (msgLastDoc) {
                msgQuery = msgQuery.startAfter(msgLastDoc);
              }
              const msgSnap = await msgQuery.get();
              if (msgSnap.empty) break;
              for (const msgDoc of msgSnap.docs) {
                batch.update(msgDoc.ref, {
                  sender_name: "Usuário excluído",
                  sender_photo_url: FieldValue.delete(),
                });
                batchOps++;
                msgTotal++;
                if (batchOps >= 450) await commitBatch();
              }
              msgLastDoc = msgSnap.docs[msgSnap.docs.length - 1];
              msgIterations++;
            }
            chatsAnonymized += msgTotal;
          }
          if (chatsAnonymized > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizadas ${chatsAnonymized} mensagens ` +
              `de DM do usuário ${uid}`
            );
          }
        } catch (dmError) {
          logger.warn(
            `[ACCOUNT_CLEANUP] Falha ao anonimizar DMs de ${uid}`,
            dmError
          );
        }

        // 16. FIX #4049: game_photos / game_videos (uploaded_by == uid) — LGPD.
        // Coleções top-level chaveadas por uploaded_by (PII denormalizado:
        // uploaded_by_name/photo). Coleta também os storage_paths para apagar
        // os objetos do bucket no passo 20.
        // FIX #4082: paginação por cursor (startAfter) + guarda de iterações.
        // Antes a query relia do começo a cada página (sem startAfter) e a
        // terminação dependia de um efeito colateral do queueDelete (dedup +
        // auto-commit aos 450 ops), não da estrutura do laço — reintroduzindo
        // o anti-pattern que o #2323 corrigiu no laço de cashbox logo abaixo.
        // SEM orderBy explícito (reusa a ordenação implícita por __name__ do
        // single-field index já existente), idêntico ao laço de cashbox.
        const mediaStoragePaths: string[] = [];
        let gameMediaTotal = 0;
        for (const collectionName of ["game_photos", "game_videos"]) {
          let mediaLastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          let mediaIterations = 0;
          while (true) {
            if (++mediaIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                `iterações excedido ao paginar ${collectionName} para ${uid} ` +
                "— abortando para evitar loop infinito"
              );
              break;
            }
            let mediaQuery = db
              .collection(collectionName)
              .where("uploaded_by", "==", uid)
              .limit(500);
            if (mediaLastDoc) {
              mediaQuery = mediaQuery.startAfter(mediaLastDoc);
            }
            const mediaSnap = await mediaQuery.get();
            if (mediaSnap.empty) break;
            for (const doc of mediaSnap.docs) {
              const storagePath = doc.data()?.storage_path;
              if (typeof storagePath === "string" && storagePath) {
                mediaStoragePaths.push(storagePath);
              }
              await queueDelete(doc.ref);
              gameMediaTotal++;
            }
            mediaLastDoc = mediaSnap.docs[mediaSnap.docs.length - 1];
            if (mediaSnap.size < 500) break;
          }
        }
        if (gameMediaTotal > 0) {
          logger.info(
            `[ACCOUNT_CLEANUP] Deletando ${gameMediaTotal} ` +
            `game_photos/game_videos do usuário ${uid}`
          );
        }

        await commitBatch();

        let anonFailed = false;

        // FIX #1961: cashbox entries — anonymize created_by_name (LGPD Art. 18 VI)
        // Cashbox entries live at groups/{groupId}/cashbox/{entryId}.
        // FIX #2323: paginação por cursor (startAfter) + guarda de iterações.
        // Antes: query sem cursor repetia sempre os mesmos 500 docs (created_by
        // não muda na anonimização, só created_by_NAME) → size sempre 500 →
        // loop infinito. Agora avança via startAfter(lastDoc). SEM orderBy
        // explícito (espelha o loop de `groups` abaixo): reusa a ordenação
        // implícita por __name__ do single-field index já existente — não exige
        // índice composto novo (que não existe em firestore.indexes.json).
        try {
          let cashboxTotal = 0;
          let cashboxLastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          let cashboxIterations = 0;
          while (true) {
            if (++cashboxIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar cashbox transactions " +
                  `para ${uid} — abortando para evitar loop infinito`
              );
              anonFailed = true;
              break;
            }
            let cashboxQuery = db
              .collectionGroup("cashbox")
              .where("created_by", "==", uid)
              .limit(500);
            if (cashboxLastDoc) {
              cashboxQuery = cashboxQuery.startAfter(cashboxLastDoc);
            }
            const cashboxSnap = await cashboxQuery.get();
            if (cashboxSnap.empty) break;
            const cashboxBatch = db.batch();
            cashboxSnap.forEach((doc) => {
              cashboxBatch.update(doc.ref, {
                created_by_name: "Usuário removido",
              });
            });
            await cashboxBatch.commit();
            cashboxTotal += cashboxSnap.size;
            cashboxLastDoc =
              cashboxSnap.docs[cashboxSnap.docs.length - 1];
            if (cashboxSnap.size < 500) break;
          }
          if (cashboxTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${cashboxTotal} ` +
                `cashbox transactions do usuário ${uid}`
            );
          }
        } catch (cashboxError) {
          // FIX #3897: só falha transitória força retry da limpeza inteira.
          if (isTransientFirestoreError(cashboxError)) {
            anonFailed = true;
            logger.warn(
              "[ACCOUNT_CLEANUP] Erro transitório ao anonimizar cashbox " +
              `transactions para ${uid} (retry via failurePolicy vai ` +
              "tentar de novo):",
              cashboxError
            );
          } else {
            logger.error(
              "[ACCOUNT_CLEANUP] Erro permanente ao anonimizar cashbox " +
              `transactions para ${uid} (não força retry — requer ` +
              "investigação manual):",
              cashboxError
            );
          }
        }

        // FIX #1963: location reviews — anonymize user_name (LGPD Art. 18 VI)
        // Reviews are subcollections inside location documents.
        // FIX #2323: paginação por cursor (startAfter) + guarda de iterações.
        // Mesma causa-raiz do loop de cashbox: o filtro (user_id) não muda na
        // anonimização → query sem cursor reprocessava os mesmos 500 docs em
        // loop. SEM orderBy explícito (reusa ordenação por __name__).
        try {
          let reviewsTotal = 0;
          let reviewsLastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          let reviewsIterations = 0;
          while (true) {
            if (++reviewsIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar location reviews " +
                  `para ${uid} — abortando para evitar loop infinito`
              );
              anonFailed = true;
              break;
            }
            let reviewsQuery = db
              .collectionGroup("reviews")
              .where("user_id", "==", uid)
              .limit(500);
            if (reviewsLastDoc) {
              reviewsQuery = reviewsQuery.startAfter(reviewsLastDoc);
            }
            const reviewsSnap = await reviewsQuery.get();
            if (reviewsSnap.empty) break;
            const reviewsBatch = db.batch();
            reviewsSnap.forEach((doc) => {
              reviewsBatch.update(doc.ref, {
                user_name: "Usuário removido",
              });
            });
            await reviewsBatch.commit();
            reviewsTotal += reviewsSnap.size;
            reviewsLastDoc =
              reviewsSnap.docs[reviewsSnap.docs.length - 1];
            if (reviewsSnap.size < 500) break;
          }
          if (reviewsTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${reviewsTotal} ` +
                `location reviews do usuário ${uid}`
            );
          }
        } catch (reviewsError) {
          // FIX #3897: só falha transitória força retry da limpeza inteira.
          if (isTransientFirestoreError(reviewsError)) {
            anonFailed = true;
            logger.warn(
              "[ACCOUNT_CLEANUP] Erro transitório ao anonimizar location " +
              `reviews para ${uid} (retry via failurePolicy vai tentar ` +
              "de novo):",
              reviewsError
            );
          } else {
            logger.error(
              "[ACCOUNT_CLEANUP] Erro permanente ao anonimizar location " +
              `reviews para ${uid} (não força retry — requer investigação ` +
              "manual):",
              reviewsError
            );
          }
        }

        // FIX #1965: groups — anonymize ownerName + members[].userName (LGPD Art. 18 VI)
        // Owner name and member names are denormalized and retain PII after deletion.
        try {
          let groupsTotal = 0;
          let lastDoc: admin.firestore.DocumentSnapshot | null = null;
          let groupsIterations = 0;
          while (true) {
            if (++groupsIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar grupos " +
                  `para ${uid} — abortando para evitar loop infinito`
              );
              anonFailed = true;
              break;
            }
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
          // FIX #3897: só falha transitória força retry da limpeza inteira.
          if (isTransientFirestoreError(groupsError)) {
            anonFailed = true;
            logger.warn(
              "[ACCOUNT_CLEANUP] Erro transitório ao anonimizar grupos " +
              `para ${uid} (retry via failurePolicy vai tentar de novo):`,
              groupsError
            );
          } else {
            logger.error(
              "[ACCOUNT_CLEANUP] Erro permanente ao anonimizar grupos " +
              `para ${uid} (não força retry — requer investigação manual):`,
              groupsError
            );
          }
        }

        // FIX #1968: activities — anonymize targetUserName + targetUserPhoto (LGPD Art. 18 VI)
        // Activities where the deleted user is referenced as a target (by other users).
        // FIX #2323: paginação por cursor (startAfter) + guarda de iterações.
        // Mesma causa-raiz dos loops acima: o filtro (targetUserId) não muda na
        // anonimização → query sem cursor reprocessava os mesmos 500 docs em
        // loop. SEM orderBy explícito (reusa ordenação por __name__).
        try {
          let targetActivitiesTotal = 0;
          let activitiesLastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          let activitiesIterations = 0;
          while (true) {
            if (++activitiesIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar activities target " +
                  `para ${uid} — abortando para evitar loop infinito`
              );
              anonFailed = true;
              break;
            }
            let activitiesQuery = db
              .collectionGroup("activities")
              .where("targetUserId", "==", uid)
              .limit(500);
            if (activitiesLastDoc) {
              activitiesQuery = activitiesQuery.startAfter(activitiesLastDoc);
            }
            const activitiesSnap = await activitiesQuery.get();
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
            activitiesLastDoc =
              activitiesSnap.docs[activitiesSnap.docs.length - 1];
            if (activitiesSnap.size < 500) break;
          }
          if (targetActivitiesTotal > 0) {
            logger.info(
              `[ACCOUNT_CLEANUP] Anonimizando ${targetActivitiesTotal} ` +
                `activities com target PII do usuário ${uid}`
            );
          }
        } catch (activitiesError) {
          // FIX #3897: só falha transitória força retry da limpeza inteira.
          if (isTransientFirestoreError(activitiesError)) {
            anonFailed = true;
            logger.warn(
              "[ACCOUNT_CLEANUP] Erro transitório ao anonimizar " +
              `activities target para ${uid} (retry via failurePolicy ` +
              "vai tentar de novo):",
              activitiesError
            );
          } else {
            logger.error(
              "[ACCOUNT_CLEANUP] Erro permanente ao anonimizar activities " +
              `target para ${uid} (não força retry — requer investigação ` +
              "manual):",
              activitiesError
            );
          }
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
            } catch (deleteError: unknown) {
              logger.warn(
                `[ACCOUNT_CLEANUP] Erro ao deletar arquivos do prefixo ${prefix}:`,
                deleteError
              );
            }
          }

          // FIX #4049: apaga os objetos de mídia de jogo do usuário usando os
          // storage_paths coletados dos docs game_photos/game_videos (passo 16).
          // O prefixo é literal no getFiles, então não dá para casar
          // `games/*/photos/{uid}/` diretamente — usamos o path canônico do doc.
          for (const mediaPath of mediaStoragePaths) {
            try {
              await bucket.file(mediaPath).delete({ignoreNotFound: true});
              logger.info(
                `[ACCOUNT_CLEANUP] Mídia de jogo deletada: ${mediaPath}`
              );
            } catch (deleteError: unknown) {
              logger.warn(
                `[ACCOUNT_CLEANUP] Erro ao deletar mídia ${mediaPath}:`,
                deleteError
              );
            }
          }
        } catch (storageError) {
          logger.warn(
            "[ACCOUNT_CLEANUP] Erro ao limpar Storage " +
            `para ${uid} (non-fatal):`,
            storageError
          );
        }

        if (anonFailed) {
          throw new Error(
            "[ACCOUNT_CLEANUP] PII anonymization incomplete — forcing retry"
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
