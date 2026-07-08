import {HttpsError} from "firebase-functions/v2/https";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";
import {
  VenueAccountBillingScope,
  VenueAccountBillingCycle,
  VenueAccountPlanCode,
  VenueAccountStatus,
  buildVenueAccountLocationSnapshot,
  computeVenueAccountMetrics,
  normalizeVenueAccountBillingCycle,
  normalizeVenueAccountBillingScope,
  normalizeVenueAccountPlanCode,
  normalizeVenueAccountStatus,
} from "../locations/venue-account-shared";

type AdminUserRoleFilter = "ALL" | "ADMIN" | "FIELD_OWNER" | "PLAYER";
type AdminOwnerFilter =
  "ALL" |
  "FIELD_OWNER" |
  "HAS_LOCATIONS" |
  "PUBLISHED" |
  "OVERDUE" |
  "INCOMPLETE";

interface SearchAdminUsersRequest {
  search?: string | null;
  role?: AdminUserRoleFilter | null;
  ownerFilter?: AdminOwnerFilter | null;
  pageSize?: number | null;
  pageToken?: string | null;
}

interface OwnerSummary {
  totalLocations: number;
  publishedLocations: number;
  pendingLocations: number;
  overdueLocations: number;
  incompleteLocations: number;
  activeSubscriptionLocations: number;
  monthlyFeeTotalCents: number;
  managersTotal: number;
}

interface OwnerLocationSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  publicationStatus: string;
  subscriptionStatus: string;
  monthlyFeeCents: number | null;
  billingDueDay: number | null;
  fieldCount: number;
  managersCount: number;
  managersPreview: string[];
  updatedAtIso: string | null;
}

interface OwnerOnboardingSummary {
  status: string;
  submittedAtIso: string | null;
  reviewedAtIso: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  businessName: string | null;
  notes: string | null;
  reviewReason: string | null;
}

interface VenueAccountSummary {
  id: string;
  status: VenueAccountStatus;
  billingScope: VenueAccountBillingScope;
  billingPlanCode: VenueAccountPlanCode | null;
  billingPlanLabel: string | null;
  billingCycle: VenueAccountBillingCycle | null;
  billingDueDay: number | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  linkedLocationIds: string[];
  linkedLocationsCount: number;
  publishedLocationsCount: number;
  activeFieldCount: number;
  legacyMonthlyFeeTotalCents: number;
  computedMonthlyFeeCents: number;
  updatedAtIso: string | null;
}

interface AdminUserCrmRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  lastLoginAtIso: string | null;
  gamesPlayed: number;
  level: number;
  isMock: boolean;
  demoData: boolean;
  dataOrigin: string | null;
  seedId: string | null;
  demoDataReason: string | null;
  cpfVerified: boolean;
  phoneVerified: boolean;
  realDataProtected: boolean;
  ownerSummary: OwnerSummary;
  ownerLocations: OwnerLocationSummary[];
  ownerOnboarding: OwnerOnboardingSummary | null;
  venueAccount: VenueAccountSummary | null;
}

const USER_SCAN_LIMIT = 10000;
const LOCATION_SCAN_LIMIT = 10000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const ROLE_FILTERS = new Set(["ALL", "ADMIN", "FIELD_OWNER", "PLAYER"]);
const OWNER_FILTERS = new Set([
  "ALL",
  "FIELD_OWNER",
  "HAS_LOCATIONS",
  "PUBLISHED",
  "OVERDUE",
  "INCOMPLETE",
]);

const emptyOwnerSummary = (): OwnerSummary => ({
  totalLocations: 0,
  publishedLocations: 0,
  pendingLocations: 0,
  overdueLocations: 0,
  incompleteLocations: 0,
  activeSubscriptionLocations: 0,
  monthlyFeeTotalCents: 0,
  managersTotal: 0,
});

/**
 * Normaliza texto de busca recebido do cliente.
 * @param {unknown} value Valor bruto.
 * @return {string} Texto em lowercase com tamanho limitado.
 */
function cleanSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 120);
}

/**
 * Valida page size para evitar consultas caras acidentais.
 * @param {unknown} value Valor bruto.
 * @return {number} Tamanho de pagina seguro.
 */
function parsePageSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(value)));
}

/**
 * Converte page token numerico em offset de resultados filtrados.
 * @param {unknown} value Token bruto recebido do cliente.
 * @return {number} Offset seguro.
 */
