import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {calculateAutoRatingsFromStats} from "../ratings/auto-ratings";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";

interface DeleteLocationRequest {
  locationId: string;
}

const PUBLICATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "SUSPENDED",
  "REJECTED",
] as const;

const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "OVERDUE",
  "SUSPENDED",
  "CANCELLED",
] as const;

type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

interface SetLocationPublicationStatusRequest {
  locationId: string;
  publicationStatus: PublicationStatus;
  reason?: string;
}

interface SetLocationSubscriptionRequest {
  locationId: string;
  subscriptionStatus: SubscriptionStatus;
  monthlyFeeCents?: number | null;
  billingDueDay?: number | null;
  billingStartsAtIso?: string | null;
  billingExpiresAtIso?: string | null;
  adminNotes?: string | null;
}

interface RegisterLocationSubscriptionPaymentRequest {
  locationId: string;
  amountCents: number;
  periodKey: string;
  paidAtIso?: string | null;
  method?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
}

interface CalculateAutoRatingsRequest {
  userId: string;
}

interface AutoRatingsForUser {
  auto_striker_rating: number;
  auto_mid_rating: number;
  auto_defender_rating: number;
  auto_gk_rating: number;
  auto_rating_samples: number;
  auto_rating_updated_at: FirebaseFirestore.FieldValue;
}

const DELETE_BATCH_SIZE = 500;
const LOCATION_SUBCOLLECTIONS = [
  "reviews",
  "fields",
  "availability",
  "audit_logs",
  "commercial_events",
  "subscription_payments",
];

/**
 * Valida uma string obrigatoria recebida em callable.
 * @param {unknown} value Valor bruto recebido.
 * @param {string} field Nome do campo para mensagem de erro.
 * @return {string} String trimada.
 */
function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${field} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Normaliza texto opcional e aplica limite de seguranca.
 * @param {unknown} value Valor bruto recebido.
 * @param {number} maxLength Tamanho maximo.
 * @return {string | null} Texto trimado ou null.
 */
function optionalTrimmed(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Converte uma data ISO opcional em Date para Firestore.
 * @param {unknown} value Valor bruto recebido.
 * @param {string} field Nome do campo para mensagem de erro.
 * @return {Date | null} Data parseada ou null.
 */
function parseOptionalIsoDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} must be an ISO string`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError("invalid-argument", `${field} must be a valid ISO date`);
  }
  return parsed;
}

/**
 * Valida enum string vindo do cliente.
 * @param {unknown} value Valor bruto recebido.
 * @param {Array<string>} values Valores permitidos.
 * @param {string} field Nome do campo para mensagem de erro.
 * @return {string} Valor validado.
 */
function requireEnum<T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be one of: ${values.join(", ")}`
    );
  }
  return value as T[number];
}

/**
 * Carrega uma location existente ou falha com not-found.
 * @param {string} locationId ID da location.
 * @return {Promise<object>} Referencia e dados atuais.
 */
async function getExistingLocation(locationId: string) {
  const locRef = db().collection("locations").doc(locationId);
  const locDoc = await locRef.get();
  if (!locDoc.exists) {
    throw new HttpsError("not-found", `Location ${locationId} not found`);
  }
  return {locRef, locData: locDoc.data() || {}};
}

/**
 * Escreve evento comercial imutavel na location e no audit global.
 * @param {object} params Dados do evento comercial.
 * @return {Promise<void>} Promessa resolvida apos gravacao.
 */
async function writeLocationCommercialEvent(params: {
  locationId: string;
  actorUserId: string;
  type: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string | null;
}) {
  const event = {
    type: params.type,
    actor_user_id: params.actorUserId,
    before: params.before || null,
    after: params.after || null,
    reason: params.reason || null,
    created_at: FieldValue.serverTimestamp(),
  };
  await Promise.all([
    db()
      .collection("locations")
      .doc(params.locationId)
      .collection("commercial_events")
      .add(event),
    db().collection("audit_logs").add({
      ...event,
      target_location_id: params.locationId,
    }),
  ]);
}

/**
 * Atualiza ratings automaticos e historico a partir de statistics/{userId}.
 * @param {string} userId ID do usuario.
 * @param {FirebaseFirestore.DocumentData} stats Documento statistics.
 * @return {Promise<{ratings: AutoRatingsForUser, sampleSize: number}>}
 */
