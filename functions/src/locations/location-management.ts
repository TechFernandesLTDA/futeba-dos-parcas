import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {calculateAutoRatingsFromStats} from "../ratings/auto-ratings";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";
import {
  isContractExpired,
  isTrialAged,
  isVenueAccountStatus,
  resolveSubscriptionStatusOrDefault,
} from "./venue-account-shared";

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

const BILLING_PLAN_CODES = [
  "TRIAL",
  "BASIC",
  "PRO",
  "ENTERPRISE",
  "CUSTOM",
] as const;

const BILLING_CYCLES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;

const COMMERCIAL_REQUEST_TYPES = [
  "PUBLICATION",
  "COMMERCIAL_UPDATE",
] as const;

const FIELD_TYPES = [
  "SOCIETY",
  "FUTSAL",
  "CAMPO",
  "AREIA",
  "OUTROS",
] as const;

type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];
type BillingCycle = (typeof BILLING_CYCLES)[number];
type CommercialRequestType = (typeof COMMERCIAL_REQUEST_TYPES)[number];
type FieldType = (typeof FIELD_TYPES)[number];
type CommercialRequestStatus =
  "PENDING_REVIEW" |
  "NEEDS_CHANGES" |
  "APPROVED" |
  "REJECTED";

interface SetLocationPublicationStatusRequest {
  locationId: string;
  publicationStatus: PublicationStatus;
  reason?: string;
}

interface SetLocationSubscriptionRequest {
  locationId: string;
  subscriptionStatus: SubscriptionStatus;
  billingPlanCode?: BillingPlanCode | null;
  billingPlanLabel?: string | null;
  billingCycle?: BillingCycle | null;
  billingBaseFeeCents?: number | null;
  monthlyFeeCents?: number | null;
  billingDueDay?: number | null;
  billingStartsAtIso?: string | null;
  billingExpiresAtIso?: string | null;
  billingExceptionNote?: string | null;
  adminNotes?: string | null;
}

interface VenueAccountRowProjection {
  venueAccountId: string | null;
  venueAccountStatus: string | null;
  venueAccountChargeScope: string | null;
  venueAccountPlanCode: string | null;
  venueAccountPlanLabel: string | null;
  venueAccountMonthlyTotalCents: number | null;
  venueAccountLinkedLocationsCount: number | null;
  venueAccountActiveFieldsCount: number | null;
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

interface SubmitLocationSubscriptionReceiptRequest {
  locationId: string;
  amountCents: number;
  periodKey: string;
  paidAtIso?: string | null;
  method?: string | null;
  receiptStoragePath: string;
  notes?: string | null;
}

interface ReviewLocationSubscriptionReceiptRequest {
  locationId: string;
  paymentId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string | null;
}

interface RequestLocationCommercialReviewRequest {
  locationId: string;
  requestType: CommercialRequestType;
  requestedSections?: string[] | null;
  notes?: string | null;
}

interface ReviewLocationCommercialRequest {
  locationId: string;
  requestId: string;
  decision: Exclude<CommercialRequestStatus, "PENDING_REVIEW">;
  notes?: string | null;
}

interface LocationSubscriptionLedgerEntry {
  type: string;
  actor_user_id: string;
  amount_cents?: number | null;
  period_key?: string | null;
  payment_id?: string | null;
  method?: string | null;
  review_status?: string | null;
  previous_subscription_status?: string | null;
  next_subscription_status?: string | null;
  previous_commercial_status?: string | null;
  next_commercial_status?: string | null;
  billing_plan_code?: string | null;
  billing_plan_label?: string | null;
  billing_cycle?: string | null;
  billing_base_fee_cents?: number | null;
  monthly_fee_cents?: number | null;
  billing_due_day?: number | null;
  billing_exception_note?: string | null;
  reason?: string | null;
  effective_at?: Date | FirebaseFirestore.FieldValue | null;
}

interface AssignLocationOwnerRequest {
  locationId: string;
  newOwnerId: string;
  reason?: string | null;
}

interface InviteLocationManagerRequest {
  locationId: string;
  managerUid?: string | null;
  managerEmail?: string | null;
  message?: string | null;
}

interface AcceptLocationManagerInviteRequest {
  locationId: string;
  inviteId: string;
}

interface RemoveLocationManagerRequest {
  locationId: string;
  managerUid: string;
  reason?: string | null;
}

interface GetAdminLocationBillingSummaryRequest {
  periodKey?: string | null;
}

interface RunLocationBillingAutomationRequest {
  periodKey?: string | null;
}

interface RecomputeLocationAggregatesRequest {
  locationId?: string | null;
  limit?: number | null;
  startAfterId?: string | null;
}

interface LocationBillingAutomationResult {
  runId: string;
  periodKey: string;
  processedLocations: number;
  skippedLocations: number;
  paidLocations: number;
  partialLocations: number;
  pendingLocations: number;
  overdueLocations: number;
  suspendedLocations: number;
  reactivatedLocations: number;
  inconsistentLocations: number;
  /** Contratos com `billing_expires_at` no passado encerrados nesta execucao (#4107). */
  expiredLocations: number;
  /** Quadras em TRIAL ha mais de TRIAL_MAX_DAYS observadas nesta execucao (#4111). */
  agedTrialLocations: number;
  ledgerEntriesCreated: number;
  /**
   * Listas de IDs (#4111): o cron do dinheiro nao pode descartar quadra em
   * silencio. Limitadas a BILLING_AUTOMATION_ID_LIST_CAP para manter logs e o
   * doc de execucao bounded; os contadores continuam exatos.
   */
  skippedLocationIds: string[];
  inconsistentLocationIds: string[];
  expiredLocationIds: string[];
  agedTrialLocationIds: string[];
  resumedFromLocationId: string | null;
  nextCursor: string | null;
  budgetExhausted: boolean;
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
const MANAGER_INVITE_TTL_DAYS = 14;
const LOCATION_AGGREGATE_GAME_LIMIT = 1000;
const LOCATION_AGGREGATE_REVIEW_LIMIT = 1000;
const LOCATION_AGGREGATE_REBUILD_LIMIT = 500;
const ACTIVE_GAME_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "LIVE"]);
const FINISHED_GAME_STATUSES = new Set(["FINISHED"]);
const BILLING_SUMMARY_PAGE_SIZE = 500;
const BILLING_SUMMARY_PAYMENT_CONCURRENCY = 25;
const BILLING_AUTOMATION_MAX_RUN_MS = 480_000;
const DEFAULT_BILLING_GRACE_DAYS = 5;
const DEFAULT_BILLING_SUSPENSION_DAYS = 15;
/** Maximo de IDs por lista no resultado/doc de execucao do cron de cobranca (#4111). */
const BILLING_AUTOMATION_ID_LIST_CAP = 200;
/** Colecao com um doc por execucao do cron de cobranca (#4111). */
const BILLING_AUTOMATION_RUNS_COLLECTION = "billing_automation_runs";
const LOCATION_SUBCOLLECTIONS = [
  "reviews",
  "fields",
  "availability",
  "audit_logs",
  "commercial_events",
  "publication_requests",
  "subscription_payments",
  "subscription_ledger",
  "subscription_cycles",
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
 * Valida periodo comercial no formato AAAA-MM.
 * @param {unknown} value Valor bruto recebido.
 * @return {string} Periodo validado.
 */
function requirePeriodKey(value: unknown): string {
  const periodKey = requireNonEmptyString(value, "periodKey");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new HttpsError("invalid-argument", "periodKey must use YYYY-MM");
  }
  return periodKey;
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
 * Normaliza e valida email opcional para convites comerciais.
 * @param {unknown} value Valor bruto recebido.
 * @return {string | null} Email em lowercase ou null.
 */
function optionalEmail(value: unknown): string | null {
  const email = optionalTrimmed(value, 254)?.toLowerCase() ?? null;
  if (email === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "managerEmail must be valid");
  }
  return email;
}

/**
 * Normaliza lista opcional de strings removendo duplicidade e ruído.
 * @param {unknown} value Valor bruto.
 * @param {number} maxItems Limite de itens.
 * @param {number} maxLength Limite por item.
 * @return {string[]} Lista sanitizada.
 */
function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, maxLength);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
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
 * Converte valores Firestore/Date em ISO string segura para resposta callable.
 * @param {unknown} value Valor bruto vindo do Firestore.
 * @return {string | null} Data ISO ou null.
 */
function toIsoString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ?
      parsed.toISOString() :
      null;
  }
  return null;
}

/**
 * Periodo comercial atual no formato AAAA-MM.
 * @return {string} Periodo atual em UTC.
 */
function currentBillingPeriodKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Periodo comercial de uma data no formato AAAA-MM.
 * @param {Date} date Data base.
 * @return {string} Periodo em UTC.
 */
function billingPeriodKeyForDate(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Retorna o ultimo dia do mes UTC.
 * @param {number} year Ano UTC.
 * @param {number} month Mes UTC no intervalo 1-12.
 * @return {number} Quantidade de dias.
 */
function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Limita inteiro opcional com fallback.
 * @param {unknown} value Valor bruto.
 * @param {number} fallback Valor padrao.
 * @param {number} min Valor minimo.
 * @param {number} max Valor maximo.
 * @return {number} Inteiro seguro.
 */
function boundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(Number(value), min), max);
}

/**
 * Calcula datas relevantes do ciclo mensal.
 * @param {string} periodKey Periodo AAAA-MM.
 * @param {unknown} rawDueDay Dia de vencimento.
 * @param {unknown} rawGraceDays Dias de tolerancia.
 * @param {unknown} rawSuspensionDays Dias ate suspensao.
 * @return {object} Datas de cobranca.
 */
