/**
 * RETRY COM EXPONENTIAL BACKOFF - Utilitário
 *
 * Fornece retry automático com backoff exponencial
 * para qualquer operação async.
 * Diferencia erros transientes (retry) de erros
 * permanentes (fail-fast).
 *
 * FEATURES:
 * - Exponential backoff com jitter
 * - Classificação automática de erros
 * - Dead letter queue para falhas permanentes
 * - Configurável por operação
 * - Logging estruturado
 *
 * USO:
 * ```typescript
 * import {retryWithBackoff} from
 *   "../utils/retry-with-backoff";
 *
 * const result = await retryWithBackoff(
 *   () => firestoreOperation(),
 *   {maxRetries: 3, operationName: "updateUser"}
 * );
 * ```
 *
 * @see specs/BACKEND_OPTIMIZATION_SPEC.md - PHASE 3
 */

import * as admin from "firebase-admin";

const getDb = () => admin.firestore();

// ==========================================
// INTERFACES
// ==========================================

/** Configuração do retry */
export interface RetryConfig {
  /** Número máximo de tentativas. Padrão: 3 */
  maxRetries?: number;
  /** Backoff inicial em ms. Padrão: 1000 */
  initialBackoffMs?: number;
  /** Backoff máximo em ms. Padrão: 30000 */
  maxBackoffMs?: number;
  /** Multiplicador do backoff. Padrão: 2 */
  backoffMultiplier?: number;
  /** Adicionar jitter ao backoff. Padrão: true */
  jitter?: boolean;
  /** Nome da operação (para logs) */
  operationName?: string;
  /** Enviar para DLQ em falha. Padrão: false */
  enableDeadLetterQueue?: boolean;
  /** Contexto adicional para logs/DLQ */
  context?: Record<string, unknown>;
  /** Função para verificar se erro é transiente */
  isTransientError?: (
    error: Record<string, unknown> | Error
  ) => boolean;
}

/** Resultado do retry */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  attempts: number;
  totalDurationMs: number;
  sentToDeadLetterQueue: boolean;
}

/** Documento na dead letter queue */
export interface DeadLetterEntry {
  operation_name: string;
  error_message: string;
  error_code?: string;
  attempts: number;
  total_duration_ms: number;
  context: Record<string, unknown>;
  created_at: admin.firestore.FieldValue;
  status: "PENDING" | "RESOLVED" | "IGNORED";
  resolved_at?: admin.firestore.FieldValue;
  resolved_by?: string;
}

// ==========================================
// CONSTANTES
// ==========================================

/** Coleção para dead letter queue */
const DEAD_LETTER_COLLECTION = "dead_letter_queue";

/** Configuração padrão */
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  operationName: "operation",
  enableDeadLetterQueue: false,
  context: {},
  isTransientError: defaultIsTransientError,
};

// ==========================================
// CLASSIFICAÇÃO DE ERROS
// ==========================================

/**
 * Verifica se um erro é transiente (retry seguro)
 * ou permanente (fail-fast).
 *
 * Erros transientes (retry):
 * - ABORTED (code 10): Contenção Firestore
 * - UNAVAILABLE (code 14): Serviço indisponível
 * - DEADLINE_EXCEEDED: Timeout de operação
 * - RESOURCE_EXHAUSTED: Quota excedida
 * - Network errors: ECONNRESET, ETIMEDOUT, etc.
 *
 * Erros permanentes (fail-fast):
 * - INVALID_ARGUMENT: Dados inválidos
 * - PERMISSION_DENIED: Sem permissão
 * - NOT_FOUND: Documento não existe
 * - ALREADY_EXISTS: Documento já existe
 * - UNAUTHENTICATED: Não autenticado
 *
 * @param {Record<string, unknown> | Error} error -
 *   O erro a ser classificado
 * @return {boolean} true se erro é transiente
 */
export function defaultIsTransientError(
  error: Record<string, unknown> | Error
): boolean {
  // Códigos gRPC transientes
  const transientGrpcCodes = [
    10, // ABORTED
    14, // UNAVAILABLE
    4, // DEADLINE_EXCEEDED
    8, // RESOURCE_EXHAUSTED
  ];

  const errorRecord =
    error as Record<string, unknown>;
  if (
    errorRecord.code &&
    typeof errorRecord.code === "number"
  ) {
    return transientGrpcCodes.includes(
      errorRecord.code as number
    );
  }

  // Mensagens de erro transientes
  const transientMessages = [
    "DEADLINE_EXCEEDED",
    "UNAVAILABLE",
    "ABORTED",
    "contention",
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "socket hang up",
    "network error",
    "RESOURCE_EXHAUSTED",
  ];

  const errorMessage = (
    (errorRecord.message as string) || ""
  ).toLowerCase();

  return transientMessages.some((msg) =>
    errorMessage.includes(msg.toLowerCase())
  );
}

