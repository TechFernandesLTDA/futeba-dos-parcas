/**
 * RETRY COM EXPONENTIAL BACKOFF - Utilitário Genérico
 *
 * Fornece retry automático com backoff exponencial para qualquer operação async.
 * Diferencia erros transientes (retry) de erros permanentes (fail-fast).
 *
 * FEATURES:
 * - Exponential backoff com jitter (evita thundering herd)
 * - Classificação automática de erros transientes vs permanentes
 * - Dead letter queue para falhas permanentes (log em Firestore)
 * - Configurável por operação
 * - Logging estruturado para observabilidade
 *
 * USO:
 * ```typescript
 * import { retryWithBackoff } from "../utils/retry-with-backoff";
 *
 * const result = await retryWithBackoff(
 *   () => firestoreOperation(),
 *   { maxRetries: 3, operationName: "updateUser" }
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
  /** Número máximo de tentativas (incluindo a primeira). Padrão: 3 */
  maxRetries?: number;
  /** Backoff inicial em milissegundos. Padrão: 1000 */
  initialBackoffMs?: number;
  /** Backoff máximo em milissegundos. Padrão: 30000 */
  maxBackoffMs?: number;
  /** Multiplicador do backoff. Padrão: 2 */
  backoffMultiplier?: number;
  /** Adicionar jitter aleatório ao backoff. Padrão: true */
  jitter?: boolean;
  /** Nome da operação (para logs). Padrão: "operation" */
  operationName?: string;
  /** Enviar para dead letter queue em caso de falha permanente. Padrão: false */
  enableDeadLetterQueue?: boolean;
  /** Contexto adicional para logs/dead letter queue */
  context?: Record<string, any>;
  /** Função personalizada para verificar se o erro é transiente */
  isTransientError?: (error: any) => boolean;
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
  context: Record<string, any>;
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
 * Verifica se um erro é transiente (retry seguro) ou permanente (fail-fast).
 *
 * Erros transientes (retry):
 * - ABORTED (code 10): Contenção Firestore
 * - UNAVAILABLE (code 14): Serviço indisponível temporariamente
 * - DEADLINE_EXCEEDED: Timeout de operação
 * - RESOURCE_EXHAUSTED: Quota excedida temporariamente
 * - Network errors: ECONNRESET, ETIMEDOUT, ECONNREFUSED
 *
 * Erros permanentes (fail-fast):
 * - INVALID_ARGUMENT: Dados inválidos (não adianta retentar)
 * - PERMISSION_DENIED: Sem permissão
 * - NOT_FOUND: Documento não existe
 * - ALREADY_EXISTS: Documento já existe
 * - UNAUTHENTICATED: Não autenticado
 */
