/**
 * SECFIX #433: Migração de PII (email, fcm_token, birth_date,
 * height_cm, weight_kg, gender) de users → users_private.
 *
 * STAGE 1 (este PR):
 * - Trigger onUserUpdated mantém users_private em sync com PII de users
 * - Callable migratePiiToUsersPrivate (ADMIN one-shot) popula users_private
 *   com dados atuais de users
 * - users continua tendo PII (backward compat com repos clientes)
 *
 * STAGE 2 (PR futuro):
 * - Repos clientes lêem PII de users_private (apenas próprio user)
 * - Remove PII de users (write rule + cleanup)
 *
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md mencionar users_private
 * como collection canonical pra dados sensíveis.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {
  onDocumentUpdated,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {FieldValue, FieldPath} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";
import {checkRateLimit} from "../middleware/rate-limiter";

const PII_FIELDS = [
  "email",
  "fcm_token",
  "birth_date",
  "height_cm",
  "weight_kg",
  "gender",
] as const;

/**
 * Constrói payload de PII pra users_private extraindo apenas
 * campos sensíveis NON-NULL do doc users.
 *
 * STAGE 3 (#433): pula nulls/undefined pra não overwrite users_private
 * quando users.PII é unset via removePiiFromUsers callable.
 *
 * @param {admin.firestore.DocumentData} userData - Doc users
 * @return {Record<string, unknown>} Subset com apenas campos PII non-null
 */
function extractPii(
  userData: admin.firestore.DocumentData
): Record<string, unknown> {
  const pii: Record<string, unknown> = {};
  for (const field of PII_FIELDS) {
    const val = userData[field];
    // Skip null/undefined — não queremos sobrescrever users_private com null
    // quando users tem PII removida (Stage 3 cleanup).
    if (val === null || val === undefined) continue;
    pii[field] = val;
  }
  return pii;
}

/**
 * Detecta se PII mudou comparando before/after.
 *
 * @param {admin.firestore.DocumentData|undefined} before - Estado antes
 * @param {admin.firestore.DocumentData|undefined} after - Estado depois
 * @return {boolean} true se algum campo PII mudou
 */
function piiChanged(
  before: admin.firestore.DocumentData | undefined,
  after: admin.firestore.DocumentData | undefined
): boolean {
  if (!before || !after) return true;
  for (const field of PII_FIELDS) {
    if (before[field] !== after[field]) return true;
  }
  return false;
}

/**
 * Trigger: copia PII pra users_private na criação inicial.
 * Idempotente — usa merge: true.
 */
