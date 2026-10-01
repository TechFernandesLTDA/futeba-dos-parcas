const VENUE_ACCOUNT_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "OVERDUE",
  "SUSPENDED",
  "CANCELLED",
] as const;

const VENUE_ACCOUNT_BILLING_SCOPES = [
  "OWNER",
  "LOCATION",
  "FIELD_COUNT",
  "MANUAL_OVERRIDE",
] as const;

const VENUE_ACCOUNT_PLAN_CODES = [
  "TRIAL",
  "BASIC",
  "PRO",
  "ENTERPRISE",
  "CUSTOM",
] as const;

const VENUE_ACCOUNT_BILLING_CYCLES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;

export type VenueAccountStatus = (typeof VENUE_ACCOUNT_STATUSES)[number];

/**
 * Default unico para `subscription_status`/`status` ausente ou invalido
 * (#4111). Antes cada leitor escolhia o seu: o cron cobrava como "ACTIVE",
 * o resolver comercial e a conta agregada tratavam como "TRIAL" (isento de
 * cobranca e sem data para envelhecer) — dado corrompido virava servico
 * gratuito invisivel.
 *
 * Decisao fail-closed: valor ausente/invalido cai em "ACTIVE", o unico
 * status que recebe escrutinio automatico em todos os caminhos —
 * o cron gera ciclo (ou registra a quadra em `inconsistentLocations`,
 * que agora alerta), o painel financeiro conta no MRR esperado e o
 * resolver comercial marca `subscriptionStatusInvalid`. "TRIAL" so seria
 * aceitavel com `trial_started_at` garantido, o que um doc sem status
 * tambem nao tem.
 */
export const DEFAULT_SUBSCRIPTION_STATUS: VenueAccountStatus = "ACTIVE";

/**
 * Idade maxima (dias) de um TRIAL antes de aparecer como pendencia
 * comercial (`trialExpired`). Decisao de produto (#4111): nao ha mudanca
 * automatica de status, apenas sinalizacao.
 */
export const TRIAL_MAX_DAYS = 30;
export type VenueAccountBillingScope =
  (typeof VENUE_ACCOUNT_BILLING_SCOPES)[number];
export type VenueAccountPlanCode = (typeof VENUE_ACCOUNT_PLAN_CODES)[number];
export type VenueAccountBillingCycle =
  (typeof VENUE_ACCOUNT_BILLING_CYCLES)[number];

export interface VenueAccountLocationSnapshot {
  id: string;
  ownerId: string | null;
  publicationStatus: string | null;
  fieldCount: number;
  activeFieldCount: number;
  monthlyFeeCents: number;
}

export interface VenueAccountCommercialConfig {
  status: VenueAccountStatus;
  billingScope: VenueAccountBillingScope;
  billingPlanCode?: VenueAccountPlanCode | null;
  billingPlanLabel?: string | null;
  billingCycle?: VenueAccountBillingCycle | null;
  billingBaseFeeCents?: number | null;
  defaultLocationFeeCents?: number | null;
  pricePerActiveFieldCents?: number | null;
  monthlyFeeOverrideCents?: number | null;
  billingDueDay?: number | null;
}

export interface VenueAccountMetrics {
  linkedLocationsCount: number;
  publishedLocationsCount: number;
  activeFieldCount: number;
  legacyMonthlyFeeTotalCents: number;
  computedMonthlyFeeCents: number;
}

export interface VenueAccountDenormalizedLocationFields {
  venue_account_id: string;
  venue_account_status: VenueAccountStatus;
  venue_account_charge_scope: VenueAccountBillingScope;
  venue_account_plan_code: VenueAccountPlanCode | null;
  venue_account_plan_label: string | null;
  venue_account_monthly_total_cents: number;
  venue_account_linked_locations_count: number;
  venue_account_active_fields_count: number;
}

/**
 * Valida status permitido da conta comercial.
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando o status e valido.
 */
export function isVenueAccountStatus(value: unknown): value is VenueAccountStatus {
  return typeof value === "string" &&
    VENUE_ACCOUNT_STATUSES.includes(value as VenueAccountStatus);
}

/**
 * Valida escopo de cobranca permitido.
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando o escopo e valido.
 */
export function isVenueAccountBillingScope(
  value: unknown
): value is VenueAccountBillingScope {
  return typeof value === "string" &&
    VENUE_ACCOUNT_BILLING_SCOPES.includes(value as VenueAccountBillingScope);
}

/**
 * Valida codigo de plano permitido.
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando o codigo e valido.
 */
export function isVenueAccountPlanCode(value: unknown): value is VenueAccountPlanCode {
  return typeof value === "string" &&
    VENUE_ACCOUNT_PLAN_CODES.includes(value as VenueAccountPlanCode);
}

/**
 * Valida ciclo de cobranca permitido.
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando o ciclo e valido.
 */
export function isVenueAccountBillingCycle(
  value: unknown
): value is VenueAccountBillingCycle {
  return typeof value === "string" &&
    VENUE_ACCOUNT_BILLING_CYCLES.includes(value as VenueAccountBillingCycle);
}