export function defaultIsTransientError(error: any): boolean {
  // Códigos gRPC transientes
  const transientGrpcCodes = [
    10, // ABORTED
    14, // UNAVAILABLE
    4,  // DEADLINE_EXCEEDED
    8,  // RESOURCE_EXHAUSTED
  ];

  if (error.code && typeof error.code === "number") {
    return transientGrpcCodes.includes(error.code);
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

  const errorMessage = (error.message || "").toLowerCase();

  return transientMessages.some((msg) =>
    errorMessage.includes(msg.toLowerCase())
  );
}

// ==========================================
// FUNÇÃO PRINCIPAL: retryWithBackoff
// ==========================================

/**
 * Executa uma operação com retry e exponential backoff.
 *
 * ESTRATÉGIA:
 * 1. Executar operação
 * 2. Se sucesso: retornar resultado
 * 3. Se erro transiente: aguardar backoff e retentar
 * 4. Se erro permanente: falhar imediatamente
 * 5. Se max retries atingido: falhar e opcionalmente enviar para DLQ
 *
 * BACKOFF:
 * - Tentativa 1: imediato
 * - Tentativa 2: 1s (+ jitter)
 * - Tentativa 3: 2s (+ jitter)
 * - Tentativa 4: 4s (+ jitter)
 * - ...
 *
 * @param operation Função async para executar
 * @param config Configuração do retry
 * @returns Resultado com metadata do retry
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const cfg = {...DEFAULT_CONFIG, ...config};
  const startTime = Date.now();
  let lastError: any;

  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    try {
      const result = await operation();

      // Log de sucesso (se houve retries)
      if (attempt > 1) {
        console.log(
          `[RETRY] ${cfg.operationName}: Sucesso na tentativa ${attempt}/${cfg.maxRetries} ` +
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
    } catch (error: any) {
      lastError = error;

      // Verificar se o erro é transiente
      const isTransient = cfg.isTransientError!(error);

      if (!isTransient) {
        // Erro permanente: falhar imediatamente
        console.error(
          `[RETRY] ${cfg.operationName}: Erro permanente na tentativa ${attempt}. ` +
          `Não retentando. Erro: ${error.message || error}`
        );

        const dlqSent = cfg.enableDeadLetterQueue
          ? await sendToDeadLetterQueue(cfg, error, attempt, Date.now() - startTime)
          : false;

        return {
          success: false,
          error: error.message || "Erro permanente",
          attempts: attempt,
          totalDurationMs: Date.now() - startTime,
          sentToDeadLetterQueue: dlqSent,
        };
      }

      // Se é a última tentativa, não fazer backoff
      if (attempt === cfg.maxRetries) {
        console.error(
          `[RETRY] ${cfg.operationName}: Max retries (${cfg.maxRetries}) atingido. ` +
          `Último erro: ${error.message || error}`
        );
        break;
      }

      // Calcular backoff exponencial com jitter
      const baseBackoff = Math.min(
        cfg.initialBackoffMs * Math.pow(cfg.backoffMultiplier, attempt - 1),
        cfg.maxBackoffMs
      );

      const jitterMs = cfg.jitter
        ? Math.random() * baseBackoff * 0.3 // 0-30% de jitter
        : 0;

      const backoffMs = Math.round(baseBackoff + jitterMs);

      console.log(
        `[RETRY] ${cfg.operationName}: Tentativa ${attempt}/${cfg.maxRetries} falhou ` +
        `(erro transiente: ${error.code || error.message}). ` +
        `Retry em ${backoffMs}ms...`
      );

      await sleep(backoffMs);
    }
  }

  // Todas as tentativas falharam
  const dlqSent = cfg.enableDeadLetterQueue
    ? await sendToDeadLetterQueue(cfg, lastError, cfg.maxRetries, Date.now() - startTime)
    : false;

  return {
    success: false,
    error: lastError?.message || "Max retries excedido",
    attempts: cfg.maxRetries,
    totalDurationMs: Date.now() - startTime,
    sentToDeadLetterQueue: dlqSent,
  };
}

// ==========================================
// DEAD LETTER QUEUE
// ==========================================

/**
 * Envia uma operação falhada para a dead letter queue.
 *
 * A DLQ armazena operações que falharam permanentemente para
 * análise e resolução manual.
 *
 * @param config Configuração da operação
 * @param error Erro que causou a falha
 * @param attempts Número de tentativas
 * @param durationMs Duração total
 * @returns true se enviado com sucesso
 */
async function sendToDeadLetterQueue(
  config: Required<RetryConfig>,
  error: any,
  attempts: number,
  durationMs: number
): Promise<boolean> {
  try {
    const db = getDb();
    const entry: DeadLetterEntry = {
      operation_name: config.operationName,
      error_message: error?.message || String(error),
      error_code: error?.code?.toString(),
      attempts,
      total_duration_ms: durationMs,
      context: config.context,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: "PENDING",
    };

    await db.collection(DEAD_LETTER_COLLECTION).add(entry);

    console.log(
      `[DLQ] Operação "${config.operationName}" enviada para dead letter queue ` +
      `(${attempts} tentativas, ${durationMs}ms)`
    );

    return true;
  } catch (dlqError) {
    console.error(
      `[DLQ] Erro ao enviar para dead letter queue:`, dlqError
    );
    return false;
  }
}

/**
 * Busca itens pendentes na dead letter queue.
 *
 * @param limit Número máximo de itens. Padrão: 50
 * @returns Array de documentos da DLQ
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
    console.error("[DLQ] Erro ao buscar itens:", error);
    return [];
  }
}

/**
 * Marca um item da dead letter queue como resolvido.
 *
 * @param docId ID do documento na DLQ
 * @param resolvedBy UID do usuário que resolveu
 */
export async function resolveDeadLetterItem(
  docId: string,
  resolvedBy: string
): Promise<void> {
  const db = getDb();

  await db.collection(DEAD_LETTER_COLLECTION).doc(docId).update({
    status: "RESOLVED",
    resolved_at: admin.firestore.FieldValue.serverTimestamp(),
    resolved_by: resolvedBy,
  });

  console.log(`[DLQ] Item ${docId} marcado como resolvido por ${resolvedBy}`);
}

// ==========================================
// UTILITÁRIOS
// ==========================================

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper conveniente para operações Firestore com retry.
 *
 * Pré-configurado para erros comuns do Firestore:
 * - Contenção (ABORTED)
 * - Timeout (DEADLINE_EXCEEDED)
 * - Serviço indisponível (UNAVAILABLE)
 *
 * @param operation Operação Firestore async
 * @param operationName Nome para logs
 * @param enableDLQ Habilitar dead letter queue
 * @returns Resultado da operação
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
      `Operação "${operationName}" falhou após ${result.attempts} tentativas: ${result.error}`
    );
  }

  return result.result!;
}
