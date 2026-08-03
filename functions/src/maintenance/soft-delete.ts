/**
 * SOFT DELETE - CLOUD FUNCTIONS - P2 #40
 *
 * Funções callable e scheduled para
 * gerenciamento de soft-delete.
 *
 * CALLABLE FUNCTIONS:
 * - softDeleteGame: Marca jogo como soft-deleted
 * - softDeleteGroup: Marca grupo e seus jogos
 * - restoreDeletedGame: Restaura jogo
 * - restoreDeletedGroup: Restaura grupo
 *
 * SCHEDULED FUNCTIONS:
 * - cleanupAllSoftDeleted: Cleanup unificado
 *   semanal (sáb 02:00 BRT)
 *
 * @see specs/P2_40_SOFT_DELETE_PATTERN.md
 * @see functions/src/utils/soft-delete-helper.ts
 */

import {logger} from "firebase-functions";
import * as functions from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {
  softDeleteGameCascade,
  restoreSoftDeleted,
  softDeleteGroupCascade,
  cleanupSoftDeleted,
} from "../utils/soft-delete-helper.js";
import {
  checkRateLimit,
} from "../middleware/rate-limiter.js";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";
import {
  acquireSchedulerLock,
  releaseSchedulerLock,
  startSchedulerHeartbeat,
  schedulerLockTtlForTimeout,
  schedulerHeartbeatIntervalForTtl,
} from "../utils/scheduler-lock";


/** Dias de retenção antes de deletar */
const RETENTION_DAYS = 30;

// ==========================================
// CALLABLE: Soft Delete Game
// ==========================================

interface SoftDeleteGameData {
  gameId: string;
  reason?: string;
}

/**
 * Marca um jogo como soft-deleted.
 * Apenas o dono do jogo pode deletar.
 * Não permite deletar jogos em progresso
 * (LIVE) ou finalizados (FINISHED).
 *
 * @param {functions.https.CallableRequest}
 *   request - Requisição callable
 * @return {Promise<Record<string, unknown>>}
 *   Resultado da operação
 */
export const softDeleteGame =
  functions.https.onCall<SoftDeleteGameData>({
    region: "southamerica-east1",
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {gameId, reason} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    // Rate Limiting: 5 deleções/min por usuário
    // Admin bypass rate limit (não aplicável a admins)
    const isAdmin = request.auth?.token?.role === "ADMIN";
    if (!isAdmin) {
      const {allowed: rlAllowed} = await checkRateLimit(userId, {
        maxRequests: 5,
        windowMs: 60 * 1000,
        keyPrefix: "soft_delete_game",
      });
      if (!rlAllowed) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          ERROR_MSGS.RATE_LIMIT_GENERIC
        );
      }
    }

    if (!gameId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "gameId é obrigatório"
      );
    }

    try {
      const gameDoc = await db()
        .collection("games")
        .doc(gameId)
        .get();

      if (!gameDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Jogo não encontrado"
        );
      }

      const gameData = gameDoc.data();

      // Verificar proprietário ou admin
      if (!isAdmin && gameData?.owner_id !== userId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas o dono do jogo ou ADMIN pode deletar"
        );
      }

      // Verificar se já está deletado (idempotência)
      if (gameData?.deleted_at) {
        return {
          success: true,
          gameId,
          message: "Jogo já estava deletado",
          alreadyDeleted: true,
        };
      }

      // Não permitir deletar jogos em progresso
      if (gameData?.status === "LIVE") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Não é possível deletar jogo em andamento"
        );
      }

      // Deleta o jogo e seus dados operacionais associados em cascata.
      const result = await softDeleteGameCascade(
        gameId, userId, reason || ""
      );

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Erro ao deletar"
        );
      }

      logger.info(
        `[SOFT_DELETE] Game ${gameId} ` +
        `soft-deleted por ${userId}`
      );

      await db().collection("audit_logs").add({
        action: "SOFT_DELETE_GAME",
        target_id: gameId,
        performed_by: userId,
        performed_at: FieldValue.serverTimestamp(),
        reason: reason || null,
        previous_status: gameData?.status || null,
      });

      return {
        success: true,
        gameId,
        deletedAt: result.deletedAt.toISOString(),
      };
    } catch (error: unknown) {
      if (
        error instanceof
          functions.https.HttpsError
      ) {
        throw error;
      }
      logger.error(
        "[SOFT_DELETE] Erro ao soft-delete " +
        `game ${gameId}:`, error
      );
      throw new functions.https.HttpsError(
        "internal",
        "Erro ao deletar jogo"
      );
    }
  });