function buildBillingCycleDates(
  periodKey: string,
  rawDueDay: unknown,
  rawGraceDays: unknown,
  rawSuspensionDays: unknown
) {
  const [year, month] = periodKey.split("-").map(Number);
  const dueDay = boundedInteger(rawDueDay, 10, 1, 31);
  const graceDays = boundedInteger(
    rawGraceDays,
    DEFAULT_BILLING_GRACE_DAYS,
    0,
    90
  );
  const suspensionDays = boundedInteger(
    rawSuspensionDays,
    DEFAULT_BILLING_SUSPENSION_DAYS,
    graceDays,
    180
  );
  const clampedDueDay = Math.min(dueDay, daysInUtcMonth(year, month));
  const dueAt = new Date(Date.UTC(year, month - 1, clampedDueDay, 12, 0, 0));
  const graceEndsAt = new Date(dueAt.getTime() + graceDays * 86400000);
  const suspendAt = new Date(dueAt.getTime() + suspensionDays * 86400000);
  return {dueDay, graceDays, suspensionDays, dueAt, graceEndsAt, suspendAt};
}

/**
 * Soma campo monetario apenas quando ele e inteiro positivo.
 * @param {unknown} value Valor bruto.
 * @return {number} Valor normalizado em centavos.
 */
function positiveCents(value: unknown): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;
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
 * Garante que o caller e admin global ou owner atual da location.
 * @param {object} request Requisicao callable autenticada.
 * @param {FirebaseFirestore.DocumentData} locData Dados da location.
 */
function assertAdminOrLocationOwner(
  request: {auth?: {uid: string; token?: Record<string, unknown>}},
  locData: FirebaseFirestore.DocumentData
) {
  const callerUid = request.auth?.uid;
  const isAdmin = request.auth?.token?.role === "ADMIN";
  if (!callerUid || (!isAdmin && locData.owner_id !== callerUid)) {
    throw new HttpsError(
      "permission-denied",
      "Only the location owner or admin can manage managers"
    );
  }
}

/**
 * Garante caller admin global.
 * @param {object} request Requisicao callable autenticada.
 */
function assertAdmin(
  request: {auth?: {uid: string; token?: Record<string, unknown>}}
) {
  if (request.auth?.token?.role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Only admins can review receipts");
  }
}

/**
 * Garante caller admin ou dono atual da location.
 * @param {object} request Requisicao callable autenticada.
 * @param {FirebaseFirestore.DocumentData} locData Dados da location.
 */
function assertAdminOrLocationOwnerForReceipt(
  request: {auth?: {uid: string; token?: Record<string, unknown>}},
  locData: FirebaseFirestore.DocumentData
) {
  const callerUid = request.auth?.uid;
  const isAdmin = request.auth?.token?.role === "ADMIN";
  if (!callerUid || (!isAdmin && locData.owner_id !== callerUid)) {
    throw new HttpsError(
      "permission-denied",
      "Only the location owner or admin can submit receipts"
    );
  }
}

/**
 * Valida path privado oficial de comprovante comercial da quadra.
 * @param {unknown} value Path recebido do cliente.
 * @param {string} locationId ID da location.
 * @param {unknown} ownerId Owner esperado.
 * @return {string} Path validado.
 */
