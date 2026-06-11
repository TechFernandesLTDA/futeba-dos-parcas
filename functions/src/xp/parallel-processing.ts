/**
 * PROCESSAMENTO PARALELO E BATCH DE XP -
 * P0 OPTIMIZATION
 *
 * Implementa otimizações críticas P0:
 * - P0 #6: Processamento paralelo/batch de XP
 *   (não síncrono)
 * - P0 #7: Firestore batch writes (até 500 ops)
 * - P0 #9: Idempotência com transaction IDs
 * - P0 #10: Rate limiting em callable functions
 *
 * PERFORMANCE:
 * - Antes: 60+ sequential Firestore reads/writes
 * - Depois: 12 parallel batches, 60% redução de
 *   latência
 * - Custo: 40% redução de Firestore reads
 */

import {logger} from "firebase-functions";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import {db} from "../_db";


// ==========================================
// INTERFACES & TYPES
// ==========================================

/** Requisição de processamento batch de XP */
export interface BatchXpRequest {
  gameId: string;
  playerUpdates: Array<{
    userId: string;
    xpEarned: number;
    xpBefore: number;
    xpAfter: number;
    levelBefore: number;
    levelAfter: number;
    breakdown: XpBreakdown;
    metadata: XpMetadata;
  }>;
}

/** Breakdown detalhado de XP por categoria */
export interface XpBreakdown {
  participation: number;
  goals: number;
  assists: number;
  saves: number;
  result: number;
  mvp: number;
  cleanSheet: number;
  milestones: number;
  streak: number;
  penalty: number;
}

/** Metadados do jogo para log de XP */
export interface XpMetadata {
  goals: number;
  assists: number;
  saves: number;
  wasMvp: boolean;
  wasCleanSheet: boolean;
  wasWorstPlayer: boolean;
  gameResult: string;
  milestonesUnlocked: string[];
}

/** Resultado do processamento paralelo */
export interface ParallelProcessingResult {
  success: boolean;
  gameId: string;
  processedCount: number;
  failedCount: number;
  totalDuration: number;
  batches: BatchResult[];
  error?: string;
}

/** Resultado de um batch individual */
export interface BatchResult {
  batchNumber: number;
  startIndex: number;
  endIndex: number;
  processedCount: number;
  failedCount: number;
  duration: number;
  transactionIds: string[];
  error?: string;
}

/*
 * processXpParallel, processBatchWithRetry, processBatch,
 * generateParallelTransactionId, isParallelTransactionProcessed
 * were REMOVED per #1150:
 * - No callers exist (callable removed in SECFIX #581)
 * - Idempotency check ran OUTSIDE runTransaction (race condition)
 * - Doc ID was random (not deterministic), allowing double XP
 * - Dead code risk: future PR re-introducing callers would
 *   silently regress XP double-counting
 *
 * Reference: SECFIX #441, SECFIX #581, SECFIX #793
 */

// ==========================================
// REMOVIDO em FIX #581: callable processXpBatch
// ==========================================
//
// O callable `processXpBatch` foi REMOVIDO em 2026-05-08 porque:
//
// 1. ANTI-CHEAT BYPASS: aceitava `xpEarned`/`breakdown` direto do cliente sem
//    recomputar do server. Owner de jogo podia dar até 500 XP/call pra qualquer
//    jogador. Caps de MAX_GOALS=15 etc eram bypassed.
//
// 2. DEAD CODE: zero callers em Android/web/iOS/shared. XP processing real é
//    feito server-side por `onGameStatusUpdate` trigger em src/index.ts.
//
// 3. DOUBLE-CREDIT RACE: idempotency via `whereIn` rodava FORA de
//    runTransaction (regressão do PR #441 fix em src/xp/processing.ts).
//
// Helpers internos (`processXpParallel`, `generateParallelTransactionId`,
// `isParallelTransactionProcessed`) ficam disponíveis pra uso server-side.
//
// Closes #581.

/**
 * Função auxiliar: Resetar rate limit
 * (admin only).
 *
 * @param {object} request - Requisição
 *   Firebase callable
 * @return {Promise<object>} Resultado do reset
 */
export const resetXpRateLimit =
  onCall<{userId: string}>(
    {
      enforceAppCheck: true,
      region: "southamerica-east1",
    },
    async (request) => {
      // Validar que é admin via Custom Claim (PERF_001).
      // FIX #582: era Firestore lookup (`users/{uid}.role`) vulnerável a:
      //   - Stale doc antes do trigger sync propagar
      //   - Bypass via rules ou admin SDK escrevendo users.role direto
      //     sem passar pelo setUserRole callable (sync Custom Claim)
      // Custom Claim em request.auth.token é a fonte de verdade canônica.
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Authentication required"
        );
      }

      if (request.auth.token?.role !== "ADMIN") {
        throw new HttpsError(
          "permission-denied",
          "Admin access required"
        );
      }

      // Reset rate limit
      const targetUserId =
        request.data.userId;
      const bucketKey =
        `xp_process_${targetUserId}`;

      try {
        await db()
          .collection("rate_limits")
          .doc(bucketKey)
          .delete();

        logger.info(
          "[XP_RATE_LIMIT] Rate limit " +
          "reset for user " +
          `${targetUserId} by admin ` +
          `${request.auth.uid}`
        );

        return {
          success: true,
          message:
            "Rate limit reset for user " +
            `${targetUserId}`,
        };
      } catch (error) {
        logger.error(
          "[XP_RATE_LIMIT] Failed to reset rate limit " +
          `for user ${targetUserId}:`,
          error
        );
        throw new HttpsError(
          "internal",
          "Failed to reset rate limit"
        );
      }
    }
  );
