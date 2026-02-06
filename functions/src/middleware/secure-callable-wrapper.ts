/**
 * SECURE CALLABLE WRAPPER
 *
 * Wrapper para Cloud Functions callable que integra:
 * 1. Firebase App Check (P0 #32)
 * 2. Rate Limiting (P0 #34)
 * 3. Authentication check
 * 4. Audit logging
 *
 * USAGE:
 * ```typescript
 * export const setUserRole = secureCallable(
 *   {appCheck: true, rateLimit: RATE_LIMITS.GAME_CREATE},
 *   async (request) => {
 *     // Sua lógica aqui
 *     return {success: true};
 *   }
 * );
 * ```
 */

import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {checkRateLimit, RateLimitConfig} from "./rate-limiter";

const db = admin.firestore();

// ==========================================
// TIPOS
// ==========================================

export interface SecureCallableOptions {
  /**
   * P0 #32: Enforce Firebase App Check
   * - true: Bloqueia requests sem App Check válido
   * - false: Permite requests (útil para debug)
   * Default: true em PRODUCTION, false em DEV
   */
  appCheck?: boolean;

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
   * - undefined: qualquer usuário autenticado
   * - string: um role específico (ex: 'ADMIN')
   * - string[]: um dos roles (ex: ['ADMIN', 'FIELD_OWNER'])
   */
  requiredRole?: string | string[];

  /**
   * Habilitar audit logging
   * Default: true
   */
  enableAuditLog?: boolean;

  /**
   * Função customizada para extrair info adicional de audit
   */
  auditLogContext?: (request: CallableRequest<any>) => Promise<Record<string, any>>;
}

// ==========================================
// SECURE CALLABLE WRAPPER
// ==========================================

export function secureCallable<TRequest = any, TResponse = any>(
  options: SecureCallableOptions,
  handler: (request: CallableRequest<TRequest>) => Promise<TResponse>
) {
  // Aplicar defaults (manter tipos opcionais para evitar problemas com undefined)
  const config = {
    appCheck: options.appCheck ?? (process.env.NODE_ENV === "production"),
    rateLimit: options.rateLimit,
    requireAuth: options.requireAuth ?? true,
    requiredRole: options.requiredRole,
    enableAuditLog: options.enableAuditLog ?? true,
    auditLogContext: options.auditLogContext,
  };

  return onCall(
    {
      enforceAppCheck: config.appCheck,
      consumeAppCheckToken: config.appCheck,
    },
    async (request: CallableRequest<TRequest>) => {
      const startTime = Date.now();
      const requestId = generateRequestId();

      try {
        // ==========================================
        // 1. AUTHENTICATION CHECK
        // ==========================================

        if (config.requireAuth && !request.auth) {
          throw new HttpsError(
            "unauthenticated",
            "User authentication required to call this function"
          );
        }

        const userId = request.auth?.uid;

        // ==========================================
        // 2. AUTHORIZATION CHECK (Role-based)
        // ==========================================

        if (config.requiredRole && userId) {
          const userRole = await getUserRole(userId);

          const allowedRoles = Array.isArray(config.requiredRole)
            ? config.requiredRole
            : [config.requiredRole];

          if (!userRole || !allowedRoles.includes(userRole)) {
            console.warn(
              `[SECURE_CALLABLE] User ${userId} (role: ${userRole}) denied access. Required: ${allowedRoles.join(", ")}`
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
              `This operation requires one of: ${allowedRoles.join(", ")}`
            );
          }
        }

        // ==========================================
        // 3. RATE LIMITING CHECK (P0 #34)
        // ==========================================

        if (config.rateLimit && userId) {
          const {allowed, remaining, resetAt} = await checkRateLimit(userId, config.rateLimit);

          if (!allowed) {
            const resetInSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

            console.warn(
              `[SECURE_CALLABLE] User ${userId} exceeded rate limit (${config.rateLimit.maxRequests}/${config.rateLimit.windowMs}ms). Reset in ${resetInSeconds}s`
            );

            await logAudit({
              requestId,
              type: "RATE_LIMIT_EXCEEDED",
              userId,
              limit: config.rateLimit.maxRequests,
              window: config.rateLimit.windowMs,
              status: "DENIED",
            });

            throw new HttpsError(
              "resource-exhausted",
              `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
              {
                retryAfter: resetInSeconds,
                limit: config.rateLimit.maxRequests,
                window: config.rateLimit.windowMs,
              }
            );
          }

          console.log(
            `[SECURE_CALLABLE] User ${userId}: ${remaining}/${config.rateLimit.maxRequests} requests remaining`
          );
        }

        // ==========================================
        // 4. EXECUTE HANDLER
        // ==========================================

        console.log(`[SECURE_CALLABLE] ${requestId}: Starting handler execution for user ${userId}`);

        const result = await handler(request);

        // ==========================================
        // 5. AUDIT LOGGING (Success)
        // ==========================================

        if (config.enableAuditLog) {
          const duration = Date.now() - startTime;

          const auditContext = config.auditLogContext
            ? await config.auditLogContext(request)
            : {};

          await logAudit({
            requestId,
            type: "FUNCTION_EXECUTED",
            userId,
            status: "SUCCESS",
            duration,
            ip: (request.rawRequest?.ip as string) || "unknown",
            ...auditContext,
          });
        }

        return result;
      } catch (error) {
        // ==========================================
        // 6. ERROR HANDLING & AUDIT LOGGING (Failure)
        // ==========================================

        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (config.enableAuditLog) {
          await logAudit({
            requestId,
            type: "FUNCTION_ERROR",
            userId: request.auth?.uid,
            status: "ERROR",
            duration,
            error: errorMessage,
            ip: (request.rawRequest?.ip as string) || "unknown",
          });
        }

        console.error(`[SECURE_CALLABLE] ${requestId}: Error after ${duration}ms:`, error);

        // Re-throw if already HttpsError
        if (error instanceof HttpsError) {
          throw error;
        }

        // Wrap generic errors
        throw new HttpsError(
          "internal",
          "An error occurred while processing your request",
          {originalError: errorMessage}
        );
      }
    }
  );
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get user role from Custom Claims or Firestore fallback.
 * Uses Custom Claims first (0 reads), falls back to Firestore.
 */
async function getUserRole(userId: string): Promise<string | null> {
  try {
    // 1. Try Custom Claims first (no Firestore read)
    const user = await admin.auth().getUser(userId);
    const customRole = user.customClaims?.role;

    if (customRole) {
      return customRole;
    }

    // 2. Fallback: read from Firestore (for backward compatibility)
    const userDoc = await db.collection("users").doc(userId).get();
    const firestoreRole = userDoc.data()?.role;

    return firestoreRole || null;
  } catch (error) {
    console.error(`[SECURE_CALLABLE] Error getting role for ${userId}:`, error);
    return null;
  }
}

/**
 * Generate unique request ID for tracing.
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log security/audit events to Firestore.
 */
async function logAudit(data: Record<string, any>): Promise<void> {
  try {
    await db.collection("audit_logs").add({
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[SECURE_CALLABLE] Error logging audit:", error);
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
   * Admin ou Field Owner, com rate limit apertado
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