function parseOffset(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Normaliza filtro de role com fallback seguro.
 * @param {unknown} value Valor bruto.
 * @return {AdminUserRoleFilter} Role ou ALL.
 */
function normalizeRole(value: unknown): AdminUserRoleFilter {
  if (typeof value === "string" && ROLE_FILTERS.has(value)) {
    return value as AdminUserRoleFilter;
  }
  return "ALL";
}

/**
 * Normaliza filtro comercial com fallback seguro.
 * @param {unknown} value Valor bruto.
 * @return {AdminOwnerFilter} Filtro comercial ou ALL.
 */
function normalizeOwnerFilter(value: unknown): AdminOwnerFilter {
  if (typeof value === "string" && OWNER_FILTERS.has(value)) {
    return value as AdminOwnerFilter;
  }
  return "ALL";
}

/**
 * Converte timestamps Firestore/Date em ISO serializavel para callable.
 * @param {unknown} value Valor de data bruto.
 * @return {string | null} ISO ou null.
 */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as {toDate?: unknown}).toDate === "function"
  ) {
    return (value as {toDate: () => Date}).toDate().toISOString();
  }
  return null;
}

/**
 * Retorna numero valido ou fallback.
 * @param {unknown} value Valor bruto.
 * @param {number} fallback Valor padrao.
 * @return {number} Numero normalizado.
 */
function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Retorna string ou vazio.
 * @param {unknown} value Valor bruto.
 * @return {string} String segura.
 */
function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Retorna array de strings seguro.
 * @param {unknown} value Valor bruto.
 * @return {string[]} Array normalizado.
 */
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Retorna booleano estrito, aceitando apenas true como verdadeiro.
 * @param {unknown} value Valor bruto.
 * @return {boolean} Boolean normalizado.
 */
function isTrue(value: unknown): boolean {
  return value === true;
}

/**
 * Retorna numero positivo ou null.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Numero seguro.
 */
function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ?
    value :
    null;
}

/**
 * Retorna inteiro positivo ou null.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Inteiro seguro.
 */
function positiveIntegerOrNull(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 ?
    value :
    null;
}

/**
 * Retorna numero finito ou null para campos monetarios opcionais.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Numero preservado ou null.
 */
function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Detecta se uma quadra ainda nao tem cadastro comercial completo.
 * @param {FirebaseFirestore.DocumentData} data Dados da location.
 * @return {boolean} True quando faltam campos comerciais essenciais.
 */
function commercialIncomplete(data: FirebaseFirestore.DocumentData): boolean {
  const monthlyFee = data.monthly_fee_cents;
  const dueDay = data.billing_due_day;
  const publication = data.publication_status;
  const subscription = data.subscription_status;
  return typeof monthlyFee !== "number" ||
    monthlyFee <= 0 ||
    typeof dueDay !== "number" ||
    dueDay < 1 ||
    dueDay > 31 ||
    typeof publication !== "string" ||
    typeof subscription !== "string";
}

/**
 * Carrega e agrega resumo comercial por owner no backend.
 * @return {Promise<object>} Map de summaries e metadados de varredura.
 */
