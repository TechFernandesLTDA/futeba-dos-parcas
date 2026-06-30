import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";
import {
  VenueAccountBillingCycle,
  VenueAccountBillingScope,
  VenueAccountCommercialConfig,
  VenueAccountPlanCode,
  VenueAccountStatus,
  buildVenueAccountDenormalizedLocationFields,
  buildVenueAccountLocationSnapshot,
  centsOrNull,
  clearVenueAccountDenormalizedLocationFields,
  computeVenueAccountMetrics,
  isVenueAccountBillingCycle,
  isVenueAccountBillingScope,
  isVenueAccountPlanCode,
  isVenueAccountStatus,
  normalizeVenueAccountBillingScope,
  normalizeVenueAccountStatus,
  positiveIntegerOrNull,
  stringOrNull,
} from "../locations/venue-account-shared";

interface UpsertVenueAccountRequest {
  ownerUid?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  billingContactPhone?: string | null;
  billingContactDocument?: string | null;
  status?: VenueAccountStatus | null;
  billingScope?: VenueAccountBillingScope | null;
  billingPlanCode?: VenueAccountPlanCode | null;
  billingPlanLabel?: string | null;
  billingCycle?: VenueAccountBillingCycle | null;
  billingBaseFeeCents?: number | null;
  defaultLocationFeeCents?: number | null;
  pricePerActiveFieldCents?: number | null;
  monthlyFeeOverrideCents?: number | null;
  billingDueDay?: number | null;
  billingStartsAtIso?: string | null;
  billingExpiresAtIso?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  linkedLocationIds?: string[] | null;
}

interface LinkLocationToVenueAccountRequest {
  ownerUid?: string | null;
  locationId?: string | null;
}

interface UnlinkLocationFromVenueAccountRequest {
  ownerUid?: string | null;
  locationId?: string | null;
}

interface VenueAccountCallableResponse {
  success: boolean;
  accountId: string;
  ownerUid: string;
  linkedLocationIds: string[];
  linkedLocationsCount: number;
  publishedLocationsCount: number;
  activeFieldCount: number;
  computedMonthlyFeeCents: number;
  status: VenueAccountStatus;
  billingScope: VenueAccountBillingScope;
}

const COLLECTION = "venue_accounts";

/**
 * Normaliza string obrigatoria.
 * @param {unknown} value Valor recebido.
 * @param {string} field Campo validado.
 * @return {string} Texto trimado.
 */
function requireTrimmedString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${field} is required`);
  }
  return value.trim();
}

/**
 * Normaliza string opcional com limite.
 * @param {unknown} value Valor recebido.
 * @param {number} maxLength Limite.
 * @return {string | null} Texto seguro.
 */
function optionalTrimmed(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Normaliza email opcional.
 * @param {unknown} value Valor recebido.
 * @return {string | null} Email normalizado.
 */
function optionalEmail(value: unknown): string | null {
  const email = optionalTrimmed(value, 254)?.toLowerCase() ?? null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "billingContactEmail must be valid");
  }
  return email;
}

/**
 * Normaliza array de ids.
 * @param {unknown} value Valor recebido.
 * @return {string[]} Lista unica.
 */
function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100)
  ));
}

/**
 * Faz parse de ISO opcional.
 * @param {unknown} value Valor bruto.
 * @param {string} field Campo validado.
 * @return {Date | null} Data segura.
 */
function parseOptionalIsoDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} must be a valid ISO date`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError("invalid-argument", `${field} must be a valid ISO date`);
  }
  return parsed;
}

/**
 * Normaliza dia de vencimento comercial.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Dia de 1 a 31 ou null.
 */
function billingDueDayOrNull(value: unknown): number | null {
  const day = positiveIntegerOrNull(value);
  return day !== null && day >= 1 && day <= 31 ? day : null;
}

/**
 * Monta configuracao comercial a partir do estado atual + input.
 * @param {Record<string, unknown> | null} current Estado atual.
 * @param {UpsertVenueAccountRequest} input Input admin.
 * @return {VenueAccountCommercialConfig} Config normalizada.
 */