function requireLocationReceiptStoragePath(
  value: unknown,
  locationId: string,
  ownerId: unknown
): string {
  const storagePath = requireNonEmptyString(value, "receiptStoragePath");
  if (typeof ownerId !== "string" || !ownerId.trim()) {
    throw new HttpsError("failed-precondition", "Location owner is not configured");
  }
  const escapedLocationId = locationId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedOwnerId = ownerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^locations/${escapedLocationId}/subscription_receipts/` +
    `${escapedOwnerId}/[A-Za-z0-9._-]+\\.(jpg|jpeg|png|webp|pdf)$`,
    "i"
  );
  if (!pattern.test(storagePath)) {
    throw new HttpsError(
      "invalid-argument",
      "receiptStoragePath must use the official private location receipt path"
    );
  }
  return storagePath;
}

/**
 * Extrai lista de fotos do cadastro principal do local.
 * @param {FirebaseFirestore.DocumentData} locData Dados da location.
 * @return {string[]} URLs/caminhos válidos.
 */
function getLocationPhotos(
  locData: FirebaseFirestore.DocumentData
): string[] {
  const photos = Array.isArray(locData.photos) ?
    locData.photos.filter((item) => typeof item === "string" && item.trim()) :
    [];
  const photoUrl = typeof locData.photo_url === "string" && locData.photo_url.trim() ?
    [locData.photo_url.trim()] :
    [];
  return Array.from(new Set([...photos, ...photoUrl]));
}

/**
 * Extrai preço hora independentemente do formato legado.
 * @param {FirebaseFirestore.DocumentData} fieldData Dados do campo.
 * @return {number} Valor monetário.
 */
function getFieldHourlyPrice(fieldData: FirebaseFirestore.DocumentData): number {
  const value = fieldData.hourly_price ?? fieldData.hourlyPrice;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ?
    value :
    0;
}

/**
 * Determina se um campo está ativo considerando formatos legados.
 * @param {FirebaseFirestore.DocumentData} fieldData Dados do campo.
 * @return {boolean} Indicador de atividade.
 */
function isFieldActive(fieldData: FirebaseFirestore.DocumentData): boolean {
  if (typeof fieldData.is_active === "boolean") return fieldData.is_active;
  if (typeof fieldData.isActive === "boolean") return fieldData.isActive;
  return true;
}

/**
 * Carrega campos da quadra nas estruturas raiz e aninhada sem duplicar IDs.
 * @param {string} locationId ID da location.
 * @return {Promise<FirebaseFirestore.DocumentData[]>} Lista consolidada.
 */
async function getLocationFields(
  locationId: string
): Promise<FirebaseFirestore.DocumentData[]> {
  const [nestedSnapshot, rootSnapshot] = await Promise.all([
    db().collection("locations").doc(locationId).collection("fields").get(),
    db().collection("fields").where("location_id", "==", locationId).limit(200).get(),
  ]);

  const seen = new Set<string>();
  const fields: FirebaseFirestore.DocumentData[] = [];
  for (const snapshot of [nestedSnapshot, rootSnapshot]) {
    for (const doc of snapshot.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      fields.push(doc.data() || {});
    }
  }
  return fields;
}

/**
 * Normaliza tipo de campo para buckets comerciais conhecidos.
 * @param {unknown} value Valor bruto.
 * @return {FieldType} Tipo normalizado.
 */
function normalizeFieldType(value: unknown): FieldType {
  return typeof value === "string" &&
    (FIELD_TYPES as readonly string[]).includes(value) ?
    value as FieldType :
    "OUTROS";
}

/**
 * Normaliza amenity para chave filtravel.
 * @param {unknown} value Valor bruto.
 * @return {string | null} Chave normalizada.
 */
function normalizeAmenity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
}

/**
 * Converte timestamp/date Firestore em Date.
 * @param {unknown} value Valor bruto.
 * @return {Date | null} Date normalizado.
 */
function dateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value &&
    typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return null;
}

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

/**
 * Calcula expiracao padrao de convite de manager.
 * @return {Date} Data de expiracao.
 */
function managerInviteExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MANAGER_INVITE_TTL_DAYS);
  return expiresAt;
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
 * Cria entrada imutavel do ledger financeiro da quadra.
 * @param {string} locationId ID da location.
 * @param {LocationSubscriptionLedgerEntry} entry Dados financeiros auditaveis.
 * @return {FirebaseFirestore.DocumentReference} Referencia criada.
 */
function createSubscriptionLedgerRef(
  locationId: string,
  entry: LocationSubscriptionLedgerEntry
) {
  const ledgerCollection = db()
    .collection("locations")
    .doc(locationId)
    .collection("subscription_ledger");
  const ledgerRef = typeof entry.payment_id === "string" && entry.payment_id ?
    ledgerCollection.doc(`${entry.type}_${entry.payment_id}`) :
    ledgerCollection.doc();
  return {
    ledgerRef,
    data: {
      ...entry,
      created_at: FieldValue.serverTimestamp(),
    },
  };
}

/**
 * Soma pagamentos aprovados de uma quadra para o periodo.
 * @param {string} locationId ID da location.
 * @param {string} periodKey Periodo AAAA-MM.
 * @return {Promise<number>} Total aprovado em centavos.
 */
async function sumApprovedSubscriptionPayments(
  locationId: string,
  periodKey: string
): Promise<number> {
  const paymentsSnapshot = await db()
    .collection("locations")
    .doc(locationId)
    .collection("subscription_payments")
    .where("period_key", "==", periodKey)
    .get();
  let paidCents = 0;
  for (const paymentDoc of paymentsSnapshot.docs) {
    const payment = paymentDoc.data() || {};
    const reviewStatus = payment.review_status || payment.status;
    if (reviewStatus === "APPROVED") {
      paidCents += positiveCents(payment.amount_cents);
    }
  }
  return paidCents;
}

/**
 * Calcula status da assinatura apos registrar/aprovar pagamento.
 * @param {object} params Dados do periodo e da location.
 * @return {Promise<object>} Status e saldo recomputados.
 */
async function resolveSubscriptionStatusAfterApprovedPayment(params: {
  locationId: string;
  periodKey: string | null;
  monthlyFeeCents: number;
  newlyApprovedAmountCents: number;
  currentSubscriptionStatus: unknown;
  currentCommercialStatus: unknown;
  billingExpiresAt?: unknown;
  alreadyApprovedCents?: number;
  now?: Date;
}): Promise<{
  paidCents: number | null;
  openBalanceCents: number | null;
  subscriptionStatus: string | null;
  commercialStatus: string | null;
}> {
  const currentSubscriptionStatus =
    typeof params.currentSubscriptionStatus === "string" ?
      params.currentSubscriptionStatus :
      null;
  const currentCommercialStatus =
    typeof params.currentCommercialStatus === "string" ?
      params.currentCommercialStatus :
      currentSubscriptionStatus;
  // #4107: pagamento aprovado NAO reativa contrato vencido. O estado
  // consistente com o cron (que encerra contratos expirados como CANCELLED)
  // e devolver CANCELLED: o valor pago fica registrado no ledger/pagamentos,
  // mas a quadra nao volta a ACTIVE ate um admin renovar `billing_expires_at`.
  const contractExpired = isContractExpired(
    params.billingExpiresAt,
    params.now || new Date()
  );
  const reactivatedStatus = contractExpired ? "CANCELLED" : "ACTIVE";
  if (!params.periodKey || params.monthlyFeeCents <= 0) {
    return {
      paidCents: null,
      openBalanceCents: null,
      subscriptionStatus: reactivatedStatus,
      commercialStatus: reactivatedStatus,
    };
  }

  const alreadyApprovedCents = typeof params.alreadyApprovedCents === "number" ?
    params.alreadyApprovedCents :
    await sumApprovedSubscriptionPayments(
      params.locationId,
      params.periodKey
    );
  const paidCents = alreadyApprovedCents + params.newlyApprovedAmountCents;
  const openBalanceCents = Math.max(params.monthlyFeeCents - paidCents, 0);
  if (openBalanceCents <= 0) {
    return {
      paidCents,
      openBalanceCents,
      subscriptionStatus: reactivatedStatus,
      commercialStatus: reactivatedStatus,
    };
  }

  return {
    paidCents,
    openBalanceCents,
    subscriptionStatus: contractExpired ? "CANCELLED" : currentSubscriptionStatus,
    commercialStatus: contractExpired ? "CANCELLED" : currentCommercialStatus,
  };
}

/**
 * Adiciona ID a uma lista bounded do resultado do cron (#4111).
 * @param {string[]} list Lista alvo.
 * @param {string} id ID da quadra.
 */
function pushBoundedLocationId(list: string[], id: string): void {
  if (list.length < BILLING_AUTOMATION_ID_LIST_CAP) list.push(id);
}

/**
 * Divide uma lista em chunks para controlar paralelismo de leituras.
 * @param {Array<T>} items Lista original.
 * @param {number} size Tamanho maximo por chunk.
 * @return {Array<Array<T>>} Chunks.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Carrega todas as quadras paginando por documentId para nao truncar MRR.
 * @return {Promise<Array<FirebaseFirestore.QueryDocumentSnapshot>>} Docs.
 */
async function fetchAllBillingSummaryLocationDocs(): Promise<
  Array<FirebaseFirestore.QueryDocumentSnapshot>
  > {
  const docs: Array<FirebaseFirestore.QueryDocumentSnapshot> = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let query: FirebaseFirestore.Query = db()
      .collection("locations")
      .orderBy(FieldPath.documentId())
      .limit(BILLING_SUMMARY_PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snapshot = await query.get();
    docs.push(...snapshot.docs);
    if (snapshot.size < BILLING_SUMMARY_PAGE_SIZE) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    if (!lastDoc) {
      break;
    }
  }

  return docs;
}

/**
 * Soma pagamentos do periodo filtrando no Firestore e limitando ao ciclo.
 * @param {string} locationId ID da quadra.
 * @param {string} periodKey Periodo AAAA-MM.
 * @param {number} monthlyFeeCents Mensalidade esperada.
 * @return {Promise<object>} Totais do periodo.
 */
async function getBillingSummaryPaymentTotals(
  locationId: string,
  periodKey: string,
  monthlyFeeCents: number
) {
  const paymentsSnapshot = await db()
    .collection("locations")
    .doc(locationId)
    .collection("subscription_payments")
    .where("period_key", "==", periodKey)
    .get();

  let approvedCents = 0;
  let pendingReceiptCount = 0;
  let lastPaymentAtIso: string | null = null;
  for (const paymentDoc of paymentsSnapshot.docs) {
    const payment = paymentDoc.data() || {};
    const reviewStatus = payment.review_status || payment.status;
    if (reviewStatus === "APPROVED") {
      approvedCents += positiveCents(payment.amount_cents);
      const paidAtIso = toIsoString(payment.paid_at);
      if (paidAtIso && (!lastPaymentAtIso || paidAtIso > lastPaymentAtIso)) {
        lastPaymentAtIso = paidAtIso;
      }
    } else if (reviewStatus === "PENDING_REVIEW") {
      pendingReceiptCount += 1;
    }
  }

  return {
    receivedCents: monthlyFeeCents > 0 ?
      Math.min(approvedCents, monthlyFeeCents) :
      0,
    pendingReceiptCount,
    lastPaymentAtIso,
  };
}

/**
 * Processa ciclos mensais de cobranca de quadras.
 * @param {object} params Parametros opcionais de execucao.
 * @return {Promise<LocationBillingAutomationResult>} Resultado consolidado.
 */
export async function processLocationBillingAutomation(params?: {
  periodKey?: string | null;
  now?: Date;
  actorUserId?: string;
  maxRunMs?: number;
  clockMs?: () => number;
}): Promise<LocationBillingAutomationResult> {
  const now = params?.now || new Date();
  const periodKey = params?.periodKey ?
    requirePeriodKey(params.periodKey) :
    billingPeriodKeyForDate(now);
  const actorUserId = params?.actorUserId || "system:billing-automation";
  const clockMs = params?.clockMs || (() => Date.now());
  const maxRunMs = Number.isInteger(params?.maxRunMs) &&
    (params?.maxRunMs as number) > 0 ?
    (params!.maxRunMs as number) :
    BILLING_AUTOMATION_MAX_RUN_MS;

  // ID de execucao: sortable e deterministico para o mesmo `now` (testes).
  const runId = `${periodKey}_${now.toISOString().replace(/[:.]/g, "-")}`;
  const result: LocationBillingAutomationResult = {
    runId,
    periodKey,
    processedLocations: 0,
    skippedLocations: 0,
    paidLocations: 0,
    partialLocations: 0,
    pendingLocations: 0,
    overdueLocations: 0,
    suspendedLocations: 0,
    reactivatedLocations: 0,
    inconsistentLocations: 0,
    expiredLocations: 0,
    agedTrialLocations: 0,
    ledgerEntriesCreated: 0,
    skippedLocationIds: [],
    inconsistentLocationIds: [],
    expiredLocationIds: [],
    agedTrialLocationIds: [],
    resumedFromLocationId: null,
    nextCursor: null,
    budgetExhausted: false,
  };

  const cursorRef = db()
    .collection("billing_automation_state")
    .doc(periodKey);
  const cursorDoc = await cursorRef.get();
  const cursorData = (cursorDoc.data && cursorDoc.data()) || {};
  const resumedFromLocationId =
    typeof cursorData.last_location_id === "string" &&
    cursorData.last_location_id ?
      cursorData.last_location_id :
      null;
  result.resumedFromLocationId = resumedFromLocationId;

  const runStartedAt = clockMs();
  let lastVisitedId = resumedFromLocationId;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  paging: while (true) {
    let query: FirebaseFirestore.Query = db()
      .collection("locations")
      .orderBy(FieldPath.documentId())
      .limit(BILLING_SUMMARY_PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    } else if (resumedFromLocationId) {
      query = query.startAfter(resumedFromLocationId);
    }
    const snapshot = await query.get();
    if (snapshot.size === 0) {
      break;
    }

    for (const doc of snapshot.docs) {
      if (clockMs() - runStartedAt >= maxRunMs) {
        const budgetExhaustedAt = clockMs();
        result.budgetExhausted = true;
        result.nextCursor = lastVisitedId;
        await cursorRef.set({
          period_key: periodKey,
          last_location_id: lastVisitedId,
          updated_at: FieldValue.serverTimestamp(),
        });
        logger.info("Location billing automation budget exhausted", {
          periodKey,
          resumedFromLocationId,
          nextCursor: result.nextCursor,
          budgetExhaustedAt,
          processedLocations: result.processedLocations,
        });
        break paging;
      }

      const locationId = doc.id || doc.ref?.id;
      const locData = doc.data() || {};
      if (!locationId) {
        result.skippedLocations += 1;
        continue;
      }
      lastVisitedId = locationId;

      // #4111: default unico fail-closed compartilhado com resolver/painel.
      const subscriptionStatus = resolveSubscriptionStatusOrDefault(
        locData.subscription_status
      );
      if (subscriptionStatus === "CANCELLED") {
        result.skippedLocations += 1;
        pushBoundedLocationId(result.skippedLocationIds, locationId);
        continue;
      }
      if (subscriptionStatus === "TRIAL") {
        // FIX #3953: TRIAL nao gera ciclo nem suspende. #4111: mas precisa
        // envelhecer — primeira observacao sem `trial_started_at` grava o
        // relogio (backfill = agora) e trials acima de TRIAL_MAX_DAYS sao
        // registrados no doc de execucao para virarem pendencia.
        result.skippedLocations += 1;
        pushBoundedLocationId(result.skippedLocationIds, locationId);
        if (!locData.trial_started_at) {
          await doc.ref.update({
            trial_started_at: now,
            updated_at: FieldValue.serverTimestamp(),
            updated_by: actorUserId,
          });
        } else if (isTrialAged(locData.trial_started_at, now)) {
          result.agedTrialLocations += 1;
          pushBoundedLocationId(result.agedTrialLocationIds, locationId);
        }
        continue;
      }

      const billingStartsAtIso = toIsoString(locData.billing_starts_at);
      if (billingStartsAtIso && new Date(billingStartsAtIso).getTime() > now.getTime()) {
        result.skippedLocations += 1;
        pushBoundedLocationId(result.skippedLocationIds, locationId);
        continue;
      }

      // #4107: guarda simetrica a `billing_starts_at`. Contrato com
      // `billing_expires_at` no passado esta encerrado: nao gera ciclo, nao
      // cobra e transiciona (uma unica vez — CANCELLED ja foi pulado acima)
      // para CANCELLED com ledger e evento proprios.
      if (isContractExpired(locData.billing_expires_at, now)) {
        result.expiredLocations += 1;
        pushBoundedLocationId(result.expiredLocationIds, locationId);
        const expiredBatch = db().batch();
        expiredBatch.update(doc.ref, {
          subscription_status: "CANCELLED",
          commercial_status: "CANCELLED",
          updated_at: FieldValue.serverTimestamp(),
          updated_by: actorUserId,
        });
        const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
          locationId,
          {
            type: "BILLING_AUTOMATION_CONTRACT_EXPIRED",
            actor_user_id: actorUserId,
            period_key: periodKey,
            previous_subscription_status: subscriptionStatus,
            next_subscription_status: "CANCELLED",
            previous_commercial_status: locData.commercial_status ?? null,
            next_commercial_status: "CANCELLED",
            reason: `Automacao mensal ${periodKey}: contrato expirado em ` +
              `${toIsoString(locData.billing_expires_at)}`,
            effective_at: now,
          }
        );
        expiredBatch.set(ledgerRef, ledgerData);
        await expiredBatch.commit();
        result.ledgerEntriesCreated += 1;
        await writeLocationCommercialEvent({
          locationId,
          actorUserId,
          type: "LOCATION_BILLING_AUTOMATION_STATUS_CHANGED",
          before: {
            subscription_status: subscriptionStatus,
            commercial_status: locData.commercial_status ?? null,
          },
          after: {
            subscription_status: "CANCELLED",
            commercial_status: "CANCELLED",
            billing_expires_at_iso: toIsoString(locData.billing_expires_at),
            period_key: periodKey,
          },
          reason: `Automacao mensal ${periodKey}: contrato expirado`,
        });
        continue;
      }

      const ownerId = typeof locData.owner_id === "string" ?
        locData.owner_id :
        null;
      const monthlyFeeCents = positiveCents(locData.monthly_fee_cents);
      const billingDueDay = Number.isInteger(locData.billing_due_day) ?
        Number(locData.billing_due_day) :
        null;
      if (!ownerId || monthlyFeeCents <= 0 || !billingDueDay) {
        // #4111: quadra que nunca entra no laco e impossivel de cobrar.
        // Fica registrada por ID no doc de execucao e gera alerta.
        result.inconsistentLocations += 1;
        pushBoundedLocationId(result.inconsistentLocationIds, locationId);
        continue;
      }

      const paidCents = await sumApprovedSubscriptionPayments(locationId, periodKey);
      const openBalanceCents = Math.max(monthlyFeeCents - paidCents, 0);
      const cycleDates = buildBillingCycleDates(
        periodKey,
        billingDueDay,
        locData.billing_grace_days,
        locData.billing_suspension_days
      );

      let cycleStatus: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" | "SUSPENDED";
      if (openBalanceCents <= 0) {
        cycleStatus = "PAID";
        result.paidLocations += 1;
      } else if (now.getTime() >= cycleDates.suspendAt.getTime()) {
        cycleStatus = "SUSPENDED";
        result.suspendedLocations += 1;
      } else if (now.getTime() >= cycleDates.graceEndsAt.getTime()) {
        cycleStatus = "OVERDUE";
        result.overdueLocations += 1;
      } else if (paidCents > 0) {
        cycleStatus = "PARTIAL";
        result.partialLocations += 1;
      } else {
        cycleStatus = "PENDING";
        result.pendingLocations += 1;
      }

      let nextSubscriptionStatus = subscriptionStatus;
      if (cycleStatus === "PAID") {
        nextSubscriptionStatus = "ACTIVE";
      } else if (cycleStatus === "OVERDUE") {
        nextSubscriptionStatus = "OVERDUE";
      } else if (cycleStatus === "SUSPENDED") {
        nextSubscriptionStatus = "SUSPENDED";
      }

      const locRef = doc.ref;
      const cycleRef = locRef.collection("subscription_cycles").doc(periodKey);
      const batch = db().batch();
      const statusChanged = nextSubscriptionStatus !== subscriptionStatus ||
        locData.commercial_status !== nextSubscriptionStatus;
      const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        current_billing_period_key: periodKey,
        current_billing_cycle_status: cycleStatus,
        current_billing_paid_cents: paidCents,
        current_billing_open_balance_cents: openBalanceCents,
        billing_due_at: cycleDates.dueAt,
        billing_grace_ends_at: cycleDates.graceEndsAt,
        billing_suspend_at: cycleDates.suspendAt,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: actorUserId,
      };
      if (statusChanged) {
        update.subscription_status = nextSubscriptionStatus;
        update.commercial_status = nextSubscriptionStatus;
      }

      batch.set(cycleRef, {
        period_key: periodKey,
        location_id: locationId,
        owner_id: ownerId,
        amount_cents: monthlyFeeCents,
        paid_cents: paidCents,
        open_balance_cents: openBalanceCents,
        billing_due_day: billingDueDay,
        due_at: cycleDates.dueAt,
        grace_ends_at: cycleDates.graceEndsAt,
        suspend_at: cycleDates.suspendAt,
        grace_days: cycleDates.graceDays,
        suspension_days: cycleDates.suspensionDays,
        status: cycleStatus,
        previous_status: locData.current_billing_cycle_status || null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        processed_at: FieldValue.serverTimestamp(),
      }, {merge: true});
      batch.update(locRef, update);

      let ledgerType: string | null = null;
      if (statusChanged) {
        if (cycleStatus === "PAID") {
          ledgerType = "BILLING_AUTOMATION_REACTIVATED";
          result.reactivatedLocations += 1;
        } else if (cycleStatus === "OVERDUE") {
          ledgerType = "BILLING_AUTOMATION_OVERDUE";
        } else if (cycleStatus === "SUSPENDED") {
          ledgerType = "BILLING_AUTOMATION_SUSPENDED";
        }
      }

      if (ledgerType) {
        const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
          locationId,
          {
            type: ledgerType,
            actor_user_id: actorUserId,
            amount_cents: openBalanceCents,
            period_key: periodKey,
            previous_subscription_status: subscriptionStatus,
            next_subscription_status: nextSubscriptionStatus,
            previous_commercial_status: locData.commercial_status ?? null,
            next_commercial_status: nextSubscriptionStatus,
            billing_due_day: billingDueDay,
            reason: `Automacao mensal ${periodKey}: ${cycleStatus}`,
            effective_at: now,
          }
        );
        batch.set(ledgerRef, ledgerData);
        result.ledgerEntriesCreated += 1;
      }

      await batch.commit();
      if (statusChanged) {
        await writeLocationCommercialEvent({
          locationId,
          actorUserId,
          type: "LOCATION_BILLING_AUTOMATION_STATUS_CHANGED",
          before: {
            subscription_status: subscriptionStatus,
            commercial_status: locData.commercial_status ?? null,
          },
          after: {
            subscription_status: nextSubscriptionStatus,
            commercial_status: nextSubscriptionStatus,
            billing_cycle_status: cycleStatus,
            open_balance_cents: openBalanceCents,
            period_key: periodKey,
          },
          reason: `Automacao mensal ${periodKey}`,
        });
      }

      result.processedLocations += 1;
    }

    if (snapshot.size < BILLING_SUMMARY_PAGE_SIZE) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    if (!lastDoc) {
      break;
    }
  }

  if (!result.budgetExhausted) {
    await cursorRef.delete();
    logger.info("Location billing automation finished", {
      ...result,
      resumedFromLocationId,
    });
  }

  await persistBillingAutomationRun(result, now, actorUserId);

  return result;
}

/**
 * Persiste um doc por execucao do cron em `billing_automation_runs` (#4111)
 * com contadores + listas de IDs, para que quadras descartadas por
 * `continue` deixem rastro consultavel (admin e monitoring/alerting.ts).
 * Falha de persistencia nao derruba o cron: e observabilidade, nao cobranca.
 * @param {LocationBillingAutomationResult} result Resultado consolidado.
 * @param {Date} now Instante de referencia da execucao.
 * @param {string} actorUserId Ator (sistema ou admin).
 * @return {Promise<void>} Promise resolvida apos tentativa de gravacao.
 */
async function persistBillingAutomationRun(
  result: LocationBillingAutomationResult,
  now: Date,
  actorUserId: string
): Promise<void> {
  try {
    await db()
      .collection(BILLING_AUTOMATION_RUNS_COLLECTION)
      .doc(result.runId)
      .set({
        run_id: result.runId,
        period_key: result.periodKey,
        actor_user_id: actorUserId,
        started_at: now,
        finished_at: FieldValue.serverTimestamp(),
        processed_locations: result.processedLocations,
        skipped_locations: result.skippedLocations,
        paid_locations: result.paidLocations,
        partial_locations: result.partialLocations,
        pending_locations: result.pendingLocations,
        overdue_locations: result.overdueLocations,
        suspended_locations: result.suspendedLocations,
        reactivated_locations: result.reactivatedLocations,
        inconsistent_locations: result.inconsistentLocations,
        expired_locations: result.expiredLocations,
        aged_trial_locations: result.agedTrialLocations,
        ledger_entries_created: result.ledgerEntriesCreated,
        skipped_location_ids: result.skippedLocationIds,
        inconsistent_location_ids: result.inconsistentLocationIds,
        expired_location_ids: result.expiredLocationIds,
        aged_trial_location_ids: result.agedTrialLocationIds,
        id_list_cap: BILLING_AUTOMATION_ID_LIST_CAP,
        resumed_from_location_id: result.resumedFromLocationId,
        next_cursor: result.nextCursor,
        budget_exhausted: result.budgetExhausted,
        created_at: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    logger.error("Location billing automation run doc failed", {
      runId: result.runId,
      periodKey: result.periodKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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

export const runLocationBillingAutomation =
secureCallable<RunLocationBillingAutomationRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 5, windowMs: 60000, keyPrefix: "locBillAuto"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "runLocationBillingAutomation",
      periodKey: req.data?.periodKey ?? null,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const periodKey = request.data?.periodKey ?
      requirePeriodKey(request.data.periodKey) :
      null;
    return processLocationBillingAutomation({
      periodKey,
      actorUserId: request.auth.uid,
    });
  }
);

export const processLocationBillingCycles = onSchedule(
  {
    schedule: "every day 04:20",
    timeZone: "America/Sao_Paulo",
    memory: "512MiB",
    timeoutSeconds: 540,
    retryCount: 3,
    maxRetrySeconds: 300,
  },
  async () => {
    const result = await processLocationBillingAutomation();
    logger.info("Location billing automation finished", result);
  }
);

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

export const getAdminLocationBillingSummary =
secureCallable<GetAdminLocationBillingSummaryRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: false,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 30, windowMs: 60000, keyPrefix: "locBillSum"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "getAdminLocationBillingSummary",
      periodKey: req.data?.periodKey ?? null,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const periodKey = request.data?.periodKey ?
      requirePeriodKey(request.data.periodKey) :
      currentBillingPeriodKey();
    const locationDocs = await fetchAllBillingSummaryLocationDocs();
    const summary = {
      expectedMrrCents: 0,
      receivedCents: 0,
      overdueCents: 0,
      trialCents: 0,
      suspendedCents: 0,
      activeLocations: 0,
      trialLocations: 0,
      overdueLocations: 0,
      suspendedLocations: 0,
      cancelledLocations: 0,
      pendingReceiptLocations: 0,
    };
    const rows = [];

    for (const docChunk of chunkArray(
      locationDocs,
      BILLING_SUMMARY_PAYMENT_CONCURRENCY
    )) {
      const chunkRows = await Promise.all(docChunk.map(async (doc) => {
        const locData = doc.data() || {};
        const locationId = doc.id || doc.ref?.id;
        if (!locationId) return null;
        // #4111: default unico fail-closed compartilhado com cron/resolver.
        const subscriptionStatus = resolveSubscriptionStatusOrDefault(
          locData.subscription_status
        );
        const publicationStatus =
          typeof locData.publication_status === "string" ?
            locData.publication_status :
            (locData.is_verified === true ? "PUBLISHED" : "PENDING_REVIEW");
        const monthlyFeeCents = positiveCents(locData.monthly_fee_cents);
        const expectedCents = ["ACTIVE", "OVERDUE"].includes(subscriptionStatus) ?
          monthlyFeeCents :
          0;
        const paymentTotals = await getBillingSummaryPaymentTotals(
          locationId,
          periodKey,
          monthlyFeeCents
        );
        const venueAccountProjection: VenueAccountRowProjection = {
          venueAccountId: typeof locData.venue_account_id === "string" ?
            locData.venue_account_id :
            null,
          venueAccountStatus: typeof locData.venue_account_status === "string" ?
            locData.venue_account_status :
            null,
          venueAccountChargeScope:
            typeof locData.venue_account_charge_scope === "string" ?
              locData.venue_account_charge_scope :
              null,
          venueAccountPlanCode: typeof locData.venue_account_plan_code === "string" ?
            locData.venue_account_plan_code :
            null,
          venueAccountPlanLabel:
            typeof locData.venue_account_plan_label === "string" ?
              locData.venue_account_plan_label :
              null,
          venueAccountMonthlyTotalCents:
            Number.isInteger(locData.venue_account_monthly_total_cents) ?
              Number(locData.venue_account_monthly_total_cents) :
              null,
          venueAccountLinkedLocationsCount:
            Number.isInteger(locData.venue_account_linked_locations_count) ?
              Number(locData.venue_account_linked_locations_count) :
              null,
          venueAccountActiveFieldsCount:
            Number.isInteger(locData.venue_account_active_fields_count) ?
              Number(locData.venue_account_active_fields_count) :
              null,
        };

        return {
          row: {
            id: locationId,
            name: typeof locData.name === "string" ? locData.name : locationId,
            ownerId: typeof locData.owner_id === "string" ?
              locData.owner_id :
              null,
            city: typeof locData.city === "string" ? locData.city : null,
            state: typeof locData.state === "string" ? locData.state : null,
            publicationStatus,
            subscriptionStatus,
            billingPlanCode: typeof locData.billing_plan_code === "string" ?
              locData.billing_plan_code :
              null,
            billingPlanLabel: typeof locData.billing_plan_label === "string" ?
              locData.billing_plan_label :
              null,
            billingCycle: typeof locData.billing_cycle === "string" ?
              locData.billing_cycle :
              null,
            billingBaseFeeCents:
              Number.isInteger(locData.billing_base_fee_cents) &&
              Number(locData.billing_base_fee_cents) >= 0 ?
                Number(locData.billing_base_fee_cents) :
                null,
            monthlyFeeCents,
            billingDueDay: Number.isInteger(locData.billing_due_day) ?
              Number(locData.billing_due_day) :
              null,
            billingStartsAtIso: toIsoString(locData.billing_starts_at),
            billingExpiresAtIso: toIsoString(locData.billing_expires_at),
            trialStartedAtIso: toIsoString(locData.trial_started_at),
            expectedCents,
            receivedCents: paymentTotals.receivedCents,
            openBalanceCents: Math.max(
              monthlyFeeCents - paymentTotals.receivedCents,
              0
            ),
            billingExceptionNote: typeof locData.billing_exception_note === "string" ?
              locData.billing_exception_note :
              null,
            currentBillingCycleStatus:
              typeof locData.current_billing_cycle_status === "string" ?
                locData.current_billing_cycle_status :
                null,
            currentBillingPaidCents: positiveCents(
              locData.current_billing_paid_cents
            ),
            currentBillingOpenBalanceCents: positiveCents(
              locData.current_billing_open_balance_cents
            ),
            billingDueAtIso: toIsoString(locData.billing_due_at),
            billingGraceEndsAtIso: toIsoString(locData.billing_grace_ends_at),
            billingSuspendAtIso: toIsoString(locData.billing_suspend_at),
            pendingReceiptCount: paymentTotals.pendingReceiptCount,
            lastPaymentAtIso: paymentTotals.lastPaymentAtIso,
            updatedAtIso: toIsoString(locData.updated_at),
            ...venueAccountProjection,
          },
          subscriptionStatus,
          monthlyFeeCents,
          receivedCents: paymentTotals.receivedCents,
          pendingReceiptCount: paymentTotals.pendingReceiptCount,
        };
      }));

      for (const item of chunkRows) {
        if (!item) continue;
        const {
          subscriptionStatus,
          monthlyFeeCents,
          receivedCents,
          pendingReceiptCount,
        } = item;
        if (subscriptionStatus === "ACTIVE") {
          summary.activeLocations += 1;
          summary.expectedMrrCents += monthlyFeeCents;
        } else if (subscriptionStatus === "TRIAL") {
          summary.trialLocations += 1;
          summary.trialCents += monthlyFeeCents;
        } else if (subscriptionStatus === "OVERDUE") {
          summary.overdueLocations += 1;
          summary.expectedMrrCents += monthlyFeeCents;
          summary.overdueCents += monthlyFeeCents;
        } else if (subscriptionStatus === "SUSPENDED") {
          summary.suspendedLocations += 1;
          summary.suspendedCents += monthlyFeeCents;
        } else if (subscriptionStatus === "CANCELLED") {
          summary.cancelledLocations += 1;
        }
        summary.receivedCents += receivedCents;
        if (pendingReceiptCount > 0) {
          summary.pendingReceiptLocations += 1;
        }
        rows.push(item.row);
      }
    }

    return {
      periodKey,
      generatedAtIso: new Date().toISOString(),
      scannedLocations: locationDocs.length,
      scanLimit: BILLING_SUMMARY_PAGE_SIZE,
      scanComplete: true,
      summary,
      locations: rows,
    };
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
      const fields = await getLocationFields(locationId);
      const publicationSnapshot = buildLocationCommercialRequestSnapshot(
        {
          ...locData,
          publication_status: "PUBLISHED",
          is_verified: true,
        },
        fields
      );
      if (publicationSnapshot.ready_for_publication_approval !== true) {
        const issueCodes = Array.isArray(publicationSnapshot.commercial_issue_codes) ?
          publicationSnapshot.commercial_issue_codes :
          [];
        throw new HttpsError(
          "failed-precondition",
          `Location is not ready for publication: ${issueCodes.join(", ")}`
        );
      }
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

export const requestLocationCommercialReview =
secureCallable<RequestLocationCommercialReviewRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "locCommReq"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "requestLocationCommercialReview",
      locationId: req.data?.locationId,
      requestType: req.data?.requestType,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }

    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const requestType = requireEnum(
      request.data.requestType,
      COMMERCIAL_REQUEST_TYPES,
      "requestType"
    );
    const notes = optionalTrimmed(request.data.notes, 2000);
    const requestedSections = normalizeStringArray(
      request.data.requestedSections,
      8,
      60
    );
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwner(request, locData);

    if (locData.latest_commercial_request_status === "PENDING_REVIEW") {
      throw new HttpsError(
        "failed-precondition",
        "There is already a pending commercial request for this location"
      );
    }
    if (requestType === "PUBLICATION" &&
      locData.publication_status === "PUBLISHED"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Published locations should use COMMERCIAL_UPDATE requests"
      );
    }

    const fields = await getLocationFields(locationId);
    const snapshot = buildLocationCommercialRequestSnapshot(locData, fields);
    const pendingItemIds = Array.isArray(snapshot.pending_item_ids) ?
      snapshot.pending_item_ids :
      [];
    if (requestType === "PUBLICATION" &&
      snapshot.owner_ready_for_publication !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Complete the minimum registration before requesting publication: ${pendingItemIds.join(", ")}`
      );
    }

    const requestRef = locRef.collection("publication_requests").doc();
    const publicationStatus = requestType === "PUBLICATION" &&
      locData.publication_status !== "PUBLISHED" ?
      "PENDING_REVIEW" :
      (typeof locData.publication_status === "string" ?
        locData.publication_status :
        "DRAFT");

    const batch = db().batch();
    batch.set(requestRef, {
      location_id: locationId,
      request_type: requestType,
      status: "PENDING_REVIEW",
      requested_sections: requestedSections,
      owner_notes: notes,
      admin_notes: null,
      submitted_by: request.auth.uid,
      reviewer_user_id: null,
      snapshot,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      reviewed_at: null,
      closed_at: null,
    });
    batch.update(locRef, {
      latest_commercial_request_id: requestRef.id,
      latest_commercial_request_type: requestType,
      latest_commercial_request_status: "PENDING_REVIEW",
      latest_commercial_request_requested_sections: requestedSections,
      latest_commercial_request_owner_notes: notes,
      latest_commercial_request_admin_notes: null,
      latest_commercial_request_pending_item_ids: snapshot.pending_item_ids,
      latest_commercial_request_commercial_issue_codes:
        snapshot.commercial_issue_codes,
      latest_commercial_request_checklist_completed:
        snapshot.checklist_completed,
      latest_commercial_request_checklist_total: snapshot.checklist_total,
      latest_commercial_request_active_field_count:
        snapshot.active_field_count,
      latest_commercial_request_photo_count: snapshot.photo_count,
      latest_commercial_request_requested_at: FieldValue.serverTimestamp(),
      latest_commercial_request_updated_at: FieldValue.serverTimestamp(),
      latest_commercial_request_reviewed_at: null,
      owner_notes: notes,
      publication_status: publicationStatus,
      unpublished_reason: null,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_COMMERCIAL_REQUEST_SUBMITTED",
      before: {
        latest_commercial_request_status:
          locData.latest_commercial_request_status ?? null,
        publication_status: locData.publication_status ?? null,
      },
      after: {
        request_id: requestRef.id,
        request_type: requestType,
        request_status: "PENDING_REVIEW",
        requested_sections: requestedSections,
        publication_status: publicationStatus,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      requestId: requestRef.id,
      requestStatus: "PENDING_REVIEW",
      publicationStatus,
    };
  }
);