async function loadOwnerSummaries(): Promise<{
  summaries: Map<string, OwnerSummary>;
  locationsByOwner: Map<string, OwnerLocationSummary[]>;
  locationSnapshotsByOwner: Map<
    string,
    ReturnType<typeof buildVenueAccountLocationSnapshot>[]
  >;
  scannedLocations: number;
  locationScanComplete: boolean;
}> {
  const snapshot = await db()
    .collection("locations")
    .limit(LOCATION_SCAN_LIMIT)
    .get();
  const summaries = new Map<string, OwnerSummary>();
  const locationsByOwner = new Map<string, OwnerLocationSummary[]>();
  const locationSnapshotsByOwner = new Map<
    string,
    ReturnType<typeof buildVenueAccountLocationSnapshot>[]
  >();

  snapshot.docs.forEach((locationDoc) => {
    const data = locationDoc.data();
    const ownerId = stringOrEmpty(data.owner_id || data.ownerId);
    if (!ownerId) return;

    const summary = summaries.get(ownerId) || emptyOwnerSummary();
    const publication = stringOrEmpty(
      data.publication_status || data.publicationStatus
    );
    const subscription = stringOrEmpty(
      data.subscription_status || data.subscriptionStatus
    );
    const managers = stringArray(data.managers);
    const monthlyFeeCents = positiveNumberOrNull(
      data.monthly_fee_cents ?? data.monthlyFeeCents
    );
    const billingDueDay = positiveIntegerOrNull(
      data.billing_due_day ?? data.billingDueDay
    );

    summary.totalLocations += 1;
    if (publication === "PUBLISHED" || data.is_verified === true) {
      summary.publishedLocations += 1;
    }
    if (publication === "PENDING_REVIEW" || publication === "DRAFT") {
      summary.pendingLocations += 1;
    }
    if (["OVERDUE", "SUSPENDED", "CANCELLED"].includes(subscription)) {
      summary.overdueLocations += 1;
    }
    if (["TRIAL", "ACTIVE"].includes(subscription)) {
      summary.activeSubscriptionLocations += 1;
    }
    if (monthlyFeeCents) {
      summary.monthlyFeeTotalCents += monthlyFeeCents;
    }
    summary.managersTotal += managers.length;
    if (commercialIncomplete(data)) {
      summary.incompleteLocations += 1;
    }
    summaries.set(ownerId, summary);

    const ownerLocations = locationsByOwner.get(ownerId) || [];
    ownerLocations.push({
      id: locationDoc.id,
      name: stringOrEmpty(data.name) || "Quadra sem nome",
      city: stringOrEmpty(data.city) || null,
      state: stringOrEmpty(data.state) || null,
      publicationStatus: publication || "PENDING_REVIEW",
      subscriptionStatus: subscription || "TRIAL",
      monthlyFeeCents,
      billingDueDay,
      fieldCount: numberOrDefault(data.field_count ?? data.fieldCount, 0),
      managersCount: managers.length,
      managersPreview: managers.slice(0, 5),
      updatedAtIso: toIso(data.updated_at || data.updatedAt),
    });
    locationsByOwner.set(ownerId, ownerLocations);

    const locationSnapshots = locationSnapshotsByOwner.get(ownerId) || [];
    locationSnapshots.push(buildVenueAccountLocationSnapshot({
      id: locationDoc.id,
      ownerId,
      publicationStatus: publication,
      isVerified: data.is_verified,
      fieldCount: data.field_count ?? data.fieldCount,
      activeFieldCount: data.active_field_count,
      hasActiveFields: data.has_active_fields ?? data.hasActiveFields,
      monthlyFeeCents,
    }));
    locationSnapshotsByOwner.set(ownerId, locationSnapshots);
  });

  locationsByOwner.forEach((locations) => {
    locations.sort((a, b) => {
      const aTime = a.updatedAtIso ? new Date(a.updatedAtIso).getTime() : 0;
      const bTime = b.updatedAtIso ? new Date(b.updatedAtIso).getTime() : 0;
      return bTime - aTime || a.name.localeCompare(b.name);
    });
  });

  return {
    summaries,
    locationsByOwner,
    locationSnapshotsByOwner,
    scannedLocations: snapshot.docs.length,
    locationScanComplete: snapshot.docs.length < LOCATION_SCAN_LIMIT,
  };
}

/**
 * Carrega status de onboarding comercial por owner.
 * @return {Promise<Map<string, OwnerOnboardingSummary>>} Map por owner uid.
 */
async function loadOwnerOnboarding(): Promise<Map<string, OwnerOnboardingSummary>> {
  const snapshot = await db()
    .collection("venue_owner_onboarding")
    .limit(USER_SCAN_LIMIT)
    .get();
  const onboarding = new Map<string, OwnerOnboardingSummary>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    onboarding.set(doc.id, {
      status: stringOrEmpty(data.status) || "LEAD",
      submittedAtIso: toIso(data.submitted_at || data.submittedAt),
      reviewedAtIso: toIso(data.reviewed_at || data.reviewedAt),
      contactName: stringOrEmpty(data.contact_name || data.contactName) || null,
      contactEmail: stringOrEmpty(data.contact_email || data.contactEmail) || null,
      phone: stringOrEmpty(data.phone) || null,
      businessName: stringOrEmpty(data.business_name || data.businessName) || null,
      notes: stringOrEmpty(data.notes) || null,
      reviewReason: stringOrEmpty(data.review_reason || data.reviewReason) || null,
    });
  });
  return onboarding;
}

/**
 * Carrega contas comerciais por owner.
 * @return {Promise<Map<string, Record<string, unknown>>>} Map por owner uid.
 */
async function loadVenueAccounts(): Promise<Map<string, Record<string, unknown>>> {
  const snapshot = await db()
    .collection("venue_accounts")
    .limit(USER_SCAN_LIMIT)
    .get();
  const accounts = new Map<string, Record<string, unknown>>();
  snapshot.docs.forEach((doc) => {
    accounts.set(doc.id, doc.data() || {});
  });
  return accounts;
}