function buildCommercialConfig(
  current: Record<string, unknown> | null,
  input: UpsertVenueAccountRequest
): VenueAccountCommercialConfig {
  const statusCandidate = input.status ?? current?.status;
  const billingScopeCandidate = input.billingScope ?? current?.billing_scope;
  const billingPlanCodeCandidate =
    input.billingPlanCode === undefined ?
      current?.billing_plan_code :
      input.billingPlanCode;
  const billingCycleCandidate =
    input.billingCycle === undefined ?
      current?.billing_cycle :
      input.billingCycle;
  const billingPlanLabelCandidate =
    input.billingPlanLabel === undefined ?
      current?.billing_plan_label :
      input.billingPlanLabel;
  const billingBaseFeeCandidate =
    input.billingBaseFeeCents === undefined ?
      current?.billing_base_fee_cents :
      input.billingBaseFeeCents;
  const defaultLocationFeeCandidate =
    input.defaultLocationFeeCents === undefined ?
      current?.default_location_fee_cents :
      input.defaultLocationFeeCents;
  const pricePerActiveFieldCandidate =
    input.pricePerActiveFieldCents === undefined ?
      current?.price_per_active_field_cents :
      input.pricePerActiveFieldCents;
  const monthlyFeeOverrideCandidate =
    input.monthlyFeeOverrideCents === undefined ?
      current?.monthly_fee_override_cents :
      input.monthlyFeeOverrideCents;
  const billingDueDayCandidate =
    input.billingDueDay === undefined ?
      current?.billing_due_day :
      input.billingDueDay;

  const status = normalizeVenueAccountStatus(statusCandidate);
  const billingScope = normalizeVenueAccountBillingScope(billingScopeCandidate);
  const billingPlanCode = billingPlanCodeCandidate === null ?
    null :
    (isVenueAccountPlanCode(billingPlanCodeCandidate) ?
      billingPlanCodeCandidate :
      null);
  const billingCycle = billingCycleCandidate === null ?
    null :
    (isVenueAccountBillingCycle(billingCycleCandidate) ?
      billingCycleCandidate :
      null);
  const billingPlanLabel = billingPlanLabelCandidate === null ?
    null :
    optionalTrimmed(billingPlanLabelCandidate, 120);
  const billingBaseFeeCents = billingBaseFeeCandidate === null ?
    null :
    centsOrNull(billingBaseFeeCandidate);
  const defaultLocationFeeCents = defaultLocationFeeCandidate === null ?
    null :
    centsOrNull(defaultLocationFeeCandidate);
  const pricePerActiveFieldCents = pricePerActiveFieldCandidate === null ?
    null :
    centsOrNull(pricePerActiveFieldCandidate);
  const monthlyFeeOverrideCents = monthlyFeeOverrideCandidate === null ?
    null :
    centsOrNull(monthlyFeeOverrideCandidate);
  const billingDueDay = billingDueDayCandidate === null ?
    null :
    billingDueDayOrNull(billingDueDayCandidate);

  if (billingBaseFeeCandidate !== undefined &&
    billingBaseFeeCandidate !== null &&
    billingBaseFeeCents === null) {
    throw new HttpsError("invalid-argument", "billingBaseFeeCents must be >= 0");
  }
  if (defaultLocationFeeCandidate !== undefined &&
    defaultLocationFeeCandidate !== null &&
    defaultLocationFeeCents === null) {
    throw new HttpsError(
      "invalid-argument",
      "defaultLocationFeeCents must be >= 0"
    );
  }
  if (pricePerActiveFieldCandidate !== undefined &&
    pricePerActiveFieldCandidate !== null &&
    pricePerActiveFieldCents === null) {
    throw new HttpsError(
      "invalid-argument",
      "pricePerActiveFieldCents must be >= 0"
    );
  }
  if (monthlyFeeOverrideCandidate !== undefined &&
    monthlyFeeOverrideCandidate !== null &&
    monthlyFeeOverrideCents === null) {
    throw new HttpsError(
      "invalid-argument",
      "monthlyFeeOverrideCents must be >= 0"
    );
  }
  if (billingDueDayCandidate !== undefined &&
    billingDueDayCandidate !== null &&
    billingDueDay === null) {
    throw new HttpsError("invalid-argument", "billingDueDay must be 1-31");
  }

  return {
    status,
    billingScope,
    billingPlanCode,
    billingPlanLabel,
    billingCycle,
    billingBaseFeeCents,
    defaultLocationFeeCents,
    pricePerActiveFieldCents,
    monthlyFeeOverrideCents,
    billingDueDay,
  };
}

