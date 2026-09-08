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
 * Normaliza status da conta distinguindo legado ausente de dado inválido.
 * @param {unknown} value Valor bruto.
 * @return {VenueAccountStatus} Status valido.
 */
export function normalizeVenueAccountStatus(value: unknown): VenueAccountStatus {
  if (value === null || value === undefined) return "ACTIVE";
  return isVenueAccountStatus(value) ? value : "SUSPENDED";
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