// ==========================================
// FUNÇÃO PRINCIPAL: retryWithBackoff
// ==========================================

/**
 * Executa uma operação com retry e exponential
 * backoff.
 *
 * ESTRATÉGIA:
 * 1. Executar operação
 * 2. Se sucesso: retornar resultado
 * 3. Se erro transiente: aguardar backoff e retry
 * 4. Se erro permanente: falhar imediatamente
 * 5. Se max retries: falhar e opcionalmente DLQ
 *
 * @param {Function} operation - Função async
 * @param {RetryConfig} config - Configuração
 * @return {Promise<RetryResult<T>>} Resultado
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const cfg = {...DEFAULT_CONFIG, ...config};
  const startTime = Date.now();
  let lastError: Record<string, unknown> | Error |
    undefined;

  for (
    let attempt = 1;
    attempt <= cfg.maxRetries;
    attempt++
  ) {
    try {
      const result = await operation();

      // Log de sucesso (se houve retries)
      if (attempt > 1) {
        console.log(
          `[RETRY] ${cfg.operationName}: ` +
          "Sucesso na tentativa " +
          `${attempt}/${cfg.maxRetries} ` +
          `(${Date.now() - startTime}ms total)`
        );
      }

      return {
        success: true,
        result,
        attempts: attempt,
        totalDurationMs: Date.now() - startTime,
        sentToDeadLetterQueue: false,
      };
    } catch (error: unknown) {
      const typedError =
        error as Record<string, unknown>;
      lastError = typedError;

      // Verificar se o erro é transiente
      const isTransient =
        cfg.isTransientError!(typedError);

      if (!isTransient) {
        // Erro permanente: falhar imediatamente
        const errMsg =
          (typedError.message as string) ||
          String(error);
        console.error(
          `[RETRY] ${cfg.operationName}: ` +
          "Erro permanente na tentativa " +
          `${attempt}. Não retentando. ` +
          `Erro: ${errMsg}`
        );

        const dlqSent = cfg.enableDeadLetterQueue ?
          await sendToDeadLetterQueue(
            cfg,
            typedError,
            attempt,
            Date.now() - startTime
          ) :
          false;

        return {
          success: false,
          error:
            (typedError.message as string) ||
            "Erro permanente",
          attempts: attempt,
          totalDurationMs:
            Date.now() - startTime,
          sentToDeadLetterQueue: dlqSent,
        };
      }

      // Se é a última tentativa, não backoff
      if (attempt === cfg.maxRetries) {
        const errMsg =
          (typedError.message as string) ||
          String(error);
        console.error(
          `[RETRY] ${cfg.operationName}: ` +
          "Max retries " +
          `(${cfg.maxRetries}) atingido. ` +
          `Último erro: ${errMsg}`
        );
        break;
      }

      // Calcular backoff exponencial com jitter
      const baseBackoff = Math.min(
        cfg.initialBackoffMs *
          Math.pow(
            cfg.backoffMultiplier,
            attempt - 1
          ),
        cfg.maxBackoffMs
      );

      const jitterMs = cfg.jitter ?
        Math.random() * baseBackoff * 0.3 :
        0;

      const backoffMs = Math.round(
        baseBackoff + jitterMs
      );

      const errCode =
        (typedError.code as string) ||
        (typedError.message as string);
      console.log(
        `[RETRY] ${cfg.operationName}: ` +
        `Tentativa ${attempt}/` +
        `${cfg.maxRetries} falhou ` +
        `(erro transiente: ${errCode}). ` +
        `Retry em ${backoffMs}ms...`
      );

      await sleep(backoffMs);
    }
  }

  // Todas as tentativas falharam
  const dlqSent = cfg.enableDeadLetterQueue ?
    await sendToDeadLetterQueue(
      cfg,
      lastError as Record<string, unknown>,
      cfg.maxRetries,
      Date.now() - startTime
    ) :
    false;

  const lastErrRecord =
    lastError as Record<string, unknown> | undefined;

  return {
    success: false,
    error:
      (lastErrRecord?.message as string) ||
      "Max retries excedido",
    attempts: cfg.maxRetries,
    totalDurationMs: Date.now() - startTime,
    sentToDeadLetterQueue: dlqSent,
  };
}

// ==========================================
// DEAD LETTER QUEUE
// ==========================================

/**
 * Envia uma operação falhada para a dead letter
 * queue.
 *
 * A DLQ armazena operações que falharam
 * permanentemente para análise e resolução manual.
 *
 * @param {Required<RetryConfig>} config -
 *   Configuração da operação
 * @param {Record<string, unknown>} error -
 *   Erro que causou a falha
 * @param {number} attempts - Número de tentativas
 * @param {number} durationMs - Duração total
 * @return {Promise<boolean>} true se enviado
 */