/**
 * Carrega locations vinculadas e valida ownership/conta atual.
 * @param {string[]} locationIds IDs desejados.
 * @param {string} ownerUid Owner esperado.
 * @param {string} accountId Conta atual.
 * @return {Promise<FirebaseFirestore.DocumentSnapshot[]>} Snapshots validos.
 */
async function fetchValidatedLocationDocs(
  locationIds: string[],
  ownerUid: string,
  accountId: string
) {
  const docs = await Promise.all(locationIds.map((locationId) =>
    db().collection("locations").doc(locationId).get()
  ));
  for (const doc of docs) {
    if (!doc.exists) {
      throw new HttpsError("not-found", `Location ${doc.id} not found`);
    }
    const data = doc.data() || {};
    if (stringOrNull(data.owner_id) !== ownerUid) {
      throw new HttpsError(
        "failed-precondition",
        `Location ${doc.id} does not belong to owner ${ownerUid}`
      );
    }
    if (stringOrNull(data.venue_account_id) &&
      stringOrNull(data.venue_account_id) !== accountId) {
      throw new HttpsError(
        "failed-precondition",
        `Location ${doc.id} is already linked to another venue account`
      );
    }
  }
  return docs;
}

/**
 * Escreve evento imutavel de conta comercial.
 * @param {object} params Dados do evento.
 */