// ==========================================
// CALLABLE: Soft Delete Group (NOVO - P2 #40)
// ==========================================

interface SoftDeleteGroupData {
  groupId: string;
  reason?: string;
}

/**
 * Marca um grupo e seus jogos como soft-deleted
 * (cascade). Apenas admin/owner do grupo pode
 * deletar.
 *
 * A cascade soft-delete marca:
 * 1. O grupo com deleted_at
 * 2. Todos os jogos ativos do grupo
 *
 * Os dados são preservados por 30 dias.
 *
 * @param {functions.https.CallableRequest}
 *   request - Requisição callable
 * @return {Promise<Record<string, unknown>>}
 *   Resultado da operação
 */
export const softDeleteGroup =
  functions.https.onCall<SoftDeleteGroupData>({
    region: "southamerica-east1",
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {groupId, reason} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    // Rate Limiting: 3 deleções de grupo/min
    // Admin bypass rate limit (paridade com softDeleteGame)
    const isAdmin = request.auth?.token?.role === "ADMIN";
    if (!isAdmin) {
      const {allowed: rlAllowed} = await checkRateLimit(userId, {
        maxRequests: 3,
        windowMs: 60 * 1000,
        keyPrefix: "soft_delete_group",
      });
      if (!rlAllowed) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          ERROR_MSGS.RATE_LIMIT_GENERIC
        );
      }
    }

    if (!groupId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "groupId é obrigatório"
      );
    }

    try {
      // Verificar permissão (admin ou owner)
      const groupDoc = await db()
        .collection("groups")
        .doc(groupId)
        .get();

      if (!groupDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Grupo não encontrado"
        );
      }

      const groupData = groupDoc.data();

      // Verificar se já deletado
      if (groupData?.deleted_at) {
        return {
          success: true,
          groupId,
          message: "Grupo já estava deletado",
          alreadyDeleted: true,
        };
      }

      // Verificar se é owner do grupo
      const memberDoc = await db()
        .collection("groups")
        .doc(groupId)
        .collection("members")
        .doc(userId)
        .get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Você não é membro deste grupo"
        );
      }

      const memberRole =
        memberDoc.data()?.role;
      if (
        memberRole !== "OWNER" &&
        memberRole !== "ADMIN"
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas owner ou admin pode deletar"
        );
      }

      // Executar soft-delete cascade
      const result =
        await softDeleteGroupCascade(
          groupId, userId, reason || ""
        );

      if (!result.groupDeleted) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Erro ao deletar grupo"
        );
      }

      logger.info(
        `[SOFT_DELETE] Grupo ${groupId} ` +
        `soft-deleted por ${userId}: ` +
        `${result.gamesDeleted} jogos afetados`
      );

      await db().collection("audit_logs").add({
        action: "SOFT_DELETE_GROUP",
        target_id: groupId,
        performed_by: userId,
        performed_at: FieldValue.serverTimestamp(),
        reason: reason || null,
        games_affected: result.gamesDeleted,
      });

      return {
        success: true,
        groupId,
        gamesAffected: result.gamesDeleted,
        message:
          `Grupo e ${result.gamesDeleted} ` +
          "jogos marcados para deleção",
      };
    } catch (error: unknown) {
      if (
        error instanceof
          functions.https.HttpsError
      ) {
        throw error;
      }
      logger.error(
        "[SOFT_DELETE] Erro ao soft-delete " +
        `grupo ${groupId}:`, error
      );
      throw new functions.https.HttpsError(
        "internal",
        "Erro ao deletar grupo"
      );
    }
  });

// ==========================================
// CALLABLE: Restore Deleted Game (P2 #40)
// ==========================================

interface RestoreDeletedGameData {
  gameId: string;
}

/**
 * Restaura um jogo soft-deleted.
 * Apenas o usuário que deletou ou admin pode
 * restaurar.
 *
 * @param {functions.https.CallableRequest}
 *   request - Requisição callable
 * @return {Promise<Record<string, unknown>>}
 *   Resultado da operação
 */