/**
 * Aplica filtro comercial ao usuario retornado.
 * @param {AdminUserCrmRow} user Usuario com summary agregado.
 * @param {AdminOwnerFilter} ownerFilter Filtro selecionado.
 * @return {boolean} True quando passa no filtro.
 */
function matchesOwnerFilter(
  user: AdminUserCrmRow,
  ownerFilter: AdminOwnerFilter
): boolean {
  const summary = user.ownerSummary;
  if (ownerFilter === "ALL") return true;
  if (ownerFilter === "FIELD_OWNER") {
    return user.role === "FIELD_OWNER" || summary.totalLocations > 0;
  }
  if (ownerFilter === "HAS_LOCATIONS") return summary.totalLocations > 0;
  if (ownerFilter === "PUBLISHED") return summary.publishedLocations > 0;
  if (ownerFilter === "OVERDUE") return summary.overdueLocations > 0;
  if (ownerFilter === "INCOMPLETE") return summary.incompleteLocations > 0;
  return true;
}

/**
 * Aplica busca textual por uid, nome, email ou role.
 * @param {AdminUserCrmRow} user Usuario normalizado.
 * @param {string} search Texto de busca normalizado.
 * @return {boolean} True quando corresponde.
 */
function matchesSearch(user: AdminUserCrmRow, search: string): boolean {
  if (!search) return true;
  return [
    user.id,
    user.name,
    user.email,
    user.phone || "",
    user.role,
    user.ownerOnboarding?.status || "",
    user.ownerOnboarding?.businessName || "",
    ...user.ownerLocations.flatMap((location) => [
      location.id,
      location.name,
      location.city || "",
      location.state || "",
      location.publicationStatus,
      location.subscriptionStatus,
    ]),
    user.venueAccount?.status || "",
    user.venueAccount?.billingScope || "",
    user.venueAccount?.billingPlanLabel || "",
    user.venueAccount?.billingPlanCode || "",
    user.venueAccount?.billingContactName || "",
    user.venueAccount?.billingContactEmail || "",
  ].some((value) => value.toLowerCase().includes(search));
}

/**
 * Busca usuarios para CRM admin com agregados comerciais calculados no backend.
 */
export const searchAdminUsers = secureCallable<
  SearchAdminUsersRequest,
  {
    users: AdminUserCrmRow[];
    nextPageToken: string | null;
    totalMatched: number;
    scannedUsers: number;
    scannedLocations: number;
    scanComplete: boolean;
  }
