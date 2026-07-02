/**
 * SECURE CALLABLE WRAPPER
 *
 * Wrapper para Cloud Functions callable que
 * integra:
 * 1. Firebase App Check (P0 #32)
 * 2. Rate Limiting (P0 #34)
 * 3. Authentication check
 * 4. Audit logging
 *
 * USAGE:
 * ```typescript
 * export const setUserRole = secureCallable(
 *   {
 *     appCheck: true,
 *     rateLimit: RATE_LIMITS.GAME_CREATE,
 *   },
 *   async (request) => {
 *     // Sua lógica aqui
 *     return {success: true};
 *   }
 * );
 * ```
 */

import {logger} from "firebase-functions";
import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {
  checkRateLimit,
  checkRateLimitByIp,
  RateLimitConfig,
} from "./rate-limiter";
import {clientIp} from "../auth/anti-abuse";

/**
 * Obtém instância do Firestore com lazy init.
 *
 * @return {FirebaseFirestore.Firestore} Firestore
 */
function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
}

// ==========================================
// TIPOS
// ==========================================

/** Contexto adicional para audit log */
type AuditLogContextFn = (
  request: CallableRequest
) => Promise<Record<string, unknown>>;

/** Opções do wrapper seguro */
export interface SecureCallableOptions {
  /**
   * P0 #32: Enforce Firebase App Check
   * - true: Bloqueia sem App Check válido
   * - false: Permite requests (debug)
   * Default: true em PRODUCTION, false em DEV
   */
  appCheck?: boolean;

  /**
   * Consome o token App Check para bloquear replay.
   * Use em operacoes mutantes/sensiveis. Callables de leitura podem
   * manter App Check sem consumo para evitar falso positivo em retries.
   * Default: mesmo valor de appCheck.
   */
  consumeAppCheckToken?: boolean;

  /**
   * P0 #34: Rate limiting config
   * - Se definido: aplica rate limiting
   * - Se undefined: sem rate limiting
   */
  rateLimit?: RateLimitConfig;

  /**
   * Requer autenticação do usuário
   * Default: true
   */
  requireAuth?: boolean;

  /**
   * Role(s) requerido(s) para executar
   * - undefined: qualquer autenticado
   * - string: um role (ex: "ADMIN")
   * - string[]: um dos roles
   */
  requiredRole?: string | string[];

  /**
   * Habilitar audit logging
   * Default: true
   */
  enableAuditLog?: boolean;

  /**
   * Função customizada para extrair info
   * adicional de audit
   */
  auditLogContext?: AuditLogContextFn;

  /**
   * Secrets do Firebase Functions necessarios
   * em runtime (acessiveis via process.env).
   * Ex: ["CPF_SALT"]
   */
  secrets?: string[];
}

// ==========================================
// SECURE CALLABLE WRAPPER
// ==========================================

/**
 * Wrapper seguro para Cloud Functions callable.
 *
 * @param {SecureCallableOptions} options - Config
 * @param {Function} handler - Handler callable
 * @return {object} Cloud Function callable
 */
export function secureCallable<
  TRequest = unknown,
  TResponse = unknown