async function sendToDeadLetterQueue(
  config: Required<RetryConfig>,
  error: Record<string, unknown>,
  attempts: number,
  durationMs: number
): Promise<boolean> {
  try {
    const db = getDb();
    const entry: DeadLetterEntry = {
      operation_name: config.operationName,
      error_message:
        (error?.message as string) || String(error),
      error_code:
        error?.code?.toString(),
      attempts,
      total_duration_ms: durationMs,
      context: config.context,
      created_at:
        admin.firestore.FieldValue
          .serverTimestamp(),
      status: "PENDING",
    };

    await db
      .collection(DEAD_LETTER_COLLECTION)
      .add(entry);

    console.log(
      "[DLQ] Operação " +
      `"${config.operationName}" enviada ` +
      "para dead letter queue " +
      `(${attempts} tentativas, ` +
      `${durationMs}ms)`
    );

    return true;
  } catch (dlqError) {
    console.error(
      "[DLQ] Erro ao enviar para " +
      "dead letter queue:",
      dlqError
    );
    return false;
  }
}

/**
 * Busca itens pendentes na dead letter queue.
 *
 * @param {number} limit - Número máximo de itens
 * @return {Promise<Array<DeadLetterEntry>>}
 *   Array de documentos da DLQ
 */
export async function getDeadLetterQueueItems(
  limit = 50
): Promise<Array<DeadLetterEntry & {id: string}>> {
  const db = getDb();

  try {
    const snapshot = await db
      .collection(DEAD_LETTER_COLLECTION)
      .where("status", "==", "PENDING")
      .orderBy("created_at", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data() as DeadLetterEntry,
    }));
  } catch (error) {
    console.error(
      "[DLQ] Erro ao buscar itens:",
      error
    );
    return [];
  }
}

/**
 * Marca um item da DLQ como resolvido.
 *
 * @param {string} docId - ID do documento na DLQ
 * @param {string} resolvedBy - UID do usuário
 * @return {Promise<void>}
 */
export async function resolveDeadLetterItem(
  docId: string,
  resolvedBy: string
): Promise<void> {
  const db = getDb();

  await db
    .collection(DEAD_LETTER_COLLECTION)
    .doc(docId)
    .update({
      status: "RESOLVED",
      resolved_at:
        admin.firestore.FieldValue
          .serverTimestamp(),
      resolved_by: resolvedBy,
    });

  console.log(
    `[DLQ] Item ${docId} marcado como ` +
    `resolvido por ${resolvedBy}`
  );
}

// ==========================================
// UTILITÁRIOS
// ==========================================

/**
 * Sleep helper.
 *
 * @param {number} ms - Milissegundos para esperar
 * @return {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

/**
 * Wrapper conveniente para operações Firestore
 * com retry.
 *
 * Pré-configurado para erros comuns do Firestore:
 * - Contenção (ABORTED)
 * - Timeout (DEADLINE_EXCEEDED)
 * - Serviço indisponível (UNAVAILABLE)
 *
 * @param {Function} operation - Operação async
 * @param {string} operationName - Nome para logs
 * @param {boolean} enableDLQ - Habilitar DLQ
 * @return {Promise<T>} Resultado da operação
 */
export async function retryFirestoreOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  enableDLQ = false
): Promise<T> {
  const result = await retryWithBackoff(operation, {
    maxRetries: 3,
    initialBackoffMs: 1000,
    operationName,
    enableDeadLetterQueue: enableDLQ,
  });

  if (!result.success) {
    throw new Error(
      `Operação "${operationName}" falhou ` +
      `após ${result.attempts} tentativas: ` +
      result.error
    );
  }

  return result.result!;
}