export const reviewLocationCommercialRequest =
secureCallable<ReviewLocationCommercialRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locCommReview"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "reviewLocationCommercialRequest",
      locationId: req.data?.locationId,
      requestId: req.data?.requestId,
      decision: req.data?.decision,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    assertAdmin(request);

    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const requestId = requireNonEmptyString(request.data.requestId, "requestId");
    const decision = requireEnum(
      request.data.decision,
      ["NEEDS_CHANGES", "APPROVED", "REJECTED"] as const,
      "decision"
    );
    const notes = optionalTrimmed(request.data.notes, 2000);
    const {locRef, locData} = await getExistingLocation(locationId);
    const commercialRequestRef = locRef.collection("publication_requests").doc(requestId);
    const commercialRequestDoc = await commercialRequestRef.get();
    if (!commercialRequestDoc.exists) {
      throw new HttpsError("not-found", `Commercial request ${requestId} not found`);
    }
    const commercialRequestData = commercialRequestDoc.data() || {};
    if (commercialRequestData.status !== "PENDING_REVIEW") {
      throw new HttpsError(
        "failed-precondition",
        "Commercial request is not pending review"
      );
    }

    const requestType = requireEnum(
      commercialRequestData.request_type,
      COMMERCIAL_REQUEST_TYPES,
      "requestType"
    );
    const fields = await getLocationFields(locationId);
    const snapshot = buildLocationCommercialRequestSnapshot(locData, fields);
    let nextPublicationStatus = typeof locData.publication_status === "string" ?
      locData.publication_status :
      "DRAFT";

    if (decision === "APPROVED" && requestType === "PUBLICATION") {
      if (snapshot.ready_for_publication_approval !== true) {
        throw new HttpsError(
          "failed-precondition",
          "Location is not ready for publication approval"
        );
      }
      nextPublicationStatus = "PUBLISHED";
    } else if (requestType === "PUBLICATION" && nextPublicationStatus !== "PUBLISHED") {
      nextPublicationStatus = decision === "REJECTED" ? "REJECTED" : "DRAFT";
    }

    const batch = db().batch();
    batch.update(commercialRequestRef, {
      status: decision,
      admin_notes: notes,
      reviewer_user_id: request.auth.uid,
      snapshot,
      reviewed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      closed_at: FieldValue.serverTimestamp(),
    });

    const locationUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      latest_commercial_request_id: requestId,
      latest_commercial_request_type: requestType,
      latest_commercial_request_status: decision,
      latest_commercial_request_requested_sections:
        commercialRequestData.requested_sections ?? [],
      latest_commercial_request_owner_notes:
        commercialRequestData.owner_notes ?? null,
      latest_commercial_request_admin_notes: notes,
      latest_commercial_request_pending_item_ids: snapshot.pending_item_ids,
      latest_commercial_request_commercial_issue_codes:
        snapshot.commercial_issue_codes,
      latest_commercial_request_checklist_completed:
        snapshot.checklist_completed,
      latest_commercial_request_checklist_total: snapshot.checklist_total,
      latest_commercial_request_active_field_count:
        snapshot.active_field_count,
      latest_commercial_request_photo_count: snapshot.photo_count,
      latest_commercial_request_updated_at: FieldValue.serverTimestamp(),
      latest_commercial_request_reviewed_at: FieldValue.serverTimestamp(),
      admin_notes: notes,
      publication_status: nextPublicationStatus,
      unpublished_reason: decision === "REJECTED" ? notes : null,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };

    if (decision === "APPROVED" && requestType === "PUBLICATION") {
      locationUpdate.published_at = FieldValue.serverTimestamp();
      locationUpdate.published_by = request.auth.uid;
      locationUpdate.unpublished_reason = null;
    }

    batch.update(locRef, locationUpdate);
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_COMMERCIAL_REQUEST_REVIEWED",
      before: {
        request_id: requestId,
        request_status: commercialRequestData.status ?? null,
        publication_status: locData.publication_status ?? null,
      },
      after: {
        request_id: requestId,
        request_type: requestType,
        request_status: decision,
        publication_status: nextPublicationStatus,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      requestId,
      requestStatus: decision,
      publicationStatus: nextPublicationStatus,
    };
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
    const hasBillingPlanCode = request.data.billingPlanCode !== undefined;
    const hasBillingPlanLabel = request.data.billingPlanLabel !== undefined;
    const hasBillingCycle = request.data.billingCycle !== undefined;
    const hasBillingBaseFee = request.data.billingBaseFeeCents !== undefined;
    const hasMonthlyFee = request.data.monthlyFeeCents !== undefined;
    const hasBillingDueDay = request.data.billingDueDay !== undefined;
    const hasBillingStartsAt = request.data.billingStartsAtIso !== undefined;
    const hasBillingExpiresAt = request.data.billingExpiresAtIso !== undefined;
    const hasBillingExceptionNote = request.data.billingExceptionNote !== undefined;
    const hasAdminNotes = request.data.adminNotes !== undefined;
    const {locRef, locData} = await getExistingLocation(locationId);
    const billingPlanCode = hasBillingPlanCode ?
      (request.data.billingPlanCode === null ?
        null :
        requireEnum(
          request.data.billingPlanCode,
          BILLING_PLAN_CODES,
          "billingPlanCode"
        )) :
      (typeof locData.billing_plan_code === "string" ?
        locData.billing_plan_code :
        null);
    const billingPlanLabel = hasBillingPlanLabel ?
      optionalTrimmed(request.data.billingPlanLabel, 120) :
      (typeof locData.billing_plan_label === "string" ?
        locData.billing_plan_label :
        null);
    const billingCycle = hasBillingCycle ?
      (request.data.billingCycle === null ?
        null :
        requireEnum(
          request.data.billingCycle,
          BILLING_CYCLES,
          "billingCycle"
        )) :
      (typeof locData.billing_cycle === "string" ?
        locData.billing_cycle :
        null);
    const billingBaseFeeCents = hasBillingBaseFee ?
      request.data.billingBaseFeeCents ?? null :
      locData.billing_base_fee_cents ?? null;
    const monthlyFeeCents = hasMonthlyFee ?
      request.data.monthlyFeeCents ?? null :
      locData.monthly_fee_cents ?? null;
    const billingDueDay = hasBillingDueDay ?
      request.data.billingDueDay ?? null :
      locData.billing_due_day ?? null;

    if (billingBaseFeeCents !== null &&
      (!Number.isInteger(billingBaseFeeCents) || billingBaseFeeCents < 0)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "billingBaseFeeCents must be >= 0"
      );
    }
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

    const billingStartsAt = hasBillingStartsAt ?
      parseOptionalIsoDate(request.data.billingStartsAtIso, "billingStartsAtIso") :
      locData.billing_starts_at ?? null;
    const billingExpiresAt = hasBillingExpiresAt ?
      parseOptionalIsoDate(
        request.data.billingExpiresAtIso,
        "billingExpiresAtIso"
      ) :
      locData.billing_expires_at ?? null;
    if (billingStartsAt && billingExpiresAt && billingStartsAt > billingExpiresAt) {
      throw new HttpsError(
        "invalid-argument",
        "billingStartsAtIso must be <= billingExpiresAtIso"
      );
    }
    const billingExceptionNote = hasBillingExceptionNote ?
      optionalTrimmed(request.data.billingExceptionNote, 1000) :
      (typeof locData.billing_exception_note === "string" ?
        locData.billing_exception_note :
        null);
    const adminNotes = hasAdminNotes ?
      optionalTrimmed(request.data.adminNotes, 2000) :
      null;
    const before = {
      subscription_status: locData.subscription_status ?? null,
      commercial_status: locData.commercial_status ?? null,
      billing_plan_code: locData.billing_plan_code ?? null,
      billing_plan_label: locData.billing_plan_label ?? null,
      billing_cycle: locData.billing_cycle ?? null,
      billing_base_fee_cents: locData.billing_base_fee_cents ?? null,
      monthly_fee_cents: locData.monthly_fee_cents ?? null,
      billing_due_day: locData.billing_due_day ?? null,
      billing_starts_at: locData.billing_starts_at ?? null,
      billing_expires_at: locData.billing_expires_at ?? null,
      billing_exception_note: locData.billing_exception_note ?? null,
      admin_notes: locData.admin_notes ?? null,
      trial_started_at: locData.trial_started_at ?? null,
    };
    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      subscription_status: subscriptionStatus,
      commercial_status: subscriptionStatus,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };
    if (hasBillingPlanCode) update.billing_plan_code = billingPlanCode;
    if (hasBillingPlanLabel) update.billing_plan_label = billingPlanLabel;
    if (hasBillingCycle) update.billing_cycle = billingCycle;
    if (hasBillingBaseFee) update.billing_base_fee_cents = billingBaseFeeCents;
    if (hasMonthlyFee) update.monthly_fee_cents = monthlyFeeCents;
    if (hasBillingDueDay) update.billing_due_day = billingDueDay;
    if (hasBillingStartsAt) update.billing_starts_at = billingStartsAt;
    if (hasBillingExpiresAt) update.billing_expires_at = billingExpiresAt;
    if (hasBillingExceptionNote) {
      update.billing_exception_note = billingExceptionNote;
    }
    if (hasAdminNotes) update.admin_notes = adminNotes;
    // #4111: toda entrada em TRIAL inicia o relogio de envelhecimento.
    // Quadra que ja estava em TRIAL com relogio preserva a data original.
    if (subscriptionStatus === "TRIAL" &&
      !(locData.subscription_status === "TRIAL" && locData.trial_started_at)
    ) {
      update.trial_started_at = new Date();
    }

    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "SUBSCRIPTION_STATUS_CHANGED",
        actor_user_id: request.auth.uid,
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: subscriptionStatus,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: subscriptionStatus,
        billing_plan_code: billingPlanCode,
        billing_plan_label: billingPlanLabel,
        billing_cycle: billingCycle,
        billing_base_fee_cents: billingBaseFeeCents,
        monthly_fee_cents: monthlyFeeCents,
        billing_due_day: billingDueDay,
        billing_exception_note: billingExceptionNote,
        reason: adminNotes,
        effective_at: FieldValue.serverTimestamp(),
      }
    );
    const batch = db().batch();
    batch.update(locRef, update);
    batch.set(ledgerRef, ledgerData);
    await batch.commit();
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
    const periodKey = requirePeriodKey(request.data.periodKey);
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
    const resolvedStatus = await resolveSubscriptionStatusAfterApprovedPayment({
      locationId,
      periodKey,
      monthlyFeeCents: positiveCents(locData.monthly_fee_cents),
      newlyApprovedAmountCents: amountCents,
      currentSubscriptionStatus: locData.subscription_status,
      currentCommercialStatus: locData.commercial_status,
      billingExpiresAt: locData.billing_expires_at,
    });
    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "PAYMENT_REGISTERED",
        actor_user_id: request.auth.uid,
        amount_cents: amountCents,
        period_key: periodKey,
        payment_id: paymentRef.id,
        method,
        review_status: "APPROVED",
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: resolvedStatus.subscriptionStatus,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: resolvedStatus.commercialStatus,
        reason: notes,
        effective_at: paidAt,
      }
    );
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
      status: "APPROVED",
      review_status: "APPROVED",
      reviewed_at: FieldValue.serverTimestamp(),
      reviewed_by: request.auth.uid,
    });
    batch.update(locRef, {
      subscription_status: resolvedStatus.subscriptionStatus,
      commercial_status: resolvedStatus.commercialStatus,
      last_payment_at: paidAt,
      last_payment_amount_cents: amountCents,
      last_payment_period_key: periodKey,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    batch.set(ledgerRef, ledgerData);
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
        subscription_status: resolvedStatus.subscriptionStatus,
        commercial_status: resolvedStatus.commercialStatus,
        amount_cents: amountCents,
        period_key: periodKey,
        paid_cents: resolvedStatus.paidCents,
        open_balance_cents: resolvedStatus.openBalanceCents,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId: paymentRef.id,
      subscriptionStatus: resolvedStatus.subscriptionStatus,
    };
  }
);