/**
 * Normaliza inteiro positivo opcional.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Inteiro positivo ou null.
 */
export function positiveIntegerOrNull(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 ?
    value :
    null;
}

/**
 * Normaliza valor monetario em centavos.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Inteiro >= 0 ou null.
 */
export function centsOrNull(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 ?
    value :
    null;
}

/**
 * Normaliza string nao vazia.
 * @param {unknown} value Valor bruto.
 * @return {string | null} Texto trimado ou null.
 */
export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve `subscription_status` (location) ou `status` (venue_account)
 * aplicando o default unico fail-closed (#4111). Todos os leitores —
 * resolver comercial, cron de cobranca, painel financeiro e conta agregada —
 * DEVEM usar este helper em vez de escolher o proprio fallback.
 * @param {unknown} value Valor bruto do documento.
 * @return {VenueAccountStatus} Status valido.
 */
export function resolveSubscriptionStatusOrDefault(
  value: unknown
): VenueAccountStatus {
  return isVenueAccountStatus(value) ? value : DEFAULT_SUBSCRIPTION_STATUS;
}

/**
 * Normaliza status da conta com fallback seguro.
 * @param {unknown} value Valor bruto.
 * @return {VenueAccountStatus} Status valido.
 */
export function normalizeVenueAccountStatus(value: unknown): VenueAccountStatus {
  return resolveSubscriptionStatusOrDefault(value);
}

/**
 * Converte Date/Timestamp Firestore em epoch ms, ou null quando invalido.
 * @param {unknown} value Valor bruto do documento.
 * @return {number | null} Epoch ms ou null.
 */
export function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (value && typeof value === "object" &&
    "toDate" in value &&
    typeof (value as {toDate: unknown}).toDate === "function"
  ) {
    const parsed = (value as {toDate: () => unknown}).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ?
      parsed.getTime() :
      null;
  }
  return null;
}

/**
 * Verifica se o contrato comercial ja venceu (#4107).
 * `billing_expires_at` no passado significa contrato encerrado: nao deve
 * gerar ciclo, nao deve voltar a ACTIVE e deve sair do fluxo de publicacao.
 * @param {unknown} billingExpiresAt Valor bruto de `billing_expires_at`.
 * @param {Date} now Instante de referencia.
 * @return {boolean} True quando a data existe e ja passou.
 */
export function isContractExpired(billingExpiresAt: unknown, now: Date): boolean {
  const expiresAtMs = toEpochMs(billingExpiresAt);
  return expiresAtMs !== null && expiresAtMs < now.getTime();
}

/**
 * Verifica se um TRIAL passou de `TRIAL_MAX_DAYS` (#4111).
 * @param {unknown} trialStartedAt Valor bruto de `trial_started_at`.
 * @param {Date} now Instante de referencia.
 * @return {boolean} True quando o trial e mais velho que o limite.
 */
export function isTrialAged(trialStartedAt: unknown, now: Date): boolean {
  const startedAtMs = toEpochMs(trialStartedAt);
  if (startedAtMs === null) return false;
  const maxAgeMs = TRIAL_MAX_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - startedAtMs > maxAgeMs;
}

/**
 * Normaliza escopo da conta com fallback seguro.
 * @param {unknown} value Valor bruto.
 * @return {VenueAccountBillingScope} Escopo valido.
 */
export function normalizeVenueAccountBillingScope(
  value: unknown
): VenueAccountBillingScope {
  return isVenueAccountBillingScope(value) ? value : "LOCATION";
}

/**
 * Normaliza codigo de plano opcional.
 * @param {unknown} value Valor bruto.
 * @return {VenueAccountPlanCode | null} Codigo valido ou null.
 */
export function normalizeVenueAccountPlanCode(
  value: unknown
): VenueAccountPlanCode | null {
  return isVenueAccountPlanCode(value) ? value : null;
}

/**
 * Normaliza ciclo de cobranca opcional.
 * @param {unknown} value Valor bruto.
 * @return {VenueAccountBillingCycle | null} Ciclo valido ou null.
 */
export function normalizeVenueAccountBillingCycle(
  value: unknown
): VenueAccountBillingCycle | null {
  return isVenueAccountBillingCycle(value) ? value : null;
}

/**
 * Normaliza status publico da quadra.
 * @param {unknown} value Status bruto.
 * @param {unknown} isVerified Flag legado de verificacao.
 * @return {string} Status coerente para a conta agregada.
 */
export function normalizeLocationPublicationStatus(
  value: unknown,
  isVerified?: unknown
): string {
  if (typeof value === "string" && value) return value;
  return isVerified === true ? "PUBLISHED" : "PENDING_REVIEW";
}

/**
 * Cria snapshot resumido da quadra para calculos comerciais agregados.
 * @param {object} params Dados normalizados/parciais da quadra.
 * @return {VenueAccountLocationSnapshot} Snapshot agregavel.
 */
