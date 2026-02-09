/**
 * CUSTOM CLAIMS MANAGEMENT
 *
 * Firebase Custom Claims permitem armazenar metadata de usuário no JWT token,
 * eliminando a necessidade de chamadas get() nas Security Rules.
 *
 * Benefícios:
 * - Redução de ~40% nos Firestore reads (eliminando getUserRole())
 * - Latência de validação reduzida em ~20ms
 * - Custo mensal reduzido em $10-15 para 10k usuários
 *
 * Referência: specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {checkRateLimit} from "../middleware/rate-limiter";

const db = admin.firestore();

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface SetUserRoleRequest {
    uid: string;
    role: "ADMIN" | "FIELD_OWNER" | "PLAYER";
}

interface UserClaims {
    role?: string;
    [key: string]: any;
}

// ==========================================
// CLOUD FUNCTION: setUserRole
// ==========================================

/**
 * Define o role de um usuário via Custom Claims.
 *
 * SECURITY:
 * - Apenas ADMIN pode alterar roles
 * - Validação server-side de permissões
 * - Sincronização com Firestore para auditoria
 *
 * USAGE:
 * ```typescript
 * const setRole = httpsCallable(functions, 'setUserRole');
 * await setRole({ uid: 'user123', role: 'ADMIN' });
 * ```
 */
export const setUserRole = onCall<SetUserRoleRequest>(
  {
    // P0 #32: Firebase App Check - Garante que apenas apps verificados podem chamar
    // PRODUCTION: enforceAppCheck: true (bloqueia apps não-verificados)
    // DEBUG: enforceAppCheck: false (permite testar via Firebase CLI)
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    // ==========================================
    // 1. AUTHENTICATION CHECK
    // ==========================================
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to set roles"
      );
    }

    // ==========================================
    // 1.5. RATE LIMITING - Máximo 5 chamadas por minuto
    // ==========================================
    const rateLimitResult = await checkRateLimit(
      request.auth.uid,
      {maxRequests: 5, windowMs: 60000, keyPrefix: "setRole"}
    );
    if (!rateLimitResult.allowed) {
      throw new HttpsError("resource-exhausted", "Rate limit excedido. Tente novamente em breve.");
    }

    // ==========================================
    // 2. AUTHORIZATION CHECK
    // ==========================================
    const callerToken = request.auth.token as UserClaims;
    const callerRole = callerToken.role;

    // CRITICAL: Apenas ADMIN pode mudar roles
    if (callerRole !== "ADMIN") {
      // Fallback para Firestore durante período de transição
      const callerDoc = await db.collection("users").doc(request.auth.uid).get();
      const callerData = callerDoc.data();

      if (!callerData || callerData.role !== "ADMIN") {
        logger.warn(`[CUSTOM_CLAIMS][SECURITY] User ${request.auth.uid} (role: ${callerRole || callerData?.role || "NONE"}) attempted to change role of ${request.data.uid}`);
        throw new HttpsError(
          "permission-denied",
          "Only administrators can change user roles"
        );
      }
    }

    // ==========================================
    // 3. INPUT VALIDATION
    // ==========================================
    const {uid, role} = request.data;

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "uid must be a non-empty string");
    }

    const validRoles = ["ADMIN", "FIELD_OWNER", "PLAYER"];
    if (!role || !validRoles.includes(role)) {
      throw new HttpsError(
        "invalid-argument",
        `role must be one of: ${validRoles.join(", ")}`
      );
    }

    // ==========================================
    // 4. VERIFY TARGET USER EXISTS
    // ==========================================
    const targetUserDoc = await db.collection("users").doc(uid).get();
    if (!targetUserDoc.exists) {
      throw new HttpsError("not-found", `User ${uid} not found`);
    }

    const currentRole = targetUserDoc.data()?.role;

    // ==========================================
    // 5. SET CUSTOM CLAIM
    // ==========================================
    try {
      await admin.auth().setCustomUserClaims(uid, {role});
      logger.info(`[CUSTOM_CLAIMS] Set role=${role} for user ${uid} by admin ${request.auth.uid}`);
    } catch (error) {
      logger.error(`[CUSTOM_CLAIMS] Error setting claims for ${uid}:`, error);
      throw new HttpsError(
        "internal",
        "Failed to set custom claims. Please try again."
      );
    }

    // ==========================================
    // 6. SYNC TO FIRESTORE (for backward compatibility & audit)
    // ==========================================
    try {
      await db.collection("users").doc(uid).update({
        role,
        claims_updated_at: FieldValue.serverTimestamp(),
        claims_updated_by: request.auth.uid,
      });
      logger.info(`[CUSTOM_CLAIMS] Synced role to Firestore for user ${uid}`);
    } catch (error) {
      logger.error(`[CUSTOM_CLAIMS] Error syncing to Firestore for ${uid}:`, error);
      // Non-critical error - Custom Claim já foi setado
      // Continue para não bloquear a operação
    }

    // ==========================================
    // 7. AUDIT LOG
    // ==========================================
    try {
      await db.collection("audit_logs").add({
        type: "ROLE_CHANGE",
        target_user_id: uid,
        actor_user_id: request.auth.uid,
        old_role: currentRole,
        new_role: role,
        timestamp: FieldValue.serverTimestamp(),
        ip_address: request.rawRequest?.ip || null,
      });
    } catch (error) {
      logger.error("[CUSTOM_CLAIMS][AUDIT] Error creating audit log:", error);
      // Non-critical - continuar
    }

    return {
      success: true,
      uid,
      role,
      message: "Role updated successfully. User must logout/login to refresh token.",
    };
  }
);