export const submitLocationSubscriptionReceipt =
secureCallable<SubmitLocationSubscriptionReceiptRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "locPaySubmit"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "submitLocationSubscriptionReceipt",
      locationId: req.data?.locationId,
      periodKey: req.data?.periodKey,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const periodKey = requirePeriodKey(request.data.periodKey);
    const {amountCents} = request.data;
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new HttpsError("invalid-argument", "amountCents must be > 0");
    }
    const paidAt = parseOptionalIsoDate(request.data.paidAtIso, "paidAtIso") ||
      new Date();
    const method = optionalTrimmed(request.data.method, 80);
    const notes = optionalTrimmed(request.data.notes, 1000);
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwnerForReceipt(request, locData);
    const receiptStoragePath = requireLocationReceiptStoragePath(
      request.data.receiptStoragePath,
      locationId,
      locData.owner_id
    );
    const paymentRef = locRef.collection("subscription_payments").doc();
    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "PAYMENT_RECEIPT_SUBMITTED",
        actor_user_id: request.auth.uid,
        amount_cents: amountCents,
        period_key: periodKey,
        payment_id: paymentRef.id,
        method,
        review_status: "PENDING_REVIEW",
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: locData.subscription_status ?? null,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: locData.commercial_status ?? null,
        reason: notes,
        effective_at: paidAt,
      }
    );

    const batch = db().batch();
    batch.set(paymentRef, {
      amount_cents: amountCents,
      period_key: periodKey,
      paid_at: paidAt,
      method,
      receipt_storage_path: receiptStoragePath,
      receipt_url: null,
      notes,
      status: "PENDING_REVIEW",
      review_status: "PENDING_REVIEW",
      submitted_at: FieldValue.serverTimestamp(),
      submitted_by: request.auth.uid,
      created_at: FieldValue.serverTimestamp(),
      created_by: request.auth.uid,
    });
    batch.set(ledgerRef, ledgerData);
    await batch.commit();

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_SUBSCRIPTION_RECEIPT_SUBMITTED",
      after: {
        payment_id: paymentRef.id,
        amount_cents: amountCents,
        period_key: periodKey,
        receipt_storage_path: receiptStoragePath,
        review_status: "PENDING_REVIEW",
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId: paymentRef.id,
      reviewStatus: "PENDING_REVIEW",
    };
  }
);

