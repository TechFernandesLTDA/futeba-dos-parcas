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
 * - location reviews (user_id) → anonymize user_name + user_photo(_url) (#1963)
 * - groups (owner_id/owner_name; ownerId legado) → anonymize owner name (#1965/#4113)
 * - groups/{id}/members/{uid} (via users/{uid}/groups) → anonymize
 *   user_name + user_photo_url/user_photo (#4113)
 * - groups/{id}/cashbox (player_id, via users/{uid}/groups) → anonymize
 *   player_name do jogador pagador
 * - groups/{id}/monthly_finance_periods/{p}/payers/{uid} (via
 *   users/{uid}/groups) → anonymize user_name + user_photo_url
 * - group_invites (invited_user_id/invitedUserId) → delete;
 *   (invited_by_id) → anonymize invited_by_name (#4113)
 * - statistics/{uid} → delete pelo ID (escritor não grava user_id) (#4113)
 * - activities (user_id) → delete. Não há anonimização do lado "alvo":
 *   nenhum escritor grava targetUserId/targetUserName em activities (a
 *   query de collectionGroup do #1968 era código morto e foi removida).
 *
 * Grupos que o usuário já DEIXOU não aparecem em users/{uid}/groups, então
 * o financeiro (player_name/payers) desses grupos não é alcançado — cobri-los
 * exigiria collectionGroup em cashbox.player_id / payers.user_id com índice.
 *
 * Os nomes de campo vêm de `uid-owned-collections.ts` (lista canônica
 * compartilhada com account-merge.ts, verificada contra os escritores reais).
 * Usuários sem CPF verificado (sem users_private) são no-op silencioso.
 *
 * NOTA: usa firebase-functions/v1 pois v2 ainda não suporta
 * Auth triggers (onDelete). Padrão idêntico ao onUserCreate em
 * user-management.ts.
 */

import {runWith} from "firebase-functions/v1";
import type {EventContext} from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {Storage} from "@google-cloud/storage";
import {
  ANONYMIZED_USER_NAME,
  AUDIT_LOGS,
  CASHBOX,
  GROUP_INVITES,
  GROUP_MEMBERS,
  GROUPS,
  LOCATION_REVIEWS,
  MONTHLY_PAYERS,
  STATISTICS,
  USER_GROUP_LINKS,
  USER_STREAKS,
} from "./uid-owned-collections";

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

        // #4113: deleção paginada por cursor (startAfter) + guarda de
        // iterações. A terminação não depende do dedup/auto-commit do
        // queueDelete (anti-pattern apontado no #4082). Usado pelas coleções
        // incluídas nesta correção.
        const deleteAllByField = async (
          collectionName: string,
          field: string
        ): Promise<number> => {
          let total = 0;
          let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
          let iterations = 0;
          while (true) {
            if (++iterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                `iterações excedido ao paginar ${collectionName} (${field}) ` +
                `para ${uid} — abortando para evitar loop infinito`
              );
              break;
            }
            let query = db
              .collection(collectionName)
              .where(field, "==", uid)
              .limit(500);
            if (lastDoc) query = query.startAfter(lastDoc);
            const snap = await query.get();
            if (snap.empty) break;
            for (const doc of snap.docs) {
              await queueDelete(doc.ref);
              total++;
            }
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.size < 500) break;
          }
          return total;
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
            .collection(AUDIT_LOGS.collection)
            .where(AUDIT_LOGS.targetField, "==", uid)
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
            .collection(AUDIT_LOGS.collection)
            .where(AUDIT_LOGS.actorField, "==", uid)
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

        // 4b'. #4113: demais campos de uid gravados pelos escritores de
        // audit_logs (performed_by, manager_uid, source_user_id) — mesma
        // política de apagamento do #2081 para logs em que o usuário é ator.
        let auditOtherLogsTotal = 0;
        for (const field of AUDIT_LOGS.otherUidFields) {
          auditOtherLogsTotal += await deleteAllByField(
            AUDIT_LOGS.collection,
            field
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

        // 11. FIX #786 + #4113: statistics/{uid}. O escritor das Functions
        // (index.ts onGameFinished) grava o doc pelo ID = uid SEM campo
        // user_id — a query por user_id só alcançava docs do escritor
        // Android legado e o doc canônico sobrevivia à exclusão. Apaga pelo
        // ID e mantém a query como complemento legado.
        let statisticsTotal = 0;
        await queueDelete(db.doc(`${STATISTICS.collection}/${STATISTICS.docId(uid)}`));
        statisticsTotal++;
        while (true) {
          const statisticsSnap = await db
            .collection(STATISTICS.collection)
            .where(STATISTICS.legacyUidField, "==", uid)
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
        // Sem anonimização "alvo" (#1968): nenhum escritor grava targetUserId em activities; autor = user_id acima.
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
        await queueDelete(
          db.doc(`${USER_STREAKS.collection}/${USER_STREAKS.docId(uid)}`)
        );
        // #4113: os leitores localizam o streak por user_id — docs legados
        // com ID ≠ uid sobreviviam. O doc {uid} já enfileirado é deduplicado.
        const userStreaksTotal = 1 + await deleteAllByField(
          USER_STREAKS.collection,
          USER_STREAKS.uidField
        );
        logger.info(
          `[ACCOUNT_CLEANUP] Deletando user_streaks do usuário ${uid}`
        );

        // 15b. #4113: group_invites endereçados ao usuário (invited_user_id;
        // invitedUserId legado). Carregam invited_user_name/photo — o convite
        // é do próprio usuário excluído, então é apagado como os demais
        // registros dele (confirmations, notifications). Paginação por cursor via
        // deleteAllByField.
        let groupInvitesDeletedTotal = 0;
        for (const invitedField of GROUP_INVITES.invitedUserFields) {
          groupInvitesDeletedTotal += await deleteAllByField(
            GROUP_INVITES.collection,
            invitedField
          );
        }
        logger.info(
          `[ACCOUNT_CLEANUP] Deletando ${groupInvitesDeletedTotal} ` +
          `group_invites do usuário ${uid}`
        );

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
        let cashboxTotal = 0;
        try {
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
              .collectionGroup(CASHBOX.collectionGroup)
              .where(CASHBOX.uidField, "==", uid)
              .limit(500);
            if (cashboxLastDoc) {
              cashboxQuery = cashboxQuery.startAfter(cashboxLastDoc);
            }
            const cashboxSnap = await cashboxQuery.get();
            if (cashboxSnap.empty) break;
            const cashboxBatch = db.batch();
            cashboxSnap.forEach((doc) => {
              cashboxBatch.update(doc.ref, {
                [CASHBOX.nameField]: ANONYMIZED_USER_NAME,
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
        let reviewsTotal = 0;
        try {
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
              .collectionGroup(LOCATION_REVIEWS.collectionGroup)
              .where(LOCATION_REVIEWS.uidField, "==", uid)
              .limit(500);
            if (reviewsLastDoc) {
              reviewsQuery = reviewsQuery.startAfter(reviewsLastDoc);
            }
            const reviewsSnap = await reviewsQuery.get();
            if (reviewsSnap.empty) break;
            const reviewsBatch = db.batch();
            reviewsSnap.forEach((doc) => {
              // #4113: o web grava `user_photo`, o KMP `user_photo_url` —
              // a foto também é PII e ficava para trás.
              reviewsBatch.update(doc.ref, {
                [LOCATION_REVIEWS.nameField]: ANONYMIZED_USER_NAME,
                ...Object.fromEntries(
                  LOCATION_REVIEWS.photoFields.map((field) => [field, null])
                ),
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

        // FIX #1965 + #4113: groups — anonymize owner name (LGPD Art. 18 VI)
        // #4113: o bloco original lia `ownerId`/`ownerName` e `members[]` de
        // objetos — formas que NENHUM escritor grava (useGroups.ts:402-406 e
        // GroupRepository.kt:1014 gravam `owner_id`/`owner_name` e `members`
        // como array de STRINGS). Era código morto: o trigger reportava
        // sucesso e o nome do dono ficava gravado. Agora consulta pelo campo
        // real (query filtrada em vez de varrer a coleção inteira) e mantém
        // a forma camel só como defesa legada. O array `members` não carrega
        // PII e não é tocado; a PII de membro mora na subcoleção (bloco
        // seguinte).
        let groupsTotal = 0;
        try {
          for (const ownerField of GROUPS.ownerIdFields) {
            const ownerNameField = GROUPS.ownerNameByIdField[ownerField];
            let lastDoc: admin.firestore.DocumentSnapshot | null = null;
            let groupsIterations = 0;
            while (true) {
              if (++groupsIterations > MAX_ANON_ITERATIONS) {
                logger.error(
                  `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                    `iterações excedido ao anonimizar grupos (${ownerField}) ` +
                    `para ${uid} — abortando para evitar loop infinito`
                );
                anonFailed = true;
                break;
              }
              let query = db
                .collection(GROUPS.collection)
                .where(ownerField, "==", uid)
                .limit(500);
              if (lastDoc) query = query.startAfter(lastDoc);
              const groupsSnap = await query.get();
              if (groupsSnap.empty) break;
              const groupsBatch = db.batch();
              let batchOps = 0;
              for (const doc of groupsSnap.docs) {
                const data = doc.data() ?? {};
                if (data[ownerField] !== uid) continue;
                if (
                  !data[ownerNameField] ||
                  data[ownerNameField] === ANONYMIZED_USER_NAME
                ) continue;
                groupsBatch.update(doc.ref, {
                  [ownerNameField]: ANONYMIZED_USER_NAME,
                });
                batchOps++;
                groupsTotal++;
              }
              if (batchOps > 0) {
                await groupsBatch.commit();
              }
              lastDoc = groupsSnap.docs[groupsSnap.docs.length - 1];
              if (groupsSnap.size < 500) break;
            }
          }
          logger.info(
            `[ACCOUNT_CLEANUP] Anonimizando ${groupsTotal} ` +
              `grupos com owner_name do usuário ${uid}`
          );
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

        // Financeiro do grupo — PII do jogador PAGADOR (LGPD Art. 18 VI):
        // - groups/{g}/cashbox: `player_name` onde `player_id == uid`
        //   (cashbox/callable.ts:430-431);
        // - groups/{g}/monthly_finance_periods/{p}/payers/{uid}: `user_name`
        //   + `user_photo_url` (cashbox/monthly.ts:1286-1296).
        // Diferente de `created_by` (collectionGroup acima, com fieldOverride),
        // `player_id`/payers não têm índice de collectionGroup — um
        // collectionGroup aqui falharia com FAILED_PRECONDITION. Por isso a
        // varredura é grupo a grupo, em escopo COLLECTION (índice single-field
        // automático; sem orderBy explícito, ordena por __name__), a partir do
        // espelho users/{uid}/groups, DENTRO do laço de membros abaixo e ANTES
        // de apagar o link: se a etapa falhar, o link fica e o retry
        // (failurePolicy) reencontra o grupo.
        // LIMITAÇÃO: grupos que o usuário já DEIXOU não estão em
        // users/{uid}/groups, então o player_name/payers desses grupos não é
        // alcançado. Cobri-los exigiria collectionGroup em cashbox.player_id e
        // payers.user_id com fieldOverride novo (fora deste fix).
        let cashboxPlayerTotal = 0;
        let monthlyPayersTotal = 0;

        // Anonimiza `player_name` nas entradas de caixa do grupo em que o
        // usuário é o pagador. Cursor obrigatório: o filtro (player_id) não
        // muda na anonimização (#2323). Retorna false se a guarda estourar.
        const anonymizeCashboxPlayer = async (
          groupId: string
        ): Promise<boolean> => {
          let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
          let iterations = 0;
          while (true) {
            if (++iterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar cashbox (player_id) do " +
                  `grupo ${groupId} para ${uid} — abortando para evitar loop infinito`
              );
              return false;
            }
            let query = db
              .collection(CASHBOX.path(groupId))
              .where(CASHBOX.playerIdField, "==", uid)
              .limit(500);
            if (lastDoc) query = query.startAfter(lastDoc);
            const snap = await query.get();
            if (snap.empty) return true;
            const playerBatch = db.batch();
            let ops = 0;
            for (const doc of snap.docs) {
              const playerName = (doc.data() ?? {})[CASHBOX.playerNameField];
              // A baixa mensal (monthly.ts:1831) grava player_id sem nome:
              // não cria o campo. Já anonimizado: não reescreve no retry.
              if (!playerName || playerName === ANONYMIZED_USER_NAME) continue;
              playerBatch.update(doc.ref, {
                [CASHBOX.playerNameField]: ANONYMIZED_USER_NAME,
              });
              ops++;
            }
            if (ops > 0) {
              await playerBatch.commit();
              cashboxPlayerTotal += ops;
            }
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.size < 500) return true;
          }
        };

        // Anonimiza o doc de pagador do usuário em cada período mensal do
        // grupo: lista os períodos (sem filtro, paginado por cursor) e lê
        // payers/{uid} pelo ID — update() só se existir (em doc inexistente
        // derrubaria o batch). Retorna false se a guarda estourar.
        const anonymizeMonthlyPayer = async (
          groupId: string
        ): Promise<boolean> => {
          let lastPeriod: admin.firestore.QueryDocumentSnapshot | null = null;
          let iterations = 0;
          while (true) {
            if (++iterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar payers mensais do " +
                  `grupo ${groupId} para ${uid} — abortando para evitar loop infinito`
              );
              return false;
            }
            let query = db
              .collection(MONTHLY_PAYERS.periodsPath(groupId))
              .limit(500);
            if (lastPeriod) query = query.startAfter(lastPeriod);
            const periodsSnap = await query.get();
            if (periodsSnap.empty) return true;
            const payerRefs = periodsSnap.docs.map((period) =>
              db.doc(MONTHLY_PAYERS.path(groupId, period.id, uid)));
            const payerSnaps = await Promise.all(
              payerRefs.map((payerRef) => payerRef.get())
            );
            const payersBatch = db.batch();
            let ops = 0;
            payerSnaps.forEach((payerSnap, index) => {
              if (!payerSnap.exists) return;
              const data = payerSnap.data() ?? {};
              const alreadyAnonymized =
                data[MONTHLY_PAYERS.nameField] === ANONYMIZED_USER_NAME &&
                MONTHLY_PAYERS.photoFields.every(
                  (field) => (data[field] ?? null) === null
                );
              if (alreadyAnonymized) return;
              payersBatch.update(payerRefs[index], {
                [MONTHLY_PAYERS.nameField]: ANONYMIZED_USER_NAME,
                ...Object.fromEntries(
                  MONTHLY_PAYERS.photoFields.map((field) => [field, null])
                ),
              });
              ops++;
            });
            if (ops > 0) {
              await payersBatch.commit();
              monthlyPayersTotal += ops;
            }
            lastPeriod = periodsSnap.docs[periodsSnap.docs.length - 1];
            if (periodsSnap.size < 500) return true;
          }
        };

        // Isola a falha de uma etapa financeira de um grupo: erro num grupo
        // não interrompe membros nem os demais grupos. Retorna true só se a
        // etapa terminou — qualquer falha mantém o link do grupo (único
        // ponteiro para ele no retry automático ou numa reexecução manual).
        const runGroupFinanceStep = async (
          label: string,
          groupId: string,
          step: (groupId: string) => Promise<boolean>
        ): Promise<boolean> => {
          try {
            const complete = await step(groupId);
            if (!complete) anonFailed = true;
            return complete;
          } catch (financeError) {
            // FIX #3897: só falha transitória força retry da limpeza inteira.
            if (isTransientFirestoreError(financeError)) {
              anonFailed = true;
              logger.warn(
                `[ACCOUNT_CLEANUP] Erro transitório ao anonimizar ${label} ` +
                `do grupo ${groupId} para ${uid} (retry via failurePolicy ` +
                "vai tentar de novo):",
                financeError
              );
            } else {
              logger.error(
                `[ACCOUNT_CLEANUP] Erro permanente ao anonimizar ${label} ` +
                `do grupo ${groupId} para ${uid} (não força retry — requer ` +
                "investigação manual):",
                financeError
              );
            }
            return false;
          }
        };

        // #4113: groups/{id}/members/{uid} — fonte canônica de membership
        // (rules autorizam por ela) e onde a PII real de membro mora:
        // `user_name` + `user_photo_url` (web) / `user_photo` (KMP). Nunca
        // era lida. Descobrimos os grupos pelo espelho users/{uid}/groups
        // (gravado por web/KMP em toda entrada de grupo): custa N leituras
        // diretas por ID, sem query collectionGroup em members.user_id. O doc
        // de membro é ANONIMIZADO, não apagado, para não disparar
        // onMemberLeft/member_count. O link órfão sob o users/{uid} já
        // apagado é removido no mesmo batch — só depois de o financeiro do
        // grupo (bloco acima) ter sido anonimizado por completo.
        // Cada link gera até 2 ops (update do membro + delete do link): a
        // página de 200 mantém o batch em <= 400 ops, abaixo do teto de 500.
        const GROUP_LINK_PAGE_SIZE = 200;
        let groupMembersTotal = 0;
        let groupLinksTotal = 0;
        let groupLinksKeptTotal = 0;
        try {
          let linkLastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          let linkIterations = 0;
          while (true) {
            if (++linkIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar membros de grupo " +
                  `para ${uid} — abortando para evitar loop infinito`
              );
              anonFailed = true;
              break;
            }
            let linkQuery = db
              .collection(USER_GROUP_LINKS.path(uid))
              .limit(GROUP_LINK_PAGE_SIZE);
            if (linkLastDoc) linkQuery = linkQuery.startAfter(linkLastDoc);
            const linkSnap = await linkQuery.get();
            if (linkSnap.empty) break;
            const membersBatch = db.batch();
            let batchOps = 0;
            for (const link of linkSnap.docs) {
              const groupId = link.id;
              // Financeiro ANTES de apagar o link: o link é o que permite ao
              // retry reencontrar o grupo.
              const cashboxDone = await runGroupFinanceStep(
                "cashbox (player_id)",
                groupId,
                anonymizeCashboxPlayer
              );
              const payersDone = await runGroupFinanceStep(
                "payers mensais",
                groupId,
                anonymizeMonthlyPayer
              );
              const memberRef = db.doc(GROUP_MEMBERS.path(groupId, uid));
              // Leitura direta: update() em doc inexistente derrubaria o
              // batch inteiro, e set({merge}) criaria um membro fantasma.
              const memberSnap = await memberRef.get();
              if (memberSnap.exists) {
                membersBatch.update(memberRef, {
                  [GROUP_MEMBERS.nameField]: ANONYMIZED_USER_NAME,
                  ...Object.fromEntries(
                    GROUP_MEMBERS.photoFields.map((field) => [field, null])
                  ),
                });
                batchOps++;
                groupMembersTotal++;
              }
              if (cashboxDone && payersDone) {
                membersBatch.delete(link.ref);
                batchOps++;
                groupLinksTotal++;
              } else {
                groupLinksKeptTotal++;
              }
            }
            if (batchOps > 0) {
              await membersBatch.commit();
            }
            linkLastDoc = linkSnap.docs[linkSnap.docs.length - 1];
            if (linkSnap.size < GROUP_LINK_PAGE_SIZE) break;
          }
          logger.info(
            `[ACCOUNT_CLEANUP] Anonimizando ${groupMembersTotal} ` +
              `groups/*/members/${uid}, ${cashboxPlayerTotal} cashbox ` +
              `(player_name) e ${monthlyPayersTotal} payers mensais; ` +
              `removendo ${groupLinksTotal} links users/${uid}/groups ` +
              `(${groupLinksKeptTotal} mantidos para retry)`
          );
        } catch (membersError) {
          // FIX #3897: só falha transitória força retry da limpeza inteira.
          if (isTransientFirestoreError(membersError)) {
            anonFailed = true;
            logger.warn(
              "[ACCOUNT_CLEANUP] Erro transitório ao anonimizar membros de " +
              `grupo para ${uid} (retry via failurePolicy vai tentar de novo):`,
              membersError
            );
          } else {
            logger.error(
              "[ACCOUNT_CLEANUP] Erro permanente ao anonimizar membros de " +
              `grupo para ${uid} (não força retry — requer investigação manual):`,
              membersError
            );
          }
        }

        // #4113: group_invites enviados PELO usuário (invited_by_id). O doc
        // pertence ao fluxo do convidado — só o nome de quem convidou
        // (invited_by_name) é anonimizado. Cursor obrigatório: o filtro
        // (invited_by_id) não muda na anonimização (#2323).
        let groupInvitesAnonymizedTotal = 0;
        try {
          let inviterLastDoc:
            admin.firestore.QueryDocumentSnapshot | null = null;
          let inviterIterations = 0;
          while (true) {
            if (++inviterIterations > MAX_ANON_ITERATIONS) {
              logger.error(
                `[ACCOUNT_CLEANUP] Limite de ${MAX_ANON_ITERATIONS} ` +
                  "iterações excedido ao anonimizar group_invites " +
                  `(invited_by_id) para ${uid} — abortando para evitar loop infinito`
              );
              anonFailed = true;
              break;
            }
            let inviterQuery = db
              .collection(GROUP_INVITES.collection)
              .where(GROUP_INVITES.inviterField, "==", uid)
              .limit(500);
            if (inviterLastDoc) {
              inviterQuery = inviterQuery.startAfter(inviterLastDoc);
            }
            const inviterSnap = await inviterQuery.get();
            if (inviterSnap.empty) break;
            const inviterBatch = db.batch();
            inviterSnap.forEach((doc) => {
              inviterBatch.update(doc.ref, {
                [GROUP_INVITES.inviterNameField]: ANONYMIZED_USER_NAME,
              });
            });
            await inviterBatch.commit();
            groupInvitesAnonymizedTotal += inviterSnap.size;
            inviterLastDoc = inviterSnap.docs[inviterSnap.docs.length - 1];
            if (inviterSnap.size < 500) break;
          }
          logger.info(
            `[ACCOUNT_CLEANUP] Anonimizando ${groupInvitesAnonymizedTotal} ` +
              `group_invites enviados pelo usuário ${uid}`
          );
        } catch (inviterError) {
          // FIX #3897: só falha transitória força retry da limpeza inteira.
          if (isTransientFirestoreError(inviterError)) {
            anonFailed = true;
            logger.warn(
              "[ACCOUNT_CLEANUP] Erro transitório ao anonimizar group_invites " +
              `para ${uid} (retry via failurePolicy vai tentar de novo):`,
              inviterError
            );
          } else {
            logger.error(
              "[ACCOUNT_CLEANUP] Erro permanente ao anonimizar group_invites " +
              `para ${uid} (não força retry — requer investigação manual):`,
              inviterError
            );
          }
        }

        // #4113: observabilidade — contagem por coleção, sempre logada
        // (inclusive zeros). Zero numa coleção em que o usuário tinha
        // atividade é o sinal do "campo errado ⇒ query vazia" (#3877/#4113)
        // e deve virar alerta, não silêncio.
        logger.info(
          `[ACCOUNT_CLEANUP] Cleanup completo para usuário ${uid}`,
          {
            uid,
            counts: {
              audit_logs_target: auditLogsTotal,
              audit_logs_actor: auditActorLogsTotal,
              audit_logs_other: auditOtherLogsTotal,
              rate_limits: rateLimitsTotal,
              verification_failures: verifyFailTotal,
              notifications: notificationsTotal,
              confirmations: confirmationsTotal,
              mvp_votes: mvpVotesTotal,
              xp_logs: xpLogsTotal,
              statistics: statisticsTotal,
              season_participation: seasonPartTotal,
              activities: activitiesTotal,
              user_badges: userBadgesTotal,
              user_streaks: userStreaksTotal,
              group_invites_deleted: groupInvitesDeletedTotal,
              game_media: gameMediaTotal,
              cashbox_anonymized: cashboxTotal,
              location_reviews_anonymized: reviewsTotal,
              groups_owner_anonymized: groupsTotal,
              group_members_anonymized: groupMembersTotal,
              cashbox_player_anonymized: cashboxPlayerTotal,
              monthly_payers_anonymized: monthlyPayersTotal,
              user_group_links_deleted: groupLinksTotal,
              user_group_links_kept: groupLinksKeptTotal,
              group_invites_anonymized: groupInvitesAnonymizedTotal,
            },
            anonFailed,
          }
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