// ==========================================
// CLOUD FUNCTION: onNewUserCreated
// ==========================================

/**
 * Triggered quando um novo documento de usuário é criado em Firestore.
 * Define role padrão "PLAYER" no Custom Claim.
 *
 * IMPORTANTE: Esta função é chamada quando o documento users/{uid} é criado.
 * Sincroniza o role do Firestore para Custom Claims.
 */
export const onNewUserCreated = onDocumentCreated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const userData = event.data?.data();

  if (!userData) {
    logger.error(`[CUSTOM_CLAIMS] No user data for ${userId}`);
    return;
  }

  logger.info(`[CUSTOM_CLAIMS] Setting default role for user ${userId}`);

  try {
    // Pegar role do documento (ou default PLAYER)
    const role = userData.role || "PLAYER";

    // Definir no Custom Claim
    await admin.auth().setCustomUserClaims(userId, {
      role: role,
    });

    logger.info(`[CUSTOM_CLAIMS] Successfully set role=${role} for ${userId}`);
  } catch (error) {
    logger.error(`[CUSTOM_CLAIMS] Error setting claims for ${userId}:`, error);
    // Não throw - o usuário ainda pode usar o app, o role está no Firestore
  }
});

// ==========================================
// MIGRATION UTILITY (Run once via scripts/)
// ==========================================

/**
 * Migra todos os usuários existentes para Custom Claims.
 *
 * USAGE:
 * ```bash
 * # Via Firebase CLI
 * firebase functions:shell
 * > migrateAllUsersToCustomClaims()
 * ```
 *
 * OU crie um script em functions/src/scripts/migrate-claims.ts
 */
export const migrateAllUsersToCustomClaims = onCall(
  {
    // CRITICAL: Apenas admin pode executar migração
    // enforceAppCheck: false,  // Permitir chamada via Firebase CLI
  },
  async (request) => {
    // Verificar permissão de admin
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // Rate limiting global - Máximo 1 chamada a cada 5 minutos
    const migrateRateLimitResult = await checkRateLimit(
      request.auth.uid,
      {maxRequests: 1, windowMs: 300000, keyPrefix: "migrate"}
    );
    if (!migrateRateLimitResult.allowed) {
      throw new HttpsError("resource-exhausted", "Migração já executada recentemente. Tente novamente em breve.");
    }

    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "ADMIN") {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    // Rate limiting: Apenas uma migração por hora para evitar abuso
    const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hora
    const lockRef = db.collection("system_locks").doc("claims_migration");
    const lockDoc = await lockRef.get();

    if (lockDoc.exists) {
      const lastRun = lockDoc.data()?.last_run_at?.toDate?.();
      if (lastRun && (Date.now() - lastRun.getTime()) < RATE_LIMIT_MS) {
        const minutesRemaining = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRun.getTime())) / 60000);
        logger.warn(`[MIGRATION] Rate limited: migration already ran at ${lastRun.toISOString()}. Try again in ${minutesRemaining} minutes.`);
        throw new HttpsError(
          "resource-exhausted",
          `Migration already ran recently. Try again in ${minutesRemaining} minutes.`
        );
      }
    }

    // Registrar lock antes de iniciar
    await lockRef.set({
      last_run_at: FieldValue.serverTimestamp(),
      started_by: request.auth.uid,
      status: "running",
    });

    logger.info(`[MIGRATION] Starting Custom Claims migration by ${request.auth.uid}`);

    try {
      // Buscar todos os usuários do Firestore (em chunks de 500)
      let processed = 0;
      let errors = 0;
      let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

      while (true) {
        let query = db.collection("users").limit(500);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) break;

        // Processar em paralelo (max 10 concurrent)
        const chunk = snapshot.docs;
        for (let i = 0; i < chunk.length; i += 10) {
          const batch = chunk.slice(i, i + 10);

          await Promise.all(
            batch.map(async (doc) => {
              const userData = doc.data();
              const role = userData.role || "PLAYER";

              try {
                await admin.auth().setCustomUserClaims(doc.id, {role});
                processed++;

                if (processed % 100 === 0) {
                  logger.info(`[MIGRATION] Processed ${processed} users...`);
                }
              } catch (err) {
                logger.error(`[MIGRATION] Error for user ${doc.id}:`, err);
                errors++;
              }
            })
          );
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }

      // Atualizar lock com status final
      await lockRef.update({
        status: "completed",
        completed_at: FieldValue.serverTimestamp(),
        processed_count: processed,
        error_count: errors,
      });

      logger.info(`[MIGRATION] Complete: ${processed} users migrated, ${errors} errors`);

      return {
        success: true,
        processed,
        errors,
        message: `Migration complete. ${processed} users updated.`,
      };
    } catch (error) {
      // Atualizar lock com status de erro
      try {
        await lockRef.update({
          status: "failed",
          failed_at: FieldValue.serverTimestamp(),
          error: String(error),
        });
      } catch { /* ignore lock update failure */ }

      logger.error("[MIGRATION] Fatal error:", error);
      throw new HttpsError("internal", "Migration failed");
    }
  }
);