export const reviewLocationSubscriptionReceipt =
secureCallable<ReviewLocationSubscriptionReceiptRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locPayReview"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "reviewLocationSubscriptionReceipt",
      locationId: req.data?.locationId,
      paymentId: req.data?.paymentId,
      decision: req.data?.decision,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    assertAdmin(request);
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const paymentId = requireNonEmptyString(request.data.paymentId, "paymentId");
    const decision = requireEnum(
      request.data.decision,
      ["APPROVED", "REJECTED"] as const,
      "decision"
    );
    const notes = optionalTrimmed(request.data.notes, 1000);
    const actorUid = request.auth.uid;
    const {locRef} = await getExistingLocation(locationId);
    const paymentRef = locRef.collection("subscription_payments").doc(paymentId);

    const review = await db().runTransaction(async (tx) => {
      const paymentDoc = await tx.get(paymentRef);
      if (!paymentDoc.exists) {
        throw new HttpsError("not-found", `Payment ${paymentId} not found`);
      }
      const paymentData = paymentDoc.data() || {};
      if (paymentData.review_status !== "PENDING_REVIEW" &&
        paymentData.status !== "PENDING_REVIEW"
      ) {
        throw new HttpsError("failed-precondition", "Payment is not pending review");
      }
      if (typeof paymentData.receipt_storage_path !== "string") {
        throw new HttpsError("failed-precondition", "Payment has no private receipt path");
      }

      const paymentUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        review_status: decision,
        status: decision,
        reviewed_at: FieldValue.serverTimestamp(),
        reviewed_by: actorUid,
        review_notes: notes,
        updated_at: FieldValue.serverTimestamp(),
      };
      const paymentAmountCents = positiveCents(paymentData.amount_cents);
      const paymentPeriodKey = typeof paymentData.period_key === "string" ?
        paymentData.period_key :
        null;

      const locDoc = await tx.get(locRef);
      const currentLocData = locDoc.data() || {};

      let alreadyApprovedCents = 0;
      if (decision === "APPROVED" && paymentPeriodKey) {
        const paymentsSnapshot = await tx.get(
          locRef
            .collection("subscription_payments")
            .where("period_key", "==", paymentPeriodKey)
        );
        for (const approvedDoc of paymentsSnapshot.docs) {
          const approved = approvedDoc.data() || {};
          const approvedReviewStatus = approved.review_status || approved.status;
          if (approvedReviewStatus === "APPROVED") {
            alreadyApprovedCents += positiveCents(approved.amount_cents);
          }
        }
      }

      const resolvedStatus = decision === "APPROVED" ?
        await resolveSubscriptionStatusAfterApprovedPayment({
          locationId,
          periodKey: paymentPeriodKey,
          monthlyFeeCents: positiveCents(currentLocData.monthly_fee_cents),
          newlyApprovedAmountCents: paymentAmountCents,
          currentSubscriptionStatus: currentLocData.subscription_status,
          currentCommercialStatus: currentLocData.commercial_status,
          billingExpiresAt: currentLocData.billing_expires_at,
          alreadyApprovedCents,
        }) :
        {
          paidCents: null,
          openBalanceCents: null,
          subscriptionStatus: currentLocData.subscription_status ?? null,
          commercialStatus: currentLocData.commercial_status ?? null,
        };

      if (decision === "APPROVED") {
        tx.update(paymentRef, paymentUpdate);
        tx.update(locRef, {
          subscription_status: resolvedStatus.subscriptionStatus,
          commercial_status: resolvedStatus.commercialStatus,
          last_payment_at: paymentData.paid_at ?? null,
          last_payment_amount_cents: paymentData.amount_cents ?? null,
          last_payment_period_key: paymentData.period_key ?? null,
          last_payment_id: paymentId,
          updated_at: FieldValue.serverTimestamp(),
          updated_by: actorUid,
        });
      } else {
        tx.update(paymentRef, paymentUpdate);
      }

      const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
        locationId,
        {
          type: decision === "APPROVED" ?
            "PAYMENT_RECEIPT_APPROVED" :
            "PAYMENT_RECEIPT_REJECTED",
          actor_user_id: actorUid,
          amount_cents: typeof paymentData.amount_cents === "number" ?
            paymentData.amount_cents : null,
          period_key: typeof paymentData.period_key === "string" ?
            paymentData.period_key : null,
          payment_id: paymentId,
          method: typeof paymentData.method === "string" ? paymentData.method : null,
          review_status: decision,
          previous_subscription_status: currentLocData.subscription_status ?? null,
          next_subscription_status: resolvedStatus.subscriptionStatus,
          previous_commercial_status: currentLocData.commercial_status ?? null,
          next_commercial_status: resolvedStatus.commercialStatus,
          reason: notes,
          effective_at: paymentData.paid_at ?? FieldValue.serverTimestamp(),
        }
      );
      tx.set(ledgerRef, ledgerData);

      return {
        resolvedStatus,
        previousSubscriptionStatus: currentLocData.subscription_status ?? null,
        previousCommercialStatus: currentLocData.commercial_status ?? null,
      };
    });

    await writeLocationCommercialEvent({
      locationId,
      actorUserId: actorUid,
      type: decision === "APPROVED" ?
        "LOCATION_SUBSCRIPTION_RECEIPT_APPROVED" :
        "LOCATION_SUBSCRIPTION_RECEIPT_REJECTED",
      before: {
        subscription_status: review.previousSubscriptionStatus,
        commercial_status: review.previousCommercialStatus,
        payment_id: paymentId,
      },
      after: {
        subscription_status: review.resolvedStatus.subscriptionStatus,
        commercial_status: review.resolvedStatus.commercialStatus,
        payment_id: paymentId,
        review_status: decision,
        paid_cents: review.resolvedStatus.paidCents,
        open_balance_cents: review.resolvedStatus.openBalanceCents,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId,
      reviewStatus: decision,
      subscriptionStatus: review.resolvedStatus.subscriptionStatus,
    };
  }
);

