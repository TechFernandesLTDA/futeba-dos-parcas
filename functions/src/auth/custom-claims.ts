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
  onDocumentUpdated,
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
import {
  acquireOperationLease,
  completeOperationLease,
  failOperationLease,
} from "../middleware/operation-lock";


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
    appCheck: process.env.FUNCTIONS_EMULATOR !== "true",
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
      const role = (VALID_ROLES as readonly unknown[]).includes(userData.role) ?
        userData.role :
        "PLAYER";

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
// TRIGGER: onUserRoleUpdated (reconciliação)
// ==========================================

/**
 * Reconcilia a custom claim `role` sempre que o campo `role`
 * mudar em `users/{userId}`.
 *
 * MOTIVAÇÃO (#3938): As Firestore rules em FASE 2 leem EXCLUSIVAMENTE
 * a custom claim (`request.auth.token.role`), mas o espelho
 * `users/{uid}.role` continua editável por ADMIN (regra `allow update`
 * com bypass `isAdmin()`) e por qualquer script com Admin SDK. Como o
 * único sync existente era `onDocumentCreated`, rebaixar um usuário
 * editando o Firestore era um no-op permanente — a claim antiga
 * persistia e o acesso ADMIN era mantido indefinidamente.
 *
 * Este trigger fecha o gap: qualquer mutação de `role` no Firestore
 * (callable `setUserRole`, console Firebase, CRM, scripts Admin SDK)
 * é espelhada para a custom claim E seguida de `revokeRefreshTokens`,
 * espelhando o contrato do `setUserRole`.
 *
 * IDEMPOTÊNCIA:
 * - Só age quando `before.role !== after.role` (ignora updates de
 *   outros campos, ex.: `claims_updated_at` escrito por `setUserRole`).
 * - Vira no-op quando a claim já reflete o novo mirror (cobre o fluxo
 *   do `setUserRole`, que grava a claim ANTES do Firestore: quando o
 *   trigger dispara a claim já está correta).
 * - Não escreve de volta em `users/{userId}` (apenas Auth + audit_logs),
 *   portanto não há risco de loop de trigger.
 *
 * @param {object} event - Evento de update do documento Firestore
 * @return {Promise<void>} Promise vazia
 */
export const onUserRoleUpdated = onDocumentUpdated(
  {document: "users/{userId}", region: FUNCTION_REGION, retry: true},
  async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!beforeData || !afterData) {
      return;
    }

    const beforeRole = beforeData.role;
    const afterRole = afterData.role;

    // Idempotência #1: só reconcilia quando `role` realmente mudou.
    // Evita reprocessar updates de outros campos (claims_updated_at,
    // profile updates, etc.) que disparam este trigger.
    if (beforeRole === afterRole) {
      return;
    }

    // Privilégio mínimo se o novo role for inválido/ausente: nunca
    // preserva um privilégio duvidoso lido do espelho.
    const newRole =
      (VALID_ROLES as readonly unknown[]).includes(afterRole) ?
        afterRole :
        "PLAYER";

    try {
      // Idempotência #2: se a claim já bate com o mirror, nada a fazer.
      // Este é exatamente o caso do `setUserRole`, que seta a claim
      // ANTES de escrever no Firestore — quando o trigger dispara, a
      // claim já está correta e o trigger vira no-op.
      const existingClaims =
        (await admin.auth().getUser(userId)).customClaims || {};

      if (existingClaims.role === newRole) {
        logger.info(
          "[CUSTOM_CLAIMS] onUserRoleUpdated no-op " +
          `(claim já = ${newRole}) para ${userId}`
        );
        return;
      }

      await admin
        .auth()
        .setCustomUserClaims(userId, {
          ...existingClaims,
          role: newRole,
        });

      // Invalida refresh tokens para forçar re-login com o novo role,
      // espelhando o contrato de segurança do `setUserRole` (#3938).
      await admin.auth().revokeRefreshTokens(userId);

      logger.warn(
        "[CUSTOM_CLAIMS] onUserRoleUpdated reconciliou claim " +
        `para ${userId}: ${beforeRole ?? "(none)"} -> ${newRole} ` +
        "(refresh tokens revoked)"
      );

      // Audit log para rastreabilidade de reconciliações originadas
      // fora do callable `setUserRole` (ex.: console Firebase, scripts
      // Admin SDK). actor_user_id null sinaliza origem externa ao
      // callable autenticado.
      try {
        await db().collection("audit_logs").add({
          type: "ROLE_RECONCILED",
          target_user_id: userId,
          actor_user_id: null,
          old_role: beforeRole ?? null,
          new_role: newRole,
          timestamp: FieldValue.serverTimestamp(),
        });
      } catch (auditError) {
        logger.error(
          "[CUSTOM_CLAIMS][AUDIT] Falha ao registrar ROLE_RECONCILED:",
          auditError
        );
        // Non-critical — a claim já foi reconciliada.
      }
    } catch (error) {
      const code = (error as {code?: string} | null)?.code;
      // #2782: No emulador (test harness / E2E) é comum atualizar docs
      // users/{uid} direto no Firestore sem o Auth user correspondente.
      // getUser/setCustomUserClaims lançam auth/user-not-found; o retry
      // (#1030 via retry:true acima) não resolve user ausente (não é
      // transiente), então logamos e retornamos SEM relançar — apenas
      // no emulador. Produção mantém o relançar para retry do Firebase.
      if (
        process.env.FUNCTIONS_EMULATOR === "true" &&
        code === "auth/user-not-found"
      ) {
        logger.warn(
          "[CUSTOM_CLAIMS] onUserRoleUpdated: Auth user ausente no " +
          `emulador; pulando claims para ${userId} (seed sem Auth user)`
        );
        return;
      }
      logger.error(
        `[CUSTOM_CLAIMS] onUserRoleUpdated erro para ${userId}:`,
        error
      );
      // #1030 + FIX #1309-M5: relança para o onDocumentUpdated v2
      // retentar (habilitado por retry:true acima).
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
    appCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "migrate",
    },
    enableAuditLog: true,
    timeoutSeconds: 540,
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
    const database = db();
    const operationLease = await acquireOperationLease(
      database,
      "claims_migration",
      request.auth.uid,
      {cooldownMs: 60 * 60 * 1000, leaseMs: 10 * 60 * 1000},
    );

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
              const docRole = (VALID_ROLES as readonly unknown[])
                .includes(uData.role) ?
                uData.role :
                "PLAYER";

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
      await completeOperationLease(database, operationLease, {
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
        await failOperationLease(database, operationLease, error);
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
