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
import {
  acquireOperationLease,
  completeOperationLease,
  failOperationLease,
  OperationLease,
} from "../middleware/operation-lock";

const PII_FIELDS = [
  "email",
  "fcm_token",
  "birth_date",
  "height_cm",
  "weight_kg",
  "gender",
  // #3935: `phone` (E.164 em plaintext) é gravado em users/{uid} por
  // reconcilePhoneIdentity/account-merge legados. Incluí-lo aqui dá ao callable
  // ADMIN `removePiiFromUsers` um caminho de REPARO para limpar docs de
  // usuários já verificados que ficaram ilegíveis aos pares (o guard público
  // nega o get quando `phone` está presente e não-vazio). Os writers foram
  // corrigidos (param de gravar phone), mas os docs históricos precisam do
  // backfill. Não confundir com users_private.phoneNumber (canônico, privado).
  "phone",
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
 * Compara PII Firestore por valor, incluindo Timestamp/GeoPoint e mapas, sem
 * depender de identidade de referência JavaScript.
 *
 * @param {unknown} left Valor público.
 * @param {unknown} right Valor privado.
 * @param {number} depth Profundidade interna de mapas/arrays.
 * @return {boolean} true quando semanticamente equivalentes.
 */
export function piiValuesEqual(
  left: unknown,
  right: unknown,
  depth = 0,
): boolean {
  if (Object.is(left, right)) return true;
  if (depth > 8 || left == null || right == null) return false;

  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime();
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        piiValuesEqual(value, right[index], depth + 1)
      );
  }

  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftComparable = left as {
    isEqual?: (other: unknown) => boolean;
    toMillis?: () => number;
  };
  const rightComparable = right as {
    isEqual?: (other: unknown) => boolean;
    toMillis?: () => number;
  };

  if (typeof leftComparable.isEqual === "function") {
    try {
      return leftComparable.isEqual(right);
    } catch {
      return false;
    }
  }
  if (typeof rightComparable.isEqual === "function") {
    try {
      return rightComparable.isEqual(left);
    } catch {
      return false;
    }
  }
  if (
    typeof leftComparable.toMillis === "function" ||
    typeof rightComparable.toMillis === "function"
  ) {
    return typeof leftComparable.toMillis === "function" &&
      typeof rightComparable.toMillis === "function" &&
      leftComparable.toMillis() === rightComparable.toMillis();
  }

  const leftPrototype = Object.getPrototypeOf(left);
  const rightPrototype = Object.getPrototypeOf(right);
  const leftIsPlain = leftPrototype === Object.prototype || leftPrototype === null;
  const rightIsPlain = rightPrototype === Object.prototype || rightPrototype === null;
  if (!leftIsPlain || !rightIsPlain) return false;

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] &&
      piiValuesEqual(leftRecord[key], rightRecord[key], depth + 1)
    );
}

type AtomicPiiResult = {
  hadPii: boolean;
  changed: boolean;
  conflicts: string[];
};

/**
 * Copia PII pública para o documento privado sob controle de concorrência.
 * Valores privados divergentes nunca são sobrescritos pelo backfill.
 *
 * @param {FirebaseFirestore.Firestore} db Firestore.
 * @param {FirebaseFirestore.DocumentReference} userRef Perfil público.
 * @return {Promise<AtomicPiiResult>} Resultado da reconciliação.
 */
export async function migratePiiDocumentAtomically(
  db: FirebaseFirestore.Firestore,
  userRef: FirebaseFirestore.DocumentReference,
): Promise<AtomicPiiResult> {
  const privateRef = db.doc(`users_private/${userRef.id}`);
  return db.runTransaction(async (tx) => {
    const [freshUser, freshPrivate] = await Promise.all([
      tx.get(userRef),
      tx.get(privateRef),
    ]);
    const pii = freshUser.exists ? extractPii(freshUser.data() ?? {}) : {};
    const privateData = freshPrivate.data() ?? {};
    const update: Record<string, unknown> = {};
    const conflicts: string[] = [];
    for (const [field, value] of Object.entries(pii)) {
      const privateValue = privateData[field];
      if (
        privateValue === undefined ||
        privateValue === null ||
        piiValuesEqual(privateValue, value)
      ) {
        update[field] = value;
      } else {
        conflicts.push(field);
      }
    }
    const changed = Object.keys(update).length > 0;
    if (changed) {
      const now = FieldValue.serverTimestamp();
      tx.set(privateRef, {
        ...update,
        piiSyncedAt: now,
        migratedAt: now,
      }, {merge: true});
    }
    return {hadPii: Object.keys(pii).length > 0, changed, conflicts};
  });
}

/**
 * Remove PII pública somente se o valor privado ainda for semanticamente
 * idêntico no instante do commit. A transação repete a leitura se houver write
 * concorrente e impede apagar um valor novo com base em snapshot antigo.
 *
 * @param {FirebaseFirestore.Firestore} db Firestore.
 * @param {FirebaseFirestore.DocumentReference} userRef Perfil público.
 * @return {Promise<AtomicPiiResult>} Resultado da limpeza.
 */
