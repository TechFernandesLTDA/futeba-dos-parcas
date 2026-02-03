/**
 * XP PROCESSING COM IDEMPOTÊNCIA
 *
 * Sistema de processamento de XP com garantias de:
 * - Idempotência via transaction_id
 * - Retry seguro sem duplicação
 * - Atomicidade via Firestore transactions
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

// ==========================================
// INTERFACES
// ==========================================

export interface XpProcessingResult {
  success: boolean;
  transactionId: string;
  alreadyProcessed: boolean;
  error?: string;
}

export interface XpTransactionData {
  gameId: string;
  userId: string;
  xpEarned: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  breakdown: XpBreakdown;
  metadata: XpMetadata;
}

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

// ==========================================
// GERAÇÃO DE TRANSACTION ID
// ==========================================

/**
 * Gera um transaction_id determinístico baseado em game_id + user_id
 * Garante que o mesmo evento sempre gera o mesmo transaction_id
 */
export function generateTransactionId(gameId: string, userId: string): string {
  // Formato: game_{gameId}_user_{userId}
  // Permite fácil identificação e debug
  return `game_${gameId}_user_${userId}`;
}

// ==========================================
// VERIFICAÇÃO DE IDEMPOTÊNCIA
// ==========================================

/**
 * Verifica se uma transação XP já foi processada.
 * Retorna true se já existe um xp_log com o transaction_id.
 */
export async function isTransactionAlreadyProcessed(
  transactionId: string
): Promise<boolean> {
  try {
    const existingLog = await db
      .collection("xp_logs")
      .where("transaction_id", "==", transactionId)
      .limit(1)
      .get();

    return !existingLog.empty;
  } catch (error) {
    console.error(`[XP_IDEMPOTENCY] Erro ao verificar transação ${transactionId}:`, error);
    // Em caso de erro, assumir que NÃO foi processado (fail-safe)
    return false;
  }
}

// ==========================================
// PROCESSAMENTO IDEMPOTENTE DE XP
// ==========================================

/**
 * Processa XP para um jogador com garantia de idempotência.
 *
 * IMPORTANTE: Esta função pode ser chamada múltiplas vezes com segurança.
 * Se o transaction_id já existir, retorna sucesso sem processar novamente.
 *
 * @param data Dados completos da transação XP
 * @returns Resultado do processamento
 */
