import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";
import {
  isContractExpired,
  isTrialAged,
  isVenueAccountStatus,
  resolveSubscriptionStatusOrDefault,
} from "./venue-account-shared";
import {
  ACTIVE_GAME_STATUSES,
  chunkArray,
  dateOrNull,
  FieldType,
  FINISHED_GAME_STATUSES,
  getFieldHourlyPrice,
  getLocationFields,
  getLocationPhotos,
  isFieldActive,
  LOCATION_AGGREGATE_GAME_LIMIT,
  LOCATION_AGGREGATE_REBUILD_LIMIT,
  LOCATION_AGGREGATE_REVIEW_LIMIT,
  normalizeAmenity,
  normalizeFieldType,
  optionalTrimmed,
  positiveCents,
  RecomputeLocationAggregatesRequest,
  toIsoString,
} from "./location-types-helpers";

/**
 * Calcula agregados de campos/precos por tipo sem depender do client.
 * @param {FirebaseFirestore.DocumentData[]} fields Campos vinculados.
 * @return {Record<string, unknown>} Campos denormalizados.
 */
export function buildLocationFieldAggregates(
  fields: FirebaseFirestore.DocumentData[]
): Record<string, unknown> {
  const activeFields = fields.filter((field) => isFieldActive(field));
  const priceBuckets = new Map<FieldType, number[]>();
  const activeTypes = new Set<FieldType>();
  const activeFieldAmenities = new Set<string>();

  for (const field of activeFields) {
    const type = normalizeFieldType(field.type);
    activeTypes.add(type);
    if (Array.isArray(field.amenities)) {
      field.amenities
        .map(normalizeAmenity)
        .filter((amenity): amenity is string => Boolean(amenity))
        .forEach((amenity) => activeFieldAmenities.add(amenity));
    }
    const price = getFieldHourlyPrice(field);
    if (price > 0) {
      priceBuckets.set(type, [...(priceBuckets.get(type) || []), price]);
    }
  }

  const allPrices = Array.from(priceBuckets.values()).flat();
  const priceByType: Record<string, {
    min_hourly_price_cents: number;
    average_hourly_price_cents: number;
    active_field_count: number;
  }> = {};

  for (const [type, prices] of priceBuckets.entries()) {
    const total = prices.reduce((sum, value) => sum + value, 0);
    priceByType[type] = {
      min_hourly_price_cents: Math.min(...prices),
      average_hourly_price_cents: Math.round(total / prices.length),
      active_field_count: prices.length,
    };
  }

  return {
    field_count: fields.length,
    active_field_count: activeFields.length,
    has_active_fields: activeFields.length > 0,
    active_field_types: Array.from(activeTypes).sort(),
    active_field_amenities: Array.from(activeFieldAmenities).sort(),
    primary_field_type: Array.from(activeTypes).sort()[0] || null,
    min_hourly_price_cents: allPrices.length > 0 ? Math.min(...allPrices) : null,
    average_hourly_price_cents: allPrices.length > 0 ?
      Math.round(allPrices.reduce((sum, value) => sum + value, 0) /
        allPrices.length) :
      null,
    hourly_price_by_type: priceByType,
  };
}

/**
 * Calcula agregados de jogos da location.
 * @param {FirebaseFirestore.DocumentData[]} games Jogos vinculados.
 * @param {Date} now Referencia temporal.
 * @return {Record<string, unknown>} Campos denormalizados.
 */
