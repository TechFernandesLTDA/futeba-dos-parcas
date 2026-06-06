/**
 * XP PROCESSING COM IDEMPOTÊNCIA
 *
 * Sistema de processamento de XP com garantias:
 * - Idempotência via transaction_id
 * - Retry seguro sem duplicação
 * - Atomicidade via Firestore transactions
 * - Validação rigorosa de dados
 */

import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {
  MAX_XP_PER_GAME,
  MIN_XP_PER_GAME,
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
} from "../constants";
import {db} from "../_db";


// ==========================================
// CONSTANTES DE VALIDAÇÃO
// ==========================================

/** Nível máximo permitido no sistema */
const MAX_LEVEL = 999;

/** Máximo de stats plausíveis por jogo */
const MAX_STATS_PER_GAME = 50;

/** Máximo de milestones desbloqueadas por jogo */
const MAX_MILESTONES_PER_GAME = 10;

// ==========================================
// INTERFACES
// ==========================================

/** Resultado do processamento de XP */
export interface XpProcessingResult {
  success: boolean;
  transactionId: string;
  alreadyProcessed: boolean;
  error?: string;
}

/** Dados da transação XP */
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

/** Breakdown de XP por categoria */
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

/** Metadata do XP */
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
 * Retorna 0 se o valor for inválido.
 *
 * @param {unknown} value - Valor a validar
 * @param {string} fieldName - Nome do campo
 * @return {number} Valor sanitizado
 */
function sanitizeNumber(
  value: unknown,
  fieldName: string
): number {
  if (value === undefined || value === null) {
    logger.warn(
      `[XP_VALIDATION] Campo ${fieldName} ` +
      "é null/undefined, usando 0"
    );
    return 0;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    logger.warn(
      `[XP_VALIDATION] Campo ${fieldName} ` +
      `é inválido (${value}), usando 0`
    );
    return 0;
  }
  return num;
}

/**
 * Valida se um valor de estatística é plausível.
 * Rejeita valores negativos ou excessivamente
 * altos.
 *
 * @param {number} value - Valor da estatística
 * @param {string} fieldName - Nome do campo
 * @param {number} max - Valor máximo permitido
 * @return {number} Valor validado
 */
function validateStatValue(
  value: number,
  fieldName: string,
  max: number = MAX_STATS_PER_GAME
): number {
  const sanitized = sanitizeNumber(
    value,
    fieldName
  );
  if (sanitized < 0) {
    logger.warn(
      `[XP_VALIDATION] ${fieldName} negativo ` +
      `(${sanitized}), corrigindo para 0`
    );
    return 0;
  }
  if (sanitized > max) {
    logger.warn(
      `[XP_VALIDATION] ${fieldName} excede ` +
      "máximo plausível " +
      `(${sanitized} > ${max}), limitando`
    );
    return max;
  }
  return Math.floor(sanitized);
}

/**
 * Valida e sanitiza todos os dados de uma
 * transação XP antes do processamento.
 *
 * VALIDAÇÕES:
 * - IDs não vazios e do tipo string
 * - xpEarned dentro de limites razoáveis
 * - xpBefore/xpAfter não negativos
 * - Levels dentro do limite máximo
 * - Breakdown sem valores NaN
 * - Metadata com estatísticas plausíveis
 *
 * @param {XpTransactionData} data - Dados XP
 * @return {XpTransactionData} Dados sanitizados
 */
