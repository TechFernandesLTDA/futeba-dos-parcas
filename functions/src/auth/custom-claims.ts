/**
 * CUSTOM CLAIMS MANAGEMENT
 *
 * Firebase Custom Claims permitem armazenar
 * metadata de usuário no JWT token,
 * eliminando a necessidade de chamadas get()
 * nas Security Rules.
 *
 * Benefícios:
 * - Redução de ~40% nos Firestore reads
 *   (eliminando getUserRole())
 * - Latência de validação reduzida em ~20ms
 * - Custo mensal reduzido em $10-15 para
 *   10k usuários
 *
 * Referência:
 * specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md
 */

import * as admin from "firebase-admin";
import {
  HttpsError,
} from "firebase-functions/v2/https";
import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {
  FIRESTORE_PAGINATION_LIMIT,
  MAX_CONCURRENT_OPS,
  FUNCTION_REGION,
} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {db} from "../_db";


// ==========================================
// TYPES & INTERFACES
// ==========================================

/**
 * Canonical role list — must match Android role whitelist
 * (app/.../ui/admin/ManageRolesScreen.kt) and web role constants.
 * If you add a role here, update Android + web too.
 * @see #1970
 */
const VALID_ROLES = ["ADMIN", "FIELD_OWNER", "PLAYER"] as const;