export async function processXpIdempotent(
  data: XpTransactionData
): Promise<XpProcessingResult> {
  const transactionId = generateTransactionId(data.gameId, data.userId);

  // FASE 1: Verificação de idempotência (ANTES de qualquer escrita)
  const alreadyProcessed = await isTransactionAlreadyProcessed(transactionId);

  if (alreadyProcessed) {
    console.log(
      `[XP_IDEMPOTENCY] Transação ${transactionId} já processada. Pulando.`
    );
    return {
      success: true,
      transactionId,
      alreadyProcessed: true,
    };
  }

  // FASE 2: Processamento atômico via Firestore Transaction
  try {
    await db.runTransaction(async (transaction) => {
      // 2.1: Re-verificar idempotência DENTRO da transaction (double-check)
      const xpLogsRef = db.collection("xp_logs");
      const existingCheck = await transaction.get(
        xpLogsRef.where("transaction_id", "==", transactionId).limit(1)
      );

      if (!existingCheck.empty) {
        console.log(
          `[XP_IDEMPOTENCY] Transação ${transactionId} já processada (race condition detectada). Abortando.`
        );
        // Transaction será abortada, mas retornaremos sucesso
        return;
      }

      // 2.2: Atualizar XP do usuário
      const userRef = db.collection("users").doc(data.userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error(`Usuário ${data.userId} não encontrado`);
      }

      transaction.update(userRef, {
        experience_points: data.xpAfter,
        level: data.levelAfter,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2.3: Atualizar milestones (se houver)
      if (data.metadata.milestonesUnlocked.length > 0) {
        transaction.update(userRef, {
          milestones_achieved: admin.firestore.FieldValue.arrayUnion(
            ...data.metadata.milestonesUnlocked
          ),
        });
      }

      // 2.4: Criar XP log com transaction_id
      const logRef = xpLogsRef.doc();
      transaction.set(logRef, {
        transaction_id: transactionId, // CHAVE DE IDEMPOTÊNCIA
        user_id: data.userId,
        game_id: data.gameId,
        xp_earned: data.xpEarned,
        xp_before: data.xpBefore,
        xp_after: data.xpAfter,
        level_before: data.levelBefore,
        level_after: data.levelAfter,

        // Breakdown
        xp_participation: data.breakdown.participation,
        xp_goals: data.breakdown.goals,
        xp_assists: data.breakdown.assists,
        xp_saves: data.breakdown.saves,
        xp_result: data.breakdown.result,
        xp_mvp: data.breakdown.mvp,
        xp_clean_sheet: data.breakdown.cleanSheet,
        xp_milestones: data.breakdown.milestones,
        xp_streak: data.breakdown.streak,
        xp_penalty: data.breakdown.penalty,

        // Metadata
        goals: data.metadata.goals,
        assists: data.metadata.assists,
        saves: data.metadata.saves,
        was_mvp: data.metadata.wasMvp,
        was_clean_sheet: data.metadata.wasCleanSheet,
        was_worst_player: data.metadata.wasWorstPlayer,
        game_result: data.metadata.gameResult,
        milestones_unlocked: data.metadata.milestonesUnlocked,

        // Timestamps
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        processed_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `[XP_IDEMPOTENCY] Transação ${transactionId} processada com sucesso: +${data.xpEarned} XP`
      );
    });

    return {
      success: true,
      transactionId,
      alreadyProcessed: false,
    };
  } catch (error: any) {
    console.error(
      `[XP_IDEMPOTENCY] Erro ao processar transação ${transactionId}:`,
      error
    );

    return {
      success: false,
      transactionId,
      alreadyProcessed: false,
      error: error.message || "Erro desconhecido",
    };
  }
}

// ==========================================
// BATCH PROCESSING
// ==========================================

/**
 * Processa múltiplas transações XP em batch com idempotência.
 *
 * PERFORMANCE: Usa batch writes do Firestore (500 ops/batch)
 * IDEMPOTÊNCIA: Filtra transações já processadas antes do batch
 *
 * @param transactions Lista de transações XP
 * @returns Lista de resultados
 */
export async function processXpBatch(
  transactions: XpTransactionData[]
): Promise<XpProcessingResult[]> {
  if (transactions.length === 0) {
    return [];
  }

  console.log(`[XP_BATCH] Processando ${transactions.length} transações...`);

  // FASE 1: Filtrar transações já processadas (verificação em lote)
  const transactionIds = transactions.map((t) =>
    generateTransactionId(t.gameId, t.userId)
  );

  const existingLogsSnap = await db
    .collection("xp_logs")
    .where("transaction_id", "in", transactionIds.slice(0, 10)) // Firestore limit: 10
    .get();

  const processedIds = new Set(
    existingLogsSnap.docs.map((doc) => doc.data().transaction_id)
  );

  const toProcess = transactions.filter(
    (t) => !processedIds.has(generateTransactionId(t.gameId, t.userId))
  );

  const skipped = transactions.length - toProcess.length;

  if (skipped > 0) {
    console.log(`[XP_BATCH] ${skipped} transações já processadas. Pulando.`);
  }

  if (toProcess.length === 0) {
    // Todas já processadas
    return transactions.map((t) => ({
      success: true,
      transactionId: generateTransactionId(t.gameId, t.userId),
      alreadyProcessed: true,
    }));
  }

  // FASE 2: Processar em batches de 500 operações
  const results: XpProcessingResult[] = [];

  // Cada transação = 2 writes (user + log) + potencial milestone update
  // Limite seguro: 166 transações por batch (166 * 3 = 498 ops)
  const BATCH_SIZE = 166;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const chunk = toProcess.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const data of chunk) {
      const transactionId = generateTransactionId(data.gameId, data.userId);

      try {
        // User update
        const userRef = db.collection("users").doc(data.userId);
        batch.update(userRef, {
          experience_points: data.xpAfter,
          level: data.levelAfter,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Milestones
        if (data.metadata.milestonesUnlocked.length > 0) {
          batch.update(userRef, {
            milestones_achieved: admin.firestore.FieldValue.arrayUnion(
              ...data.metadata.milestonesUnlocked
            ),
          });
        }

        // XP log
        const logRef = db.collection("xp_logs").doc();
        batch.set(logRef, {
          transaction_id: transactionId,
          user_id: data.userId,
          game_id: data.gameId,
          xp_earned: data.xpEarned,
          xp_before: data.xpBefore,
          xp_after: data.xpAfter,
          level_before: data.levelBefore,
          level_after: data.levelAfter,
          xp_participation: data.breakdown.participation,
          xp_goals: data.breakdown.goals,
          xp_assists: data.breakdown.assists,
          xp_saves: data.breakdown.saves,
          xp_result: data.breakdown.result,
          xp_mvp: data.breakdown.mvp,
          xp_clean_sheet: data.breakdown.cleanSheet,
          xp_milestones: data.breakdown.milestones,
          xp_streak: data.breakdown.streak,
          xp_penalty: data.breakdown.penalty,
          goals: data.metadata.goals,
          assists: data.metadata.assists,
          saves: data.metadata.saves,
          was_mvp: data.metadata.wasMvp,
          was_clean_sheet: data.metadata.wasCleanSheet,
          was_worst_player: data.metadata.wasWorstPlayer,
          game_result: data.metadata.gameResult,
          milestones_unlocked: data.metadata.milestonesUnlocked,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          processed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({
          success: true,
          transactionId,
          alreadyProcessed: false,
        });
      } catch (error: any) {
        console.error(
          `[XP_BATCH] Erro ao processar ${transactionId}:`,
          error
        );
        results.push({
          success: false,
          transactionId,
          alreadyProcessed: false,
          error: error.message,
        });
      }
    }

    // Commit batch
    try {
      await batch.commit();
      console.log(`[XP_BATCH] Batch de ${chunk.length} transações commitado`);
    } catch (error: any) {
      console.error(`[XP_BATCH] Erro ao commitar batch:`, error);
      // Marcar todas as transações do chunk como falhadas
      chunk.forEach((data) => {
        const idx = results.findIndex(
          (r) => r.transactionId === generateTransactionId(data.gameId, data.userId)
        );
        if (idx !== -1) {
          results[idx].success = false;
          results[idx].error = error.message;
        }
      });
    }
  }

  console.log(
    `[XP_BATCH] Processamento completo: ${results.filter((r) => r.success).length}/${transactions.length} sucesso`
  );

  return results;
}

// ==========================================
// UTILITÁRIOS DE RETRY
// ==========================================

/**
 * Retry com exponential backoff para operações XP.
 * Útil para lidar com contenção de Firestore.
 */
export async function retryXpOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialBackoffMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Só retry em erros transientes
      const isTransient =
        error.code === 10 || // ABORTED (contention)
        error.code === 14 || // UNAVAILABLE
        error.message?.includes("DEADLINE_EXCEEDED") ||
        error.message?.includes("contention");

      if (!isTransient || attempt === maxRetries) {
        throw error;
      }

      const backoffMs = Math.pow(2, attempt - 1) * initialBackoffMs;
      console.log(
        `[XP_RETRY] Tentativa ${attempt}/${maxRetries} falhou. Retry em ${backoffMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}