export function buildVenueAccountLocationSnapshot(params: {
  id: string;
  ownerId: unknown;
  publicationStatus: unknown;
  isVerified?: unknown;
  fieldCount: unknown;
  activeFieldCount?: unknown;
  hasActiveFields?: unknown;
  monthlyFeeCents: unknown;
}): VenueAccountLocationSnapshot {
  const fieldCount = positiveIntegerOrNull(params.fieldCount) ?? 0;
  const explicitActiveFieldCount =
    positiveIntegerOrNull(params.activeFieldCount);
  const activeFieldCount = explicitActiveFieldCount ??
    (params.hasActiveFields === false ? 0 : fieldCount);
  return {
    id: params.id,
    ownerId: stringOrNull(params.ownerId),
    publicationStatus: normalizeLocationPublicationStatus(
      params.publicationStatus,
      params.isVerified
    ),
    fieldCount,
    activeFieldCount,
    monthlyFeeCents: centsOrNull(params.monthlyFeeCents) ?? 0,
  };
}

/**
 * Calcula metricas da conta comercial com base nas quadras vinculadas.
 * @param {VenueAccountCommercialConfig} config Configuracao comercial.
 * @param {VenueAccountLocationSnapshot[]} linkedLocations Quadras vinculadas.
 * @return {VenueAccountMetrics} Totais agregados calculados.
 */
export function computeVenueAccountMetrics(
  config: VenueAccountCommercialConfig,
  linkedLocations: VenueAccountLocationSnapshot[]
): VenueAccountMetrics {
  const linkedLocationsCount = linkedLocations.length;
  const publishedLocationsCount = linkedLocations.filter((location) =>
    location.publicationStatus === "PUBLISHED"
  ).length;
  const activeFieldCount = linkedLocations.reduce(
    (sum, location) => sum + location.activeFieldCount,
    0
  );
  const legacyMonthlyFeeTotalCents = linkedLocations.reduce(
    (sum, location) => sum + location.monthlyFeeCents,
    0
  );

  let computedMonthlyFeeCents = legacyMonthlyFeeTotalCents;
  if (config.billingScope === "OWNER") {
    computedMonthlyFeeCents =
      centsOrNull(config.monthlyFeeOverrideCents) ??
      centsOrNull(config.billingBaseFeeCents) ??
      legacyMonthlyFeeTotalCents;
  } else if (config.billingScope === "LOCATION") {
    const defaultLocationFee = centsOrNull(config.defaultLocationFeeCents);
    computedMonthlyFeeCents = defaultLocationFee !== null ?
      defaultLocationFee * linkedLocationsCount :
      legacyMonthlyFeeTotalCents;
  } else if (config.billingScope === "FIELD_COUNT") {
    const pricePerActiveField = centsOrNull(config.pricePerActiveFieldCents);
    computedMonthlyFeeCents = pricePerActiveField !== null ?
      pricePerActiveField * activeFieldCount :
      legacyMonthlyFeeTotalCents;
  } else if (config.billingScope === "MANUAL_OVERRIDE") {
    computedMonthlyFeeCents =
      centsOrNull(config.monthlyFeeOverrideCents) ??
      centsOrNull(config.billingBaseFeeCents) ??
      legacyMonthlyFeeTotalCents;
  }

  return {
    linkedLocationsCount,
    publishedLocationsCount,
    activeFieldCount,
    legacyMonthlyFeeTotalCents,
    computedMonthlyFeeCents,
  };
}

/**
 * Gera campos denormalizados que voltam para o documento da quadra.
 * @param {object} params Conta e metricas calculadas.
 * @return {VenueAccountDenormalizedLocationFields} Campos denormalizados.
 */
export function buildVenueAccountDenormalizedLocationFields(params: {
  accountId: string;
  config: VenueAccountCommercialConfig;
  metrics: VenueAccountMetrics;
}): VenueAccountDenormalizedLocationFields {
  return {
    venue_account_id: params.accountId,
    venue_account_status: params.config.status,
    venue_account_charge_scope: params.config.billingScope,
    venue_account_plan_code: params.config.billingPlanCode ?? null,
    venue_account_plan_label: params.config.billingPlanLabel ?? null,
    venue_account_monthly_total_cents: params.metrics.computedMonthlyFeeCents,
    venue_account_linked_locations_count: params.metrics.linkedLocationsCount,
    venue_account_active_fields_count: params.metrics.activeFieldCount,
  };
}

/**
 * Limpa denormalizacao da conta comercial nas quadras desvinculadas.
 * @return {Record<string, null>} Campos nulos para update.
 */
export function clearVenueAccountDenormalizedLocationFields() {
  return {
    venue_account_id: null,
    venue_account_status: null,
    venue_account_charge_scope: null,
    venue_account_plan_code: null,
    venue_account_plan_label: null,
    venue_account_monthly_total_cents: null,
    venue_account_linked_locations_count: null,
    venue_account_active_fields_count: null,
  };
}
