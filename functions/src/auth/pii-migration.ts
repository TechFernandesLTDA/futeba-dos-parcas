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
 * campos sensíveis do doc users.
 *
 * @param {admin.firestore.DocumentData} userData - Doc users
 * @return {Record<string, unknown>} Subset com apenas campos PII
 */
function extractPii(
  userData: admin.firestore.DocumentData
): Record<string, unknown> {
  const pii: Record<string, unknown> = {};
  for (const field of PII_FIELDS) {
    if (userData[field] !== undefined) {
      pii[field] = userData[field];
    }
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