export function buildLocationGameAggregates(
  games: FirebaseFirestore.DocumentData[],
  now = new Date()
): Record<string, unknown> {
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  let totalGames = 0;
  let finishedGames = 0;
  let upcomingGames = 0;
  let gamesThisWeek = 0;
  let gamesLast30Days = 0;
  let lastGameAt: Date | null = null;
  let lastActivityAt: Date | null = null;

  for (const game of games) {
    if (game.deleted_at || game.deletedAt) continue;
    const status = typeof game.status === "string" ? game.status : "";
    if (status === "CANCELLED") continue;
    const date = dateOrNull(game.dateTime ?? game.date_time);
    const updatedAt = dateOrNull(game.updated_at ?? game.updatedAt);
    const createdAt = dateOrNull(game.created_at ?? game.createdAt);
    const activityDate = updatedAt || createdAt || date;

    totalGames += 1;
    if (FINISHED_GAME_STATUSES.has(status)) finishedGames += 1;
    if (date && date > now && ACTIVE_GAME_STATUSES.has(status)) {
      upcomingGames += 1;
      if (date <= weekEnd) gamesThisWeek += 1;
    }
    if (date && date >= thirtyDaysAgo && date <= now) {
      gamesLast30Days += 1;
    }
    if (date && (!lastGameAt || date > lastGameAt)) lastGameAt = date;
    if (activityDate && (!lastActivityAt || activityDate > lastActivityAt)) {
      lastActivityAt = activityDate;
    }
  }

  return {
    games_count: totalGames,
    finished_games_count: finishedGames,
    upcoming_games_count: upcomingGames,
    games_this_week_count: gamesThisWeek,
    games_last_30_days_count: gamesLast30Days,
    last_game_at: lastGameAt,
    last_activity_at: lastActivityAt,
  };
}

/**
 * Calcula rating/reviews a partir da subcolecao real de reviews.
 * @param {FirebaseFirestore.DocumentData[]} reviews Reviews vinculadas.
 * @return {Record<string, unknown>} Campos denormalizados.
 */
export function buildLocationReviewAggregates(
  reviews: FirebaseFirestore.DocumentData[]
): Record<string, unknown> {
  const ratings = reviews
    .map((review) => review.rating)
    .filter((rating): rating is number =>
      typeof rating === "number" &&
      Number.isFinite(rating) &&
      rating >= 1 &&
      rating <= 5
    );
  const average = ratings.length > 0 ?
    ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length :
    0;

  return {
    rating: ratings.length > 0 ? Number(average.toFixed(2)) : 0,
    average_rating: ratings.length > 0 ? Number(average.toFixed(2)) : 0,
    rating_count: ratings.length,
    review_count: reviews.length,
  };
}

/**
 * Recalcula e persiste todos os agregados comerciais de uma location.
 * @param {string} locationId ID da location.
 * @return {Promise<Record<string, unknown> | null>} Agregado aplicado.
 */
export async function recomputeLocationAggregates(
  locationId: string
): Promise<Record<string, unknown> | null> {
  const locRef = db().collection("locations").doc(locationId);
  const locDoc = await locRef.get();
  if (!locDoc.exists) return null;
  const locData = locDoc.data() || {};

  const [fields, gamesSnapshot, reviewsSnapshot] = await Promise.all([
    getLocationFields(locationId),
    db()
      .collection("games")
      .where("location_id", "==", locationId)
      .limit(LOCATION_AGGREGATE_GAME_LIMIT)
      .get(),
    locRef
      .collection("reviews")
      .limit(LOCATION_AGGREGATE_REVIEW_LIMIT)
      .get(),
  ]);
  const fieldAggregates = buildLocationFieldAggregates(fields);
  const amenities = new Set<string>();
  if (Array.isArray(locData.amenities)) {
    locData.amenities
      .map(normalizeAmenity)
      .filter((amenity): amenity is string => Boolean(amenity))
      .forEach((amenity) => amenities.add(amenity));
  }
  if (locData.has_parking === true || locData.hasParking === true) {
    amenities.add("parking");
  }
  if (locData.has_lighting === true || locData.hasLighting === true) {
    amenities.add("lighting");
  }
  if (locData.has_showers === true || locData.hasShowers === true) {
    amenities.add("shower");
    amenities.add("locker_room");
  }
  const fieldAmenities = fieldAggregates.active_field_amenities;
  if (Array.isArray(fieldAmenities)) {
    fieldAmenities
      .filter((amenity): amenity is string => typeof amenity === "string")
      .forEach((amenity) => amenities.add(amenity));
  }

  const aggregates = {
    ...fieldAggregates,
    ...buildLocationGameAggregates(gamesSnapshot.docs.map((doc) => doc.data() || {})),
    ...buildLocationReviewAggregates(
      reviewsSnapshot.docs.map((doc) => doc.data() || {})
    ),
    amenities_normalized: Array.from(amenities).sort(),
    location_stats_updated_at: FieldValue.serverTimestamp(),
    location_stats_source: "cloud_functions",
  };

  await locRef.update(aggregates);
  return aggregates;
}

