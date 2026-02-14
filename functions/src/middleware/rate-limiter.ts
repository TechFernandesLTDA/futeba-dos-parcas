/**
 * RATE LIMITING MIDDLEWARE
 *
 * Sistema de rate limiting para Cloud Functions
 * callable. Previne abuso e garante fair usage.
 *
 * FEATURES:
 * - Limite por usuário (UID-based)
 * - Janelas deslizantes (sliding window)
 * - Armazenamento em Firestore (distributed)
 * - Cleanup automático de registros expirados
 */

import * as admin from "firebase-admin";
import {
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";

const db = admin.firestore();

// ==========================================
// CONFIGURAÇÃO DE RATE LIMITS
// ==========================================

/** Configuração de rate limit */
export interface RateLimitConfig {
  /** Máximo de requests permitidos */
  maxRequests: number;
  /** Janela de tempo em milissegundos */
  windowMs: number;
  /** Prefixo para diferenciar endpoints */
  keyPrefix?: string;
}

/** Resultado da verificação de rate limit */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// Rate limits por tipo de operação
export const RATE_LIMITS = {
  // Operações críticas (alta prioridade)
  GAME_CREATE: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  }, // 10/min
  GAME_UPDATE: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  }, // 20/min
  GAME_DELETE: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  }, // 5/min

  // Operações de leitura (média prioridade)
  GAME_LIST: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  }, // 30/min
  USER_PROFILE: {
    maxRequests: 50,
    windowMs: 60 * 1000,
  }, // 50/min

  // Operações batch (baixa prioridade)
  BATCH_OPERATION: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  }, // 5/min

  // Notificações
  SEND_NOTIFICATION: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  }, // 20/min

  // Default fallback
  DEFAULT: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  }, // 10/min
} as const;

// ==========================================
// RATE LIMIT CHECK
// ==========================================

/**
 * Verifica se um usuário excedeu o rate limit.
 *
 * @param {string} userId - UID do usuário
 * @param {RateLimitConfig} config - Configuração
 * @return {Promise<RateLimitResult>} Resultado
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Chave única para o bucket
  const keyPrefix =
    config.keyPrefix || "default";
  const bucketKey = `${keyPrefix}_${userId}`;
  const bucketRef = db
    .collection("rate_limits")
    .doc(bucketKey);

  try {
    // Usar transação para atomicidade
    const result = await db.runTransaction(
      async (transaction) => {
        const bucketDoc =
          await transaction.get(bucketRef);

        let requests: number[] = [];

        if (bucketDoc.exists) {
          const data = bucketDoc.data();
          // Filtrar requests dentro da janela
          requests = (
            data?.requests || []
          ).filter(
            (timestamp: number) =>
              timestamp > windowStart
          );
        }

        // Adicionar request atual
        requests.push(now);

        const currentCount = requests.length;
        const allowed =
          currentCount <= config.maxRequests;
        const remaining = Math.max(
          0,
          config.maxRequests - currentCount
        );
        const resetAt =
          new Date(now + config.windowMs);

        // Atualizar bucket
        transaction.set(
          bucketRef,
          {
            requests,
            last_updated:
              admin.firestore.FieldValue
                .serverTimestamp(),
            expires_at:
              admin.firestore.Timestamp
                .fromDate(resetAt),
          },
          {merge: true}
        );

        return {allowed, remaining, resetAt};
      }
    );

    return result;
  } catch (error) {
    console.error(
      "[RATE_LIMIT] Erro ao verificar " +
      `rate limit para ${userId}:`, error
    );
    // Em caso de erro, permitir request
    // (fail-open para disponibilidade)
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(now + config.windowMs),
    };
  }
}

// ==========================================
// MIDDLEWARE WRAPPER
// ==========================================

/**
 * Middleware para aplicar rate limiting em
 * callable functions.
 *
 * EXEMPLO DE USO:
 * ```typescript
 * export const createGame = onCall(
 *   withRateLimit(
 *     RATE_LIMITS.GAME_CREATE,
 *     async (request) => {
 *       // Sua lógica aqui
 *       return { gameId: "123" };
 *     }
 *   )
 * );
 * ```
 *
 * @param {RateLimitConfig} config - Config
 * @param {Function} handler - Handler callable
 * @return {Function} Handler com rate limit
 */
export function withRateLimit<T = unknown>(
  config: RateLimitConfig,
  handler: (
    request: CallableRequest
  ) => Promise<T>
): (request: CallableRequest) => Promise<T> {
  return async (
    request: CallableRequest
  ) => {
    // Verificar autenticação
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Usuário não autenticado"
      );
    }

    const userId = request.auth.uid;

    // Verificar rate limit
    const {allowed, remaining, resetAt} =
      await checkRateLimit(userId, config);

    if (!allowed) {
      const resetInSeconds = Math.ceil(
        (resetAt.getTime() - Date.now()) / 1000
      );

      console.warn(
        "[RATE_LIMIT] Usuário " +
        `${userId} excedeu limite ` +
        `(${config.maxRequests}/` +
        `${config.windowMs}ms). ` +
        `Reset em ${resetInSeconds}s`
      );

      throw new HttpsError(
        "resource-exhausted",
        "Rate limit excedido. Tente " +
        `novamente em ${resetInSeconds} ` +
        "segundos.",
        {
          retryAfter: resetInSeconds,
          limit: config.maxRequests,
          window: config.windowMs,
        }
      );
    }

    // Log de debug
    console.log(
      "[RATE_LIMIT] Usuário " +
      `${userId}: ${remaining}/` +
      `${config.maxRequests} ` +
      "requests restantes"
    );

    // Executar handler
    return await handler(request);
  };
}

// ==========================================
// CLEANUP DE BUCKETS EXPIRADOS
// ==========================================