export const assignLocationOwner = secureCallable<AssignLocationOwnerRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locOwner"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "assignLocationOwner",
      locationId: req.data?.locationId,
      newOwnerId: req.data?.newOwnerId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const newOwnerId = requireNonEmptyString(request.data.newOwnerId, "newOwnerId");
    const reason = optionalTrimmed(request.data.reason, 500);
    const {locRef, locData} = await getExistingLocation(locationId);
    const newOwnerDoc = await db().collection("users").doc(newOwnerId).get();
    if (!newOwnerDoc.exists) {
      throw new HttpsError("not-found", `User ${newOwnerId} not found`);
    }

    const previousOwnerId = typeof locData.owner_id === "string" ?
      locData.owner_id :
      null;
    if (previousOwnerId === newOwnerId) {
      return {success: true, locationId, ownerId: newOwnerId, changed: false};
    }

    await locRef.update({
      owner_id: newOwnerId,
      managers: FieldValue.arrayRemove(newOwnerId),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_OWNER_ASSIGNED",
      before: {owner_id: previousOwnerId},
      after: {owner_id: newOwnerId},
      reason,
    });

    return {success: true, locationId, ownerId: newOwnerId, changed: true};
  }
);

export const inviteLocationManager =
secureCallable<InviteLocationManagerRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locMgrInvite"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "inviteLocationManager",
      locationId: req.data?.locationId,
      managerUid: req.data?.managerUid,
      managerEmail: req.data?.managerEmail,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const managerUid = optionalTrimmed(request.data.managerUid, 128);
    const managerEmail = optionalEmail(request.data.managerEmail);
    if (!managerUid && !managerEmail) {
      throw new HttpsError(
        "invalid-argument",
        "managerUid or managerEmail is required"
      );
    }
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwner(request, locData);
    if (managerUid && managerUid === locData.owner_id) {
      throw new HttpsError("invalid-argument", "Owner cannot be invited as manager");
    }
    if (managerUid && Array.isArray(locData.managers) &&
      locData.managers.includes(managerUid)
    ) {
      return {success: true, locationId, inviteId: null, alreadyManager: true};
    }

    const inviteRef = locRef.collection("manager_invites").doc();
    await inviteRef.set({
      manager_uid: managerUid ?? null,
      manager_email: managerEmail,
      status: "PENDING",
      message: optionalTrimmed(request.data.message, 500),
      created_at: FieldValue.serverTimestamp(),
      created_by: request.auth.uid,
      expires_at: managerInviteExpiresAt(),
    });
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_MANAGER_INVITED",
      after: {
        invite_id: inviteRef.id,
        manager_uid: managerUid ?? null,
        manager_email: managerEmail,
      },
    });

    return {
      success: true,
      locationId,
      inviteId: inviteRef.id,
      alreadyManager: false,
    };
  }
);