export function validateAndSanitizeXpData(
  data: XpTransactionData
): XpTransactionData {
  // Validação de IDs (crítico)
  if (
    !data.gameId ||
    typeof data.gameId !== "string" ||
    data.gameId.trim().length === 0
  ) {
    throw new Error(
      "gameId é obrigatório e deve ser " +
      "uma string não vazia"
    );
  }
  if (
    !data.userId ||
    typeof data.userId !== "string" ||
    data.userId.trim().length === 0
  ) {
    throw new Error(
      "userId é obrigatório e deve ser " +
      "uma string não vazia"
    );
  }

  // Sanitizar e validar campos numéricos de XP
  const xpEarned = sanitizeNumber(
    data.xpEarned,
    "xpEarned"
  );
  if (xpEarned > MAX_XP_PER_GAME) {
    logger.warn(
      "[XP_VALIDATION] xpEarned excessivo " +
      `(${xpEarned}) para user ` +
      `${data.userId} no jogo ` +
      `${data.gameId}. Limitando a ` +
      `${MAX_XP_PER_GAME}`
    );
  }
  if (xpEarned < MIN_XP_PER_GAME) {
    logger.warn(
      "[XP_VALIDATION] xpEarned muito " +
      `negativo (${xpEarned}) para user ` +
      `${data.userId}. Limitando a ` +
      `${MIN_XP_PER_GAME}`
    );
  }
  const clampedXpEarned = Math.max(
    MIN_XP_PER_GAME,
    Math.min(MAX_XP_PER_GAME, xpEarned)
  );

  const xpBefore = Math.max(
    0,
    sanitizeNumber(data.xpBefore, "xpBefore")
  );
  const xpAfter = Math.max(
    0,
    sanitizeNumber(data.xpAfter, "xpAfter")
  );

  // Validar consistência de XP (tolerância de 1)
  const expectedXpAfter =
    xpBefore + clampedXpEarned;
  if (Math.abs(xpAfter - expectedXpAfter) > 1) {
    logger.warn(
      "[XP_VALIDATION] Inconsistência de XP: " +
      `before=${xpBefore} + ` +
      `earned=${clampedXpEarned} != ` +
      `after=${xpAfter}. ` +
      "Recalculando xpAfter para " +
      `${Math.max(0, expectedXpAfter)}`
    );
  }
  const correctedXpAfter = Math.max(
    0,
    expectedXpAfter
  );

  // Validar levels
  const levelBefore = Math.max(
    0,
    Math.min(
      MAX_LEVEL,
      Math.floor(
        sanitizeNumber(
          data.levelBefore,
          "levelBefore"
        )
      )
    )
  );
  const levelAfter = Math.max(
    0,
    Math.min(
      MAX_LEVEL,
      Math.floor(
        sanitizeNumber(
          data.levelAfter,
          "levelAfter"
        )
      )
    )
  );

  // Sanitizar breakdown (XP por categoria)
  const breakdown: XpBreakdown = {
    participation: sanitizeNumber(
      data.breakdown?.participation,
      "breakdown.participation"
    ),
    goals: sanitizeNumber(
      data.breakdown?.goals,
      "breakdown.goals"
    ),
    assists: sanitizeNumber(
      data.breakdown?.assists,
      "breakdown.assists"
    ),
    saves: sanitizeNumber(
      data.breakdown?.saves,
      "breakdown.saves"
    ),
    result: sanitizeNumber(
      data.breakdown?.result,
      "breakdown.result"
    ),
    mvp: sanitizeNumber(
      data.breakdown?.mvp,
      "breakdown.mvp"
    ),
    cleanSheet: sanitizeNumber(
      data.breakdown?.cleanSheet,
      "breakdown.cleanSheet"
    ),
    milestones: sanitizeNumber(
      data.breakdown?.milestones,
      "breakdown.milestones"
    ),
    streak: sanitizeNumber(
      data.breakdown?.streak,
      "breakdown.streak"
    ),
    penalty: sanitizeNumber(
      data.breakdown?.penalty,
      "breakdown.penalty"
    ),
  };

  // Validar soma do breakdown (tolerância de 5)
  const breakdownSum = Object.values(breakdown)
    .reduce((sum, val) => sum + val, 0);
  if (
    Math.abs(breakdownSum - clampedXpEarned) > 5
  ) {
    logger.warn(
      "[XP_VALIDATION] Soma do breakdown " +
      `(${breakdownSum}) difere do xpEarned ` +
      `(${clampedXpEarned}). ` +
      "Verificar cálculos."
    );
  }

  // Sanitizar metadata
  // FIX #789: passar caps específicos (15/10/30) ao validateStatValue.
  // Antes usava default MAX_STATS_PER_GAME=50, permitindo stats infladas.
  const validResults = ["WIN", "DRAW", "LOSS"];
  const metadata: XpMetadata = {
    goals: Math.min(
      validateStatValue(data.metadata?.goals, "metadata.goals"),
      MAX_GOALS_PER_GAME,
    ),
    assists: Math.min(
      validateStatValue(data.metadata?.assists, "metadata.assists"),
      MAX_ASSISTS_PER_GAME,
    ),
    saves: Math.min(
      validateStatValue(data.metadata?.saves, "metadata.saves"),
      MAX_SAVES_PER_GAME,
    ),
    wasMvp: Boolean(data.metadata?.wasMvp),
    wasCleanSheet: Boolean(
      data.metadata?.wasCleanSheet
    ),
    wasWorstPlayer: Boolean(
      data.metadata?.wasWorstPlayer
    ),
    gameResult: validResults.includes(
      data.metadata?.gameResult
    ) ?
      data.metadata.gameResult :
      "DRAW",
    milestonesUnlocked: Array.isArray(
      data.metadata?.milestonesUnlocked
    ) ?
      data.metadata.milestonesUnlocked
        .filter(
          (m: string) =>
            typeof m === "string" &&
            m.length > 0
        )
        .slice(0, MAX_MILESTONES_PER_GAME) :
      [],
  };

  logger.info(
    "[XP_VALIDATION] Dados validados para " +
    `user ${data.userId} no jogo ` +
    `${data.gameId}: XP=${clampedXpEarned}, ` +
    `level=${levelBefore}->${levelAfter}`
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
// HELPER: SCHEMA DO XP LOG
// ==========================================

/**
 * Constrói o objeto de dados para um documento
 * xp_log. Centraliza o schema para evitar
 * duplicação entre processXpIdempotent e
 * processXpBatch.
 *
 * @param {string} transactionId - ID da transação
 * @param {XpTransactionData} data - Dados XP
 * @return {Record<string, unknown>} Documento
 */
function buildXpLogData(
  transactionId: string,
  data: XpTransactionData
): Record<string, unknown> {
  return {
    transaction_id: transactionId,
    user_id: data.userId,
    game_id: data.gameId,
    xp_earned: data.xpEarned,
    xp_before: data.xpBefore,
    xp_after: data.xpAfter,
    level_before: data.levelBefore,
    level_after: data.levelAfter,

    // Breakdown
    xp_participation:
      data.breakdown.participation,
    xp_goals: data.breakdown.goals,
    xp_assists: data.breakdown.assists,
    xp_saves: data.breakdown.saves,
    xp_result: data.breakdown.result,
    xp_mvp: data.breakdown.mvp,
    xp_clean_sheet:
      data.breakdown.cleanSheet,
    xp_milestones:
      data.breakdown.milestones,
    xp_streak: data.breakdown.streak,
    xp_penalty: data.breakdown.penalty,

    // Metadata
    goals: data.metadata.goals,
    assists: data.metadata.assists,
    saves: data.metadata.saves,
    was_mvp: data.metadata.wasMvp,
    was_clean_sheet:
      data.metadata.wasCleanSheet,
    was_worst_player:
      data.metadata.wasWorstPlayer,
    game_result:
      data.metadata.gameResult,
    milestones_unlocked:
      data.metadata.milestonesUnlocked,

    // Timestamps
    created_at:
      FieldValue
        .serverTimestamp(),
    processed_at:
      FieldValue
        .serverTimestamp(),
  };
}

// ==========================================
// GERAÇÃO DE TRANSACTION ID
// ==========================================

/**
 * Gera um transaction_id determinístico baseado
 * em game_id + user_id. Garante que o mesmo
 * evento sempre gera o mesmo transaction_id.
 *
 * @param {string} gameId - ID do jogo
 * @param {string} userId - ID do usuário
 * @return {string} Transaction ID
 */
export function generateTransactionId(
  gameId: string,
  userId: string
): string {
  return `game_${gameId}_user_${userId}`;
}

// ==========================================
// VERIFICAÇÃO DE IDEMPOTÊNCIA
// ==========================================

/**
 * Verifica se uma transação XP já foi processada.
 * Retorna true se já existe xp_log com o
 * transaction_id.
 *
 * @param {string} transactionId - ID da transação
 * @return {Promise<boolean>} true se já processada
 */
export async function isTransactionAlreadyProcessed(
  transactionId: string
): Promise<boolean> {
  try {
    const docSnap = await db()
      .collection("xp_logs")
      .doc(transactionId)
      .get();

    return docSnap.exists;
  } catch (error) {
    logger.error(
      "[XP_IDEMPOTENCY] Erro ao verificar " +
      `transação ${transactionId}:`,
      error
    );
    throw error;
  }
}

// ==========================================
// PROCESSAMENTO IDEMPOTENTE DE XP
// ==========================================

/**
 * Processa XP para um jogador com garantia de
 * idempotência.
 *
 * IMPORTANTE: Esta função pode ser chamada
 * múltiplas vezes com segurança. Se o
 * transaction_id já existir, retorna sucesso
 * sem processar novamente.
 *
 * @param {XpTransactionData} data - Dados da
 *   transação XP
 * @return {Promise<XpProcessingResult>} Resultado
 */
export async function processXpIdempotent(
  data: XpTransactionData
): Promise<XpProcessingResult> {
  // FASE 0: Validação e sanitização de dados
  let validatedData: XpTransactionData;
  try {
    validatedData =
      validateAndSanitizeXpData(data);
  } catch (validationError: unknown) {
    const typedError =
      validationError as Error;
    logger.error(
      "[XP_IDEMPOTENCY] Dados inválidos " +
      `recusados: ${typedError.message}`,
      {
        gameId: data.gameId,
        userId: data.userId,
      }
    );
    const unknownGameId =
      data.gameId || "unknown";
    const unknownUserId =
      data.userId || "unknown";
    return {
      success: false,
      transactionId:
        "invalid_" + unknownGameId +
        "_" + unknownUserId,
      alreadyProcessed: false,
      error:
        "Validação falhou: " +
        typedError.message,
    };
  }

  // Usar dados validados daqui em diante
  data = validatedData;
  const transactionId = generateTransactionId(
    data.gameId,
    data.userId
  );

  // FASE 1: Verificação de idempotência
  const alreadyProcessed =
    await isTransactionAlreadyProcessed(
      transactionId
    );

  if (alreadyProcessed) {
    logger.info(
      "[XP_IDEMPOTENCY] Transação " +
      `${transactionId} já processada. Pulando.`
    );
    return {
      success: true,
      transactionId,
      alreadyProcessed: true,
    };
  }

  // FASE 2: Processamento atômico via Transaction
  try {
    await db().runTransaction(
      async (transaction) => {
        // 2.1: Re-verificar idempotência com doc ID determinístico
        //      (SECFIX #1453: doc read é lockado na transaction,
        //       query read com zero docs não cria range-lock)
        const xpLogsRef = db()
          .collection("xp_logs");
        const logRef = xpLogsRef.doc(transactionId);
        const existingSnap =
          await transaction.get(logRef);

        if (existingSnap.exists) {
          logger.info(
            "[XP_IDEMPOTENCY] Transação " +
            `${transactionId} já processada ` +
            "(race condition detectada). " +
            "Abortando."
          );
          return;
        }

        // 2.2: Atualizar XP do usuário
        const userRef = db()
          .collection("users")
          .doc(data.userId);
        const userDoc =
          await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error(
            "Usuário " +
            `${data.userId} não encontrado`
          );
        }

        transaction.update(userRef, {
          experience_points: FieldValue.increment(data.xpEarned),
          level: data.levelAfter,
          updated_at:
            FieldValue
              .serverTimestamp(),
        });

        // 2.3: Atualizar milestones
        if (
          data.metadata.milestonesUnlocked
            .length > 0
        ) {
          transaction.update(userRef, {
            milestones_achieved:
              FieldValue
                .arrayUnion(
                  ...data.metadata
                    .milestonesUnlocked
                ),
          });
        }

        // 2.4: Criar XP log com doc ID determinístico (transaction_id)
        transaction.set(
          logRef,
          buildXpLogData(transactionId, data)
        );

        logger.info(
          "[XP_IDEMPOTENCY] Transação " +
          `${transactionId} processada com ` +
          `sucesso: +${data.xpEarned} XP`
        );
      }
    );

    return {
      success: true,
      transactionId,
      alreadyProcessed: false,
    };
  } catch (error: unknown) {
    const typedError =
      error as Record<string, unknown>;
    logger.error(
      "[XP_IDEMPOTENCY] Erro ao processar " +
      `transação ${transactionId}:`,
      error
    );

    return {
      success: false,
      transactionId,
      alreadyProcessed: false,
      error:
        (typedError.message as string) ||
        "Erro desconhecido",
    };
  }
}

// ==========================================
// BATCH PROCESSING
// ==========================================

/**
 * Processa múltiplas transações XP em batch com
 * idempotência.
 *
 * PERFORMANCE: Usa batch writes (500 ops/batch)
 * IDEMPOTÊNCIA: Filtra transações já processadas
 *
 * @param {XpTransactionData[]} inputTransactions -
 *   Lista de transações XP
 * @return {Promise<XpProcessingResult[]>}
 *   Lista de resultados
 */
export async function processXpBatch(
  inputTransactions: XpTransactionData[]
): Promise<XpProcessingResult[]> {
  let transactions = [...inputTransactions];
  if (transactions.length === 0) {
    return [];
  }

  logger.info(
    "[XP_BATCH] Processando " +
    `${transactions.length} transações...`
  );

  // FASE 0: Validar e sanitizar todas
  const validatedTransactions:
    XpTransactionData[] = [];
  const validationFailures:
    XpProcessingResult[] = [];

  for (const txn of transactions) {
    try {
      validatedTransactions.push(
        validateAndSanitizeXpData(txn)
      );
    } catch (validationError: unknown) {
      const typedError =
        validationError as Error;
      logger.error(
        "[XP_BATCH] Transação rejeitada na " +
        "validação: " + typedError.message,
        {
          gameId: txn.gameId,
          userId: txn.userId,
        }
      );
      const unknownGameId =
        txn.gameId || "unknown";
      const unknownUserId =
        txn.userId || "unknown";
      validationFailures.push({
        success: false,
        transactionId:
          "invalid_" + unknownGameId +
          "_" + unknownUserId,
        alreadyProcessed: false,
        error:
          "Validação falhou: " +
          typedError.message,
      });
    }
  }

  if (validationFailures.length > 0) {
    logger.warn(
      `[XP_BATCH] ${validationFailures.length}` +
      `/${transactions.length} transações ` +
      "rejeitadas na validação"
    );
  }

  // Substituir transactions pelas validadas
  transactions = validatedTransactions;

  // SECFIX #441: Idempotência atômica via runTransaction
  //
  // Problema antigo: o whereIn de pré-filtro rodava FORA de
  // transaction (Promise.all sobre db().collection().where()).
  // Sob retry concorrente do trigger, 2 instances liam empty,
  // ambos commitavam — XP duplicado.
  //
  // Fix: cada chunk roda em runTransaction com:
  //   1. xp_logs/{transactionId} como doc ID determinístico
  //   2. tx.get(logRef) atômico pra detectar duplicata
  //   3. tx.set + tx.update no mesmo escopo
  // Firestore garante: 2 transactions concorrentes no mesmo
  // logRef → 1 vence, outra retry, detecta exists, skip.
  //
  // Limites: 500 reads + 500 writes por transaction. Cada
  // transação aqui = 1 read (logRef) + 2-3 writes (user,
  // milestone opt, log). Chunk de 50 → 50 reads + ~150 writes.
  const TXN_CHUNK_SIZE = 50;
  const results: XpProcessingResult[] = [];

  for (
    let i = 0;
    i < transactions.length;
    i += TXN_CHUNK_SIZE
  ) {
    const chunk = transactions.slice(
      i,
      i + TXN_CHUNK_SIZE
    );

    try {
      const chunkResults = await db().runTransaction(
        async (tx) => {
          const partial: XpProcessingResult[] = [];

          // FASE A: ler todos os logRef do chunk pra
          // detectar duplicatas atomicamente
          const refs = chunk.map((data) => ({
            data,
            transactionId:
              generateTransactionId(
                data.gameId,
                data.userId
              ),
            logRef: db()
              .collection("xp_logs")
              .doc(
                generateTransactionId(
                  data.gameId,
                  data.userId
                )
              ),
          }));

          const snaps = await Promise.all(
            refs.map((r) => tx.get(r.logRef))
          );

          // FASE B: escrever apenas os não-processados
          for (let j = 0; j < refs.length; j++) {
            const {data, transactionId, logRef} =
              refs[j];
            const snap = snaps[j];

            if (snap.exists) {
              partial.push({
                success: true,
                transactionId,
                alreadyProcessed: true,
              });
              continue;
            }

            const userRef = db()
              .collection("users")
              .doc(data.userId);

            tx.update(userRef, {
              experience_points:
                FieldValue.increment(
                  data.xpEarned
                ),
              level: data.levelAfter,
              updated_at:
                FieldValue
                  .serverTimestamp(),
            });

            if (
              data.metadata.milestonesUnlocked
                .length > 0
            ) {
              tx.update(userRef, {
                milestones_achieved:
                  FieldValue
                    .arrayUnion(
                      ...data.metadata
                        .milestonesUnlocked
                    ),
              });
            }

            tx.set(
              logRef,
              buildXpLogData(
                transactionId,
                data
              )
            );

            partial.push({
              success: true,
              transactionId,
              alreadyProcessed: false,
            });
          }

          return partial;
        }
      );

      results.push(...chunkResults);

      const skippedInChunk = chunkResults.filter(
        (r) => r.alreadyProcessed
      ).length;
      logger.info(
        "[XP_BATCH] Chunk de " +
        `${chunk.length} transações commitado ` +
        `(${skippedInChunk} já processadas)`
      );
    } catch (error: unknown) {
      const typedError =
        error as Record<string, unknown>;
      logger.error(
        "[XP_BATCH] Erro ao commitar chunk " +
        `${i / TXN_CHUNK_SIZE}:`,
        error
      );
      // Marcar todas do chunk como falhadas
      for (const data of chunk) {
        results.push({
          success: false,
          transactionId: generateTransactionId(
            data.gameId,
            data.userId
          ),
          alreadyProcessed: false,
          error: typedError.message as string,
        });
      }
    }
  }

  const successCount = results.filter(
    (r) => r.success
  ).length;
  const failSuffix =
    validationFailures.length > 0 ?
      `, ${validationFailures.length}` +
        " rejeitados na validação" :
      "";

  logger.info(
    "[XP_BATCH] Processamento completo: " +
    `${successCount}/` +
    `${inputTransactions.length} sucesso` +
    failSuffix
  );

  return [...validationFailures, ...results];
}

// ==========================================
// UTILITÁRIOS DE RETRY
// ==========================================

/**
 * Retry com exponential backoff para operações XP.
 * Útil para lidar com contenção de Firestore.
 *
 * @param {Function} operation - Operação async
 * @param {number} maxRetries - Máx tentativas
 * @param {number} initialBackoffMs - Backoff
 *   inicial
 * @return {Promise<T>} Resultado da operação
 */
export async function retryXpOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialBackoffMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      const typedError =
        error as Record<string, unknown>;
      // Só retry em erros transientes
      const errMsg =
        typedError.message as string | undefined;
      const isTransient =
        typedError.code === 10 ||
        typedError.code === 14 ||
        errMsg?.includes(
          "DEADLINE_EXCEEDED"
        ) ||
        errMsg?.includes("contention");

      if (
        !isTransient ||
        attempt === maxRetries
      ) {
        throw error;
      }

      const backoffMs =
        Math.pow(2, attempt - 1) *
        initialBackoffMs;
      logger.info(
        "[XP_RETRY] Tentativa " +
        `${attempt}/${maxRetries} falhou. ` +
        `Retry em ${backoffMs}ms...`
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, backoffMs)
      );
    }
  }

  throw lastError;
}