/**
 * Remove buckets de rate limit expirados do
 * Firestore. Deve ser executado periodicamente
 * (ex: a cada 1 hora).
 *
 * IMPORTANTE: Exportar como scheduled function:
 * ```typescript
 * export const cleanupRateLimits = onSchedule(
 *   "every 1 hours",
 *   cleanupExpiredRateLimits
 * );
 * ```
 *
 * @return {Promise<number>} Total removidos
 */
export async function cleanupExpiredRateLimits(
): Promise<number> {
  console.log(
    "[RATE_LIMIT_CLEANUP] Iniciando limpeza " +
    "de rate limits expirados..."
  );

  const now = admin.firestore.Timestamp.now();

  try {
    // Buscar buckets expirados
    const expiredSnap = await db
      .collection("rate_limits")
      .where("expires_at", "<", now)
      .limit(500) // Processar em chunks
      .get();

    if (expiredSnap.empty) {
      console.log(
        "[RATE_LIMIT_CLEANUP] Nenhum bucket " +
        "expirado encontrado"
      );
      return 0;
    }

    // Deletar em batch
    const batch = db.batch();
    expiredSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(
      "[RATE_LIMIT_CLEANUP] " +
      `${expiredSnap.size} buckets removidos`
    );
    return expiredSnap.size;
  } catch (error) {
    console.error(
      "[RATE_LIMIT_CLEANUP] Erro ao limpar " +
      "rate limits:", error
    );
    throw error;
  }
}

// ==========================================
// RATE LIMIT POR IP (Opcional)
// ==========================================

/**
 * Rate limit baseado em IP em vez de UID.
 * Útil para endpoints públicos.
 *
 * @param {string} ipAddress - IP do cliente
 * @param {RateLimitConfig} config - Configuração
 * @return {Promise<RateLimitResult>} Resultado
 */
export async function checkRateLimitByIp(
  ipAddress: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Sanitizar IP para usar como document ID
  const sanitizedIp =
    ipAddress.replace(/[^a-zA-Z0-9]/g, "_");
  const keyPrefix =
    config.keyPrefix || "default";
  const bucketKey =
    `ip_${keyPrefix}_${sanitizedIp}`;

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const bucketRef = db
    .collection("rate_limits")
    .doc(bucketKey);

  try {
    const result = await db.runTransaction(
      async (transaction) => {
        const bucketDoc =
          await transaction.get(bucketRef);

        let requests: number[] = [];

        if (bucketDoc.exists) {
          const data = bucketDoc.data();
          requests = (
            data?.requests || []
          ).filter(
            (timestamp: number) =>
              timestamp > windowStart
          );
        }

        requests.push(now);

        const currentCount = requests.length;
        const allowed =
          currentCount <= config.maxRequests;
        const remaining = Math.max(
          0,
          config.maxRequests - currentCount
        );
        const resetAt =
          new Date(now + config.windowMs);

        transaction.set(
          bucketRef,
          {
            requests,
            ip_address: ipAddress,
            last_updated:
              admin.firestore.FieldValue
                .serverTimestamp(),
            expires_at:
              admin.firestore.Timestamp
                .fromDate(resetAt),
          },
          {merge: true}
        );

        return {allowed, remaining, resetAt};
      }
    );

    return result;
  } catch (error) {
    console.error(
      "[RATE_LIMIT_IP] Erro ao verificar " +
      `rate limit para IP ${ipAddress}:`,
      error
    );
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(now + config.windowMs),
    };
  }
}

// ==========================================
// UTILITÁRIOS
// ==========================================

/**
 * Reseta o rate limit de um usuário específico.
 * Útil para suporte/admin.
 *
 * @param {string} userId - UID do usuário
 * @param {string} keyPrefix - Prefixo da chave
 * @return {Promise<void>} Promessa vazia
 */
export async function resetUserRateLimit(
  userId: string,
  keyPrefix = "default"
): Promise<void> {
  const bucketKey = `${keyPrefix}_${userId}`;
  const bucketRef = db
    .collection("rate_limits")
    .doc(bucketKey);

  try {
    await bucketRef.delete();
    console.log(
      "[RATE_LIMIT] Rate limit resetado " +
      `para usuário ${userId}`
    );
  } catch (error) {
    console.error(
      "[RATE_LIMIT] Erro ao resetar rate " +
      `limit para ${userId}:`, error
    );
    throw error;
  }
}

/** Estatísticas de uso do rate limit */
interface RateLimitStats {
  currentRequests: number;
  oldestRequest: Date | null;
}

/**
 * Obtém estatísticas de uso de um usuário.
 *
 * @param {string} userId - UID do usuário
 * @param {string} keyPrefix - Prefixo da chave
 * @return {Promise<RateLimitStats>} Estatísticas
 */
export async function getUserRateLimitStats(
  userId: string,
  keyPrefix = "default"
): Promise<RateLimitStats> {
  const bucketKey = `${keyPrefix}_${userId}`;
  const bucketRef = db
    .collection("rate_limits")
    .doc(bucketKey);

  try {
    const bucketDoc = await bucketRef.get();

    if (!bucketDoc.exists) {
      return {
        currentRequests: 0,
        oldestRequest: null,
      };
    }

    const data = bucketDoc.data();
    const requests: number[] =
      data?.requests || [];

    return {
      currentRequests: requests.length,
      oldestRequest:
        requests.length > 0 ?
          new Date(Math.min(...requests)) :
          null,
    };
  } catch (error) {
    console.error(
      "[RATE_LIMIT] Erro ao obter stats " +
      `para ${userId}:`, error
    );
    return {
      currentRequests: 0,
      oldestRequest: null,
    };
  }
}