async function writeVenueAccountEvent(params: {
  accountId: string;
  ownerUid: string;
  actorUid: string;
  type: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  const event = {
    account_id: params.accountId,
    owner_uid: params.ownerUid,
    actor_uid: params.actorUid,
    type: params.type,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
    created_at: FieldValue.serverTimestamp(),
  };
  await Promise.all([
    db().collection(COLLECTION)
      .doc(params.accountId)
      .collection("events")
      .add(event),
    db().collection("audit_logs").add({
      ...event,
      category: "VENUE_ACCOUNT",
      target_user_id: params.ownerUid,
    }),
  ]);
}

/**
 * Persiste conta comercial e sincroniza denormalizacao nas locations.
 * @param {object} params Dados da operacao.
 * @return {Promise<VenueAccountCallableResponse>} Resumo atual.
 */
async function persistVenueAccount(params: {
  ownerUid: string;
  actorUid: string;
  eventType: string;
  reason?: string | null;
  input: UpsertVenueAccountRequest;
  linkedLocationIds?: string[];
}) : Promise<VenueAccountCallableResponse> {
  const ownerUid = params.ownerUid;
  const accountId = ownerUid;
  const accountRef = db().collection(COLLECTION).doc(accountId);
  const [accountSnap, ownerSnap] = await Promise.all([
    accountRef.get(),
    db().collection("users").doc(ownerUid).get(),
  ]);
  if (!ownerSnap.exists) {
    throw new HttpsError("not-found", "Owner profile not found");
  }

  const current = accountSnap.data() || null;
  const existingLinkedLocationIds = normalizeIds(current?.linked_location_ids);
  const nextLinkedLocationIds = params.linkedLocationIds ??
    (params.input.linkedLocationIds === undefined ?
      existingLinkedLocationIds :
      normalizeIds(params.input.linkedLocationIds));
  const locationDocs = await fetchValidatedLocationDocs(
    nextLinkedLocationIds,
    ownerUid,
    accountId
  );
  const config = buildCommercialConfig(current, params.input);
  const billingStartsAt = params.input.billingStartsAtIso === undefined ?
    (current?.billing_starts_at ?? null) :
    parseOptionalIsoDate(
      params.input.billingStartsAtIso,
      "billingStartsAtIso"
    );
  const billingExpiresAt = params.input.billingExpiresAtIso === undefined ?
    (current?.billing_expires_at ?? null) :
    parseOptionalIsoDate(
      params.input.billingExpiresAtIso,
      "billingExpiresAtIso"
    );
  const billingStartsAtDate =
    billingStartsAt instanceof Date ? billingStartsAt : null;
  const billingExpiresAtDate =
    billingExpiresAt instanceof Date ? billingExpiresAt : null;
  if (billingStartsAtDate &&
    billingExpiresAtDate &&
    billingStartsAtDate > billingExpiresAtDate) {
    throw new HttpsError(
      "invalid-argument",
      "billingStartsAtIso must be <= billingExpiresAtIso"
    );
  }

  const linkedLocations = locationDocs.map((doc) => {
    const data = doc.data() || {};
    return buildVenueAccountLocationSnapshot({
      id: doc.id,
      ownerId: data.owner_id,
      publicationStatus: data.publication_status,
      isVerified: data.is_verified,
      fieldCount: data.field_count,
      activeFieldCount: data.venue_account_active_fields_count ??
        data.active_field_count,
      hasActiveFields: data.has_active_fields,
      monthlyFeeCents: data.monthly_fee_cents,
    });
  });
  const metrics = computeVenueAccountMetrics(config, linkedLocations);
  const denormalizedLocationFields = buildVenueAccountDenormalizedLocationFields({
    accountId,
    config,
    metrics,
  });
  const removedLocationIds = existingLinkedLocationIds.filter((locationId) =>
    !nextLinkedLocationIds.includes(locationId)
  );
  const removedLocationDocs = await Promise.all(removedLocationIds.map((locationId) =>
    db().collection("locations").doc(locationId).get()
  ));

  const nextDocument = {
    owner_uid: ownerUid,
    billing_contact_name: params.input.billingContactName === undefined ?
      current?.billing_contact_name ?? null :
      optionalTrimmed(params.input.billingContactName, 120),
    billing_contact_email: params.input.billingContactEmail === undefined ?
      current?.billing_contact_email ?? null :
      optionalEmail(params.input.billingContactEmail),
    billing_contact_phone: params.input.billingContactPhone === undefined ?
      current?.billing_contact_phone ?? null :
      optionalTrimmed(params.input.billingContactPhone, 40),
    billing_contact_document: params.input.billingContactDocument === undefined ?
      current?.billing_contact_document ?? null :
      optionalTrimmed(params.input.billingContactDocument, 40),
    status: config.status,
    billing_scope: config.billingScope,
    billing_plan_code: config.billingPlanCode ?? null,
    billing_plan_label: config.billingPlanLabel ?? null,
    billing_cycle: config.billingCycle ?? null,
    billing_base_fee_cents: config.billingBaseFeeCents ?? null,
    default_location_fee_cents: config.defaultLocationFeeCents ?? null,
    price_per_active_field_cents: config.pricePerActiveFieldCents ?? null,
    monthly_fee_override_cents: config.monthlyFeeOverrideCents ?? null,
    billing_due_day: config.billingDueDay ?? null,
    billing_starts_at: billingStartsAtDate ?? null,
    billing_expires_at: billingExpiresAtDate ?? null,
    notes: params.input.notes === undefined ?
      current?.notes ?? null :
      optionalTrimmed(params.input.notes, 1000),
    admin_notes: params.input.adminNotes === undefined ?
      current?.admin_notes ?? null :
      optionalTrimmed(params.input.adminNotes, 1000),
    linked_location_ids: nextLinkedLocationIds,
    linked_locations_count: metrics.linkedLocationsCount,
    published_locations_count: metrics.publishedLocationsCount,
    active_fields_count: metrics.activeFieldCount,
    legacy_monthly_fee_total_cents: metrics.legacyMonthlyFeeTotalCents,
    computed_monthly_fee_cents: metrics.computedMonthlyFeeCents,
    created_at: current?.created_at ?? FieldValue.serverTimestamp(),
    created_by: current?.created_by ?? params.actorUid,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: params.actorUid,
  };

  const batch = db().batch();
  batch.set(accountRef, nextDocument, {merge: true});
  for (const locationDoc of locationDocs) {
    batch.update(locationDoc.ref, {
      ...denormalizedLocationFields,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: params.actorUid,
    });
  }
  for (const locationDoc of removedLocationDocs) {
    if (!locationDoc.exists) continue;
    const data = locationDoc.data() || {};
    if (stringOrNull(data.venue_account_id) === accountId) {
      batch.update(locationDoc.ref, {
        ...clearVenueAccountDenormalizedLocationFields(),
        updated_at: FieldValue.serverTimestamp(),
        updated_by: params.actorUid,
      });
    }
  }
  await batch.commit();

  await writeVenueAccountEvent({
    accountId,
    ownerUid,
    actorUid: params.actorUid,
    type: params.eventType,
    reason: params.reason ?? null,
    before: current ? {
      status: isVenueAccountStatus(current.status) ? current.status : null,
      billing_scope: isVenueAccountBillingScope(current.billing_scope) ?
        current.billing_scope :
        null,
      linked_location_ids: normalizeIds(current.linked_location_ids),
    } : null,
    after: {
      status: nextDocument.status,
      billing_scope: nextDocument.billing_scope,
      linked_location_ids: nextLinkedLocationIds,
      computed_monthly_fee_cents: metrics.computedMonthlyFeeCents,
    },
  });

  logger.info(`Venue account ${accountId} synced for owner ${ownerUid}`);
  return {
    success: true,
    accountId,
    ownerUid,
    linkedLocationIds: nextLinkedLocationIds,
    linkedLocationsCount: metrics.linkedLocationsCount,
    publishedLocationsCount: metrics.publishedLocationsCount,
    activeFieldCount: metrics.activeFieldCount,
    computedMonthlyFeeCents: metrics.computedMonthlyFeeCents,
    status: config.status,
    billingScope: config.billingScope,
  };
}

export const upsertVenueAccount = secureCallable<
  UpsertVenueAccountRequest,
  VenueAccountCallableResponse
>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "venueAccountUpsert"},
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "upsertVenueAccount",
      ownerUid: request.data?.ownerUid,
      linkedLocationCount: Array.isArray(request.data?.linkedLocationIds) ?
        request.data?.linkedLocationIds.length :
        null,
    }),
  },
  async (request) => {
    const actorUid = request.auth?.uid;
    if (!actorUid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const ownerUid = requireTrimmedString(request.data?.ownerUid, "ownerUid");
    return persistVenueAccount({
      ownerUid,
      actorUid,
      eventType: "VENUE_ACCOUNT_UPSERTED",
      input: request.data ?? {},
    });
  }
);