>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: false,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 30, windowMs: 60000, keyPrefix: "adminUserCrm"},
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      search_present: Boolean(cleanSearch(request.data?.search)),
      role: normalizeRole(request.data?.role),
      owner_filter: normalizeOwnerFilter(request.data?.ownerFilter),
    }),
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const search = cleanSearch(request.data?.search);
    const role = normalizeRole(request.data?.role);
    const ownerFilter = normalizeOwnerFilter(request.data?.ownerFilter);
    const pageSize = parsePageSize(request.data?.pageSize);
    const offset = parseOffset(request.data?.pageToken);
    const [ownerData, onboardingData, venueAccounts] = await Promise.all([
      loadOwnerSummaries(),
      loadOwnerOnboarding(),
      loadVenueAccounts(),
    ]);

    const snapshot = await db()
      .collection("users")
      .limit(USER_SCAN_LIMIT)
      .get();

    const rows = snapshot.docs.map((userDoc) => {
      const data = userDoc.data();
      const roleValue = stringOrEmpty(data.role) || "PLAYER";
      const ownerSummary = {
        ...(ownerData.summaries.get(userDoc.id) || emptyOwnerSummary()),
      };
      const ownerLocations = ownerData.locationsByOwner.get(userDoc.id) || [];
      const ownerOnboarding = onboardingData.get(userDoc.id) || null;
      const venueAccountRaw = venueAccounts.get(userDoc.id) || null;
      const venueAccount = venueAccountRaw ? (() => {
        const metrics = computeVenueAccountMetrics(
          {
            status: normalizeVenueAccountStatus(venueAccountRaw.status),
            billingScope: normalizeVenueAccountBillingScope(
              venueAccountRaw.billing_scope
            ),
            billingPlanCode: normalizeVenueAccountPlanCode(
              venueAccountRaw.billing_plan_code
            ),
            billingPlanLabel:
              stringOrEmpty(venueAccountRaw.billing_plan_label) || null,
            billingCycle: normalizeVenueAccountBillingCycle(
              venueAccountRaw.billing_cycle
            ),
            billingBaseFeeCents: finiteNumberOrNull(
              venueAccountRaw.billing_base_fee_cents
            ),
            defaultLocationFeeCents:
              finiteNumberOrNull(
                venueAccountRaw.default_location_fee_cents
              ),
            pricePerActiveFieldCents:
              finiteNumberOrNull(
                venueAccountRaw.price_per_active_field_cents
              ),
            monthlyFeeOverrideCents:
              finiteNumberOrNull(
                venueAccountRaw.monthly_fee_override_cents
              ),
            billingDueDay: positiveIntegerOrNull(
              venueAccountRaw.billing_due_day
            ),
          },
          ownerData.locationSnapshotsByOwner.get(userDoc.id) || []
        );
        ownerSummary.monthlyFeeTotalCents = metrics.computedMonthlyFeeCents;
        return {
          id: userDoc.id,
          status: normalizeVenueAccountStatus(venueAccountRaw.status),
          billingScope: normalizeVenueAccountBillingScope(
            venueAccountRaw.billing_scope
          ),
          billingPlanCode: normalizeVenueAccountPlanCode(
            venueAccountRaw.billing_plan_code
          ),
          billingPlanLabel:
            stringOrEmpty(venueAccountRaw.billing_plan_label) || null,
          billingCycle: normalizeVenueAccountBillingCycle(
            venueAccountRaw.billing_cycle
          ),
          billingDueDay: positiveIntegerOrNull(
            venueAccountRaw.billing_due_day
          ),
          billingContactName:
            stringOrEmpty(venueAccountRaw.billing_contact_name) || null,
          billingContactEmail:
            stringOrEmpty(venueAccountRaw.billing_contact_email) || null,
          linkedLocationIds: stringArray(venueAccountRaw.linked_location_ids),
          linkedLocationsCount: metrics.linkedLocationsCount,
          publishedLocationsCount: metrics.publishedLocationsCount,
          activeFieldCount: metrics.activeFieldCount,
          legacyMonthlyFeeTotalCents: metrics.legacyMonthlyFeeTotalCents,
          computedMonthlyFeeCents: metrics.computedMonthlyFeeCents,
          updatedAtIso: toIso(venueAccountRaw.updated_at),
        };
      })() : null;
      return {
        id: userDoc.id,
        name: stringOrEmpty(data.name) || "Sem nome",
        email: stringOrEmpty(data.email),
        phone: stringOrEmpty(
          data.phone || data.phone_number || data.phoneNumber
        ) || null,
        photoUrl: stringOrEmpty(data.photo_url || data.photoUrl) || null,
        role: roleValue,
        createdAtIso: toIso(data.created_at || data.createdAt),
        updatedAtIso: toIso(data.updated_at || data.updatedAt),
        lastLoginAtIso: toIso(data.last_login_at || data.lastLoginAt),
        gamesPlayed: numberOrDefault(data.games_played || data.gamesPlayed, 0),
        level: numberOrDefault(data.level, 0),
        isMock: isTrue(data.is_mock || data.isMock),
        demoData: isTrue(data.demo_data || data.demoData),
        dataOrigin:
          stringOrEmpty(data.data_origin || data.dataOrigin) || null,
        seedId: stringOrEmpty(data.seed_id || data.seedId) || null,
        demoDataReason:
          stringOrEmpty(data.demo_data_reason || data.demoDataReason) || null,
        cpfVerified: Boolean(data.cpfVerifiedAt || data.cpf_verified_at),
        phoneVerified: isTrue(data.phone_verified || data.phoneVerified),
        realDataProtected: isTrue(
          data.real_data_protected || data.realDataProtected
        ),
        ownerSummary,
        ownerLocations,
        ownerOnboarding,
        venueAccount,
      };
    }).sort((a, b) => {
      const aTime = a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0;
      const bTime = b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0;
      return bTime - aTime || a.id.localeCompare(b.id);
    });

    const filtered = rows.filter((user) => {
      const roleMatches = role === "ALL" || user.role === role;
      return roleMatches &&
        matchesSearch(user, search) &&
        matchesOwnerFilter(user, ownerFilter);
    });

    const page = filtered.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    const hasNext = nextOffset < filtered.length;

    return {
      users: page,
      nextPageToken: hasNext ? String(nextOffset) : null,
      totalMatched: filtered.length,
      scannedUsers: snapshot.docs.length,
      scannedLocations: ownerData.scannedLocations,
      scanComplete: snapshot.docs.length < USER_SCAN_LIMIT &&
        ownerData.locationScanComplete,
    };
  }
);