async function updateAutoRatingsFromStats(
  userId: string,
  stats: FirebaseFirestore.DocumentData
): Promise<{ratings: AutoRatingsForUser; sampleSize: number}> {
  const calculated = calculateAutoRatingsFromStats(stats);
  const autoRatings: AutoRatingsForUser = {
    auto_striker_rating: calculated.striker,
    auto_mid_rating: calculated.mid,
    auto_defender_rating: calculated.defender,
    auto_gk_rating: calculated.gk,
    auto_rating_samples: calculated.sampleSize,
    auto_rating_updated_at: FieldValue.serverTimestamp(),
  };

  await db()
    .collection("users")
    .doc(userId)
    .update(
      autoRatings as unknown as
        FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
    );

  const historyEntries = [
    {position: "STRIKER", rating: calculated.striker},
    {position: "MID", rating: calculated.mid},
    {position: "DEFENDER", rating: calculated.defender},
    {position: "GOALKEEPER", rating: calculated.gk},
  ].filter((entry) => entry.rating > 0);

  if (historyEntries.length > 0) {
    const historyRef = db()
      .collection("users")
      .doc(userId)
      .collection("rating_history");
    const batch = db().batch();
    for (const entry of historyEntries) {
      batch.set(historyRef.doc(), {
        ...entry,
        samples: calculated.sampleSize,
        calculatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await checkAndAwardRatingBadges(userId, {
    auto_striker_rating: calculated.striker,
    auto_mid_rating: calculated.mid,
    auto_defender_rating: calculated.defender,
    auto_gk_rating: calculated.gk,
  });
  return {ratings: autoRatings, sampleSize: calculated.sampleSize};
}

/**
 * Deletes every document in a location subcollection using paged batches.
 *
 * @param {string} locationId Location document id.
 * @param {string} subcollection Child collection name.
 * @return {Promise<number>} Number of deleted documents.
 */
export async function deleteLocationSubcollection(
  locationId: string,
  subcollection: string
): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snap = await db()
      .collection("locations")
      .doc(locationId)
      .collection(subcollection)
      .limit(DELETE_BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    deletedCount += snap.size;
    if (snap.size < DELETE_BATCH_SIZE) break;
  }

  return deletedCount;
}

export const deleteLocation = secureCallable<DeleteLocationRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 5, windowMs: 60000, keyPrefix: "deleteLoc"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "deleteLocation",
      locationId: req.data?.locationId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const {locationId} = request.data;
    if (!locationId || typeof locationId !== "string") {
      throw new HttpsError("invalid-argument", "locationId must be a non-empty string");
    }

    const locRef = db().collection("locations").doc(locationId);
    const locDoc = await locRef.get();
    if (!locDoc.exists) {
      throw new HttpsError("not-found", `Location ${locationId} not found`);
    }

    const locData = locDoc.data() || {};
    let deletedCount = 0;

    for (const sub of LOCATION_SUBCOLLECTIONS) {
      deletedCount += await deleteLocationSubcollection(locationId, sub);
    }

    await locRef.delete();
    deletedCount += 1;

    await db().collection("audit_logs").add({
      type: "LOCATION_DELETE",
      target_location_id: locationId,
      actor_user_id: request.auth.uid,
      location_name: locData.name || null,
      deleted_docs_count: deletedCount,
      subcollections: LOCATION_SUBCOLLECTIONS,
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`Location ${locationId} deleted (cascade: ${deletedCount} docs)`);
    return {success: true, deletedCount};
  }
);

export const setLocationPublicationStatus =
secureCallable<SetLocationPublicationStatusRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locPub"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "setLocationPublicationStatus",
      locationId: req.data?.locationId,
      publicationStatus: req.data?.publicationStatus,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const publicationStatus = requireEnum(
      request.data.publicationStatus,
      PUBLICATION_STATUSES,
      "publicationStatus"
    );
    const reason = optionalTrimmed(request.data.reason, 500);
    const {locRef, locData} = await getExistingLocation(locationId);
    const before = {
      publication_status: locData.publication_status ?? null,
      is_verified: locData.is_verified ?? null,
      is_active: locData.is_active ?? null,
      unpublished_reason: locData.unpublished_reason ?? null,
    };
    const isPublished = publicationStatus === "PUBLISHED";
    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      publication_status: publicationStatus,
      is_verified: isPublished ? true : locData.is_verified ?? false,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
      unpublished_reason: isPublished ? null : reason,
    };

    if (isPublished) {
      update.published_at = FieldValue.serverTimestamp();
      update.published_by = request.auth.uid;
    }

    await locRef.update(update);
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_PUBLICATION_STATUS_CHANGE",
      before,
      after: {
        publication_status: publicationStatus,
        is_verified: update.is_verified,
        unpublished_reason: update.unpublished_reason,
      },
      reason,
    });

    return {success: true, locationId, publicationStatus};
  }
);

