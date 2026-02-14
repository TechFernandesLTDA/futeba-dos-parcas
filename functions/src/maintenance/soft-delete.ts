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

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {
  softDelete,
  restoreSoftDeleted,
  softDeleteGroupCascade,
  cleanupSoftDeleted,
} from "../utils/soft-delete-helper.js";
import {
  checkRateLimit,
} from "../middleware/rate-limiter.js";

const db = admin.firestore();

/** Dias de retenção antes de deletar */
const RETENTION_DAYS = 30;

// ==========================================
// CALLABLE: Soft Delete Game
// ==========================================

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
  functions.https.onCall({
    region: "southamerica-east1",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {gameId, reason} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Usuário não autenticado"
      );
    }

    // Rate Limiting: 5 deleções/min por usuário
    const {
      allowed: rlAllowed,
      resetAt: rlResetAt,
    } = await checkRateLimit(userId, {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "soft_delete_game",
    });
    if (!rlAllowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Rate limit excedido. Tente após " +
        new Date(rlResetAt).toISOString()
      );
    }

    if (!gameId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "gameId é obrigatório"
      );
    }

    try {
      const gameDoc = await db
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

      // Verificar proprietário
      if (gameData?.owner_id !== userId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas o dono do jogo pode deletar"
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

      // Executar soft-delete usando helper
      const result = await softDelete(
        "games", gameId, userId, {
          reason: reason || "",
          setStatusDeleted: true,
        }
      );

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Erro ao deletar"
        );
      }

      console.log(
        `[SOFT_DELETE] Game ${gameId} ` +
        `soft-deleted por ${userId}`
      );

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
      console.error(
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
  functions.https.onCall({
    region: "southamerica-east1",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {groupId, reason} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Usuário não autenticado"
      );
    }

    // Rate Limiting: 3 deleções de grupo/min
    const {
      allowed: rlAllowed,
      resetAt: rlResetAt,
    } = await checkRateLimit(userId, {
      maxRequests: 3,
      windowMs: 60 * 1000,
      keyPrefix: "soft_delete_group",
    });
    if (!rlAllowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Rate limit excedido. Tente após " +
        new Date(rlResetAt).toISOString()
      );
    }

    if (!groupId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "groupId é obrigatório"
      );
    }

    try {
      // Verificar permissão (admin ou owner)
      const groupDoc = await db
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
      const memberDoc = await db
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

      console.log(
        `[SOFT_DELETE] Grupo ${groupId} ` +
        `soft-deleted por ${userId}: ` +
        `${result.gamesDeleted} jogos afetados`
      );

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
      console.error(
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
  functions.https.onCall({
    region: "southamerica-east1",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {gameId} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Usuário não autenticado"
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
      const resetIso = new Date(
        rlRestoreGame.resetAt
      ).toISOString();
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Rate limit excedido. Tente após " +
        resetIso
      );
    }

    if (!gameId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "gameId é obrigatório"
      );
    }

    try {
      const gameDoc = await db
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
      if (
        gameData.deleted_by !== userId &&
        gameData.owner_id !== userId
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas quem deletou ou o dono " +
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

      console.log(
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
      console.error(
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

/**
 * Restaura um grupo soft-deleted.
 * Apenas quem deletou ou admin pode restaurar.
 * Nota: Jogos do grupo NÃO são restaurados
 * automaticamente.
 *
 * @param {functions.https.CallableRequest}
 *   request - Requisição callable
 * @return {Promise<Record<string, unknown>>}
 *   Resultado da operação
 */
export const restoreDeletedGroup =
  functions.https.onCall({
    region: "southamerica-east1",
  }, async (request) => {
    const userId = request.auth?.uid;
    const {groupId} = request.data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Usuário não autenticado"
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
      const resetIso = new Date(
        rlRestoreGroup.resetAt
      ).toISOString();
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Rate limit excedido. Tente após " +
        resetIso
      );
    }

    if (!groupId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "groupId é obrigatório"
      );
    }

    try {
      const groupDoc = await db
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
      if (groupData.deleted_by !== userId) {
        // Verificar se é admin via custom claims
        const isAdmin =
          request.auth?.token?.role === "ADMIN";
        if (!isAdmin) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Apenas quem deletou ou admin " +
            "pode restaurar"
          );
        }
      }

      const result = await restoreSoftDeleted(
        "groups", groupId, userId
      );

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          result.error || "Erro ao restaurar"
        );
      }

      console.log(
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
      console.error(
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    console.log(
      "[SOFT_DELETE_CLEANUP] Iniciando " +
      "cleanup unificado (TTL: " +
      `${RETENTION_DAYS} dias)`
    );

    const startTime = Date.now();

    interface CleanupResult {
      collection: string;
      totalDeleted: number;
      batchCount: number;
    }

    const results: CleanupResult[] = [];

    // Limpar cada coleção usando helper
    const collections = [
      {name: "games", batchSize: 100, max: 10},
      {name: "groups", batchSize: 100, max: 10},
      {name: "locations", batchSize: 500, max: 20},
    ];

    for (const col of collections) {
      console.log(
        "[SOFT_DELETE_CLEANUP] Processando: " +
        col.name
      );

      const result = await cleanupSoftDeleted(
        col.name,
        RETENTION_DAYS,
        col.max,
        col.batchSize
      );

      results.push(result);
    }

    const totalDuration = Date.now() - startTime;
    const totalDeleted = results.reduce(
      (sum, r) => sum + r.totalDeleted, 0
    );

    // Registrar métricas
    await db.collection("metrics").add({
      type: "soft_delete_cleanup_unified",
      timestamp:
        admin.firestore.FieldValue
          .serverTimestamp(),
      retention_days: RETENTION_DAYS,
      total_deleted: totalDeleted,
      duration_ms: totalDuration,
      results: results.map((r) => ({
        collection: r.collection,
        deleted: r.totalDeleted,
        batches: r.batchCount,
      })),
    });

    console.log(
      "[SOFT_DELETE_CLEANUP] Concluído em " +
      `${totalDuration}ms. Total removido: ` +
      `${totalDeleted} documentos`
    );
  });
