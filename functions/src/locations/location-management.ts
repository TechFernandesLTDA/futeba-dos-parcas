import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
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
  monthly_fee_cents?: number | null;
  billing_due_day?: number | null;
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

interface LocationBillingAutomationResult {
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
  ledgerEntriesCreated: number;
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
const BILLING_SUMMARY_PAGE_SIZE = 500;
const BILLING_SUMMARY_PAYMENT_CONCURRENCY = 25;
const BILLING_AUTOMATION_LOCATION_LIMIT = 500;
const DEFAULT_BILLING_GRACE_DAYS = 5;
const DEFAULT_BILLING_SUSPENSION_DAYS = 15;
const LOCATION_SUBCOLLECTIONS = [
  "reviews",
  "fields",
  "availability",
  "audit_logs",
  "commercial_events",
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
  const ledgerRef = db()
    .collection("locations")
    .doc(locationId)
    .collection("subscription_ledger")
    .doc();
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
}): Promise<LocationBillingAutomationResult> {
  const now = params?.now || new Date();
  const periodKey = params?.periodKey ?
    requirePeriodKey(params.periodKey) :
    billingPeriodKeyForDate(now);
  const actorUserId = params?.actorUserId || "system:billing-automation";
  const locationsSnapshot = await db()
    .collection("locations")
    .limit(BILLING_AUTOMATION_LOCATION_LIMIT)
    .get();
  const result: LocationBillingAutomationResult = {
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
    ledgerEntriesCreated: 0,
  };

  for (const doc of locationsSnapshot.docs) {
    const locationId = doc.id || doc.ref?.id;
    const locData = doc.data() || {};
    if (!locationId) {
      result.skippedLocations += 1;
      continue;
    }

    const subscriptionStatus = typeof locData.subscription_status === "string" ?
      locData.subscription_status :
      "ACTIVE";
    if (subscriptionStatus === "CANCELLED") {
      result.skippedLocations += 1;
      continue;
    }

    const billingStartsAtIso = toIsoString(locData.billing_starts_at);
    if (billingStartsAtIso && new Date(billingStartsAtIso).getTime() > now.getTime()) {
      result.skippedLocations += 1;
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
      result.inconsistentLocations += 1;
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

  return result;
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
    retryCount: 3,
    maxRetrySeconds: 300,
  },
  async () => {
    const result = await processLocationBillingAutomation();
    logger.info("Location billing automation finished", result);
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
        const subscriptionStatus =
          typeof locData.subscription_status === "string" ?
            locData.subscription_status :
            "ACTIVE";
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
            monthlyFeeCents,
            billingDueDay: Number.isInteger(locData.billing_due_day) ?
              Number(locData.billing_due_day) :
              null,
            expectedCents,
            receivedCents: paymentTotals.receivedCents,
            openBalanceCents: Math.max(
              monthlyFeeCents - paymentTotals.receivedCents,
              0
            ),
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
    const hasMonthlyFee = request.data.monthlyFeeCents !== undefined;
    const hasBillingDueDay = request.data.billingDueDay !== undefined;
    const hasBillingStartsAt = request.data.billingStartsAtIso !== undefined;
    const hasBillingExpiresAt = request.data.billingExpiresAtIso !== undefined;
    const hasAdminNotes = request.data.adminNotes !== undefined;
    const {locRef, locData} = await getExistingLocation(locationId);
    const monthlyFeeCents = hasMonthlyFee ?
      request.data.monthlyFeeCents ?? null :
      locData.monthly_fee_cents ?? null;
    const billingDueDay = hasBillingDueDay ?
      request.data.billingDueDay ?? null :
      locData.billing_due_day ?? null;

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
    const adminNotes = hasAdminNotes ?
      optionalTrimmed(request.data.adminNotes, 2000) :
      null;
    const before = {
      subscription_status: locData.subscription_status ?? null,
      commercial_status: locData.commercial_status ?? null,
      monthly_fee_cents: locData.monthly_fee_cents ?? null,
      billing_due_day: locData.billing_due_day ?? null,
      billing_starts_at: locData.billing_starts_at ?? null,
      billing_expires_at: locData.billing_expires_at ?? null,
    };
    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      subscription_status: subscriptionStatus,
      commercial_status: subscriptionStatus,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };
    if (hasMonthlyFee) update.monthly_fee_cents = monthlyFeeCents;
    if (hasBillingDueDay) update.billing_due_day = billingDueDay;
    if (hasBillingStartsAt) update.billing_starts_at = billingStartsAt;
    if (hasBillingExpiresAt) update.billing_expires_at = billingExpiresAt;
    if (hasAdminNotes) update.admin_notes = adminNotes;

    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: "SUBSCRIPTION_STATUS_CHANGED",
        actor_user_id: request.auth.uid,
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: subscriptionStatus,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: subscriptionStatus,
        monthly_fee_cents: monthlyFeeCents,
        billing_due_day: billingDueDay,
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
        next_subscription_status: "ACTIVE",
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: "ACTIVE",
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
      subscription_status: "ACTIVE",
      commercial_status: "ACTIVE",
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
    const {locRef, locData} = await getExistingLocation(locationId);
    const paymentRef = locRef.collection("subscription_payments").doc(paymentId);
    const paymentDoc = await paymentRef.get();
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

    const batch = db().batch();
    const paymentUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      review_status: decision,
      status: decision,
      reviewed_at: FieldValue.serverTimestamp(),
      reviewed_by: request.auth.uid,
      review_notes: notes,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (decision === "APPROVED") {
      batch.update(paymentRef, paymentUpdate);
      batch.update(locRef, {
        subscription_status: "ACTIVE",
        commercial_status: "ACTIVE",
        last_payment_at: paymentData.paid_at ?? null,
        last_payment_amount_cents: paymentData.amount_cents ?? null,
        last_payment_period_key: paymentData.period_key ?? null,
        last_payment_id: paymentId,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: request.auth.uid,
      });
    } else {
      batch.update(paymentRef, paymentUpdate);
    }

    const {ledgerRef, data: ledgerData} = createSubscriptionLedgerRef(
      locationId,
      {
        type: decision === "APPROVED" ?
          "PAYMENT_RECEIPT_APPROVED" :
          "PAYMENT_RECEIPT_REJECTED",
        actor_user_id: request.auth.uid,
        amount_cents: typeof paymentData.amount_cents === "number" ?
          paymentData.amount_cents : null,
        period_key: typeof paymentData.period_key === "string" ?
          paymentData.period_key : null,
        payment_id: paymentId,
        method: typeof paymentData.method === "string" ? paymentData.method : null,
        review_status: decision,
        previous_subscription_status: locData.subscription_status ?? null,
        next_subscription_status: decision === "APPROVED" ? "ACTIVE" :
          locData.subscription_status ?? null,
        previous_commercial_status: locData.commercial_status ?? null,
        next_commercial_status: decision === "APPROVED" ? "ACTIVE" :
          locData.commercial_status ?? null,
        reason: notes,
        effective_at: paymentData.paid_at ?? FieldValue.serverTimestamp(),
      }
    );
    batch.set(ledgerRef, ledgerData);

    await batch.commit();
    await writeLocationCommercialEvent({
      locationId,
      actorUserId: request.auth.uid,
      type: decision === "APPROVED" ?
        "LOCATION_SUBSCRIPTION_RECEIPT_APPROVED" :
        "LOCATION_SUBSCRIPTION_RECEIPT_REJECTED",
      before: {
        subscription_status: locData.subscription_status ?? null,
        commercial_status: locData.commercial_status ?? null,
        payment_id: paymentId,
      },
      after: {
        subscription_status: decision === "APPROVED" ? "ACTIVE" :
          locData.subscription_status ?? null,
        commercial_status: decision === "APPROVED" ? "ACTIVE" :
          locData.commercial_status ?? null,
        payment_id: paymentId,
        review_status: decision,
      },
      reason: notes,
    });

    return {
      success: true,
      locationId,
      paymentId,
      reviewStatus: decision,
      subscriptionStatus: decision === "APPROVED" ? "ACTIVE" :
        locData.subscription_status ?? null,
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