export const restoreDeletedGame =
  functions.https.onCall<RestoreDeletedGameData>({
    region: "southamerica-east1",
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {gameId} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    // Rate Limiting: 5 restaurações/min
    const rlRestoreGame = await checkRateLimit(
      userId, {
        maxRequests: 5,
        windowMs: 60 * 1000,
        keyPrefix: "restore_game",
      }
    );
    if (!rlRestoreGame.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        ERROR_MSGS.RATE_LIMIT_GENERIC
      );
    }

    if (!gameId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "gameId é obrigatório"
      );
    }

    try {
      const gameDoc = await db()
        .collection("games")
        .doc(gameId)
        .get();

      if (!gameDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Jogo não encontrado"
        );
      }

      const gameData = gameDoc.data();

      // Verificar se está deletado
      if (!gameData?.deleted_at) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Jogo não está deletado"
        );
      }

      // Verificar permissão
      // FIX #792: admin bypass — paridade com restoreDeletedGroup (linha ~555)
      const isAdmin =
        request.auth?.token?.role === "ADMIN";
      if (
        !isAdmin &&
        gameData.deleted_by !== userId &&
        gameData.owner_id !== userId
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas quem deletou, o dono ou ADMIN " +
          "pode restaurar"
        );
      }

      const result = await restoreSoftDeleted(
        "games", gameId, userId, {
          restoreStatus: "SCHEDULED",
        }
      );

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Erro ao restaurar"
        );
      }

      logger.info(
        `[SOFT_DELETE] Jogo ${gameId} ` +
        `restaurado por ${userId}`
      );

      return {
        success: true,
        gameId,
        message: "Jogo restaurado com sucesso",
      };
    } catch (error: unknown) {
      if (
        error instanceof
          functions.https.HttpsError
      ) {
        throw error;
      }
      logger.error(
        "[SOFT_DELETE] Erro ao restaurar " +
        `jogo ${gameId}:`, error
      );
      throw new functions.https.HttpsError(
        "internal",
        "Erro ao restaurar jogo"
      );
    }
  });

// ==========================================
// CALLABLE: Restore Deleted Group (P2 #40)
// ==========================================

interface RestoreDeletedGroupData {
  groupId: string;
}

/**
 * Restaura um grupo soft-deleted.
 * Apenas quem deletou, o dono ou admin pode
 * restaurar.
 * Nota: Jogos do grupo NÃO são restaurados
 * automaticamente.
 *
 * @param {functions.https.CallableRequest}
 *   request - Requisição callable
 * @return {Promise<Record<string, unknown>>}
 *   Resultado da operação
 */
export const restoreDeletedGroup =
  functions.https.onCall<RestoreDeletedGroupData>({
    region: "southamerica-east1",
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {groupId} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    // Rate Limiting: 3 restaurações de grupo/min
    const rlRestoreGroup = await checkRateLimit(
      userId, {
        maxRequests: 3,
        windowMs: 60 * 1000,
        keyPrefix: "restore_group",
      }
    );
    if (!rlRestoreGroup.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        ERROR_MSGS.RATE_LIMIT_GENERIC
      );
    }

    if (!groupId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "groupId é obrigatório"
      );
    }

    try {
      const groupDoc = await db()
        .collection("groups")
        .doc(groupId)
        .get();

      if (!groupDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Grupo não encontrado"
        );
      }

      const groupData = groupDoc.data();

      if (!groupData?.deleted_at) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Grupo não está deletado"
        );
      }

      // Verificar permissão
      // Paridade com restoreDeletedGame: owner_id também pode restaurar
      const isAdmin =
        request.auth?.token?.role === "ADMIN";
      if (
        !isAdmin &&
        groupData.deleted_by !== userId &&
        groupData.owner_id !== userId
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas quem deletou, o dono ou admin " +
          "pode restaurar"
        );
      }

      const result = await restoreSoftDeleted(
        "groups", groupId, userId, {
          restoreStatus: "ACTIVE",
        }
      );

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Erro ao restaurar"
        );
      }

      logger.info(
        `[SOFT_DELETE] Grupo ${groupId} ` +
        `restaurado por ${userId}`
      );

      return {
        success: true,
        groupId,
        message:
          "Grupo restaurado com sucesso. " +
          "Jogos podem precisar ser " +
          "restaurados individualmente.",
      };
    } catch (error: unknown) {
      if (
        error instanceof
          functions.https.HttpsError
      ) {
        throw error;
      }
      logger.error(
        "[SOFT_DELETE] Erro ao restaurar " +
        `grupo ${groupId}:`, error
      );
      throw new functions.https.HttpsError(
        "internal",
        "Erro ao restaurar grupo"
      );
    }
  });

// ==========================================
// SCHEDULED: Cleanup Unificado (30 dias)
// ==========================================

/**
 * Cleanup unificado de documentos soft-deleted
 * (30 dias).
 *
 * Executa semanalmente (sábado às 02:00 BRT).
 * Remove permanentemente documentos das
 * coleções: games, groups, locations.
 *
 * Usa o helper reutilizável
 * cleanupSoftDeleted() para cada coleção.
 * Registra métricas no Firestore.
 *
 * @see utils/soft-delete-helper.ts
 */