/**
 * Recalcula duas locations quando um documento muda de location_id.
 * @param {unknown} beforeLocationId Location anterior.
 * @param {unknown} afterLocationId Location atual.
 * @return {Promise<void>} Promise de sincronizacao.
 */
async function recomputeChangedLocationIds(
  beforeLocationId: unknown,
  afterLocationId: unknown
): Promise<void> {
  const ids = Array.from(new Set([beforeLocationId, afterLocationId]
    .filter((id): id is string =>
      typeof id === "string" && id.trim().length > 0)));
  await Promise.all(ids.map((locationId) => recomputeLocationAggregates(locationId)));
}

/**
 * Monta snapshot operacional/comercial para solicitações do owner.
 * Tambem e o resolver de status comercial (`commercial_issue_codes`,
 * `ready_for_publication_approval`) usado pelas callables admin.
 * @param {FirebaseFirestore.DocumentData} locData Dados da location.
 * @param {FirebaseFirestore.DocumentData[]} fields Campos vinculados.
 * @param {Date} now Instante de referencia (injetavel em testes).
 * @return {Record<string, unknown>} Resumo auditável.
 */
export function buildLocationCommercialRequestSnapshot(
  locData: FirebaseFirestore.DocumentData,
  fields: FirebaseFirestore.DocumentData[],
  now: Date = new Date()
): Record<string, unknown> {
  const photos = getLocationPhotos(locData);
  const activeFields = fields.filter((field) => isFieldActive(field));
  const hasFieldRegistry = fields.length > 0 ||
    (typeof locData.field_count === "number" && locData.field_count > 0);
  const hasActiveFieldRegistry = activeFields.length > 0 ||
    locData.has_active_fields === true;
  const hasPricedField = activeFields.some((field) => getFieldHourlyPrice(field) > 0);
  const hasContact = Boolean(
    (typeof locData.phone === "string" && locData.phone.trim()) ||
    (typeof locData.whatsapp === "string" && locData.whatsapp.trim()) ||
    (typeof locData.website === "string" && locData.website.trim()) ||
    (typeof locData.instagram === "string" && locData.instagram.trim())
  );
  const hasAddress = Boolean(
    typeof locData.address === "string" && locData.address.trim() &&
    typeof locData.city === "string" && locData.city.trim() &&
    typeof locData.state === "string" && locData.state.trim()
  );
  const hasGeolocation =
    typeof locData.latitude === "number" &&
    Number.isFinite(locData.latitude) &&
    typeof locData.longitude === "number" &&
    Number.isFinite(locData.longitude);
  const hasOperatingHours = Boolean(
    typeof locData.opening_time === "string" &&
    locData.opening_time.trim() &&
    typeof locData.closing_time === "string" &&
    locData.closing_time.trim() &&
    locData.opening_time !== locData.closing_time &&
    Array.isArray(locData.operating_days) &&
    locData.operating_days.length > 0 &&
    Number.isInteger(locData.min_game_duration_minutes) &&
    Number(locData.min_game_duration_minutes) >= 30
  );

  const pendingItemIds: string[] = [];
  if (!(typeof locData.name === "string" && locData.name.trim() &&
    typeof locData.description === "string" && locData.description.trim())
  ) {
    pendingItemIds.push("identity");
  }
  if (!hasAddress) pendingItemIds.push("address");
  if (!hasGeolocation) pendingItemIds.push("geolocation");
  if (!hasOperatingHours) pendingItemIds.push("operating-hours");
  if (!hasContact) pendingItemIds.push("contact");
  if (photos.length === 0) pendingItemIds.push("photos");
  if (!hasFieldRegistry) pendingItemIds.push("fields");
  if (!hasActiveFieldRegistry) pendingItemIds.push("active-fields");
  if (!hasPricedField) pendingItemIds.push("pricing");

  const publicationStatus = typeof locData.publication_status === "string" ?
    locData.publication_status :
    "DRAFT";
  // #4111: default unico e fail-closed compartilhado com o cron e o painel.
  const subscriptionStatus = resolveSubscriptionStatusOrDefault(
    locData.subscription_status
  );
  const subscriptionStatusInvalid = !isVenueAccountStatus(locData.subscription_status);
  // #4107: contrato com `billing_expires_at` no passado esta encerrado.
  const contractExpired = isContractExpired(locData.billing_expires_at, now);
  // #4111: TRIAL sem saida automatica precisa envelhecer e virar pendencia.
  // Decisao de produto: o status continua TRIAL (sem transicao automatica),
  // mas a quadra passa a aparecer como pendencia para o admin/owner.
  const trialExpired = subscriptionStatus === "TRIAL" &&
    isTrialAged(locData.trial_started_at, now);
  const commercialIssueCodes: string[] = [];
  if (locData.is_active !== true) commercialIssueCodes.push("inactive");
  if (locData.is_verified !== true) commercialIssueCodes.push("notVerified");
  if (publicationStatus !== "PUBLISHED") commercialIssueCodes.push("notPublished");
  if (!["TRIAL", "ACTIVE"].includes(subscriptionStatus)) {
    commercialIssueCodes.push("billingIrregular");
  }
  if (subscriptionStatusInvalid) commercialIssueCodes.push("subscriptionStatusInvalid");
  if (contractExpired) commercialIssueCodes.push("contractExpired");
  if (trialExpired) commercialIssueCodes.push("trialExpired");
  if (!hasFieldRegistry) commercialIssueCodes.push("noFields");
  if (!hasActiveFieldRegistry) commercialIssueCodes.push("noActiveFields");
  if (!positiveCents(locData.monthly_fee_cents)) commercialIssueCodes.push("noMonthlyFee");
  if (!Number.isInteger(locData.billing_due_day)) commercialIssueCodes.push("noDueDay");
  if (!hasAddress) commercialIssueCodes.push("incompleteAddress");
  if (!hasGeolocation) commercialIssueCodes.push("missingGeolocation");
  if (!hasOperatingHours) commercialIssueCodes.push("missingOperatingHours");

  const ownerReadyForPublication = pendingItemIds.length === 0 && locData.is_active !== false;
  const readyForPublicationApproval = ownerReadyForPublication &&
    locData.is_active === true &&
    locData.is_verified === true &&
    hasGeolocation &&
    hasOperatingHours &&
    hasActiveFieldRegistry &&
    positiveCents(locData.monthly_fee_cents) > 0 &&
    Number.isInteger(locData.billing_due_day) &&
    ["TRIAL", "ACTIVE"].includes(subscriptionStatus) &&
    !contractExpired;

  return {
    publication_status: publicationStatus,
    subscription_status: subscriptionStatus,
    is_active: locData.is_active === true,
    is_verified: locData.is_verified === true,
    field_count: fields.length,
    active_field_count: activeFields.length,
    photo_count: photos.length,
    checklist_completed: 9 - pendingItemIds.length,
    checklist_total: 9,
    pending_item_ids: pendingItemIds,
    commercial_issue_codes: commercialIssueCodes,
    owner_ready_for_publication: ownerReadyForPublication,
    ready_for_publication_approval: readyForPublicationApproval,
    monthly_fee_cents: positiveCents(locData.monthly_fee_cents) || null,
    billing_due_day: Number.isInteger(locData.billing_due_day) ?
      Number(locData.billing_due_day) :
      null,
    billing_expires_at_iso: toIsoString(locData.billing_expires_at),
    trial_started_at_iso: toIsoString(locData.trial_started_at),
    city: typeof locData.city === "string" ? locData.city : null,
    state: typeof locData.state === "string" ? locData.state : null,
    requested_at_iso: now.toISOString(),
  };
}