export const setLocationSubscription =
secureCallable<SetLocationSubscriptionRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locSub"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "setLocationSubscription",
      locationId: req.data?.locationId,
      subscriptionStatus: req.data?.subscriptionStatus,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const subscriptionStatus = requireEnum(
      request.data.subscriptionStatus,
      SUBSCRIPTION_STATUSES,
      "subscriptionStatus"
    );
    const monthlyFeeCents = request.data.monthlyFeeCents ?? null;
    const billingDueDay = request.data.billingDueDay ?? null;

    if (monthlyFeeCents !== null &&
      (!Number.isInteger(monthlyFeeCents) || monthlyFeeCents < 0)
    ) {
      throw new HttpsError("invalid-argument", "monthlyFeeCents must be >= 0");
    }
    if (billingDueDay !== null &&
      (!Number.isInteger(billingDueDay) || billingDueDay < 1 || billingDueDay > 31)
    ) {
      throw new HttpsError("invalid-argument", "billingDueDay must be 1-31");
    }

    const billingStartsAt = parseOptionalIsoDate(
      request.data.billingStartsAtIso,
      "billingStartsAtIso"
    );
    const billingExpiresAt = parseOptionalIsoDate(
      request.data.billingExpiresAtIso,
      "billingExpiresAtIso"
    );
    const adminNotes = optionalTrimmed(request.data.adminNotes, 2000);
    const {locRef, locData} = await getExistingLocation(locationId);
    const before = {
      subscription_status: locData.subscription_status ?? null,
      commercial_status: locData.commercial_status ?? null,
      monthly_fee_cents: locData.monthly_fee_cents ?? null,
      billing_due_day: locData.billing_due_day ?? null,
      billing_starts_at: locData.billing_starts_at ?? null,
      billing_expires_at: locData.billing_expires_at ?? null,
    };
    const update = {
      subscription_status: subscriptionStatus,
      commercial_status: subscriptionStatus,
      monthly_fee_cents: monthlyFeeCents,
      billing_due_day: billingDueDay,
      billing_starts_at: billingStartsAt,
      billing_expires_at: billingExpiresAt,
      admin_notes: adminNotes,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };

    await locRef.update(update);
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_SUBSCRIPTION_CHANGE",
      before,
      after: update,
      reason: adminNotes,
    });

    return {success: true, locationId, subscriptionStatus};
  }
);

export const registerLocationSubscriptionPayment =
secureCallable<RegisterLocationSubscriptionPaymentRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locPay"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "registerLocationSubscriptionPayment",
      locationId: req.data?.locationId,
      periodKey: req.data?.periodKey,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const periodKey = requireNonEmptyString(request.data.periodKey, "periodKey");
    const {amountCents} = request.data;
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new HttpsError("invalid-argument", "amountCents must be > 0");
    }
    const paidAt = parseOptionalIsoDate(request.data.paidAtIso, "paidAtIso") ||
      new Date();
    const method = optionalTrimmed(request.data.method, 80);
    const receiptUrl = optionalTrimmed(request.data.receiptUrl, 2048);
    const notes = optionalTrimmed(request.data.notes, 1000);
    const {locRef, locData} = await getExistingLocation(locationId);
    const paymentRef = locRef.collection("subscription_payments").doc();
    const batch = db().batch();

    batch.set(paymentRef, {
      amount_cents: amountCents,
      period_key: periodKey,
      paid_at: paidAt,
      method,
      receipt_url: receiptUrl,
      notes,
      created_at: FieldValue.serverTimestamp(),
      created_by: request.auth.uid,
    });
    batch.update(locRef, {
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
      last_payment_at: paidAt,
      last_payment_amount_cents: amountCents,
      last_payment_period_key: periodKey,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_SUBSCRIPTION_PAYMENT_REGISTERED",
      before: {
        subscription_status: locData.subscription_status ?? null,
        commercial_status: locData.commercial_status ?? null,
      },
      after: {
        subscription_status: "ACTIVE",
        commercial_status: "ACTIVE",
        amount_cents: amountCents,
        period_key: periodKey,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId: paymentRef.id,
      subscriptionStatus: "ACTIVE",
    };
  }
);