export const linkLocationToVenueAccount = secureCallable<
  LinkLocationToVenueAccountRequest,
  VenueAccountCallableResponse
>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 20,
      windowMs: 60000,
      keyPrefix: "venueAccountLinkLocation",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "linkLocationToVenueAccount",
      ownerUid: request.data?.ownerUid,
      locationId: request.data?.locationId,
    }),
  },
  async (request) => {
    const actorUid = request.auth?.uid;
    if (!actorUid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const ownerUid = requireTrimmedString(request.data?.ownerUid, "ownerUid");
    const locationId = requireTrimmedString(
      request.data?.locationId,
      "locationId"
    );
    const currentSnap = await db().collection(COLLECTION).doc(ownerUid).get();
    const current = currentSnap.data() || {};
    const nextLinkedLocationIds = Array.from(new Set([
      ...normalizeIds(current.linked_location_ids),
      locationId,
    ]));
    return persistVenueAccount({
      ownerUid,
      actorUid,
      eventType: "VENUE_ACCOUNT_LOCATION_LINKED",
      reason: `location:${locationId}`,
      linkedLocationIds: nextLinkedLocationIds,
      input: {ownerUid},
    });
  }
);

export const unlinkLocationFromVenueAccount = secureCallable<
  UnlinkLocationFromVenueAccountRequest,
  VenueAccountCallableResponse
>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 20,
      windowMs: 60000,
      keyPrefix: "venueAccountUnlinkLocation",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "unlinkLocationFromVenueAccount",
      ownerUid: request.data?.ownerUid,
      locationId: request.data?.locationId,
    }),
  },
  async (request) => {
    const actorUid = request.auth?.uid;
    if (!actorUid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const ownerUid = requireTrimmedString(request.data?.ownerUid, "ownerUid");
    const locationId = requireTrimmedString(
      request.data?.locationId,
      "locationId"
    );
    const currentSnap = await db().collection(COLLECTION).doc(ownerUid).get();
    if (!currentSnap.exists) {
      throw new HttpsError("not-found", "Venue account not found");
    }
    const current = currentSnap.data() || {};
    const nextLinkedLocationIds = normalizeIds(current.linked_location_ids)
      .filter((linkedLocationId) => linkedLocationId !== locationId);
    return persistVenueAccount({
      ownerUid,
      actorUid,
      eventType: "VENUE_ACCOUNT_LOCATION_UNLINKED",
      reason: `location:${locationId}`,
      linkedLocationIds: nextLinkedLocationIds,
      input: {ownerUid},
    });
  }
);