>(
  options: SecureCallableOptions,
  handler: (
    request: CallableRequest<TRequest>
  ) => Promise<TResponse>
) {
  // Aplicar defaults
  const config = {
    appCheck: options.appCheck ??
      (!process.env.FUNCTIONS_EMULATOR),
    rateLimit: options.rateLimit,
    requireAuth: options.requireAuth ?? true,
    requiredRole: options.requiredRole,
    enableAuditLog:
      options.enableAuditLog ?? true,
    auditLogContext: options.auditLogContext,
    consumeAppCheckToken: options.consumeAppCheckToken ??
      (options.appCheck ?? (!process.env.FUNCTIONS_EMULATOR)),
  };

  return onCall(
    {
      enforceAppCheck: config.appCheck,
      consumeAppCheckToken: config.consumeAppCheckToken,
      // Secrets declaradas aqui ficam acessiveis via process.env em runtime
      ...(options.secrets ? {secrets: options.secrets} : {}),
    },
    async (
      request: CallableRequest<TRequest>
    ) => {
      const startTime = Date.now();
      const requestId = generateRequestId();

      try {
        // ======================================
        // 1. APP CHECK VALIDATION (PERF_001)
        // ======================================
        if (config.appCheck) {
          const appCheckToken = request.app;
          const rawIp =
            (request.rawRequest?.ip as
              string) || "unknown";

          if (!appCheckToken) {
            logger.warn(
              "[SECURE_CALLABLE] " +
              `${requestId}: Request SEM ` +
              "App Check token. " +
              `IP: ${rawIp}, Auth UID: ` +
              `${request.auth?.uid || "anon"}`
            );

            await logAudit({
              requestId,
              type: "APP_CHECK_MISSING",
              userId: request.auth?.uid,
              ip: rawIp,
              status: "BLOCKED",
            });

            throw new HttpsError(
              "failed-precondition",
              "App Check verification failed. " +
              "Please update your app."
            );
          }

          // Token consumido (replay attack)
          if (
            config.consumeAppCheckToken &&
            appCheckToken.alreadyConsumed
          ) {
            logger.warn(
              "[SECURE_CALLABLE] " +
              `${requestId}: App Check ` +
              "token REPLAY detectado. UID: " +
              (request.auth?.uid || "anon")
            );

            await logAudit({
              requestId,
              type: "APP_CHECK_REPLAY",
              userId: request.auth?.uid,
              ip: rawIp,
              status: "BLOCKED",
            });

            throw new HttpsError(
              "failed-precondition",
              "App Check token already " +
              "consumed. Possible replay."
            );
          }
        }

        // ======================================
        // 2. AUTHENTICATION CHECK
        // ======================================
        if (
          config.requireAuth &&
          !request.auth
        ) {
          throw new HttpsError(
            "unauthenticated",
            "User authentication required"
          );
        }

        const userId = request.auth?.uid;

        // ======================================
        // 3. RATE LIMITING CHECK (P0 #34)
        // FIX #2053: Rate-limit BEFORE role check so
        // attackers spamming role-protected endpoints
        // get rate-limited, not just permission-denied.
        // ======================================
        if (config.rateLimit) {
          type ClientRequest = {
            rawRequest?: {
              ip?: string;
              headers?: Record<string, string | string[] | undefined>;
            };
          };
          const ip = clientIp(request as unknown as ClientRequest);
          const rl = userId ?
            await checkRateLimit(userId, config.rateLimit) :
            await checkRateLimitByIp(ip, config.rateLimit);

          if (!rl.allowed) {
            const resetSec = Math.ceil(
              (rl.resetAt.getTime() -
                Date.now()) / 1000
            );

            logger.warn(
              "[SECURE_CALLABLE] " +
              `${userId ? "User " + userId : "IP " + ip} ` +
              "exceeded rate limit " +
              `(${config.rateLimit.maxRequests}` +
              `/${config.rateLimit.windowMs}ms` +
              `). Reset in ${resetSec}s`
            );

            await logAudit({
              requestId,
              type: "RATE_LIMIT_EXCEEDED",
              userId: userId || ip,
              limit:
                config.rateLimit.maxRequests,
              window:
                config.rateLimit.windowMs,
              status: "DENIED",
            });

            throw new HttpsError(
              "resource-exhausted",
              "Rate limit exceeded. Try " +
              `again in ${resetSec} seconds.`,
              {
                retryAfter: resetSec,
                limit:
                  config.rateLimit.maxRequests,
                window:
                  config.rateLimit.windowMs,
              }
            );
          }

          logger.info(
            "[SECURE_CALLABLE] " +
            `${userId ? "User " + userId : "IP " + ip}: ` +
            `${rl.remaining}/` +
            `${config.rateLimit.maxRequests} ` +
            "requests remaining"
          );
        }

        // ======================================
        // 4. AUTHORIZATION CHECK (Role-based)
        // ======================================
        if (config.requiredRole) {
          if (!userId) {
            throw new HttpsError(
              "permission-denied",
              "Authentication required for this operation"
            );
          }

          const userRole =
            await getUserRole(
              userId,
              request.auth?.token?.role as string | undefined
            );

          const allowedRoles =
            Array.isArray(
              config.requiredRole
            ) ?
              config.requiredRole :
              [config.requiredRole];

          if (
            !userRole ||
            !allowedRoles.includes(userRole)
          ) {
            logger.warn(
              "[SECURE_CALLABLE] User " +
              `${userId} (role: ${userRole}) ` +
              "denied. Required: " +
              allowedRoles.join(", ")
            );

            await logAudit({
              requestId,
              type: "AUTHORIZATION_DENIED",
              userId,
              userRole,
              requiredRoles: allowedRoles,
              status: "DENIED",
            });

            throw new HttpsError(
              "permission-denied",
              "This operation requires: " +
              allowedRoles.join(", ")
            );
          }
        }

        // ======================================
        // 5. EXECUTE HANDLER
        // ======================================
        logger.info(
          `[SECURE_CALLABLE] ${requestId}: ` +
          "Starting handler for user " +
          `${userId}`
        );

        const result = await handler(request);

        // ======================================
        // 6. AUDIT LOGGING (Success)
        // ======================================
        if (config.enableAuditLog) {
          const duration =
            Date.now() - startTime;

          const auditCtx =
            config.auditLogContext ?
              await config.auditLogContext(
                request as CallableRequest
              ) :
              {};

          await logAudit({
            requestId,
            type: "FUNCTION_EXECUTED",
            userId,
            status: "SUCCESS",
            duration,
            ip: (request.rawRequest?.ip as
              string) || "unknown",
            ...auditCtx,
          });
        }

        return result;
      } catch (error) {
        // ======================================
        // 7. ERROR HANDLING & AUDIT (Failure)
        // ======================================
        const duration =
          Date.now() - startTime;
        const errorMessage =
          error instanceof Error ?
            error.message :
            String(error);

        if (config.enableAuditLog) {
          await logAudit({
            requestId,
            type: "FUNCTION_ERROR",
            userId: request.auth?.uid,
            status: "ERROR",
            duration,
            error: errorMessage,
            ip: (request.rawRequest?.ip as
              string) || "unknown",
          });
        }

        logger.error(
          `[SECURE_CALLABLE] ${requestId}: ` +
          `Error after ${duration}ms:`, error
        );

        // Re-throw if already HttpsError
        if (error instanceof HttpsError) {
          throw error;
        }

        // SECFIX #435: NAO expor originalError ao cliente
        // (information disclosure - OWASP A05:2021).
        // Cliente recebe apenas requestId opaco para correlacao
        // em logs servidor. errorMessage ja foi logado acima.
        throw new HttpsError(
          "internal",
          "An error occurred while " +
          "processing your request",
          {requestId}
        );
      }
    }
  );
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get user role from Custom Claims or Firestore
 * fallback. Uses Custom Claims first (0 reads),
 * falls back to Firestore.
 *
 * @param {string} userId - UID do usuário
 * @param {string=} tokenRole - Role já presente no token
 * @return {Promise<string | null>} Role
 */
async function getUserRole(
  userId: string,
  tokenRole?: string
): Promise<string | null> {
  if (tokenRole) {
    return tokenRole;
  }

  try {
    // 1. Try Custom Claims first (no read)
    const user =
      await admin.auth().getUser(userId);
    const customRole =
      user.customClaims?.role;

    if (customRole) {
      return customRole;
    }
  } catch (error) {
    logger.error(
      "[SECURE_CALLABLE] Error getting " +
      `custom claims for ${userId}:`, error
    );
  }

  try {
    // 2. Fallback: read from Firestore
    const userDoc = await getDb()
      .collection("users")
      .doc(userId)
      .get();
    const firestoreRole =
      userDoc.data()?.role;
    return firestoreRole || null;
  } catch (error) {
    logger.error(
      "[SECURE_CALLABLE] Error getting " +
      `role from Firestore for ${userId}:`,
      error
    );
    return null;
  }
}

/**
 * Generate unique request ID for tracing.
 *
 * @return {string} ID único do request
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${
    Math.random().toString(36).substr(2, 9)
  }`;
}

/**
 * Log security/audit events to Firestore.
 *
 * @param {Record<string, unknown>} data - Dados
 * @return {Promise<void>} Promessa vazia
 */
async function logAudit(
  data: Record<string, unknown>
): Promise<void> {
  try {
    await getDb().collection("audit_logs").add({
      ...data,
      timestamp:
        FieldValue
          .serverTimestamp(),
    });
  } catch (error) {
    logger.error(
      "[SECURE_CALLABLE] Error logging audit:",
      error
    );
    // Non-critical: don't throw
  }
}

// ==========================================
// PRESET CONFIGURATIONS
// ==========================================

/**
 * Presets para cenários comuns
 */
export const SECURE_PRESETS = {
  /**
   * Apenas autenticado, sem rate limit
   */
  authenticated: {
    requireAuth: true,
  } as SecureCallableOptions,

  /**
   * Apenas admin, com App Check
   */
  adminOnly: {
    appCheck: true,
    requireAuth: true,
    requiredRole: "ADMIN",
  } as SecureCallableOptions,

  /**
   * Admin ou Field Owner, com rate limit
   */
  fieldOwnerOrAdmin: {
    appCheck: true,
    requireAuth: true,
    requiredRole: ["ADMIN", "FIELD_OWNER"],
  } as SecureCallableOptions,

  /**
   * Público com App Check apenas
   */
  publicWithAppCheck: {
    appCheck: true,
    requireAuth: false,
  } as SecureCallableOptions,
} as const;