export const calculateAutoRatings = secureCallable<CalculateAutoRatingsRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "autoRate"},
    enableAuditLog: true,
  },
  async (request) => {
    const {userId} = request.data;
    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userId required");
    }

    const userDoc = await db().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", `User ${userId} not found`);
    }

    // FIX #2657: query real aggregation stats (statistics/{userId})
    // instead of non-existent games.confirmed_players / games.ratings_map.
    const statsDoc = await db().collection("statistics").doc(userId).get();
    if (!statsDoc.exists) {
      logger.info(`[AUTO_RATINGS] No statistics doc for user ${userId}`);
      return {success: true};
    }

    const stats = statsDoc.data();
    if (!stats || (stats.total_games ?? stats.totalGames ?? 0) < 1) {
      return {success: true};
    }

    const result = await updateAutoRatingsFromStats(userId, stats);

    logger.info(
      `[AUTO_RATINGS] Calculated for user ${userId} ` +
      `samples=${result.sampleSize}`
    );

    return {success: true};
  }
);

/**
 * Verifica e concede badges baseados em ratings automáticos.
 * Badges concedidos: ELITE_* (4.5+), FIVE_STAR_* (5.0).
 * @param {string} userId - ID do usuário
 * @param {Object} ratings - Objeto com ratings por posição
 * @return {Promise<void>}
 */
async function checkAndAwardRatingBadges(userId: string, ratings: {[key: string]: number}): Promise<void> {
  const userRef = db().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  const userData = userSnap.data()!;
  const currentBadges: string[] = userData.badges || [];
  const newBadges: string[] = [];

  const badgeDefinitions = [
    {id: "ELITE_STRIKER", field: "auto_striker_rating", threshold: 4.5},
    {id: "ELITE_MID", field: "auto_mid_rating", threshold: 4.5},
    {id: "ELITE_DEFENDER", field: "auto_defender_rating", threshold: 4.5},
    {id: "ELITE_GOALKEEPER", field: "auto_gk_rating", threshold: 4.5},
    {id: "FIVE_STAR_STRIKER", field: "auto_striker_rating", threshold: 5.0},
    {id: "FIVE_STAR_MID", field: "auto_mid_rating", threshold: 5.0},
    {id: "FIVE_STAR_DEFENDER", field: "auto_defender_rating", threshold: 5.0},
    {id: "FIVE_STAR_GOALKEEPER", field: "auto_gk_rating", threshold: 5.0},
  ];

  badgeDefinitions.forEach((badge) => {
    const rating = ratings[badge.field];
    if (rating && rating >= badge.threshold && !currentBadges.includes(badge.id)) {
      newBadges.push(badge.id);
    }
  });

  if (newBadges.length > 0) {
    await userRef.update({
      badges: FieldValue.arrayUnion(...newBadges),
    });
  }
}

interface RecalculateAllAutoRatingsRequest {
  batchSize?: number;
}

export const recalculateAllAutoRatings = secureCallable<RecalculateAllAutoRatingsRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 1, windowMs: 300000, keyPrefix: "recalcAllRatings"},
    enableAuditLog: true,
  },
  async (request) => {
    const batchSize = Math.max(1, Math.min(Number(request.data?.batchSize) || 50, 500));

    const statsSnap = await db()
      .collection("statistics")
      .limit(batchSize)
      .get();

    let processedCount = 0;
    for (const statsDoc of statsSnap.docs) {
      const userId = statsDoc.id;
      try {
        const stats = statsDoc.data();
        if (!stats || (stats.total_games ?? stats.totalGames ?? 0) < 1) continue;

        await updateAutoRatingsFromStats(userId, stats);
        processedCount++;
      } catch (err) {
        logger.warn(`Failed to recalculate ratings for user ${userId}: ${err}`);
      }
    }

    logger.info(`Recalculated auto-ratings for ${processedCount} users`);
    return {success: true, processedCount};
  }
);
