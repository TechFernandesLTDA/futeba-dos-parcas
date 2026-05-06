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
import {logger} from "firebase-functions/v2";

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
    region: "us-central1",
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
            admin.firestore.FieldValue.serverTimestamp(),
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
    region: "us-central1",
    document: "users/{userId}",
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
            admin.firestore.FieldValue.serverTimestamp(),
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
    region: "us-central1",
    enforceAppCheck: false,
    consumeAppCheckToken: false,
    timeoutSeconds: 540, // 9min — pode ter muitos users
    memory: "512MiB",
  },
  async (request) => {
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
    const usersSnap = await db.collection("users").get();

    let migrated = 0;
    let skipped = 0;
    const errors: Array<{uid: string; error: string}> = [];

    // Process em chunks pra não estourar memory
    const CHUNK_SIZE = 100;
    const docs = usersSnap.docs;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();

      for (const doc of chunk) {
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
                admin.firestore.FieldValue.serverTimestamp(),
              migratedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
          migrated++;
        } catch (err) {
          errors.push({
            uid: doc.id,
            error: (err as Error).message,
          });
        }
      }

      try {
        await batch.commit();
      } catch (err) {
        logger.error(
          `[PII_MIGRATION] Batch commit failed at chunk ${i}:`,
          err
        );
        // Marca todos do chunk como erro
        for (const doc of chunk) {
          errors.push({
            uid: doc.id,
            error: (err as Error).message,
          });
        }
      }
    }

    logger.info(
      `[PII_MIGRATION] Done: ${migrated} migrated, ` +
        `${skipped} skipped, ${errors.length} errors`
    );

    return {
      success: true,
      migrated,
      skipped,
      errors,
      total: docs.length,
    };
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
    region: "us-central1",
    enforceAppCheck: false,
    consumeAppCheckToken: false,
  },
  async (request) => {
    const {auth, data} = request;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório");
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
        piiSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    logger.info(
      `[PII] User ${auth.uid} updated PII: ` +
        Object.keys(updates).join(",")
    );

    return {success: true, updated: Object.keys(updates)};
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
    region: "us-central1",
    enforceAppCheck: false,
    consumeAppCheckToken: false,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
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
    const usersSnap = await db.collection("users").get();

    let cleaned = 0;
    let skipped = 0;
    const errors: Array<{uid: string; error: string}> = [];

    const CHUNK = 200;
    const docs = usersSnap.docs;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const chunk = docs.slice(i, i + CHUNK);
      const batch = db.batch();
      let chunkCleans = 0;

      for (const doc of chunk) {
        const data = doc.data();

        // Verifica quais PII fields ainda estão em users
        const fieldsToDelete: Record<string, FirebaseFirestore.FieldValue> = {};
        let hasAny = false;
        for (const field of PII_FIELDS) {
          if (data[field] !== undefined && data[field] !== null) {
            fieldsToDelete[field] = admin.firestore.FieldValue.delete();
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

      if (chunkCleans === 0) continue;

      try {
        await batch.commit();
        cleaned += chunkCleans;
      } catch (err) {
        logger.error(
          `[PII_CLEANUP] Batch ${i} commit failed:`,
          err
        );
        for (const doc of chunk) {
          errors.push({uid: doc.id, error: (err as Error).message});
        }
      }
    }

    logger.info(
      `[PII_CLEANUP] Done: ${cleaned} cleaned, ` +
        `${skipped} skipped, ${errors.length} errors`
    );

    return {
      success: true,
      cleaned,
      skipped,
      errors,
      total: docs.length,
    };
  }
);