/** Request para definir role de um usuário */
interface SetUserRoleRequest {
  uid: string;
  role: (typeof VALID_ROLES)[number];
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
 * const setRole = httpsCallable(
 *   functions, "setUserRole"
 * );
 * await setRole({
 *   uid: "user123", role: "ADMIN"
 * });
 * ```
 *
 * @param {object} request - Dados da requisição
 * @return {Promise<object>} Resultado da operação
 */
export const setUserRole = secureCallable<SetUserRoleRequest>(
  {
    // SECFIX #429: appCheck enforce em production.
    // Token admin roubado/leaked nao serve fora do app oficial.
    // FIX #1577: FUNCTIONS_EMULATOR em vez de NODE_ENV
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "setRole",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "setUserRole",
      targetUserId: request.data?.uid,
      newRole: request.data?.role,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    // ==========================================
    // 3. INPUT VALIDATION
    // ==========================================
    const {uid, role} = request.data;

    if (!uid || typeof uid !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "uid must be a non-empty string"
      );
    }

    if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
      throw new HttpsError(
        "invalid-argument",
        "role must be one of: " +
        `${VALID_ROLES.join(", ")}`
      );
    }

    // ==========================================
    // 4. VERIFY TARGET USER EXISTS
    // ==========================================
    const targetUserDoc = await db()
      .collection("users")
      .doc(uid)
      .get();
    if (!targetUserDoc.exists) {
      throw new HttpsError(
        "not-found",
        `User ${uid} not found`
      );
    }

    const currentRole = targetUserDoc.data()?.role;

    // ==========================================
    // 5. SET CUSTOM CLAIM FIRST (Auth is source of truth for rules)
    //    If crash after this: Auth says correct role, Firestore lags.
    //    Rules depend on Auth → correct behavior.
    //    If crash before this: nothing persisted → safe.
    // ==========================================
    const existingClaims =
      (await admin.auth().getUser(uid))
        .customClaims || {};
    await admin
      .auth()
      .setCustomUserClaims(uid, {
        ...existingClaims,
        role,
      });

    // Invalida JWT antigo (TTL 1h).
    // Forca re-auth do cliente apos mudanca de role.
    await admin.auth().revokeRefreshTokens(uid);

    logger.info(
      "[CUSTOM_CLAIMS] " +
      `Set role=${role} for user ${uid} ` +
      `by admin ${request.auth.uid} ` +
      "(refresh tokens revoked)"
    );

    // ==========================================
    // 6. SYNC TO FIRESTORE SECOND
    //    (Firestore mirror for client listeners)
    // ==========================================
    await db()
      .collection("users")
      .doc(uid)
      .update({
        role,
        claims_updated_at:
          FieldValue.serverTimestamp(),
        claims_updated_by: request.auth.uid,
      });
    logger.info(
      "[CUSTOM_CLAIMS] Synced role to " +
      `Firestore for user ${uid}`
    );

    // ==========================================
    // 7. AUDIT LOG
    // ==========================================
    try {
      await db().collection("audit_logs").add({
        type: "ROLE_CHANGE",
        target_user_id: uid,
        actor_user_id: request.auth.uid,
        old_role: currentRole,
        new_role: role,
        timestamp: FieldValue.serverTimestamp(),
        ip_address:
          request.rawRequest?.ip || null,
      });
    } catch (error) {
      logger.error(
        "[CUSTOM_CLAIMS][AUDIT] " +
        "Error creating audit log:",
        error
      );
      // Non-critical - continuar
    }

    return {
      success: true,
      uid,
      role,
      message:
        "Role updated successfully. " +
        "User must logout/login to " +
        "refresh token.",
    };
  }
);

// ==========================================
// CLOUD FUNCTION: onNewUserCreated
// ==========================================

/**
 * Triggered quando um novo documento de usuário
 * é criado em Firestore.
 * Define role padrão "PLAYER" no Custom Claim.
 *
 * IMPORTANTE: Esta função é chamada quando o
 * documento users/{uid} é criado.
 * Sincroniza o role do Firestore para
 * Custom Claims.
 *
 * @param {object} event - Evento de criação
 *   do documento Firestore
 * @return {Promise<void>} Promise vazia
 */
export const onNewUserCreated = onDocumentCreated(
  {document: "users/{userId}", region: FUNCTION_REGION},
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();

    if (!userData) {
      logger.error(
        "[CUSTOM_CLAIMS] " +
        `No user data for ${userId}`
      );
      return;
    }

    logger.info(
      "[CUSTOM_CLAIMS] Setting default " +
      `role for user ${userId}`
    );

    try {
      // Pegar role do documento (ou default PLAYER)
      const role = userData.role || "PLAYER";

      const existingUserClaims =
        (await admin.auth().getUser(userId))
          .customClaims || {};
      await admin
        .auth()
        .setCustomUserClaims(userId, {
          ...existingUserClaims,
          role: role,
        });

      logger.info(
        "[CUSTOM_CLAIMS] Successfully " +
        `set role=${role} for ${userId}`
      );
    } catch (error) {
      // #2782: No emulador (test harness / E2E) é comum criar docs
      // users/{uid} direto no Firestore sem o Auth user correspondente.
      // getUser/setCustomUserClaims lançam auth/user-not-found e o
      // re-throw (#1030) gera retry storm → socket hang up → fatal no
      // emulador. Retry NÃO resolve user ausente (não é transiente),
      // então logamos e retornamos SEM relançar — apenas no emulador.
      // Produção mantém o comportamento original (#1030).
      const code = (error as {code?: string} | null)?.code;
      if (
        process.env.FUNCTIONS_EMULATOR === "true" &&
        code === "auth/user-not-found"
      ) {
        logger.warn(
          "[CUSTOM_CLAIMS] Auth user ausente no emulador; " +
          `pulando claims para ${userId} (seed sem Auth user)`
        );
        return;
      }
      logger.error(
        "[CUSTOM_CLAIMS] Error setting " +
        `claims for ${userId}:`,
        error
      );
      // #1030: Relança o erro para que o trigger falhe e o
      // Firebase reprocesse automaticamente com retry
      throw error;
    }
  }
);

// ==========================================
// CLOUD FUNCTION: syncFieldOwnerClaim
// ==========================================

/**
 * Sincroniza a custom claim FIELD_OWNER/ADMIN do
 * Firestore para o Firebase Auth para o usuário atual.
 *
 * ISSUE #2430: Quando um usuário tem role
 * FIELD_OWNER no Firestore mas a custom claim não
 * está sincronizada no Auth, o token JWT não
 * contém o claim e as Firestore rules rejeitam
 * a criação de locais (L1008-1010).
 *
 * Esta função lê o role do Firestore e o espelha
 * no Auth como custom claim, sem exigir privilégios
 * de ADMIN — qualquer usuário autenticado pode
 * sincronizar a PRÓPRIA claim.
 *
 * @return {Promise<object>} Resultado da sincronização
 */
export const syncFieldOwnerClaim = secureCallable(
  {
    // App Check desabilitado para esta função: é chamada durante
    // onAuthStateChanged, quando o token App Check pode não estar
    // pronto. A segurança é mantida por requireAuth + rateLimit +
    // validação do doc Firestore do usuário.
    appCheck: false,
    requireAuth: true,
    rateLimit: {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: "syncClaim",
    },
    enableAuditLog: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    const callerUid = request.auth.uid;

    logger.info(
      "[CUSTOM_CLAIMS] " +
      `syncFieldOwnerClaim called by ${callerUid}`
    );

    // Ler role do Firestore
    const userDoc = await db()
      .collection("users")
      .doc(callerUid)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError(
        "not-found",
        "Documento de usuário não encontrado"
      );
    }

    const firestoreRole = userDoc.data()?.role;

    if (
      firestoreRole !== "FIELD_OWNER" &&
      firestoreRole !== "ADMIN"
    ) {
      return {
        success: true,
        synced: false,
        role: firestoreRole || "PLAYER",
        message:
          "Usuário não possui role FIELD_OWNER " +
          "ou ADMIN. Nenhuma sincronização necessária.",
      };
    }

    // Sincronizar claim no Auth
    const existingClaims =
      (await admin.auth().getUser(callerUid))
        .customClaims || {};

    if (existingClaims.role === firestoreRole) {
      logger.info(
        "[CUSTOM_CLAIMS] " +
        `Claim já sincronizada para ${callerUid} ` +
        `(role=${firestoreRole})`
      );
      return {
        success: true,
        synced: false,
        role: firestoreRole,
        message:
          "Custom claim já está sincronizada.",
      };
    }

    await admin
      .auth()
      .setCustomUserClaims(callerUid, {
        ...existingClaims,
        role: firestoreRole,
      });

    // Invalida JWT antigo para forçar refresh
    await admin.auth().revokeRefreshTokens(callerUid);

    logger.info(
      "[CUSTOM_CLAIMS] " +
      `Claim sincronizada para ${callerUid}: ` +
      `role=${firestoreRole}`
    );

    return {
      success: true,
      synced: true,
      role: firestoreRole,
      message:
        "Custom claim sincronizada com sucesso. " +
        "Faça logout e login novamente para " +
        "atualizar o token.",
    };
  }
);

// ==========================================
// MIGRATION UTILITY (ONE-TIME — Run once via scripts/)
// ==========================================
//
// FIX #2644: Esta função é uma migração one-time. NÃO deve ser
// executada repetidamente em production. Após a migração inicial,
// manutenha exportada apenas para scripts administrativos isolados;
// considere remover do index.ts público para evitar chamadas acidentais.
// O rate limit de 1h + system_lock mitiga reexecução, mas o ideal é
// que esta função NÃO seja parte do deploy regular de functions.

/**
 * ONE-TIME MIGRATION: Migra todos os usuários existentes para
 * Custom Claims.
 *
 * USAGE:
 * ```bash
 * # Via Firebase CLI
 * firebase functions:shell
 * > migrateAllUsersToCustomClaims()
 * ```
 *
 * OU crie um script em
 * functions/src/scripts/migrate-claims.ts
 *
 * @param {object} request - Dados da requisição
 * @return {Promise<object>} Resultado
 *   da migração
 */
export const migrateAllUsersToCustomClaims = secureCallable(
  {
    // SECFIX #429: appCheck enforce em production
    // FIX #1577: FUNCTIONS_EMULATOR em vez de NODE_ENV
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "migrate",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "migrateAllUsersToCustomClaims",
      callerUid: request.auth?.uid,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    // Rate limiting: Apenas uma migração por hora
    // para evitar abuso
    const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hora
    const lockRef = db()
      .collection("system_locks")
      .doc("claims_migration");
    const lockDoc = await lockRef.get();

    if (lockDoc.exists) {
      const lastRun =
        lockDoc.data()?.last_run_at?.toDate?.();
      if (
        lastRun &&
        (Date.now() - lastRun.getTime()) <
          RATE_LIMIT_MS
      ) {
        const minutesRemaining = Math.ceil(
          (
            RATE_LIMIT_MS -
            (Date.now() - lastRun.getTime())
          ) / 60000
        );
        logger.warn(
          "[MIGRATION] Rate limited: " +
          "migration already ran at " +
          `${lastRun.toISOString()}. ` +
          "Try again in " +
          `${minutesRemaining} minutes.`
        );
        throw new HttpsError(
          "resource-exhausted",
          "Migration already ran recently. " +
          "Try again in " +
          `${minutesRemaining} minutes.`
        );
      }
    }

    // Registrar lock antes de iniciar
    await lockRef.set({
      last_run_at: FieldValue.serverTimestamp(),
      started_by: request.auth.uid,
      status: "running",
    });

    logger.info(
      "[MIGRATION] Starting Custom Claims " +
      `migration by ${request.auth.uid}`
    );

    try {
      // Buscar todos os usuários do Firestore
      // (em chunks de 500)
      let processed = 0;
      let errors = 0;
      let lastDoc:
        admin.firestore.QueryDocumentSnapshot |
        null = null;
      let hasMore = true;

      while (hasMore) {
        let query = db()
          .collection("users")
          .orderBy(
            FieldPath.documentId()
          )
          .limit(FIRESTORE_PAGINATION_LIMIT);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        // Processar em paralelo (max 10 concurrent)
        const chunk = snapshot.docs;
        for (
          let i = 0;
          i < chunk.length;
          i += MAX_CONCURRENT_OPS
        ) {
          const batch = chunk.slice(
            i, i + MAX_CONCURRENT_OPS
          );

          await Promise.all(
            batch.map(async (doc) => {
              const uData = doc.data();
              const docRole =
                uData.role || "PLAYER";

              try {
                const existingClaims =
                  (
                    await admin.auth().getUser(
                      doc.id
                    )
                  ).customClaims || {};
                await admin
                  .auth()
                  .setCustomUserClaims(
                    doc.id,
                    {
                      ...existingClaims,
                      role: docRole,
                    }
                  );
                processed++;

                if (processed % 100 === 0) {
                  logger.info(
                    "[MIGRATION] " +
                    "Processed " +
                    `${processed} users...`
                  );
                }
              } catch (err) {
                logger.error(
                  "[MIGRATION] Error " +
                  `for user ${doc.id}:`,
                  err
                );
                errors++;
              }
            })
          );
        }

        lastDoc = snapshot.docs[
          snapshot.docs.length - 1
        ];
      }

      // Atualizar lock com status final
      await lockRef.update({
        status: "completed",
        completed_at:
          FieldValue.serverTimestamp(),
        processed_count: processed,
        error_count: errors,
      });

      logger.info(
        "[MIGRATION] Complete: " +
        `${processed} users migrated, ` +
        `${errors} errors`
      );

      return {
        success: true,
        processed,
        errors,
        message:
          "Migration complete. " +
          `${processed} users updated.`,
      };
    } catch (error) {
      // Atualizar lock com status de erro
      try {
        await lockRef.update({
          status: "failed",
          failed_at:
            FieldValue.serverTimestamp(),
          error: String(error),
        });
      } catch {
        // ignore lock update failure
      }

      logger.error(
        "[MIGRATION] Fatal error:",
        error
      );
      throw new HttpsError(
        "internal",
        "Migration failed"
      );
    }
  }
);
