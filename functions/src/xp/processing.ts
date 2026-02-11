/**
 * XP PROCESSING COM IDEMPOTÊNCIA
 *
 * Sistema de processamento de XP com garantias de:
 * - Idempotência via transaction_id
 * - Retry seguro sem duplicação
 * - Atomicidade via Firestore transactions
 * - Validação rigorosa de dados antes do processamento
 */

import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";

const db = admin.firestore();

// ==========================================
// CONSTANTES DE VALIDAÇÃO
// ==========================================

/** XP máximo que um jogador pode ganhar em um único jogo */
const MAX_XP_PER_GAME = 500;

/** XP mínimo possível (penalidades podem ser negativas, mas com limite) */
const MIN_XP_PER_GAME = -100;

/** Nível máximo permitido no sistema */
const MAX_LEVEL = 999;

/** Máximo de gols/assistências/defesas plausíveis por jogo */
const MAX_STATS_PER_GAME = 50;

/** Máximo de milestones desbloqueadas por jogo */
const MAX_MILESTONES_PER_GAME = 10;

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
// VALIDAÇÃO DE DADOS XP
// ==========================================

/**
 * Valida se um número é finito e não é NaN.
 * Retorna 0 se o valor for inválido, para sanitização segura.
 */
function sanitizeNumber(value: any, fieldName: string): number {
  if (value === undefined || value === null) {
    logger.warn(`[XP_VALIDATION] Campo ${fieldName} é null/undefined, usando 0`);
    return 0;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    logger.warn(`[XP_VALIDATION] Campo ${fieldName} é inválido (${value}), usando 0`);
    return 0;
  }
  return num;
}

/**
 * Valida se um valor de estatística (gols, assists, saves) é plausível.
 * Rejeita valores negativos ou excessivamente altos.
 */
function validateStatValue(value: number, fieldName: string, max: number = MAX_STATS_PER_GAME): number {
  const sanitized = sanitizeNumber(value, fieldName);
  if (sanitized < 0) {
    logger.warn(`[XP_VALIDATION] ${fieldName} negativo (${sanitized}), corrigindo para 0`);
    return 0;
  }
  if (sanitized > max) {
    logger.warn(`[XP_VALIDATION] ${fieldName} excede máximo plausível (${sanitized} > ${max}), limitando`);
    return max;
  }
  return Math.floor(sanitized);
}

/**
 * Valida e sanitiza todos os dados de uma transação XP antes do processamento.
 *
 * VALIDAÇÕES:
 * - IDs não vazios e do tipo string
 * - xpEarned dentro de limites razoáveis e não NaN
 * - xpBefore/xpAfter não negativos e não NaN
 * - Levels não negativos e dentro do limite máximo
 * - Breakdown sem valores NaN ou negativos onde não permitido
 * - Metadata com estatísticas plausíveis
 *
 * @throws Error se dados críticos forem inválidos (IDs ausentes)
 * @returns Dados sanitizados com valores corrigidos
 */