export const cleanupAllSoftDeleted =
  functions.scheduler.onSchedule({
    schedule: "0 2 * * 6", // Sábado às 02:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
    // Issue #3967: retryCount combinado com TTL/heartbeat. Antes o
    // FIX #1040 (re-throw p/ acionar retry) era letra morta aqui:
    // sem retryCount, uma falha custava uma SEMANA inteira sem
    // hard-delete (PII retido em subcoleções — #2481/#2529). Sozinho o
    // retryCount não resolveria: sem TTL >= timeout (Defeito B do
    // #3974) toda retry caía no lock e era pulada. Agora o TTL é
    // derivado do timeoutSeconds via schedulerLockTtlForTimeout()
    // (>= timeout × 2), permitindo takeover só em morte dura real.
    retryCount: 3,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    const lockId = "cleanup_all_soft_deleted";
    // Issue #3974 Defeito B: TTL derivado do timeoutSeconds (540s). O
    // #3967 tinha fixado o TTL global em 45s — 12× menor que o timeout
    // de 540s deste job — fazendo o lock expirar no meio da execução
    // normal e uma retry tomar o lock enquanto o holder original ainda
    // gravava. TTL = 1080s (> timeout × SCHEDULER_LOCK_TTL_SAFETY_FACTOR)
    // só expira se o holder morrer de forma dura por mais que o dobro
    // do timeout.
    const lockTtlMs = schedulerLockTtlForTimeout(540);
    const lockAcquired = await acquireSchedulerLock(
      lockId,
      lockTtlMs
    );
    if (!lockAcquired) {
      logger.warn(
        "[SOFT_DELETE_CLEANUP] Execucao concorrente detectada; pulando"
      );
      return;
    }

    // Issue #3974 Defeito A: intervalo derivado do TTL e caller checa
    // heartbeat.isLost() no loop de coleções — antes o retorno boolean
    // do heartbeat era descartado, permitindo writes após perder o lock.
    const heartbeat = startSchedulerHeartbeat(
      lockId,
      lockAcquired,
      schedulerHeartbeatIntervalForTtl(lockTtlMs)
    );

    let lockStatus: "completed" | "failed" = "failed";

    // FIX #1040: try/catch externo para re-throw — aciona retry do Cloud Scheduler.
    // Sem isso, erros eram swallowed e documentos expirados ficavam acumulados.
    try {
      logger.info(
        "[SOFT_DELETE_CLEANUP] Iniciando " +
      "cleanup unificado (TTL: " +
      `${RETENTION_DAYS} dias)`
      );

      const startTime = Date.now();

    interface CleanupResult {
      collection: string;
      totalDeleted: number;
      batchCount: number;
      maxBatches: number;
      truncated: boolean;
    }

    const results: CleanupResult[] = [];

    // Limpar cada coleção usando helper
    // FIX #2481 (LGPD): recursive=true para coleções com subcoleções, senão
    // batch.delete deixa subcoleções órfãs (groups/members,
    // groups/league_standings, locations/reviews) retendo PII após hard-delete.
    const collections = [
      {name: "games", batchSize: 100, max: 10, recursive: true},
      {name: "groups", batchSize: 100, max: 10, recursive: true},
      {name: "locations", batchSize: 500, max: 20, recursive: true},
    ];

    for (const col of collections) {
      // Issue #3974 Defeito A: aborta se o lock foi tomado por outra
      // instância (execução overrunning o TTL + retry entrou, ou
      // takeover stale). Não re-throw: o novo owner já está rodando,
      // uma retry extra só competiria com ele. Hard-deletes são
      // idempotentes, mas parar cedo evita métricas/alertas duplicados.
      if (heartbeat.isLost()) {
        logger.error(
          "[SOFT_DELETE_CLEANUP] Scheduler lock perdido durante execucao; " +
          "abortando colecoes restantes para evitar writes conflitantes"
        );
        return;
      }

      logger.info(
        "[SOFT_DELETE_CLEANUP] Processando: " +
        col.name
      );

      const result = await cleanupSoftDeleted(
        col.name,
        RETENTION_DAYS,
        col.max,
        col.batchSize,
        col.recursive
      );

      results.push(result);
    }

    const totalDuration = Date.now() - startTime;
    const totalDeleted = results.reduce(
      (sum, r) => sum + r.totalDeleted, 0
    );

    // Issue #3969: coleções truncadas (teto atingido com backlog restante).
    // Cada item aqui representa documentos além do TTL de retenção que vão
    // permanecer carregando PII (LGPD) até a próxima execução semanal.
    const truncatedCollections = results
      .filter((r) => r.truncated)
      .map((r) => r.collection);

    // Registrar métricas — agora com sinal explícito de saturação por coleção.
    await db().collection("metrics").add({
      type: "soft_delete_cleanup_unified",
      timestamp:
        FieldValue
          .serverTimestamp(),
      retention_days: RETENTION_DAYS,
      total_deleted: totalDeleted,
      duration_ms: totalDuration,
      // `true` quando QUALQUER coleção saiu pelo teto. Sinal de baixa
      // cardinalidade para alertas/dashboard (issue #3969).
      truncated: truncatedCollections.length > 0,
      truncated_collections: truncatedCollections,
      results: results.map((r) => ({
        collection: r.collection,
        deleted: r.totalDeleted,
        batches: r.batchCount,
        max_batches: r.maxBatches,
        truncated: r.truncated,
      })),
    });

    // Saturação é um problema LGPD: documentos expirados permanecem. O job é
    // SEMANAL, então uma execução truncada atrasa a deleção em 7 dias inteiros.
    // Emitimos um alerta persistente (alerts/) para que nunca passe em silêncio.
    if (truncatedCollections.length > 0) {
      logger.warn(
        "[SOFT_DELETE_CLEANUP] SATURACAO DETECTADA: " +
        "colecoes " +
        `${truncatedCollections.join(", ")} ` +
        "atingiram o teto de batches e mantem backlog. " +
        "Documentos soft-deleted alem do TTL de retencao " +
        "permanecerao ate a proxima execucao semanal (risco LGPD)."
      );

      await db().collection("alerts").add({
        type: "SOFT_DELETE_CLEANUP_TRUNCATED",
        // WARNING (não CRITICAL): o sistema é projetado para drenar em
        // múltiplas semanas, mas LGPD exige visibilidade do atraso.
        severity: "WARNING",
        title: "Soft-delete cleanup saturado (backlog LGPD)",
        message:
          `${truncatedCollections.length} colecao(oes) ` +
          `(${truncatedCollections.join(", ")}) ` +
          "atingiram o teto de batches na varredura semanal " +
          "e mantem backlog. Documentos alem do TTL de retencao " +
          "permanecerao ate a proxima execucao. " +
          `Total removido nesta run: ${totalDeleted}.`,
        metadata: {
          collections: truncatedCollections,
          total_deleted: totalDeleted,
          retention_days: RETENTION_DAYS,
          results: results.map((r) => ({
            collection: r.collection,
            deleted: r.totalDeleted,
            batches: r.batchCount,
            max_batches: r.maxBatches,
            truncated: r.truncated,
          })),
        },
        created_at: FieldValue.serverTimestamp(),
        acknowledged: false,
      });
    }

    logger.info(
      "[SOFT_DELETE_CLEANUP] Concluído em " +
      `${totalDuration}ms. Total removido: ` +
      `${totalDeleted} documentos` +
      (truncatedCollections.length > 0 ?
        ` [${truncatedCollections.length} colecao(oes) TRUNCADA(S)]` :
        "")
    );
    lockStatus = "completed";
    } catch (error) {
      // Re-throw para acionar retry automático do Cloud Scheduler.
      // Sem o throw, falhas silenciosas passavam despercebidas e documentos
      // expirados nunca seriam removidos até a próxima execução semanal.
      logger.error(
        "[SOFT_DELETE_CLEANUP] Erro fatal no cleanup:", error
      );
      throw error;
    } finally {
      // Issue #3967: interrompe o heartbeat antes de liberar o lock.
      heartbeat.stop();
      // Issue #3974 Defeito A: se o lock foi perdido (outro owner
      // tomou), releaseSchedulerLock seria rejeitado (owner divergente)
      // e só geraria ruído em log — o novo owner cuida da liberação.
      if (heartbeat.isLost()) {
        logger.warn(
          "[SOFT_DELETE_CLEANUP] Pulando release do lock: owner divergente " +
          "(lock foi tomado durante a execucao)"
        );
      } else {
        try {
          await releaseSchedulerLock(
            lockId,
            lockAcquired,
            lockStatus
          );
        } catch (lockError) {
          logger.warn(
            "[SOFT_DELETE_CLEANUP] Falha ao liberar scheduler lock:",
            lockError
          );
        }
      }
    }
  });