export const acceptLocationManagerInvite =
secureCallable<AcceptLocationManagerInviteRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locMgrAccept"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "acceptLocationManagerInvite",
      locationId: req.data?.locationId,
      inviteId: req.data?.inviteId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const inviteId = requireNonEmptyString(request.data.inviteId, "inviteId");
    const {locRef, locData} = await getExistingLocation(locationId);
    const inviteRef = locRef.collection("manager_invites").doc(inviteId);
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) {
      throw new HttpsError("not-found", `Invite ${inviteId} not found`);
    }
    const inviteData = inviteDoc.data() || {};
    if (inviteData.status !== "PENDING") {
      throw new HttpsError("failed-precondition", "Invite is not pending");
    }
    const uidMatches = inviteData.manager_uid === request.auth.uid;
    const authEmail = typeof request.auth.token?.email === "string" ?
      request.auth.token.email.toLowerCase() :
      null;
    const emailMatches = Boolean(
      inviteData.manager_email && authEmail &&
      inviteData.manager_email === authEmail
    );
    if (!uidMatches && !emailMatches) {
      throw new HttpsError(
        "permission-denied",
        "Invite does not belong to this user"
      );
    }
    if (locData.owner_id === request.auth.uid) {
      throw new HttpsError("failed-precondition", "Owner is already the owner");
    }

    const batch = db().batch();
    batch.update(locRef, {
      managers: FieldValue.arrayUnion(request.auth.uid),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    batch.update(inviteRef, {
      status: "ACCEPTED",
      accepted_at: FieldValue.serverTimestamp(),
      accepted_by: request.auth.uid,
    });
    await batch.commit();
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_MANAGER_INVITE_ACCEPTED",
      after: {manager_uid: request.auth.uid, invite_id: inviteId},
    });

    return {success: true, locationId, managerUid: request.auth.uid};
  }
);

export const removeLocationManager =
secureCallable<RemoveLocationManagerRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    rateLimit: {maxRequests: 20, windowMs: 60000, keyPrefix: "locMgrRemove"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "removeLocationManager",
      locationId: req.data?.locationId,
      managerUid: req.data?.managerUid,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const locationId = requireNonEmptyString(request.data.locationId, "locationId");
    const managerUid = requireNonEmptyString(request.data.managerUid, "managerUid");
    const reason = optionalTrimmed(request.data.reason, 500);
    const {locRef, locData} = await getExistingLocation(locationId);
    assertAdminOrLocationOwner(request, locData);
    if (managerUid === locData.owner_id) {
      throw new HttpsError("invalid-argument", "Owner cannot be removed as manager");
    }

    await locRef.update({
      managers: FieldValue.arrayRemove(managerUid),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    });
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: "LOCATION_MANAGER_REMOVED",
      before: {manager_uid: managerUid},
      after: {manager_uid: null},
      reason,
    });

    return {success: true, locationId, managerUid};
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