export const recomputeLocationCommercialStats =
secureCallable<RecomputeLocationAggregatesRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "locStats"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "recomputeLocationCommercialStats",
      locationId: req.data?.locationId ?? null,
      limit: req.data?.limit ?? null,
      startAfterId: req.data?.startAfterId ?? null,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = optionalTrimmed(request.data?.locationId, 160);
    if (locationId) {
      const aggregates = await recomputeLocationAggregates(locationId);
      if (!aggregates) {
        throw new HttpsError("not-found", "Location not found");
      }
      return {success: true, processedLocations: 1, locationId};
    }

    const requestedLimit = request.data?.limit;
    const limit = Number.isInteger(requestedLimit) &&
      Number(requestedLimit) > 0 ?
      Math.min(Number(requestedLimit), LOCATION_AGGREGATE_REBUILD_LIMIT) :
      LOCATION_AGGREGATE_REBUILD_LIMIT;
    // #3838: cursor opcional permite cobrir bases com mais de uma página
    // encadeando chamadas (startAfterId = nextCursor da resposta anterior).
    const startAfterId = optionalTrimmed(request.data?.startAfterId, 160);
    let query: FirebaseFirestore.Query = db()
      .collection("locations")
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (startAfterId) {
      query = query.startAfter(startAfterId);
    }
    const snapshot = await query.get();

    let processedLocations = 0;
    for (const chunk of chunkArray(snapshot.docs, 20)) {
      await Promise.all(chunk.map(async (doc) => {
        await recomputeLocationAggregates(doc.id);
        processedLocations += 1;
      }));
    }

    const scanComplete = snapshot.size < limit;
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    return {
      success: true,
      processedLocations,
      scanComplete,
      limit,
      nextCursor: scanComplete || !lastDoc ? null : lastDoc.id,
    };
  }
);