export async function removePiiDocumentAtomically(
  db: FirebaseFirestore.Firestore,
  userRef: FirebaseFirestore.DocumentReference,
): Promise<AtomicPiiResult> {
  const privateRef = db.doc(`users_private/${userRef.id}`);
  return db.runTransaction(async (tx) => {
    const [freshUser, freshPrivate] = await Promise.all([
      tx.get(userRef),
      tx.get(privateRef),
    ]);
    const data = freshUser.data() ?? {};
    const privateData = freshPrivate.data() ?? {};
    const fieldsToDelete: Record<string, FirebaseFirestore.FieldValue> = {};
    const conflicts: string[] = [];
    let hadPii = false;
    for (const field of PII_FIELDS) {
      if (data[field] === undefined || data[field] === null) continue;
      hadPii = true;
      if (piiValuesEqual(privateData[field], data[field])) {
        fieldsToDelete[field] = FieldValue.delete();
      } else {
        conflicts.push(field);
      }
    }
    const changed = Object.keys(fieldsToDelete).length > 0;
    if (changed) tx.update(userRef, fieldsToDelete);
    return {hadPii, changed, conflicts};
  });
}

/**
 * Trigger: copia PII pra users_private na criação inicial.
 * Idempotente — usa merge: true.
 */
export const onUserDocCreated = onDocumentCreated(
  {
    region: FUNCTION_REGION,
    document: "users/{userId}",
    retry: true,
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
      throw err;
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
    let operationLease: OperationLease | undefined;
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
      operationLease = await acquireOperationLease(
        db,
        "pii_migration",
        auth.uid,
        {cooldownMs: 60 * 60 * 1000, leaseMs: 10 * 60 * 1000},
      );

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
        // Mini-batches limitam burst sem abrir mão de uma transação por usuário.
        for (let index = 0; index < usersSnap.docs.length; index += 10) {
          const chunk = usersSnap.docs.slice(index, index + 10);
          const results = await Promise.all(chunk.map(async (doc) => {
            try {
              return {
                uid: doc.id,
                result: await migratePiiDocumentAtomically(db, doc.ref),
              };
            } catch (error) {
              return {uid: doc.id, error};
            }
          }));
          for (const item of results) {
            if ("error" in item) {
              errors.push({
                uid: item.uid,
                error: item.error instanceof Error ?
                  item.error.message :
                  String(item.error),
              });
              continue;
            }
            if (!item.result.hadPii) skipped++;
            if (item.result.changed) migrated++;
            if (item.result.conflicts.length > 0) {
              errors.push({
                uid: item.uid,
                error: "PII privada divergente: " +
                  item.result.conflicts.join(", "),
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

      await completeOperationLease(db, operationLease, {
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
      if (operationLease) {
        try {
          await failOperationLease(admin.firestore(), operationLease, error);
        } catch {
          // O erro original tem prioridade.
        }
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
        [
          "MALE",
          "FEMALE",
          "OTHER",
          "NOT_INFORMED",
          "PREFER_NOT_TO_SAY",
          "M",
          "F",
          "O",
        ]
          .includes(value)
    );
  case "phone":
    // #3935: E.164 (+...) com até 16 dígitos. Permite null/vazio (cleanup).
    return (
      typeof value === "string" &&
        value.length > 0 &&
        value.length <= 16 &&
        /^\+?[0-9]+$/.test(value)
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
    let operationLease: OperationLease | undefined;
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
      operationLease = await acquireOperationLease(
        db,
        "pii_remove_cleanup",
        auth.uid,
        {cooldownMs: 60 * 60 * 1000, leaseMs: 10 * 60 * 1000},
      );

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
        for (let index = 0; index < usersSnap.docs.length; index += 10) {
          const chunk = usersSnap.docs.slice(index, index + 10);
          const results = await Promise.all(chunk.map(async (doc) => {
            try {
              return {
                uid: doc.id,
                result: await removePiiDocumentAtomically(db, doc.ref),
              };
            } catch (error) {
              return {uid: doc.id, error};
            }
          }));
          for (const item of results) {
            if ("error" in item) {
              errors.push({
                uid: item.uid,
                error: item.error instanceof Error ?
                  item.error.message :
                  String(item.error),
              });
              continue;
            }
            if (!item.result.hadPii) skipped++;
            if (item.result.changed) cleaned++;
            for (const field of item.result.conflicts) {
              errors.push({
                uid: item.uid,
                error: `PII privada ausente ou divergente: ${field}`,
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
        `[PII_CLEANUP] Done: ${cleaned} cleaned, ` +
        `${skipped} skipped, ${errors.length} errors`
      );

      await completeOperationLease(db, operationLease, {
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
      if (operationLease) {
        try {
          await failOperationLease(admin.firestore(), operationLease, error);
        } catch {
          // O erro original tem prioridade.
        }
      }

      if (error instanceof HttpsError) throw error;
      logger.error("removePiiFromUsers failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