export const onUserDocCreated = onDocumentCreated(
  {
    region: FUNCTION_REGION,
    document: "users/{userId}",
  },
  async (event) => {
    const userId = event.params.userId;
    const data = event.data?.data();
    if (!data) return;

    const pii = extractPii(data);
    const db = admin.firestore();

    try {
      await db.doc(`users_private/${userId}`).set(
        {
          ...pii,
          piiSyncedAt:
            FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
      logger.info(
        `[PII_SYNC] Initial PII synced for ${userId}`
      );
    } catch (err) {
      logger.error(
        `[PII_SYNC] Failed to sync initial PII for ${userId}:`,
        err
      );
      // Non-blocking — onUserCreate em user-management.ts ainda
      // cria o doc users com sucesso.
    }
  }
);

/**
 * Trigger: mantém users_private em sync quando PII muda em users.
 * Pula se PII não mudou (evita writes desnecessários).
 */
export const onUserDocUpdated = onDocumentUpdated(
  {
    region: FUNCTION_REGION,
    document: "users/{userId}",
    // FIX #1309-M5: onDocumentUpdated v2 NÃO retenta automaticamente sem
    // retry:true. O catch abaixo faz `throw err` para sinalizar falha;
    // sem este flag o throw seria engolido e a PII ficaria dessincronizada.
    retry: true,
  },
  async (event) => {
    const userId = event.params.userId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!piiChanged(before, after)) return;
    if (!after) return;

    const pii = extractPii(after);
    const db = admin.firestore();

    try {
      await db.doc(`users_private/${userId}`).set(
        {
          ...pii,
          piiSyncedAt:
            FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
      logger.info(
        `[PII_SYNC] PII updated for ${userId}`
      );
    } catch (err) {
      logger.error(
        `[PII_SYNC] Failed to sync PII update for ${userId}:`,
        err
      );
      // #1030 + FIX #1309-M5: relança o erro. O retry só acontece porque
      // o trigger declara `retry: true` (config acima) — sem esse flag o
      // onDocumentUpdated v2 NÃO retenta e o throw seria perdido.
      throw err;
    }
  }
);

/**
 * Callable one-shot: backfill users_private com PII de users
 * existentes. Apenas ADMIN. Deve rodar 1x após deploy.
 *
 * Idempotente — pode rodar múltiplas vezes sem problema.
 */
export const migratePiiToUsersPrivate = onCall(
  {
    region: FUNCTION_REGION,
    // FIX SEC-2026-05-08: enforce App Check em prod. Callable manipula PII
    // de todos os usuários via batch — não deve aceitar chamada não-verificada.
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
    timeoutSeconds: 540, // 9min — pode ter muitos users
    memory: "512MiB",
  },
  async (request) => {
    try {
      const {auth} = request;
      if (!auth) {
        throw new HttpsError(
          "unauthenticated",
          "Login obrigatório"
        );
      }

      if (auth.token?.role !== "ADMIN") {
        throw new HttpsError(
          "permission-denied",
          "Apenas ADMIN pode rodar migração"
        );
      }

      const db = admin.firestore();

      // FIX #2641: system_lock + rate limit — impede execuções concorrentes
      // e reexecução em intervalo curto (padrão de custom-claims.ts:464-507).
      const RATE_LIMIT_MS = 60 * 60 * 1000;
      const lockRef = db
        .collection("system_locks")
        .doc("pii_migration");
      const lockDoc = await lockRef.get();

      if (lockDoc.exists) {
        const lastRun =
          lockDoc.data()?.last_run_at?.toDate?.();
        if (
          lastRun &&
          (Date.now() - lastRun.getTime()) < RATE_LIMIT_MS
        ) {
          const minutesRemaining = Math.ceil(
            (RATE_LIMIT_MS - (Date.now() - lastRun.getTime())) / 60000
          );
          logger.warn(
            "[PII_MIGRATION] Rate limited: " +
            `migration already ran at ${lastRun.toISOString()}. ` +
            `Try again in ${minutesRemaining} minutes.`
          );
          throw new HttpsError(
            "resource-exhausted",
            "PII migration already ran recently. " +
            `Try again in ${minutesRemaining} minutes.`
          );
        }
      }

      await lockRef.set({
        last_run_at: FieldValue.serverTimestamp(),
        started_by: auth.uid,
        status: "running",
      });

      let migrated = 0;
      let skipped = 0;
      let total = 0;
      const errors: Array<{uid: string; error: string}> = [];

      // FIX #1579: paginação com cursor (limit/startAfter) em vez de .get()
      // irrestrito — .get() carrega todos os usuários em memória de uma vez,
      // causando OOM em bases grandes (>10k usuários). Padrão de referência:
      // functions/src/utils/soft-delete-helper.ts (lastDoc + startAfter loop).
      const PAGE_SIZE = 500;
      let lastDoc:
      admin.firestore.QueryDocumentSnapshot | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        let query = db
          .collection("users")
          .orderBy(FieldPath.documentId())
          .limit(PAGE_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);

        const usersSnap = await query.get();

        if (usersSnap.empty) break;

        total += usersSnap.size;
        const batch = db.batch();
        let batchHasOps = false;

        for (const doc of usersSnap.docs) {
          const userData = doc.data();
          const pii = extractPii(userData);

          // Pula se nenhum campo PII presente
          if (Object.keys(pii).length === 0) {
            skipped++;
            continue;
          }

          try {
            const privateRef = db.doc(`users_private/${doc.id}`);
            batch.set(
              privateRef,
              {
                ...pii,
                piiSyncedAt:
                FieldValue.serverTimestamp(),
                migratedAt:
                FieldValue.serverTimestamp(),
              },
              {merge: true}
            );
            migrated++;
            batchHasOps = true;
          } catch (err) {
            errors.push({
              uid: doc.id,
              error: (err as Error).message,
            });
          }
        }

        if (batchHasOps) {
          try {
            await batch.commit();
          } catch (err) {
            logger.error(
              "[PII_MIGRATION] Batch commit failed:",
              err
            );
            // Marca todos do chunk como erro
            for (const doc of usersSnap.docs) {
              errors.push({
                uid: doc.id,
                error: (err as Error).message,
              });
            }
          }
        }

        if (usersSnap.size < PAGE_SIZE) {
          hasMore = false;
        } else {
          lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
        }
      }

      logger.info(
        `[PII_MIGRATION] Done: ${migrated} migrated, ` +
        `${skipped} skipped, ${errors.length} errors`
      );

      await lockRef.update({
        status: "completed",
        completed_at: FieldValue.serverTimestamp(),
        migrated,
        skipped,
        errors_count: errors.length,
      });

      return {
        success: true,
        migrated,
        skipped,
        errors,
        total,
      };
    } catch (error) {
      try {
        await admin.firestore().collection("system_locks")
          .doc("pii_migration")
          .update({
            status: "failed",
            failed_at: FieldValue.serverTimestamp(),
            error: String(error),
          });
      } catch {
        // ignore lock update failure
      }

      if (error instanceof HttpsError) throw error;
      logger.error("migratePiiToUsersPrivate failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);

// ============================================
// STAGE 3 callables
// ============================================

/**
 * Valida tipos básicos de PII fields.
 *
 * @param {string} field - Nome do campo PII
 * @param {unknown} value - Valor a validar
 * @return {boolean} true se valor é válido pro field
 */
function validatePiiField(field: string, value: unknown): boolean {
  if (value === null || value === undefined) return true;

  switch (field) {
  case "email":
    return (
      typeof value === "string" &&
        value.length > 0 &&
        value.length < 256 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    );
  case "fcm_token":
    return typeof value === "string" && value.length < 4096;
  case "birth_date":
    return typeof value === "number" && value > 0 && value < 4102444800000;
  case "height_cm":
    return typeof value === "number" && value > 0 && value < 300;
  case "weight_kg":
    return typeof value === "number" && value > 0 && value < 500;
  case "gender":
    return (
      typeof value === "string" &&
        ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY", "M", "F", "O"]
          .includes(value)
    );
  default:
    return false;
  }
}

/**
 * Callable: owner-only updateUserPii.
 *
 * STAGE 3 (#433): repos clientes (Android) usam esta callable pra
 * escrever PII em users_private em vez de users.
 *
 * Aceita qualquer subset de PII_FIELDS. Valida tipos. Idempotente.
 *
 * Após Stage 3 final (rules.users.update bloqueia PII), esta é a ÚNICA
 * forma de cliente atualizar PII.
 */
export const updateUserPii = onCall(
  {
    region: FUNCTION_REGION,
    // FIX SEC-2026-05-08: enforce App Check em prod. Callable escreve PII
    // em users_private — exige verificação de app em prod.
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    try {
      const {auth, data} = request;
      if (!auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      // FIX #2650: rate limit per uid — impede abuso via chamadas repetidas
      const rl = await checkRateLimit(auth.uid, {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "update_pii",
      });
      if (!rl.allowed) {
        const retryAfterSec = Math.ceil(
          (rl.resetAt.getTime() - Date.now()) / 1000,
        );
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
          {retryAfter: retryAfterSec},
        );
      }

      if (!data || typeof data !== "object") {
        throw new HttpsError("invalid-argument", "Body inválido");
      }

      const updates: Record<string, unknown> = {};
      for (const field of PII_FIELDS) {
        if (!(field in data)) continue;
        const val = (data as Record<string, unknown>)[field];
        if (!validatePiiField(field, val)) {
          throw new HttpsError(
            "invalid-argument",
            `Campo ${field} inválido`
          );
        }
        updates[field] = val;
      }

      if (Object.keys(updates).length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Nenhum campo PII válido fornecido"
        );
      }

      const db = admin.firestore();
      const ref = db.doc(`users_private/${auth.uid}`);

      await ref.set(
        {
          ...updates,
          piiSyncedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      logger.info(
        `[PII] User ${auth.uid} updated PII: ` +
        Object.keys(updates).join(",")
      );

      return {success: true, updated: Object.keys(updates)};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("updateUserPii failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);

/**
 * Callable: ADMIN one-shot. Remove PII fields de users docs (deleta
 * fields em users mas mantém em users_private — onde já estão via Stage 1
 * triggers + backfill).
 *
 * STAGE 3 (#433): roda 1x após Android atualizar pra usar updateUserPii.
 * Depois disso, qualquer write de PII em users será via trigger
 * onUserDocUpdated → users_private (e Stage 4 vai bloquear via rules).
 *
 * Idempotente — se PII já removida, é no-op por user.
 */
export const removePiiFromUsers = onCall(
  {
    region: FUNCTION_REGION,
    // FIX SEC-2026-05-08: enforce App Check em prod. Callable ADMIN deleta
    // PII em batch — operação destrutiva irreversível, exige verificação.
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const {auth} = request;
      if (!auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }
      if (auth.token?.role !== "ADMIN") {
        throw new HttpsError(
          "permission-denied",
          "Apenas ADMIN pode rodar cleanup"
        );
      }

      const db = admin.firestore();

      // FIX #2641: system_lock + rate limit — impede execuções concorrentes
      const RATE_LIMIT_MS = 60 * 60 * 1000;
      const lockRef = db
        .collection("system_locks")
        .doc("pii_remove_cleanup");
      const lockDoc = await lockRef.get();

      if (lockDoc.exists) {
        const lastRun =
          lockDoc.data()?.last_run_at?.toDate?.();
        if (
          lastRun &&
          (Date.now() - lastRun.getTime()) < RATE_LIMIT_MS
        ) {
          const minutesRemaining = Math.ceil(
            (RATE_LIMIT_MS - (Date.now() - lastRun.getTime())) / 60000
          );
          logger.warn(
            "[PII_CLEANUP] Rate limited: " +
            `cleanup already ran at ${lastRun.toISOString()}. ` +
            `Try again in ${minutesRemaining} minutes.`
          );
          throw new HttpsError(
            "resource-exhausted",
            "PII cleanup already ran recently. " +
            `Try again in ${minutesRemaining} minutes.`
          );
        }
      }

      await lockRef.set({
        last_run_at: FieldValue.serverTimestamp(),
        started_by: auth.uid,
        status: "running",
      });

      let cleaned = 0;
      let skipped = 0;
      let total = 0;
      const errors: Array<{uid: string; error: string}> = [];

      // FIX #1579: paginação com cursor (limit/startAfter) em vez de .get()
      // irrestrito — igual ao fix em migratePiiToPrivate acima.
      const PAGE_SIZE = 500;
      let lastDoc:
      admin.firestore.QueryDocumentSnapshot | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        let query = db
          .collection("users")
          .orderBy(FieldPath.documentId())
          .limit(PAGE_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);

        const usersSnap = await query.get();

        if (usersSnap.empty) break;

        total += usersSnap.size;
        const batch = db.batch();
        let chunkCleans = 0;

        for (const doc of usersSnap.docs) {
          const data = doc.data();

          // Verifica quais PII fields ainda estão em users
          const fieldsToDelete: Record<string, FirebaseFirestore.FieldValue> = {};
          let hasAny = false;
          for (const field of PII_FIELDS) {
            if (data[field] !== undefined && data[field] !== null) {
              fieldsToDelete[field] = FieldValue.delete();
              hasAny = true;
            }
          }

          if (!hasAny) {
            skipped++;
            continue;
          }

          try {
            batch.update(doc.ref, fieldsToDelete);
            chunkCleans++;
          } catch (err) {
            errors.push({uid: doc.id, error: (err as Error).message});
          }
        }

        if (chunkCleans === 0) {
          if (usersSnap.size < PAGE_SIZE) {
            hasMore = false;
          } else {
            lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
          }
          continue;
        }

        try {
          await batch.commit();
          cleaned += chunkCleans;
        } catch (err) {
          logger.error(
            "[PII_CLEANUP] Batch commit failed:",
            err
          );
          for (const doc of usersSnap.docs) {
            errors.push({uid: doc.id, error: (err as Error).message});
          }
        }

        if (usersSnap.size < PAGE_SIZE) {
          hasMore = false;
        } else {
          lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
        }
      }

      logger.info(
        `[PII_CLEANUP] Done: ${cleaned} cleaned, ` +
        `${skipped} skipped, ${errors.length} errors`
      );

      await lockRef.update({
        status: "completed",
        completed_at: FieldValue.serverTimestamp(),
        cleaned,
        skipped,
        errors_count: errors.length,
      });

      return {
        success: true,
        cleaned,
        skipped,
        errors,
        total,
      };
    } catch (error) {
      try {
        await admin.firestore().collection("system_locks")
          .doc("pii_remove_cleanup")
          .update({
            status: "failed",
            failed_at: FieldValue.serverTimestamp(),
            error: String(error),
          });
      } catch {
        // ignore lock update failure
      }

      if (error instanceof HttpsError) throw error;
      logger.error("removePiiFromUsers failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