export function validateAndSanitizeXpData(data: XpTransactionData): XpTransactionData {
  // Validação de IDs (crítico - não tem como recuperar)
  if (!data.gameId || typeof data.gameId !== "string" || data.gameId.trim().length === 0) {
    throw new Error("gameId é obrigatório e deve ser uma string não vazia");
  }
  if (!data.userId || typeof data.userId !== "string" || data.userId.trim().length === 0) {
    throw new Error("userId é obrigatório e deve ser uma string não vazia");
  }

  // Sanitizar e validar campos numéricos de XP
  const xpEarned = sanitizeNumber(data.xpEarned, "xpEarned");
  if (xpEarned > MAX_XP_PER_GAME) {
    logger.warn(
      `[XP_VALIDATION] xpEarned excessivo (${xpEarned}) para user ${data.userId} no jogo ${data.gameId}. Limitando a ${MAX_XP_PER_GAME}`
    );
  }
  if (xpEarned < MIN_XP_PER_GAME) {
    logger.warn(
      `[XP_VALIDATION] xpEarned muito negativo (${xpEarned}) para user ${data.userId}. Limitando a ${MIN_XP_PER_GAME}`
    );
  }
  const clampedXpEarned = Math.max(MIN_XP_PER_GAME, Math.min(MAX_XP_PER_GAME, xpEarned));

  const xpBefore = Math.max(0, sanitizeNumber(data.xpBefore, "xpBefore"));
  const xpAfter = Math.max(0, sanitizeNumber(data.xpAfter, "xpAfter"));

  // Validar consistência: xpAfter deve ser xpBefore + xpEarned (com tolerância de 1 para arredondamento)
  const expectedXpAfter = xpBefore + clampedXpEarned;
  if (Math.abs(xpAfter - expectedXpAfter) > 1) {
    logger.warn(
      `[XP_VALIDATION] Inconsistência de XP: before=${xpBefore} + earned=${clampedXpEarned} != after=${xpAfter}. ` +
      `Recalculando xpAfter para ${Math.max(0, expectedXpAfter)}`
    );
  }
  const correctedXpAfter = Math.max(0, expectedXpAfter);

  // Validar levels
  const levelBefore = Math.max(0, Math.min(MAX_LEVEL, Math.floor(sanitizeNumber(data.levelBefore, "levelBefore"))));
  const levelAfter = Math.max(0, Math.min(MAX_LEVEL, Math.floor(sanitizeNumber(data.levelAfter, "levelAfter"))));

  // Sanitizar breakdown (XP por categoria)
  const breakdown: XpBreakdown = {
    participation: sanitizeNumber(data.breakdown?.participation, "breakdown.participation"),
    goals: sanitizeNumber(data.breakdown?.goals, "breakdown.goals"),
    assists: sanitizeNumber(data.breakdown?.assists, "breakdown.assists"),
    saves: sanitizeNumber(data.breakdown?.saves, "breakdown.saves"),
    result: sanitizeNumber(data.breakdown?.result, "breakdown.result"),
    mvp: sanitizeNumber(data.breakdown?.mvp, "breakdown.mvp"),
    cleanSheet: sanitizeNumber(data.breakdown?.cleanSheet, "breakdown.cleanSheet"),
    milestones: sanitizeNumber(data.breakdown?.milestones, "breakdown.milestones"),
    streak: sanitizeNumber(data.breakdown?.streak, "breakdown.streak"),
    penalty: sanitizeNumber(data.breakdown?.penalty, "breakdown.penalty"),
  };

  // Validar que a soma do breakdown é coerente com xpEarned (tolerância de 5 para arredondamentos)
  const breakdownSum = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  if (Math.abs(breakdownSum - clampedXpEarned) > 5) {
    logger.warn(
      `[XP_VALIDATION] Soma do breakdown (${breakdownSum}) difere do xpEarned (${clampedXpEarned}). Verificar cálculos.`
    );
  }

  // Sanitizar metadata
  const metadata: XpMetadata = {
    goals: validateStatValue(data.metadata?.goals, "metadata.goals"),
    assists: validateStatValue(data.metadata?.assists, "metadata.assists"),
    saves: validateStatValue(data.metadata?.saves, "metadata.saves"),
    wasMvp: Boolean(data.metadata?.wasMvp),
    wasCleanSheet: Boolean(data.metadata?.wasCleanSheet),
    wasWorstPlayer: Boolean(data.metadata?.wasWorstPlayer),
    gameResult: ["WIN", "DRAW", "LOSS"].includes(data.metadata?.gameResult)
      ? data.metadata.gameResult
      : "DRAW",
    milestonesUnlocked: Array.isArray(data.metadata?.milestonesUnlocked)
      ? data.metadata.milestonesUnlocked
        .filter((m: any) => typeof m === "string" && m.length > 0)
        .slice(0, MAX_MILESTONES_PER_GAME)
      : [],
  };

  logger.info(
    `[XP_VALIDATION] Dados validados para user ${data.userId} no jogo ${data.gameId}: ` +
    `XP=${clampedXpEarned}, level=${levelBefore}->${levelAfter}`
  );

  return {
    gameId: data.gameId.trim(),
    userId: data.userId.trim(),
    xpEarned: clampedXpEarned,
    xpBefore,
    xpAfter: correctedXpAfter,
    levelBefore,
    levelAfter,
    breakdown,
    metadata,
  };
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
    logger.error(`[XP_IDEMPOTENCY] Erro ao verificar transação ${transactionId}:`, error);
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
 * @return Resultado do processamento
 */
export async function processXpIdempotent(
  data: XpTransactionData
): Promise<XpProcessingResult> {
  // FASE 0: Validação e sanitização de dados (previne NaN, negativos, inconsistências)
  let validatedData: XpTransactionData;
  try {
    validatedData = validateAndSanitizeXpData(data);
  } catch (validationError: any) {
    logger.error(
      `[XP_IDEMPOTENCY] Dados inválidos recusados: ${validationError.message}`,
      {gameId: data.gameId, userId: data.userId}
    );
    return {
      success: false,
      transactionId: `invalid_${data.gameId || "unknown"}_${data.userId || "unknown"}`,
      alreadyProcessed: false,
      error: `Validação falhou: ${validationError.message}`,
    };
  }

  // Usar dados validados daqui em diante
  data = validatedData;
  const transactionId = generateTransactionId(data.gameId, data.userId);

  // FASE 1: Verificação de idempotência (ANTES de qualquer escrita)
  const alreadyProcessed = await isTransactionAlreadyProcessed(transactionId);

  if (alreadyProcessed) {
    logger.info(
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
        logger.info(
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

      logger.info(
        `[XP_IDEMPOTENCY] Transação ${transactionId} processada com sucesso: +${data.xpEarned} XP`
      );
    });

    return {
      success: true,
      transactionId,
      alreadyProcessed: false,
    };
  } catch (error: any) {
    logger.error(
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
 * @return Lista de resultados
 */
export async function processXpBatch(
  inputTransactions: XpTransactionData[]
): Promise<XpProcessingResult[]> {
  let transactions = [...inputTransactions];
  if (transactions.length === 0) {
    return [];
  }

  logger.info(`[XP_BATCH] Processando ${transactions.length} transações...`);

  // FASE 0: Validar e sanitizar todas as transações antes de processar
  const validatedTransactions: XpTransactionData[] = [];
  const validationFailures: XpProcessingResult[] = [];

  for (const txn of transactions) {
    try {
      validatedTransactions.push(validateAndSanitizeXpData(txn));
    } catch (validationError: any) {
      logger.error(
        `[XP_BATCH] Transação rejeitada na validação: ${validationError.message}`,
        {gameId: txn.gameId, userId: txn.userId}
      );
      validationFailures.push({
        success: false,
        transactionId: `invalid_${txn.gameId || "unknown"}_${txn.userId || "unknown"}`,
        alreadyProcessed: false,
        error: `Validação falhou: ${validationError.message}`,
      });
    }
  }

  if (validationFailures.length > 0) {
    logger.warn(
      `[XP_BATCH] ${validationFailures.length}/${transactions.length} transações rejeitadas na validação`
    );
  }

  // Substituir transactions pelas validadas
  transactions = validatedTransactions;

  // FASE 1: Filtrar transações já processadas (verificação em lote)
  // Firestore whereIn suporta no máximo 10 itens, então dividimos em chunks
  const transactionIds = transactions.map((t) =>
    generateTransactionId(t.gameId, t.userId)
  );

  const processedIds = new Set<string>();
  const idChunks: string[][] = [];
  for (let i = 0; i < transactionIds.length; i += 10) {
    idChunks.push(transactionIds.slice(i, i + 10));
  }

  const existingLogsSnaps = await Promise.all(
    idChunks.map((chunk) =>
      db.collection("xp_logs")
        .where("transaction_id", "in", chunk)
        .get()
    )
  );

  for (const snap of existingLogsSnaps) {
    for (const doc of snap.docs) {
      processedIds.add(doc.data().transaction_id);
    }
  }

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
      console.error("[XP_BATCH] Erro ao commitar batch:", error);
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

  logger.info(
    `[XP_BATCH] Processamento completo: ${results.filter((r) => r.success).length}/${inputTransactions.length} sucesso` +
    (validationFailures.length > 0 ? `, ${validationFailures.length} rejeitados na validação` : "")
  );

  return [...validationFailures, ...results];
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
  maxRetries = 3,
  initialBackoffMs = 1000
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