export const rebuildLocationCommercialStats = onSchedule(
  {
    schedule: "every day 04:10",
    timeZone: "America/Sao_Paulo",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    // #3838: pagina TODA a coleção (padrão #3200) — sem cap silencioso.
    // Processa página a página para não acumular todos os docs em memória.
    let processedLocations = 0;
    let pages = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (true) {
      let query: FirebaseFirestore.Query = db()
        .collection("locations")
        .orderBy(FieldPath.documentId())
        .limit(LOCATION_AGGREGATE_REBUILD_LIMIT);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snapshot = await query.get();
      pages += 1;
      for (const chunk of chunkArray(snapshot.docs, 20)) {
        await Promise.all(chunk.map(async (doc) => {
          await recomputeLocationAggregates(doc.id);
          processedLocations += 1;
        }));
      }
      if (snapshot.size < LOCATION_AGGREGATE_REBUILD_LIMIT) {
        break;
      }
      lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      if (!lastDoc) {
        break;
      }
    }
    logger.info("Rebuilt commercial stats for locations", {
      processedLocations,
      pages,
    });
  }
);

export const onNestedLocationFieldWrittenUpdateStats = onDocumentWritten(
  {
    document: "locations/{locationId}/fields/{fieldId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    await recomputeLocationAggregates(event.params.locationId);
  }
);

export const onRootFieldWrittenUpdateLocationStats = onDocumentWritten(
  {
    document: "fields/{fieldId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    await recomputeChangedLocationIds(
      before?.location_id ?? before?.locationId,
      after?.location_id ?? after?.locationId
    );
  }
);

export const onLocationReviewWrittenUpdateStats = onDocumentWritten(
  {
    document: "locations/{locationId}/reviews/{reviewId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    await recomputeLocationAggregates(event.params.locationId);
  }
);

export const onGameWrittenUpdateLocationStats = onDocumentWritten(
  {
    document: "games/{gameId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    await recomputeChangedLocationIds(
      before?.location_id ?? before?.locationId,
      after?.location_id ?? after?.locationId
    );
  }
);
