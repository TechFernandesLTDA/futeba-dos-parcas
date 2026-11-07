import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {db} from "../_db";

export interface DeleteLocationRequest {
  locationId: string;
}

export const PUBLICATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "SUSPENDED",
  "REJECTED",
] as const;

export const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "OVERDUE",
  "SUSPENDED",
  "CANCELLED",
] as const;

export const BILLING_PLAN_CODES = [
  "TRIAL",
  "BASIC",
  "PRO",
  "ENTERPRISE",
  "CUSTOM",
] as const;

export const BILLING_CYCLES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;

export const COMMERCIAL_REQUEST_TYPES = [
  "PUBLICATION",
  "COMMERCIAL_UPDATE",
] as const;

export const FIELD_TYPES = [
  "SOCIETY",
  "FUTSAL",
  "CAMPO",
  "AREIA",
  "OUTROS",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export type CommercialRequestType = (typeof COMMERCIAL_REQUEST_TYPES)[number];
export type FieldType = (typeof FIELD_TYPES)[number];
export type CommercialRequestStatus =
  "PENDING_REVIEW" |
  "NEEDS_CHANGES" |
  "APPROVED" |
  "REJECTED";

export interface SetLocationPublicationStatusRequest {
  locationId: string;
  publicationStatus: PublicationStatus;
  reason?: string;
}

export interface SetLocationSubscriptionRequest {
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

export interface VenueAccountRowProjection {
  venueAccountId: string | null;
  venueAccountStatus: string | null;
  venueAccountChargeScope: string | null;
  venueAccountPlanCode: string | null;
  venueAccountPlanLabel: string | null;
  venueAccountMonthlyTotalCents: number | null;
  venueAccountLinkedLocationsCount: number | null;
  venueAccountActiveFieldsCount: number | null;
}

export interface RegisterLocationSubscriptionPaymentRequest {
  locationId: string;
  amountCents: number;
  periodKey: string;
  paidAtIso?: string | null;
  method?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
}

export interface SubmitLocationSubscriptionReceiptRequest {
  locationId: string;
  amountCents: number;
  periodKey: string;
  paidAtIso?: string | null;
  method?: string | null;
  receiptStoragePath: string;
  notes?: string | null;
}

export interface ReviewLocationSubscriptionReceiptRequest {
  locationId: string;
  paymentId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string | null;
}

export interface RequestLocationCommercialReviewRequest {
  locationId: string;
  requestType: CommercialRequestType;
  requestedSections?: string[] | null;
  notes?: string | null;
}

export interface ReviewLocationCommercialRequest {
  locationId: string;
  requestId: string;
  decision: Exclude<CommercialRequestStatus, "PENDING_REVIEW">;
  notes?: string | null;
}

export interface LocationSubscriptionLedgerEntry {
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

export interface AssignLocationOwnerRequest {
  locationId: string;
  newOwnerId: string;
  reason?: string | null;
}

export interface InviteLocationManagerRequest {
  locationId: string;
  managerUid?: string | null;
  managerEmail?: string | null;
  message?: string | null;
}

export interface AcceptLocationManagerInviteRequest {
  locationId: string;
  inviteId: string;
}

export interface RemoveLocationManagerRequest {
  locationId: string;
  managerUid: string;
  reason?: string | null;
}

export interface GetAdminLocationBillingSummaryRequest {
  periodKey?: string | null;
}

export interface RunLocationBillingAutomationRequest {
  periodKey?: string | null;
}

export interface RecomputeLocationAggregatesRequest {
  locationId?: string | null;
  limit?: number | null;
  startAfterId?: string | null;
}

export interface LocationBillingAutomationResult {
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

export interface CalculateAutoRatingsRequest {
  userId: string;
}

export interface AutoRatingsForUser {
  auto_striker_rating: number;
  auto_mid_rating: number;
  auto_defender_rating: number;
  auto_gk_rating: number;
  auto_rating_samples: number;
  auto_rating_updated_at: FirebaseFirestore.FieldValue;
}

export interface RecalculateAllAutoRatingsRequest {
  batchSize?: number;
}

export const DELETE_BATCH_SIZE = 500;
export const MANAGER_INVITE_TTL_DAYS = 14;
export const LOCATION_AGGREGATE_GAME_LIMIT = 1000;
export const LOCATION_AGGREGATE_REVIEW_LIMIT = 1000;
export const LOCATION_AGGREGATE_REBUILD_LIMIT = 500;
export const ACTIVE_GAME_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "LIVE"]);
export const FINISHED_GAME_STATUSES = new Set(["FINISHED"]);
export const BILLING_SUMMARY_PAGE_SIZE = 500;
export const BILLING_SUMMARY_PAYMENT_CONCURRENCY = 25;
export const BILLING_AUTOMATION_MAX_RUN_MS = 480_000;
export const DEFAULT_BILLING_GRACE_DAYS = 5;
export const DEFAULT_BILLING_SUSPENSION_DAYS = 15;
/** Maximo de IDs por lista no resultado/doc de execucao do cron de cobranca (#4111). */
export const BILLING_AUTOMATION_ID_LIST_CAP = 200;
/** Colecao com um doc por execucao do cron de cobranca (#4111). */
export const BILLING_AUTOMATION_RUNS_COLLECTION = "billing_automation_runs";
export const LOCATION_SUBCOLLECTIONS = [
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
export function requireNonEmptyString(value: unknown, field: string): string {
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
export function requirePeriodKey(value: unknown): string {
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
export function optionalTrimmed(value: unknown, maxLength: number): string | null {
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
export function optionalEmail(value: unknown): string | null {
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
export function normalizeStringArray(
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
export function parseOptionalIsoDate(value: unknown, field: string): Date | null {
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
export function toIsoString(value: unknown): string | null {
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
export function currentBillingPeriodKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Periodo comercial de uma data no formato AAAA-MM.
 * @param {Date} date Data base.
 * @return {string} Periodo em UTC.
 */
export function billingPeriodKeyForDate(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Retorna o ultimo dia do mes UTC.
 * @param {number} year Ano UTC.
 * @param {number} month Mes UTC no intervalo 1-12.
 * @return {number} Quantidade de dias.
 */
export function daysInUtcMonth(year: number, month: number): number {
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
export function boundedInteger(
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
export function buildBillingCycleDates(
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
export function positiveCents(value: unknown): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

/**
 * Valida enum string vindo do cliente.
 * @param {unknown} value Valor bruto recebido.
 * @param {Array<string>} values Valores permitidos.
 * @param {string} field Nome do campo para mensagem de erro.
 * @return {string} Valor validado.
 */
export function requireEnum<T extends readonly string[]>(
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
export async function getExistingLocation(locationId: string) {
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
export function assertAdminOrLocationOwner(
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
export function assertAdmin(
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
export function assertAdminOrLocationOwnerForReceipt(
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
export function requireLocationReceiptStoragePath(
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
export function getLocationPhotos(
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
export function getFieldHourlyPrice(fieldData: FirebaseFirestore.DocumentData): number {
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
export function isFieldActive(fieldData: FirebaseFirestore.DocumentData): boolean {
  if (typeof fieldData.is_active === "boolean") return fieldData.is_active;
  if (typeof fieldData.isActive === "boolean") return fieldData.isActive;
  return true;
}

/**
 * Carrega campos da quadra nas estruturas raiz e aninhada sem duplicar IDs.
 * @param {string} locationId ID da location.
 * @return {Promise<FirebaseFirestore.DocumentData[]>} Lista consolidada.
 */
export async function getLocationFields(
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
export function normalizeFieldType(value: unknown): FieldType {
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
export function normalizeAmenity(value: unknown): string | null {
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
export function dateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value &&
    typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return null;
}

/**
 * Calcula expiracao padrao de convite de manager.
 * @return {Date} Data de expiracao.
 */
export function managerInviteExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MANAGER_INVITE_TTL_DAYS);
  return expiresAt;
}

/**
 * Escreve evento comercial imutavel na location e no audit global.
 * @param {object} params Dados do evento comercial.
 * @return {Promise<void>} Promessa resolvida apos gravacao.
 */
export async function writeLocationCommercialEvent(params: {
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
export function createSubscriptionLedgerRef(
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
 * Adiciona ID a uma lista bounded do resultado do cron (#4111).
 * @param {string[]} list Lista alvo.
 * @param {string} id ID da quadra.
 */
export function pushBoundedLocationId(list: string[], id: string): void {
  if (list.length < BILLING_AUTOMATION_ID_LIST_CAP) list.push(id);
}

/**
 * Divide uma lista em chunks para controlar paralelismo de leituras.
 * @param {Array<T>} items Lista original.
 * @param {number} size Tamanho maximo por chunk.
 * @return {Array<Array<T>>} Chunks.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
