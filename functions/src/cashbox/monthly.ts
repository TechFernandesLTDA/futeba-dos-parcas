import {createHash} from "crypto";
import * as functions from "firebase-functions/v2";
import {FieldPath, FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {isActiveGroupManager} from "./callable";
import {
  CASHBOX_MAX_AMOUNT_CENTS,
  cashboxAmountToCents,
  centsToCashboxAmount,
} from "./money";
import {
  CashboxSummaryState,
  cashboxOperationExpiresAt,
  cashboxSummaryPayload,
  cashboxSummaryState,
} from "./summary";
import {RATE_LIMITS} from "../middleware/rate-limiter";
import {secureCallable} from "../middleware/secure-callable-wrapper";

export type MonthlyPricingMode = "FIXED_MONTHLY" | "PER_GAME";
export type MonthlyPeriodStatus = "DRAFT" | "FINALIZED" | "CLOSED";
export type MonthlyPayerStatus = "PENDING" | "PARTIAL" | "PAID" | "REMOVED";

export const MONTHLY_CALCULATION_VERSION = 2;
export const MAX_MONTHLY_ROSTER_SIZE = 200;
export const MAX_MONTHLY_GAMES_PER_PERIOD = 100;
export const MAX_GROUP_MEMBERS_FOR_MONTHLY = 300;
export const MAX_MONTHLY_SCHEDULES = 100;
export const MAX_MONTHLY_RECURRING_SOURCE_GAMES = 300;

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const INCLUDED_GAME_STATUSES = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "LIVE",
  "FINISHED",
]);
const MONTHLY_TIMEZONE = "America/Sao_Paulo";

/**
 * Enriquece o audit log do secureCallable sem confiar nos dados para autorizar
 * a operação. A validação autoritativa continua dentro de cada handler.
 *
 * @param {string} action Operação financeira executada.
 * @return {Function} Extrator seguro de contexto de auditoria.
 */
function monthlyAuditContext(action: string) {
  return async (request: functions.https.CallableRequest) => {
    const data = request.data && typeof request.data === "object" ?
      request.data as Record<string, unknown> : {};
    return {
      action,
      group_id: typeof data.groupId === "string" ? data.groupId : null,
      period_key: typeof data.periodKey === "string" ? data.periodKey : null,
      target_user_id: typeof data.targetUserId === "string" ?
        data.targetUserId : null,
      occurrence_id: typeof data.occurrenceId === "string" ?
        data.occurrenceId : null,
      client_request_id: typeof data.requestId === "string" ?
        data.requestId : null,
    };
  };
}

interface ConfigureMonthlyFinanceData {
  groupId: string;
  pricingMode: MonthlyPricingMode;
  fixedMonthlyCostCents?: number | null;
  defaultGameCostCents?: number | null;
}

interface SetMonthlyMemberData {
  groupId: string;
  targetUserId: string;
  isMonthly: boolean;
}

interface RebuildMonthlyCycleData {
  groupId: string;
  periodKey: string;
}

interface SettleMonthlyChargeData {
  groupId: string;
  periodKey: string;
  targetUserId: string;
  requestId: string;
  amountCents?: number | null;
}

interface SetMonthlyGameOverrideData {
  groupId: string;
  periodKey: string;
  occurrenceId: string;
  excluded: boolean;
  costCents?: number | null;
  reason?: string | null;
}

export type MonthlyGameSource = "GAME" | "SCHEDULE" | "RECURRENCE";

export interface MonthlyGameOverride {
  excluded: boolean;
  costCents: number | null;
  reason: string | null;
}

export interface MonthlyGameInput {
  id: string;
  date: string;
  status: string;
  courtCostCents?: number | null;
  explicitlyExcluded?: boolean;
  gameId?: string | null;
  source?: MonthlyGameSource;
  scheduleId?: string | null;
  seriesId?: string | null;
  label?: string | null;
  recurrence?: string | null;
  recurrenceIndex?: number | null;
  recurrenceCount?: number | null;
  recurrenceEndDate?: string | null;
  recurrenceCancelled?: boolean;
  manualOverride?: MonthlyGameOverride | null;
}

export interface MonthlyScheduleInput {
  id: string;
  active: boolean;
  recurrenceType: string;
  dayOfWeek: number;
  anchorDate: string | null;
  endDate?: string | null;
  exceptions: string[];
  courtCostCents?: number | null;
  label?: string | null;
}

export interface BuildMonthlyCalendarInput {
  periodKey: string;
  games: MonthlyGameInput[];
  schedules: MonthlyScheduleInput[];
  overrides?: Map<string, MonthlyGameOverride>;
}

export interface MonthlyGameSnapshot {
  id: string;
  date: string;
  status: string;
  courtCostCents: number | null;
  baseCourtCostCents: number | null;
  allocatedCostCents: number;
  included: boolean;
  exclusionReason: "CANCELLED_OR_DELETED" |
    "EXPLICIT_EXCLUSION" |
    "UNSUPPORTED_STATUS" |
    null;
  baseExplicitlyExcluded: boolean;
  gameId: string | null;
  source: MonthlyGameSource;
  scheduleId: string | null;
  seriesId: string | null;
  label: string | null;
  manualOverride: MonthlyGameOverride | null;
}

export interface MonthlyChargeCalculation {
  userId: string;
  expectedCents: number;
}

export interface CalculateMonthlyPeriodInput {
  periodKey: string;
  pricingMode: MonthlyPricingMode;
  fixedMonthlyCostCents?: number | null;
  defaultGameCostCents?: number | null;
  monthlyMemberIds: string[];
  groupMemberCount: number;
  games: MonthlyGameInput[];
}

export interface MonthlyPeriodCalculation {
  periodKey: string;
  pricingMode: MonthlyPricingMode;
  totalCourtCostCents: number;
  gameCount: number;
  excludedGameCount: number;
  groupMemberCount: number;
  monthlyMemberCount: number;
  averagePerGameCents: number | null;
  averagePerMonthlyMemberCents: number | null;
  games: MonthlyGameSnapshot[];
  charges: MonthlyChargeCalculation[];
  calculationHash: string;
}

export interface SettlementCalculation {
  amountCents: number;
  paidCents: number;
  outstandingCents: number;
  status: "PARTIAL" | "PAID";
}

export type CycleRebuildDecision = "CREATE" | "REPLAY" | "REBUILD" | "LOCKED";

/**
 * Divide um total em centavos sem perda, com o resto atribuído por UID/ID.
 * @param {number} totalCents Total autoritativo em centavos.
 * @param {string[]} ids Identificadores únicos dos destinatários.
 * @return {Map<string, number>} Rateio exato por identificador.
 */
export function allocateMonthlyCents(
  totalCents: number,
  ids: string[]
): Map<string, number> {
  assertCents(totalCents, "totalCents");
  const stableIds = [...ids].sort((left, right) => left.localeCompare(right));
  if (new Set(stableIds).size !== stableIds.length ||
      stableIds.some((id) => !isSafeDocumentId(id))) {
    throw new Error("Os identificadores do rateio devem ser únicos e válidos.");
  }

  const result = new Map<string, number>();
  if (stableIds.length === 0) return result;
  const base = Math.floor(totalCents / stableIds.length);
  const remainder = totalCents % stableIds.length;
  stableIds.forEach((id, index) => {
    result.set(id, base + (index < remainder ? 1 : 0));
  });
  return result;
}

/**
 * Calcula um período mensal de forma pura, determinística e em centavos.
 * @param {CalculateMonthlyPeriodInput} input Snapshot financeiro do período.
 * @return {MonthlyPeriodCalculation} Totais, jogos e rateios exatos.
 */
export function calculateMonthlyPeriod(
  input: CalculateMonthlyPeriodInput
): MonthlyPeriodCalculation {
  assertPeriodKey(input.periodKey);
  if (input.pricingMode !== "FIXED_MONTHLY" &&
      input.pricingMode !== "PER_GAME") {
    throw new Error("pricingMode inválido.");
  }
  if (!Number.isSafeInteger(input.groupMemberCount) ||
      input.groupMemberCount < 0 ||
      input.groupMemberCount > MAX_GROUP_MEMBERS_FOR_MONTHLY) {
    throw new Error("groupMemberCount inválido.");
  }
  if (input.monthlyMemberIds.length > MAX_MONTHLY_ROSTER_SIZE) {
    throw new Error("Quantidade de mensalistas excede o limite seguro.");
  }

  const monthlyIds = [...input.monthlyMemberIds]
    .sort((left, right) => left.localeCompare(right));
  if (new Set(monthlyIds).size !== monthlyIds.length ||
      monthlyIds.some((id) => !isSafeDocumentId(id))) {
    throw new Error("Cada mensalista deve ter um UID único e válido.");
  }
  if (monthlyIds.length > input.groupMemberCount) {
    throw new Error("Mensalistas não podem exceder os membros ativos do grupo.");
  }
  if (input.games.length > MAX_MONTHLY_GAMES_PER_PERIOD) {
    throw new Error("Quantidade de jogos excede o limite seguro do período.");
  }

  const gameIds = new Set<string>();
  const normalizedGames = input.games.map((game) => {
    if (!isSafeDocumentId(game.id) || gameIds.has(game.id)) {
      throw new Error("Cada jogo deve ter um ID único e válido.");
    }
    gameIds.add(game.id);
    assertDateInPeriod(game.date, input.periodKey);
    const status = game.status.trim().toUpperCase();
    const source = normalizeMonthlyGameSource(game.source);
    const baseCourtCostCents = game.courtCostCents == null ?
      null :
      assertCents(game.courtCostCents, `courtCostCents do jogo ${game.id}`);
    const manualOverride = normalizeMonthlyGameOverride(game.manualOverride);
    const effectiveCourtCostCents = manualOverride?.costCents ??
      baseCourtCostCents;
    let exclusionReason: MonthlyGameSnapshot["exclusionReason"] = null;
    if (status === "CANCELLED" || status === "DELETED") {
      exclusionReason = "CANCELLED_OR_DELETED";
    } else if ((manualOverride ? manualOverride.excluded :
      game.explicitlyExcluded === true)) {
      exclusionReason = "EXPLICIT_EXCLUSION";
    } else if (!INCLUDED_GAME_STATUSES.has(status)) {
      exclusionReason = "UNSUPPORTED_STATUS";
    }
    return {
      ...game,
      status,
      source,
      baseCourtCostCents,
      courtCostCents: effectiveCourtCostCents,
      manualOverride,
      exclusionReason,
      included: exclusionReason === null,
    };
  }).sort((left, right) =>
    left.date.localeCompare(right.date) || left.id.localeCompare(right.id)
  );

  const includedGames = normalizedGames.filter((game) => game.included);
  let totalCourtCostCents = 0;
  if (input.pricingMode === "FIXED_MONTHLY") {
    totalCourtCostCents = assertCents(
      input.fixedMonthlyCostCents,
      "fixedMonthlyCostCents"
    );
  } else {
    const defaultCost = input.defaultGameCostCents == null ?
      null :
      assertCents(input.defaultGameCostCents, "defaultGameCostCents");
    totalCourtCostCents = includedGames.reduce((total, game) => {
      const gameCost = game.courtCostCents == null ?
        defaultCost :
        assertCents(game.courtCostCents, `courtCostCents do jogo ${game.id}`);
      if (gameCost == null) {
        throw new Error(
          `O jogo ${game.id} não tem courtCostCents nem custo padrão.`
        );
      }
      return assertCents(total + gameCost, "totalCourtCostCents");
    }, 0);
  }

  if (totalCourtCostCents > 0 && monthlyIds.length === 0) {
    throw new Error("Não há mensalistas ativos para ratear o período.");
  }
  if (totalCourtCostCents > 0 && includedGames.length === 0) {
    throw new Error("Não há jogos incluídos para cobrar este período.");
  }
  const gameAllocation = allocateMonthlyCents(
    totalCourtCostCents,
    includedGames.map((game) => game.id)
  );
  const chargeAllocation = allocateMonthlyCents(totalCourtCostCents, monthlyIds);
  const gameSnapshots: MonthlyGameSnapshot[] = normalizedGames.map((game) => {
    let allocatedCostCents = 0;
    if (game.included) {
      allocatedCostCents = input.pricingMode === "FIXED_MONTHLY" ?
        gameAllocation.get(game.id) ?? 0 :
        assertCents(
          game.courtCostCents ?? input.defaultGameCostCents,
          `courtCostCents do jogo ${game.id}`
        );
    }
    return {
      id: game.id,
      date: game.date,
      status: game.status,
      courtCostCents: game.courtCostCents,
      baseCourtCostCents: game.baseCourtCostCents,
      allocatedCostCents,
      included: game.included,
      exclusionReason: game.exclusionReason,
      baseExplicitlyExcluded: game.explicitlyExcluded === true,
      gameId: optionalSafeId(game.gameId),
      source: game.source,
      scheduleId: optionalSafeId(game.scheduleId),
      seriesId: optionalSafeId(game.seriesId),
      label: normalizeLabel(game.label),
      manualOverride: game.manualOverride,
    };
  });
  const charges = monthlyIds.map((userId) => ({
    userId,
    expectedCents: chargeAllocation.get(userId) ?? 0,
  }));
  const hashPayload = {
    calculationVersion: MONTHLY_CALCULATION_VERSION,
    periodKey: input.periodKey,
    pricingMode: input.pricingMode,
    totalCourtCostCents,
    games: gameSnapshots.map((game) => ({
      id: game.id,
      date: game.date,
      status: game.status,
      courtCostCents: game.courtCostCents,
      baseCourtCostCents: game.baseCourtCostCents,
      allocatedCostCents: game.allocatedCostCents,
      included: game.included,
      exclusionReason: game.exclusionReason,
      baseExplicitlyExcluded: game.baseExplicitlyExcluded,
      gameId: game.gameId,
      source: game.source,
      scheduleId: game.scheduleId,
      seriesId: game.seriesId,
      label: game.label,
      manualOverride: game.manualOverride,
    })),
    charges,
  };

  return {
    periodKey: input.periodKey,
    pricingMode: input.pricingMode,
    totalCourtCostCents,
    gameCount: includedGames.length,
    excludedGameCount: normalizedGames.length - includedGames.length,
    groupMemberCount: input.groupMemberCount,
    monthlyMemberCount: monthlyIds.length,
    averagePerGameCents: includedGames.length > 0 ?
      Math.round(totalCourtCostCents / includedGames.length) :
      null,
    averagePerMonthlyMemberCents: monthlyIds.length > 0 ?
      Math.round(totalCourtCostCents / monthlyIds.length) :
      null,
    games: gameSnapshots,
    charges,
    calculationHash: createHash("sha256")
      .update(JSON.stringify(hashPayload))
      .digest("hex"),
  };
}

/**
 * Expande o calendário civil completo da competência antes do rateio.
 * Jogos materializados substituem a ocorrência planejada do schedule/série.
 * @param {BuildMonthlyCalendarInput} input Jogos, schedules e overrides.
 * @return {MonthlyGameInput[]} Ocorrências únicas e determinísticas do mês.
 */
export function buildMonthlyCalendar(
  input: BuildMonthlyCalendarInput
): MonthlyGameInput[] {
  assertPeriodKey(input.periodKey);
  const periodStart = `${input.periodKey}-01`;
  const periodEnd = `${nextPeriod(input.periodKey)}-01`;
  if (input.schedules.length > MAX_MONTHLY_SCHEDULES) {
    throw new Error("Quantidade de schedules excede o limite seguro.");
  }
  if (input.games.length >
      MAX_MONTHLY_GAMES_PER_PERIOD + MAX_MONTHLY_RECURRING_SOURCE_GAMES) {
    throw new Error("Quantidade de fontes recorrentes excede o limite seguro.");
  }

  const scheduleById = new Map(
    input.schedules.map((schedule) => [schedule.id, schedule])
  );
  const actualMatchKeys = new Set<string>();
  const actualByOccurrence = new Map<string, MonthlyGameInput>();
  const gamesById = new Map<string, MonthlyGameInput>();
  input.games.forEach((game) => {
    if (!isSafeDocumentId(game.id)) {
      throw new Error("Jogo fonte possui ID inválido.");
    }
    gamesById.set(game.gameId ?? game.id, game);
  });

  [...gamesById.values()]
    .filter((game) => game.date >= periodStart && game.date < periodEnd)
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.id.localeCompare(right.id)
    )
    .forEach((game) => {
      assertDateInPeriod(game.date, input.periodKey);
      const scheduleId = optionalSafeId(game.scheduleId);
      const seriesId = optionalSafeId(game.seriesId);
      if (scheduleId) actualMatchKeys.add(`schedule:${scheduleId}:${game.date}`);
      if (seriesId) actualMatchKeys.add(`series:${seriesId}:${game.date}`);
      const source: MonthlyGameSource = scheduleId ?
        "SCHEDULE" :
        seriesId ? "RECURRENCE" : "GAME";
      const occurrenceId = scheduleId ?
        plannedOccurrenceId("schedule", scheduleId, game.date) :
        seriesId ? plannedOccurrenceId("series", seriesId, game.date) : game.id;
      if (actualByOccurrence.has(occurrenceId)) return;
      const schedule = scheduleId ? scheduleById.get(scheduleId) : undefined;
      const isScheduleException = schedule?.exceptions.includes(game.date) === true;
      actualByOccurrence.set(occurrenceId, {
        ...game,
        id: occurrenceId,
        gameId: optionalSafeId(game.gameId) ?? game.id,
        source,
        scheduleId,
        seriesId,
        label: normalizeLabel(game.label) ?? normalizeLabel(schedule?.label),
        explicitlyExcluded: game.explicitlyExcluded === true ||
          isScheduleException,
        manualOverride: input.overrides?.get(occurrenceId) ??
          game.manualOverride ?? null,
      });
    });

  const planned: MonthlyGameInput[] = [];
  input.schedules
    .filter((schedule) => schedule.active)
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((schedule) => {
      if (!isSafeDocumentId(schedule.id)) {
        throw new Error("Schedule possui ID inválido.");
      }
      for (const date of expandScheduleDates(schedule, input.periodKey)) {
        const matchKey = `schedule:${schedule.id}:${date}`;
        if (actualMatchKeys.has(matchKey)) continue;
        const id = plannedOccurrenceId("schedule", schedule.id, date);
        planned.push({
          id,
          date,
          status: "SCHEDULED",
          courtCostCents: schedule.courtCostCents ?? null,
          explicitlyExcluded: schedule.exceptions.includes(date),
          gameId: null,
          source: "SCHEDULE",
          scheduleId: schedule.id,
          seriesId: null,
          label: normalizeLabel(schedule.label),
          manualOverride: input.overrides?.get(id) ?? null,
        });
      }
    });

  const series = new Map<string, MonthlyGameInput[]>();
  [...gamesById.values()].forEach((game) => {
    if (!normalizeRecurrenceType(game.recurrence)) return;
    const seriesId = optionalSafeId(game.seriesId) ?? game.id;
    const current = series.get(seriesId) ?? [];
    current.push({...game, seriesId});
    series.set(seriesId, current);
  });
  [...series.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([seriesId, sources]) => {
      for (const occurrence of expandRecurringSeries(
        seriesId,
        sources,
        input.periodKey
      )) {
        const matchKey = `series:${seriesId}:${occurrence.date}`;
        if (actualMatchKeys.has(matchKey)) continue;
        const id = plannedOccurrenceId("series", seriesId, occurrence.date);
        planned.push({
          ...occurrence,
          id,
          gameId: null,
          source: "RECURRENCE",
          scheduleId: null,
          seriesId,
          manualOverride: input.overrides?.get(id) ?? null,
        });
      }
    });

  const all = [...actualByOccurrence.values(), ...planned]
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.id.localeCompare(right.id)
    );
  const unique = new Map<string, MonthlyGameInput>();
  all.forEach((game) => {
    if (!unique.has(game.id)) unique.set(game.id, game);
  });
  if (unique.size > MAX_MONTHLY_GAMES_PER_PERIOD) {
    throw new Error("Quantidade de jogos excede o limite seguro do período.");
  }
  return [...unique.values()];
}

/**
 * Expande um schedule ativo dentro de uma competência civil.
 * @param {MonthlyScheduleInput} schedule Schedule normalizado.
 * @param {string} periodKey Competência AAAA-MM.
 * @return {string[]} Datas planejadas em ordem crescente.
 */
export function expandScheduleDates(
  schedule: MonthlyScheduleInput,
  periodKey: string
): string[] {
  assertPeriodKey(periodKey);
  if (!Number.isInteger(schedule.dayOfWeek) ||
      schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
    throw new Error(`day_of_week inválido no schedule ${schedule.id}.`);
  }
  const recurrence = normalizeRecurrenceType(schedule.recurrenceType);
  if (!recurrence) {
    throw new Error(`recurrence_type inválido no schedule ${schedule.id}.`);
  }
  const periodStart = `${periodKey}-01`;
  const periodEnd = `${nextPeriod(periodKey)}-01`;
  const anchor = normalizeCivilDate(schedule.anchorDate) ?? periodStart;
  const endDate = normalizeCivilDate(schedule.endDate);
  if (anchor >= periodEnd || (endDate && endDate < periodStart)) return [];

  const dates: string[] = [];
  if (recurrence === "monthly") {
    const anchorOccurrence = weekdayOnOrAfter(anchor, schedule.dayOfWeek);
    const ordinal = Math.min(5, Math.ceil(Number(anchorOccurrence.slice(8)) / 7));
    const monthlyDate = nthWeekdayOfMonth(
      periodKey,
      schedule.dayOfWeek,
      ordinal
    );
    if (monthlyDate && monthlyDate >= anchor &&
        (!endDate || monthlyDate <= endDate)) {
      dates.push(monthlyDate);
    }
    return dates;
  }

  const interval = recurrence === "weekly" ? 7 : 14;
  let candidate = weekdayOnOrAfter(anchor, schedule.dayOfWeek);
  let steps = 0;
  while (candidate < periodStart) {
    candidate = addCivilDays(candidate, interval);
    if (++steps > 6000) throw new Error("Schedule antigo demais para expansão.");
  }
  while (candidate < periodEnd && (!endDate || candidate <= endDate)) {
    dates.push(candidate);
    candidate = addCivilDays(candidate, interval);
    if (++steps > 6000) throw new Error("Schedule excede o limite de expansão.");
  }
  return dates;
}

/**
 * Expande a parte ainda não materializada de uma série recorrente.
 * @param {string} seriesId ID raiz da série.
 * @param {MonthlyGameInput[]} sources Ocorrências persistidas da série.
 * @param {string} periodKey Competência AAAA-MM.
 * @return {MonthlyGameInput[]} Ocorrências planejadas na competência.
 */
export function expandRecurringSeries(
  seriesId: string,
  sources: MonthlyGameInput[],
  periodKey: string
): MonthlyGameInput[] {
  assertPeriodKey(periodKey);
  if (!isSafeDocumentId(seriesId) || sources.length === 0) return [];
  const ordered = [...sources].sort((left, right) => {
    const leftIndex = positiveInteger(left.recurrenceIndex) ?? 1;
    const rightIndex = positiveInteger(right.recurrenceIndex) ?? 1;
    return leftIndex - rightIndex || left.date.localeCompare(right.date);
  });
  const anchor = ordered[0];
  const recurrence = normalizeRecurrenceType(anchor.recurrence);
  const anchorDate = normalizeCivilDate(anchor.date);
  if (!recurrence || !anchorDate) return [];
  let index = positiveInteger(anchor.recurrenceIndex) ?? 1;
  const count = ordered.map((item) => positiveInteger(item.recurrenceCount))
    .find((value): value is number => value != null) ?? null;
  const endDate = ordered.map((item) => normalizeCivilDate(
    item.recurrenceEndDate
  )).find((value): value is string => value != null) ?? null;
  const cancelledAfter = ordered
    .filter((item) => item.recurrenceCancelled === true)
    .map((item) => normalizeCivilDate(item.date))
    .filter((value): value is string => value != null)
    .sort()[0] ?? null;
  const periodStart = `${periodKey}-01`;
  const periodEnd = `${nextPeriod(periodKey)}-01`;
  let date = anchorDate;
  let steps = 0;
  const result: MonthlyGameInput[] = [];
  while (date < periodEnd) {
    if ((!count || index <= count) &&
        (!endDate || date <= endDate) &&
        (!cancelledAfter || date <= cancelledAfter) &&
        date >= periodStart) {
      result.push({
        id: plannedOccurrenceId("series", seriesId, date),
        date,
        status: "SCHEDULED",
        courtCostCents: anchor.courtCostCents ?? null,
        explicitlyExcluded: false,
        source: "RECURRENCE",
        seriesId,
        label: normalizeLabel(anchor.label),
        recurrence,
        recurrenceIndex: index,
        recurrenceCount: count,
        recurrenceEndDate: endDate,
      });
    }
    if ((count && index >= count) ||
        (endDate && date >= endDate) ||
        (cancelledAfter && date >= cancelledAfter)) break;
    date = nextRecurringDate(date, recurrence);
    index += 1;
    if (++steps > 6000) {
      throw new Error(`Série ${seriesId} excede o limite de expansão.`);
    }
  }
  return result;
}

/**
 * Decide se um ciclo pode ser refeito sem apagar ou alterar pagamentos.
 * @param {Record<string, unknown> | undefined} current Ciclo persistido.
 * @param {string} nextHash Hash da nova apuração.
 * @param {boolean} hasPayments Indica qualquer baixa já registrada.
 * @return {CycleRebuildDecision} Decisão autoritativa para o rebuild.
 */
export function assessMonthlyCycleRebuild(
  current: Record<string, unknown> | undefined,
  nextHash: string,
  hasPayments: boolean
): CycleRebuildDecision {
  if (!current) return "CREATE";
  if (current.calculation_hash === nextHash) return "REPLAY";
  if (hasPayments || current.status !== "DRAFT") return "LOCKED";
  return "REBUILD";
}

/**
 * Calcula uma baixa parcial ou integral, sempre limitada ao saldo da cobrança.
 * @param {number} expectedCents Valor original da cobrança.
 * @param {number} paidCents Valor já baixado.
 * @param {number | null | undefined} requestedCents Valor solicitado ou saldo.
 * @return {SettlementCalculation} Novo estado da cobrança.
 */
export function calculateMonthlySettlement(
  expectedCents: number,
  paidCents: number,
  requestedCents?: number | null
): SettlementCalculation {
  assertCents(expectedCents, "expectedCents");
  assertCents(paidCents, "paidCents");
  if (paidCents > expectedCents) {
    throw new Error("paidCents não pode exceder expectedCents.");
  }
  const outstanding = expectedCents - paidCents;
  if (outstanding <= 0) throw new Error("A cobrança já está quitada.");
  const amount = requestedCents == null ?
    outstanding :
    assertCents(requestedCents, "amountCents");
  if (amount <= 0 || amount > outstanding) {
    throw new Error("amountCents deve estar entre 1 e o saldo da cobrança.");
  }
  const nextPaid = paidCents + amount;
  return {
    amountCents: amount,
    paidCents: nextPaid,
    outstandingCents: expectedCents - nextPaid,
    status: nextPaid === expectedCents ? "PAID" : "PARTIAL",
  };
}

/**
 * Confere se um marcador representa exatamente o retry recebido.
 * @param {Record<string, unknown>} operation Marcador persistido.
 * @param {object} input Intenção normalizada da baixa.
 * @return {boolean} True somente para reentrega idêntica.
 */
export function isSameMonthlySettlementOperation(
  operation: Record<string, unknown>,
  input: {
    userId: string;
    targetUserId: string;
    periodKey: string;
    requestedAmountCents: number | null;
  }
): boolean {
  return operation.created_by === input.userId &&
    (operation.target_user_id ?? operation.payer_id) === input.targetUserId &&
    operation.period_key === input.periodKey &&
    (operation.requested_amount_cents ?? null) === input.requestedAmountCents;
}

/**
 * Um intervalo de adesão mensal historicamente encerrado.
 * `to` é exclusivo (mesma semântica de effective_to_period).
 */
interface MonthlyRosterPeriod {
  from: string;
  to: string;
}

/**
 * Extrai o histórico de intervalos encerrados persistido no roster.
 * @param {Record<string, unknown>} roster Documento do roster.
 * @return {MonthlyRosterPeriod[]} Intervalos válidos, sem normalizar.
 */
function monthlyRosterPeriodHistory(
  roster: Record<string, unknown>
): MonthlyRosterPeriod[] {
  const raw = roster.periods;
  if (!Array.isArray(raw)) return [];
  const result: MonthlyRosterPeriod[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const from = temporalPeriod((entry as Record<string, unknown>).from);
    const to = temporalPeriod((entry as Record<string, unknown>).to);
    if (from && to) result.push({from, to});
  }
  return result;
}

/**
 * Confere se a janela ATUAL (effective_from/to_period) cobre o período.
 * @param {Record<string, unknown>} roster Documento do roster.
 * @param {string} periodKey Período AAAA-MM já validado.
 * @return {boolean} Se a janela corrente cobre o período.
 */
function isMonthlyRosterEligibleForCurrentWindow(
  roster: Record<string, unknown>,
  periodKey: string
): boolean {
  const effectiveFrom = temporalPeriod(
    roster.effective_from_period ?? roster.effective_from
  );
  const effectiveTo = temporalPeriod(
    roster.effective_to_period ?? roster.effective_to
  );
  if (effectiveFrom && effectiveFrom > periodKey) return false;
  if (roster.active === true) return !effectiveTo || effectiveTo >= periodKey;
  return Boolean(effectiveTo && effectiveTo > periodKey);
}

/**
 * Mantém um roster elegível no mês em que o vínculo esteve ativo.
 *
 * BUGFIX #3881: remover e readicionar um membro sobrescrevia o único par
 * effective_from/to_period, perdendo o intervalo anterior. Agora o
 * intervalo encerrado é preservado em `roster.periods` (lista de
 * intervalos) antes de abrir uma nova janela, e a elegibilidade verifica
 * a janela atual OU qualquer intervalo histórico.
 *
 * @param {Record<string, unknown>} roster Documento do roster.
 * @param {string} periodKey Período AAAA-MM.
 * @return {boolean} Se o jogador participa do rateio daquele período.
 */
export function isMonthlyRosterEligible(
  roster: Record<string, unknown>,
  periodKey: string
): boolean {
  assertPeriodKey(periodKey);
  if (isMonthlyRosterEligibleForCurrentWindow(roster, periodKey)) return true;
  return monthlyRosterPeriodHistory(roster).some(
    (period) => period.from <= periodKey && periodKey < period.to
  );
}

export const configureMonthlyFinance =
  secureCallable<ConfigureMonthlyFinanceData>({
    consumeAppCheckToken: true,
    rateLimit: RATE_LIMITS.FINANCE_MANAGE,
    auditLogContext: monthlyAuditContext("configure_monthly_finance"),
  }, async (request) => {
    const userId = requireAuthenticatedUser(request.auth?.uid);
    const groupId = requireSafeId(request.data?.groupId, "groupId");
    const pricingMode = request.data?.pricingMode;
    if (pricingMode !== "FIXED_MONTHLY" && pricingMode !== "PER_GAME") {
      throw invalidArgument("pricingMode inválido");
    }
    const fixedMonthlyCostCents = pricingMode === "FIXED_MONTHLY" ?
      requirePositiveCents(
        request.data?.fixedMonthlyCostCents,
        "fixedMonthlyCostCents"
      ) :
      null;
    const defaultGameCostCents = pricingMode === "PER_GAME" &&
      request.data?.defaultGameCostCents != null ?
      requireNonNegativeCents(
        request.data.defaultGameCostCents,
        "defaultGameCostCents"
      ) : null;
    const groupRef = db().collection("groups").doc(groupId);
    const memberRef = groupRef.collection("members").doc(userId);
    const configRef = groupRef.collection("monthly_finance_config").doc("current");
    const currentPeriodRef = groupRef.collection("monthly_finance_periods")
      .doc(currentPeriodInSaoPaulo());

    try {
      return await db().runTransaction(async (tx) => {
        const [groupDoc, memberDoc, configDoc, currentPeriodDoc] =
          await Promise.all([
            tx.get(groupRef),
            tx.get(memberRef),
            tx.get(configRef),
            tx.get(currentPeriodRef),
          ]);
        authorizeMonthlyManager(groupDoc, memberDoc, userId);
        const current = configDoc.exists ? configDoc.data() || {} : {};
        const unchanged = current.pricing_mode === pricingMode &&
          (current.fixed_monthly_cost_cents ?? null) === fixedMonthlyCostCents &&
          (current.default_game_cost_cents ?? null) === defaultGameCostCents;
        if (unchanged) {
          return {
            groupId,
            pricingMode,
            revision: safeRevision(current.revision),
            rosterRevision: safeRevision(current.roster_revision),
            duplicate: true,
          };
        }
        const currentPeriod = currentPeriodDoc.exists ?
          currentPeriodDoc.data() || {} : {};
        if (currentPeriod.status === "FINALIZED" ||
            currentPeriod.status === "CLOSED") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "A configuração não pode mudar com a competência atual bloqueada"
          );
        }
        const revision = safeRevision(current.revision) + 1;
        const rosterRevision = safeRevision(current.roster_revision);
        tx.set(configRef, {
          pricing_mode: pricingMode,
          fixed_monthly_cost_cents: fixedMonthlyCostCents,
          default_game_cost_cents: defaultGameCostCents,
          revision,
          revision_effective_period: currentPeriodInSaoPaulo(),
          roster_revision: rosterRevision,
          calculation_version: MONTHLY_CALCULATION_VERSION,
          timezone: MONTHLY_TIMEZONE,
          currency: "BRL",
          distribution_mode: "EQUAL_SPLIT",
          updated_by: userId,
          updated_at: FieldValue.serverTimestamp(),
          ...(configDoc.exists ? {} : {
            created_by: userId,
            created_at: FieldValue.serverTimestamp(),
          }),
        }, {merge: true});
        return {
          groupId,
          pricingMode,
          revision,
          rosterRevision,
          duplicate: false,
        };
      });
    } catch (error) {
      throwMonthlyCallableError(error, "configurar mensalistas", groupId);
    }
  });

export const setMonthlyMember = secureCallable<SetMonthlyMemberData>({
  consumeAppCheckToken: true,
  rateLimit: RATE_LIMITS.FINANCE_MANAGE,
  auditLogContext: monthlyAuditContext("set_monthly_member"),
}, async (request) => {
  const userId = requireAuthenticatedUser(request.auth?.uid);
  const groupId = requireSafeId(request.data?.groupId, "groupId");
  const targetUserId = requireSafeId(
    request.data?.targetUserId,
    "targetUserId"
  );
  if (typeof request.data?.isMonthly !== "boolean") {
    throw invalidArgument("isMonthly deve ser booleano");
  }
  const isMonthly = request.data.isMonthly;
  const groupRef = db().collection("groups").doc(groupId);
  const callerMemberRef = groupRef.collection("members").doc(userId);
  const targetMemberRef = groupRef.collection("members").doc(targetUserId);
  const rosterRef = groupRef.collection("monthly_member_roster").doc(targetUserId);
  const configRef = groupRef.collection("monthly_finance_config").doc("current");
  const currentPeriodRef = groupRef.collection("monthly_finance_periods")
    .doc(currentPeriodInSaoPaulo());

  try {
    return await db().runTransaction(async (tx) => {
      const [
        groupDoc,
        callerMemberDoc,
        targetMemberDoc,
        rosterDoc,
        configDoc,
        currentPeriodDoc,
      ] =
        await Promise.all([
          tx.get(groupRef),
          tx.get(callerMemberRef),
          tx.get(targetMemberRef),
          tx.get(rosterRef),
          tx.get(configRef),
          tx.get(currentPeriodRef),
        ]);
      authorizeMonthlyManager(groupDoc, callerMemberDoc, userId);
      if (!configDoc.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Configure o financeiro mensal antes de alterar mensalistas"
        );
      }
      const current = rosterDoc.exists ? rosterDoc.data() || {} : {};
      const config = configDoc.data() || {};
      if (!isMonthly && !rosterDoc.exists) {
        return {
          groupId,
          targetUserId,
          isMonthly,
          revision: 0,
          rosterRevision: safeRevision(config.roster_revision),
          duplicate: true,
        };
      }
      const targetData = targetMemberDoc.exists ? targetMemberDoc.data() || {} : {};
      if (isMonthly && (!targetMemberDoc.exists ||
          targetData.user_id !== targetUserId ||
          targetData.status !== "ACTIVE")) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "O jogador precisa ser membro ativo e íntegro do grupo"
        );
      }
      if (current.active === isMonthly) {
        return {
          groupId,
          targetUserId,
          isMonthly,
          revision: safeRevision(current.revision),
          rosterRevision: safeRevision(config.roster_revision),
          duplicate: true,
        };
      }
      const currentPeriod = currentPeriodDoc.exists ?
        currentPeriodDoc.data() || {} : {};
      if (currentPeriod.status === "FINALIZED" ||
          currentPeriod.status === "CLOSED") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "O roster não pode mudar com a competência atual bloqueada"
        );
      }
      const revision = safeRevision(current.revision) + 1;
      const rosterRevision = safeRevision(config.roster_revision) + 1;
      const effectivePeriod = currentPeriodInSaoPaulo();
      // BUGFIX #3881: readicionar um membro após remoção sobrescrevia o
      // único par effective_from/to_period, apagando o intervalo anterior
      // (ex.: ativo 2026-03..05, removido, readicionado em 2026-07 fazia
      // um rebuild de 2026-04 excluir o membro silenciosamente). Antes de
      // abrir a nova janela, arquivamos o intervalo fechado anterior em
      // `periods` para que isMonthlyRosterEligible continue enxergando-o.
      const closingPreviousWindow = isMonthly &&
        current.active === false &&
        typeof current.effective_from_period === "string" &&
        typeof current.effective_to_period === "string";
      const periods = monthlyRosterPeriodHistory(current);
      if (closingPreviousWindow) {
        periods.push({
          from: current.effective_from_period as string,
          to: current.effective_to_period as string,
        });
      }
      tx.set(rosterRef, {
        user_id: targetUserId,
        active: isMonthly,
        revision,
        effective_from: isMonthly ?
          FieldValue.serverTimestamp() :
          current.effective_from ?? null,
        effective_from_period: isMonthly ?
          effectivePeriod :
          current.effective_from_period ?? null,
        effective_to: isMonthly ? null : FieldValue.serverTimestamp(),
        effective_to_period: isMonthly ? null : effectivePeriod,
        periods,
        updated_by: userId,
        updated_at: FieldValue.serverTimestamp(),
        ...(rosterDoc.exists ? {} : {
          created_by: userId,
          created_at: FieldValue.serverTimestamp(),
        }),
      }, {merge: true});
      tx.update(configRef, {
        roster_revision: rosterRevision,
        roster_revision_effective_period: effectivePeriod,
        updated_by: userId,
        updated_at: FieldValue.serverTimestamp(),
      });
      return {
        groupId,
        targetUserId,
        isMonthly,
        revision,
        rosterRevision,
        duplicate: false,
      };
    });
  } catch (error) {
    throwMonthlyCallableError(error, "alterar roster mensal", groupId);
  }
});

export const rebuildMonthlyCycle =
  secureCallable<RebuildMonthlyCycleData>({
    consumeAppCheckToken: true,
    rateLimit: RATE_LIMITS.FINANCE_REBUILD,
    auditLogContext: monthlyAuditContext("rebuild_monthly_cycle"),
  }, async (request) => {
    const userId = requireAuthenticatedUser(request.auth?.uid);
    const groupId = requireSafeId(request.data?.groupId, "groupId");
    const periodKey = requirePeriodKey(request.data?.periodKey);
    const groupRef = db().collection("groups").doc(groupId);
    const callerMemberRef = groupRef.collection("members").doc(userId);
    const configRef = groupRef.collection("monthly_finance_config").doc("current");
    const rosterQuery = groupRef.collection("monthly_member_roster")
      .orderBy(FieldPath.documentId())
      .limit(MAX_MONTHLY_ROSTER_SIZE + 1);
    const membersQuery = groupRef.collection("members")
      .orderBy(FieldPath.documentId())
      .limit(MAX_GROUP_MEMBERS_FOR_MONTHLY + 1);
    const gamesQuery = db().collection("games")
      .where("group_id", "==", groupId)
      .where("date", ">=", `${periodKey}-01`)
      .where("date", "<", `${nextPeriod(periodKey)}-01`)
      .orderBy("date", "asc")
      .limit(MAX_MONTHLY_GAMES_PER_PERIOD + 1);
    const recurringGamesQuery = db().collection("games")
      .where("group_id", "==", groupId)
      .where("recurrence", "in", ["weekly", "biweekly", "monthly"])
      .where("date", "<", `${nextPeriod(periodKey)}-01`)
      .orderBy("date", "desc")
      .limit(MAX_MONTHLY_RECURRING_SOURCE_GAMES + 1);
    const schedulesQuery = db().collection("schedules")
      .where("group_id", "==", groupId)
      .orderBy("day_of_week", "asc")
      .limit(MAX_MONTHLY_SCHEDULES + 1);
    const periodRef = groupRef.collection("monthly_finance_periods").doc(periodKey);
    const payersRef = periodRef.collection("payers");
    const payersQuery = payersRef.orderBy(FieldPath.documentId())
      .limit(MAX_MONTHLY_ROSTER_SIZE + 1);

    try {
      return await db().runTransaction(async (tx) => {
        const [groupDoc, callerMemberDoc, configDoc, periodDoc] =
          await Promise.all([
            tx.get(groupRef),
            tx.get(callerMemberRef),
            tx.get(configRef),
            tx.get(periodRef),
          ]);
        authorizeMonthlyManager(groupDoc, callerMemberDoc, userId);
        if (!configDoc.exists) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Configure o financeiro mensal antes de calcular o período"
          );
        }
        const [
          rosterSnap,
          membersSnap,
          gamesSnap,
          recurringGamesSnap,
          schedulesSnap,
          payersSnap,
        ] =
          await Promise.all([
            tx.get(rosterQuery),
            tx.get(membersQuery),
            tx.get(gamesQuery),
            tx.get(recurringGamesQuery),
            tx.get(schedulesQuery),
            tx.get(payersQuery),
          ]);
        assertQueryLimits(
          rosterSnap.size,
          membersSnap.size,
          gamesSnap.size,
          payersSnap.size,
          schedulesSnap.size,
          recurringGamesSnap.size
        );

        const activeMemberDocs = membersSnap.docs
          .filter((doc) => {
            const data = doc.data() || {};
            return data.user_id === doc.id && data.status === "ACTIVE";
          });
        const activeMemberIds = activeMemberDocs
          .map((doc) => doc.id)
          .sort((left, right) => left.localeCompare(right));
        const activeMemberSet = new Set(activeMemberIds);
        const activeMemberById = new Map(
          activeMemberDocs.map((doc) => [doc.id, doc.data() || {}])
        );
        const monthlyMemberIds = rosterSnap.docs
          .filter((doc) => {
            const data = doc.data() || {};
            return data.user_id === doc.id &&
              activeMemberSet.has(doc.id) &&
              isMonthlyRosterEligible(data, periodKey);
          })
          .map((doc) => doc.id)
          .sort((left, right) => left.localeCompare(right));
        const config = configDoc.data() || {};
        const configRevision = safeRevision(config.revision);
        const rosterRevision = safeRevision(config.roster_revision);
        let calculation: MonthlyPeriodCalculation;
        try {
          const current = periodDoc.exists ? periodDoc.data() || {} : undefined;
          const overrides = current?.status === "DRAFT" ?
            monthlyOverridesFromStoredSnapshot(current.game_snapshot) :
            new Map<string, MonthlyGameOverride>();
          const calendar = buildMonthlyCalendar({
            periodKey,
            games: [
              ...gamesSnap.docs.map((doc) => rawGameForMonthly(doc)),
              ...recurringGamesSnap.docs.map((doc) => rawGameForMonthly(doc)),
            ],
            schedules: schedulesSnap.docs.map((doc) =>
              rawScheduleForMonthly(doc)
            ),
            overrides,
          });
          const unboundCalculation = calculateMonthlyPeriod({
            periodKey,
            pricingMode: config.pricing_mode as MonthlyPricingMode,
            fixedMonthlyCostCents: nullableNumber(
              config.fixed_monthly_cost_cents
            ),
            defaultGameCostCents: nullableNumber(
              config.default_game_cost_cents
            ),
            monthlyMemberIds,
            groupMemberCount: activeMemberIds.length,
            games: calendar,
          });
          calculation = {
            ...unboundCalculation,
            calculationHash: bindCalculationToRevisions(
              unboundCalculation.calculationHash,
              configRevision,
              rosterRevision
            ),
          };
        } catch (error) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            error instanceof Error ? error.message : "Apuração mensal inválida"
          );
        }

        const current = periodDoc.exists ? periodDoc.data() || {} : undefined;
        const hasPayments = (current?.received_cents ?? 0) > 0 ||
          (current?.settlement_count ?? 0) > 0 ||
          payersSnap.docs.some((doc) => (doc.data()?.paid_cents ?? 0) > 0);
        const decision = assessMonthlyCycleRebuild(
          current,
          calculation.calculationHash,
          hasPayments
        );
        if (decision === "LOCKED") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "O período possui baixa ou foi finalizado e não pode ser recalculado"
          );
        }
        if (decision === "REPLAY") {
          return {
            groupId,
            periodKey,
            revision: safeRevision(current?.revision),
            calculationHash: calculation.calculationHash,
            status: current?.status as MonthlyPeriodStatus,
            totalCourtCostCents: current?.total_court_cost_cents ??
              calculation.totalCourtCostCents,
            gameCount: current?.game_count ?? calculation.gameCount,
            monthlyMemberCount: current?.monthly_member_count ??
              calculation.monthlyMemberCount,
            duplicate: true,
          };
        }

        const revision = safeRevision(current?.revision) + 1;
        const chargeByUser = new Map(
          calculation.charges.map((charge) => [charge.userId, charge])
        );
        calculation.charges.forEach((charge) => {
          const profile = activeMemberById.get(charge.userId) || {};
          tx.set(payersRef.doc(charge.userId), {
            user_id: charge.userId,
            user_name: firstNonEmptyString(
              profile.display_name,
              profile.user_name,
              profile.name
            ) ?? "Jogador",
            user_photo_url: firstNonEmptyString(
              profile.photo_url,
              profile.photoUrl,
              profile.user_photo_url
            ),
            active: true,
            expected_cents: charge.expectedCents,
            paid_cents: 0,
            outstanding_cents: charge.expectedCents,
            status: charge.expectedCents === 0 ? "PAID" : "PENDING",
            payment_count: 0,
            period_key: periodKey,
            revision,
            calculation_hash: calculation.calculationHash,
            updated_at: FieldValue.serverTimestamp(),
            ...(payersSnap.docs.some((doc) => doc.id === charge.userId) ? {} : {
              created_at: FieldValue.serverTimestamp(),
            }),
          }, {merge: true});
        });
        payersSnap.docs
          .filter((doc) => !chargeByUser.has(doc.id))
          .forEach((doc) => {
            tx.set(doc.ref, {
              active: false,
              expected_cents: 0,
              outstanding_cents: 0,
              status: "REMOVED",
              revision,
              calculation_hash: calculation.calculationHash,
              removed_at: FieldValue.serverTimestamp(),
              updated_at: FieldValue.serverTimestamp(),
            }, {merge: true});
          });
        tx.set(periodRef, {
          period_key: periodKey,
          pricing_mode: calculation.pricingMode,
          fixed_monthly_cost_cents: nullableNumber(
            config.fixed_monthly_cost_cents
          ),
          default_game_cost_cents: nullableNumber(
            config.default_game_cost_cents
          ),
          status: "DRAFT",
          timezone: MONTHLY_TIMEZONE,
          currency: "BRL",
          distribution_mode: "EQUAL_SPLIT",
          calculation_version: MONTHLY_CALCULATION_VERSION,
          config_revision: configRevision,
          roster_revision: rosterRevision,
          revision,
          calculation_hash: calculation.calculationHash,
          total_court_cost_cents: calculation.totalCourtCostCents,
          game_count: calculation.gameCount,
          excluded_game_count: calculation.excludedGameCount,
          group_member_count: calculation.groupMemberCount,
          monthly_member_count: calculation.monthlyMemberCount,
          average_per_game_cents: calculation.averagePerGameCents,
          average_per_monthly_member_cents:
            calculation.averagePerMonthlyMemberCents,
          received_cents: 0,
          open_cents: calculation.totalCourtCostCents,
          settlement_count: 0,
          game_snapshot: calculation.games.map((game) => ({
            id: game.id,
            date: game.date,
            status: game.status,
            court_cost_cents: game.courtCostCents,
            base_court_cost_cents: game.baseCourtCostCents,
            allocated_cost_cents: game.allocatedCostCents,
            included: game.included,
            exclusion_reason: game.exclusionReason,
            base_explicitly_excluded: game.baseExplicitlyExcluded,
            game_id: game.gameId,
            source: game.source,
            schedule_id: game.scheduleId,
            series_id: game.seriesId,
            label: game.label,
            manual_override: storedMonthlyGameOverride(game.manualOverride),
          })),
          calculated_by: userId,
          calculated_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          ...(periodDoc.exists ? {} : {
            created_by: userId,
            created_at: FieldValue.serverTimestamp(),
          }),
        }, {merge: true});
        return {
          groupId,
          periodKey,
          revision,
          calculationHash: calculation.calculationHash,
          status: "DRAFT" as MonthlyPeriodStatus,
          totalCourtCostCents: calculation.totalCourtCostCents,
          gameCount: calculation.gameCount,
          monthlyMemberCount: calculation.monthlyMemberCount,
          duplicate: false,
        };
      });
    } catch (error) {
      throwMonthlyCallableError(error, "recalcular período mensal", groupId);
    }
  });

export const setMonthlyGameOverride =
  secureCallable<SetMonthlyGameOverrideData>({
    consumeAppCheckToken: true,
    rateLimit: RATE_LIMITS.FINANCE_MANAGE,
    auditLogContext: monthlyAuditContext("set_monthly_game_override"),
  }, async (request) => {
    const userId = requireAuthenticatedUser(request.auth?.uid);
    const groupId = requireSafeId(request.data?.groupId, "groupId");
    const periodKey = requirePeriodKey(request.data?.periodKey);
    const occurrenceId = requireSafeId(
      request.data?.occurrenceId,
      "occurrenceId"
    );
    if (typeof request.data?.excluded !== "boolean") {
      throw invalidArgument("excluded deve ser booleano");
    }
    const excluded = request.data.excluded;
    const costCents = request.data?.costCents == null ?
      null : requirePositiveCents(request.data.costCents, "costCents");
    const requestedReason = normalizeOverrideReason(request.data?.reason);
    const reason = excluded ? requestedReason ?? "OTHER" : null;
    const requestedOverride: MonthlyGameOverride = {
      excluded,
      costCents,
      reason,
    };
    const groupRef = db().collection("groups").doc(groupId);
    const callerMemberRef = groupRef.collection("members").doc(userId);
    const configRef = groupRef.collection("monthly_finance_config").doc("current");
    const periodRef = groupRef.collection("monthly_finance_periods").doc(periodKey);
    const payersRef = periodRef.collection("payers");
    const payersQuery = payersRef.orderBy(FieldPath.documentId())
      .limit(MAX_MONTHLY_ROSTER_SIZE + 1);

    try {
      return await db().runTransaction(async (tx) => {
        const [groupDoc, callerMemberDoc, configDoc, periodDoc, payersSnap] =
          await Promise.all([
            tx.get(groupRef),
            tx.get(callerMemberRef),
            tx.get(configRef),
            tx.get(periodRef),
            tx.get(payersQuery),
          ]);
        authorizeMonthlyManager(groupDoc, callerMemberDoc, userId);
        if (!configDoc.exists || !periodDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Configuração ou competência mensal não encontrada"
          );
        }
        if (payersSnap.size > MAX_MONTHLY_ROSTER_SIZE) {
          throw new functions.https.HttpsError(
            "resource-exhausted",
            "Quantidade de mensalistas excede o limite seguro"
          );
        }
        const config = configDoc.data() || {};
        const period = periodDoc.data() || {};
        if (period.status !== "DRAFT" ||
            safeRevision(period.settlement_count) > 0 ||
            requireStoredCents(period.received_cents, "received_cents") > 0 ||
            payersSnap.docs.some((doc) =>
              requireStoredCents(doc.data()?.paid_cents ?? 0, "paid_cents") > 0
            )) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Overrides só podem mudar em competência DRAFT sem baixas"
          );
        }
        const configRevision = safeRevision(config.revision);
        const rosterRevision = safeRevision(config.roster_revision);
        if ((revisionAppliesToPeriod(
          config.revision_effective_period,
          periodKey
        ) && safeRevision(period.config_revision) !== configRevision) ||
            (revisionAppliesToPeriod(
              config.roster_revision_effective_period,
              periodKey
            ) && safeRevision(period.roster_revision) !== rosterRevision)) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "A competência está desatualizada; recalcule antes do override"
          );
        }
        if (period.pricing_mode !== "PER_GAME" && costCents != null) {
          throw invalidArgument(
            "costCents por ocorrência exige precificação PER_GAME"
          );
        }
        const storedGames = monthlyGamesFromStoredSnapshot(
          period.game_snapshot
        );
        const target = storedGames.find((game) => game.id === occurrenceId);
        if (!target) {
          throw new functions.https.HttpsError(
            "not-found",
            "Ocorrência mensal não encontrada"
          );
        }
        if (sameMonthlyGameOverride(target.manualOverride, requestedOverride)) {
          return {
            groupId,
            periodKey,
            occurrenceId,
            revision: safeRevision(period.revision),
            calculationHash: period.calculation_hash as string,
            totalCourtCostCents: period.total_court_cost_cents as number,
            gameCount: period.game_count as number,
            duplicate: true,
          };
        }
        target.manualOverride = requestedOverride;
        const monthlyMemberIds = payersSnap.docs
          .filter((doc) => {
            const payer = doc.data() || {};
            return payer.user_id === doc.id && payer.active === true &&
              payer.status !== "REMOVED" && payer.period_key === periodKey;
          })
          .map((doc) => doc.id)
          .sort((left, right) => left.localeCompare(right));
        let calculation: MonthlyPeriodCalculation;
        try {
          const unbound = calculateMonthlyPeriod({
            periodKey,
            pricingMode: period.pricing_mode as MonthlyPricingMode,
            fixedMonthlyCostCents: nullableNumber(
              period.fixed_monthly_cost_cents
            ),
            defaultGameCostCents: nullableNumber(
              period.default_game_cost_cents
            ),
            monthlyMemberIds,
            groupMemberCount: safeRevision(period.group_member_count),
            games: storedGames,
          });
          calculation = {
            ...unbound,
            calculationHash: bindCalculationToRevisions(
              unbound.calculationHash,
              configRevision,
              rosterRevision
            ),
          };
        } catch (error) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            error instanceof Error ? error.message : "Override mensal inválido"
          );
        }
        const revision = safeRevision(period.revision) + 1;
        const chargeByUser = new Map(
          calculation.charges.map((charge) => [charge.userId, charge])
        );
        payersSnap.docs.forEach((doc) => {
          const charge = chargeByUser.get(doc.id);
          if (!charge) return;
          tx.update(doc.ref, {
            expected_cents: charge.expectedCents,
            outstanding_cents: charge.expectedCents,
            status: charge.expectedCents === 0 ? "PAID" : "PENDING",
            revision,
            calculation_hash: calculation.calculationHash,
            updated_at: FieldValue.serverTimestamp(),
          });
        });
        tx.update(periodRef, {
          revision,
          calculation_hash: calculation.calculationHash,
          total_court_cost_cents: calculation.totalCourtCostCents,
          game_count: calculation.gameCount,
          excluded_game_count: calculation.excludedGameCount,
          monthly_member_count: calculation.monthlyMemberCount,
          average_per_game_cents: calculation.averagePerGameCents,
          average_per_monthly_member_cents:
            calculation.averagePerMonthlyMemberCents,
          received_cents: 0,
          open_cents: calculation.totalCourtCostCents,
          game_snapshot: calculation.games.map((game) =>
            storedMonthlyGameSnapshot(game)
          ),
          last_override: {
            occurrence_id: occurrenceId,
            excluded,
            cost_cents: costCents,
            reason,
            updated_by: userId,
            updated_at: FieldValue.serverTimestamp(),
          },
          override_audit: {
            ...(period.override_audit &&
              typeof period.override_audit === "object" ?
              period.override_audit as Record<string, unknown> : {}),
            [createHash("sha256").update(occurrenceId)
              .digest("hex").slice(0, 32)]: {
              occurrence_id: occurrenceId,
              excluded,
              cost_cents: costCents,
              reason,
              updated_by: userId,
              updated_at: FieldValue.serverTimestamp(),
            },
          },
          updated_at: FieldValue.serverTimestamp(),
        });
        return {
          groupId,
          periodKey,
          occurrenceId,
          revision,
          calculationHash: calculation.calculationHash,
          totalCourtCostCents: calculation.totalCourtCostCents,
          gameCount: calculation.gameCount,
          duplicate: false,
        };
      });
    } catch (error) {
      throwMonthlyCallableError(error, "alterar ocorrência mensal", groupId);
    }
  });

export const settleMonthlyCharge =
  secureCallable<SettleMonthlyChargeData>({
    consumeAppCheckToken: true,
    rateLimit: RATE_LIMITS.FINANCE_SETTLE,
    auditLogContext: monthlyAuditContext("settle_monthly_charge"),
  }, async (request) => {
    const userId = requireAuthenticatedUser(request.auth?.uid);
    const groupId = requireSafeId(request.data?.groupId, "groupId");
    const periodKey = requirePeriodKey(request.data?.periodKey);
    const targetUserId = requireSafeId(
      request.data?.targetUserId,
      "targetUserId"
    );
    const requestId = typeof request.data?.requestId === "string" ?
      request.data.requestId.trim() : "";
    if (!REQUEST_ID_PATTERN.test(requestId)) {
      throw invalidArgument("requestId inválido");
    }
    const requestedAmountCents = request.data?.amountCents == null ?
      null :
      requirePositiveCents(request.data.amountCents, "amountCents");
    const groupRef = db().collection("groups").doc(groupId);
    const callerMemberRef = groupRef.collection("members").doc(userId);
    const configRef = groupRef.collection("monthly_finance_config").doc("current");
    const periodRef = groupRef.collection("monthly_finance_periods").doc(periodKey);
    const payerRef = periodRef.collection("payers").doc(targetUserId);
    const settlementRef = periodRef.collection("settlements").doc(requestId);
    const summaryRef = groupRef.collection("cashbox_summary").doc("current");
    const entryRef = groupRef.collection("cashbox").doc(`monthly_${requestId}`);
    const operationRef = groupRef.collection("cashbox_summary_ops")
      .doc(`create_${entryRef.id}`);

    try {
      return await db().runTransaction(async (tx) => {
        const [
          groupDoc,
          callerMemberDoc,
          configDoc,
          periodDoc,
          payerDoc,
          summaryDoc,
          operationDoc,
          entryDoc,
          settlementDoc,
        ] = await Promise.all([
          tx.get(groupRef),
          tx.get(callerMemberRef),
          tx.get(configRef),
          tx.get(periodRef),
          tx.get(payerRef),
          tx.get(summaryRef),
          tx.get(operationRef),
          tx.get(entryRef),
          tx.get(settlementRef),
        ]);
        authorizeMonthlyManager(groupDoc, callerMemberDoc, userId);
        const operationInput = {
          userId,
          targetUserId,
          periodKey,
          requestedAmountCents,
        };
        if (settlementDoc.exists) {
          const persisted = settlementDoc.data() || {};
          if (!entryDoc.exists || persisted.status !== "ACTIVE" ||
              !isSameMonthlySettlementOperation(persisted, operationInput)) {
            throw new functions.https.HttpsError(
              "already-exists",
              "requestId já foi usado com outra baixa"
            );
          }
          return {
            groupId,
            periodKey,
            targetUserId,
            entryId: entryRef.id,
            amountCents: persisted.amount_cents as number,
            paidCents: persisted.paid_cents as number,
            outstandingCents: persisted.outstanding_cents as number,
            chargeStatus: persisted.charge_status as MonthlyPayerStatus,
            periodStatus: persisted.period_status as MonthlyPeriodStatus,
            balanceCents: persisted.balance_cents as number,
            paymentSequence: safeRevision(persisted.payment_sequence),
            duplicate: true,
          };
        }
        if (operationDoc.exists) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Marcador mensal existe sem settlement auditável"
          );
        }
        if (entryDoc.exists) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Entrada mensal existe sem marcador idempotente"
          );
        }
        if (!configDoc.exists || !periodDoc.exists || !payerDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Configuração, período ou cobrança mensal não encontrado"
          );
        }
        const config = configDoc.data() || {};
        const period = periodDoc.data() || {};
        const payer = payerDoc.data() || {};
        if ((revisionAppliesToPeriod(
          config.revision_effective_period,
          periodKey
        ) && safeRevision(period.config_revision) !==
          safeRevision(config.revision)) ||
            (revisionAppliesToPeriod(
              config.roster_revision_effective_period,
              periodKey
            ) && safeRevision(period.roster_revision) !==
          safeRevision(config.roster_revision))) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "A competência está desatualizada; recalcule antes de dar baixa"
          );
        }
        if (period.status === "CLOSED") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "O período já está fechado"
          );
        }
        if (period.status !== "DRAFT" && period.status !== "FINALIZED") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Status do período inválido para baixa"
          );
        }
        if (payer.user_id !== targetUserId ||
            payer.active !== true ||
            payer.status === "REMOVED" ||
            payer.period_key !== periodKey ||
            payer.calculation_hash !== period.calculation_hash) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Cobrança mensal indisponível"
          );
        }
        const summary = cashboxSummaryState(summaryDoc);
        if (!summary) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Resumo do caixa precisa ser reconciliado"
          );
        }
        let settlement: SettlementCalculation;
        try {
          settlement = calculateMonthlySettlement(
            payer.expected_cents as number,
            payer.paid_cents as number,
            requestedAmountCents
          );
        } catch (error) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            error instanceof Error ? error.message : "Baixa mensal inválida"
          );
        }
        const currentReceived = requireStoredCents(
          period.received_cents,
          "received_cents"
        );
        const currentOpen = requireStoredCents(period.open_cents, "open_cents");
        const periodTotal = requireStoredCents(
          period.total_court_cost_cents,
          "total_court_cost_cents"
        );
        if (currentReceived + currentOpen !== periodTotal) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Totais do período precisam ser reconciliados"
          );
        }
        if (settlement.amountCents > currentOpen) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Saldo do período inconsistente com a cobrança"
          );
        }
        const nextReceived = assertCents(
          currentReceived + settlement.amountCents,
          "received_cents"
        );
        const nextOpen = currentOpen - settlement.amountCents;
        const periodStatus: MonthlyPeriodStatus = nextOpen === 0 ?
          "CLOSED" :
          "FINALIZED";
        const paymentSequence = safeRevision(payer.payment_sequence) + 1;
        const nextSummary: CashboxSummaryState = {
          incomeCents: summary.incomeCents + settlement.amountCents,
          expenseCents: summary.expenseCents,
          balanceCents: summary.balanceCents + settlement.amountCents,
          entryCount: summary.entryCount + 1,
          ledgerVersion: summary.ledgerVersion + 1,
          lastEntryAt: FieldValue.serverTimestamp(),
        };
        const amount = centsToCashboxAmount(settlement.amountCents);
        tx.set(entryRef, {
          group_id: groupId,
          type: "INCOME",
          amount,
          amount_cents: settlement.amountCents,
          description: `Mensalidade ${periodKey}`,
          category: "MONTHLY_FEE",
          status: "ACTIVE",
          request_id: requestId,
          player_id: targetUserId,
          reference_period: periodKey,
          monthly_period_key: periodKey,
          monthly_payer_id: targetUserId,
          monthly_settlement_path: settlementRef.path,
          monthly_calculation_hash: period.calculation_hash,
          monthly_payment_sequence: paymentSequence,
          created_by: userId,
          created_by_id: userId,
          created_by_name: typeof request.auth?.token?.name === "string" ?
            request.auth.token.name : "Usuário",
          created_at: FieldValue.serverTimestamp(),
        });
        tx.set(
          summaryRef,
          cashboxSummaryPayload(nextSummary, "monthly_settlement_callable"),
          {merge: true}
        );
        tx.update(payerRef, {
          paid_cents: settlement.paidCents,
          outstanding_cents: settlement.outstandingCents,
          status: settlement.status,
          payment_count: safeRevision(payer.payment_count) + 1,
          payment_sequence: paymentSequence,
          last_payment_entry_id: entryRef.id,
          last_payment_sequence: paymentSequence,
          last_payment_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        tx.update(periodRef, {
          status: periodStatus,
          received_cents: nextReceived,
          open_cents: nextOpen,
          settlement_count: safeRevision(period.settlement_count) + 1,
          ...(period.status === "DRAFT" ? {
            finalized_by: userId,
            finalized_at: FieldValue.serverTimestamp(),
          } : {}),
          ...(periodStatus === "CLOSED" ? {
            closed_by: userId,
            closed_at: FieldValue.serverTimestamp(),
          } : {}),
          updated_at: FieldValue.serverTimestamp(),
        });
        tx.set(settlementRef, {
          request_id: requestId,
          payer_id: targetUserId,
          period_key: periodKey,
          amount_cents: settlement.amountCents,
          requested_amount_cents: requestedAmountCents,
          cashbox_entry_id: entryRef.id,
          cashbox_entry_path: entryRef.path,
          calculation_hash: period.calculation_hash,
          payment_sequence: paymentSequence,
          paid_cents: settlement.paidCents,
          outstanding_cents: settlement.outstandingCents,
          charge_status: settlement.status,
          period_status: periodStatus,
          balance_cents: nextSummary.balanceCents,
          status: "ACTIVE",
          created_by: userId,
          created_at: FieldValue.serverTimestamp(),
        });
        tx.set(operationRef, {
          operation: "CREATE",
          source: "MONTHLY_SETTLEMENT",
          entry_id: entryRef.id,
          settlement_path: settlementRef.path,
          created_by: userId,
          target_user_id: targetUserId,
          period_key: periodKey,
          requested_amount_cents: requestedAmountCents,
          amount_cents: settlement.amountCents,
          paid_cents: settlement.paidCents,
          outstanding_cents: settlement.outstandingCents,
          charge_status: settlement.status,
          period_status: periodStatus,
          balance_cents: nextSummary.balanceCents,
          ledger_version: nextSummary.ledgerVersion,
          payment_sequence: paymentSequence,
          applied_at: FieldValue.serverTimestamp(),
          expires_at: cashboxOperationExpiresAt(),
        });
        return {
          groupId,
          periodKey,
          targetUserId,
          entryId: entryRef.id,
          amountCents: settlement.amountCents,
          paidCents: settlement.paidCents,
          outstandingCents: settlement.outstandingCents,
          chargeStatus: settlement.status,
          periodStatus,
          balanceCents: nextSummary.balanceCents,
          paymentSequence,
          duplicate: false,
        };
      });
    } catch (error) {
      throwMonthlyCallableError(error, "dar baixa na mensalidade", groupId);
    }
  });

/* eslint-disable valid-jsdoc -- helpers privados têm contratos TypeScript. */
/** Liga o hash financeiro às revisões autoritativas de configuração/roster. */
function bindCalculationToRevisions(
  calculationHash: string,
  configRevision: number,
  rosterRevision: number
): string {
  return createHash("sha256").update(JSON.stringify({
    calculationHash,
    configRevision,
    rosterRevision,
  })).digest("hex");
}

/** Evita que uma revisão efetiva num mês futuro invalide competência passada. */
function revisionAppliesToPeriod(value: unknown, periodKey: string): boolean {
  const effectivePeriod = temporalPeriod(value);
  return effectivePeriod == null || effectivePeriod <= periodKey;
}

/** Normaliza a origem lógica de uma ocorrência mensal. */
function normalizeMonthlyGameSource(value: unknown): MonthlyGameSource {
  return value === "SCHEDULE" || value === "RECURRENCE" ? value : "GAME";
}

/** Normaliza um override puro e rejeita dinheiro/texto inválido. */
function normalizeMonthlyGameOverride(
  value: unknown
): MonthlyGameOverride | null {
  if (value == null) return null;
  if (typeof value !== "object") throw new Error("manualOverride inválido.");
  const raw = value as Record<string, unknown>;
  const excluded = raw.excluded === true;
  const rawCost = raw.costCents ?? raw.cost_cents;
  const costCents = rawCost == null ?
    null : assertCents(rawCost, "manualOverride.costCents");
  const reasonValue = raw.reason;
  const reason = typeof reasonValue === "string" && reasonValue.trim() ?
    reasonValue.trim() : null;
  if (reason && reason.length > 200) {
    throw new Error("O motivo do override deve ter no máximo 200 caracteres.");
  }
  return {excluded, costCents, reason};
}

/** Compara overrides sem considerar metadados de auditoria. */
function sameMonthlyGameOverride(
  left: MonthlyGameOverride | null | undefined,
  right: MonthlyGameOverride | null | undefined
): boolean {
  const normalizedLeft = normalizeMonthlyGameOverride(left);
  const normalizedRight = normalizeMonthlyGameOverride(right);
  return normalizedLeft?.excluded === normalizedRight?.excluded &&
    normalizedLeft?.costCents === normalizedRight?.costCents &&
    normalizedLeft?.reason === normalizedRight?.reason;
}

/** Converte override para o contrato snake_case persistido. */
function storedMonthlyGameOverride(
  override: MonthlyGameOverride | null
): Record<string, unknown> | null {
  if (!override) return null;
  return {
    excluded: override.excluded,
    cost_cents: override.costCents,
    reason: override.reason,
  };
}

/** Serializa uma ocorrência calculada no snapshot Firestore. */
function storedMonthlyGameSnapshot(
  game: MonthlyGameSnapshot
): Record<string, unknown> {
  return {
    id: game.id,
    date: game.date,
    status: game.status,
    court_cost_cents: game.courtCostCents,
    base_court_cost_cents: game.baseCourtCostCents,
    allocated_cost_cents: game.allocatedCostCents,
    included: game.included,
    exclusion_reason: game.exclusionReason,
    base_explicitly_excluded: game.baseExplicitlyExcluded,
    game_id: game.gameId,
    source: game.source,
    schedule_id: game.scheduleId,
    series_id: game.seriesId,
    label: game.label,
    manual_override: storedMonthlyGameOverride(game.manualOverride),
  };
}

/** Reidrata o snapshot DRAFT para novo cálculo/override. */
function monthlyGamesFromStoredSnapshot(value: unknown): MonthlyGameInput[] {
  if (!Array.isArray(value) || value.length > MAX_MONTHLY_GAMES_PER_PERIOD) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Snapshot de jogos mensais inválido"
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Ocorrência mensal persistida inválida"
      );
    }
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const date = typeof raw.date === "string" ? raw.date : "";
    const status = typeof raw.status === "string" ? raw.status : "";
    if (!isSafeDocumentId(id) || !normalizeCivilDate(date)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Identidade de ocorrência mensal inválida"
      );
    }
    return {
      id,
      date,
      status,
      courtCostCents: nullableNumber(raw.base_court_cost_cents) ??
        nullableNumber(raw.court_cost_cents),
      explicitlyExcluded: raw.base_explicitly_excluded === true,
      gameId: optionalSafeId(raw.game_id),
      source: normalizeMonthlyGameSource(raw.source),
      scheduleId: optionalSafeId(raw.schedule_id),
      seriesId: optionalSafeId(raw.series_id),
      label: normalizeLabel(raw.label),
      manualOverride: normalizeMonthlyGameOverride(raw.manual_override),
    };
  });
}

/** Extrai overrides do snapshot anterior usando IDs lógicos estáveis. */
function monthlyOverridesFromStoredSnapshot(
  value: unknown
): Map<string, MonthlyGameOverride> {
  const overrides = new Map<string, MonthlyGameOverride>();
  if (!Array.isArray(value)) return overrides;
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !isSafeDocumentId(raw.id)) return;
    const override = normalizeMonthlyGameOverride(raw.manual_override);
    if (override) overrides.set(raw.id, override);
  });
  return overrides;
}

/** Normaliza o motivo recebido no callable. */
function normalizeOverrideReason(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw invalidArgument("reason inválido");
  const reason = value.trim();
  if (!reason) return null;
  if (reason.length > 200) {
    throw invalidArgument("reason deve ter no máximo 200 caracteres");
  }
  if (reason !== "HOLIDAY" && reason !== "CANCELLED" && reason !== "OTHER") {
    throw invalidArgument("reason deve ser HOLIDAY, CANCELLED ou OTHER");
  }
  return reason;
}

/** Retorna apenas IDs Firestore simples e válidos. */
function optionalSafeId(value: unknown): string | null {
  return typeof value === "string" && isSafeDocumentId(value.trim()) ?
    value.trim() : null;
}

/** Mantém labels curtas e próprias para snapshot. */
function normalizeLabel(value: unknown): string | null {
  return typeof value === "string" && value.trim() ?
    value.trim().slice(0, 120) : null;
}

/** Aceita as três recorrências suportadas no produto. */
function normalizeRecurrenceType(value: unknown):
  "weekly" | "biweekly" | "monthly" | null {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return normalized === "weekly" || normalized === "biweekly" ||
    normalized === "monthly" ? normalized : null;
}

/** Normaliza inteiros positivos usados em índices/limites de série. */
function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ?
    value : null;
}

/** Gera um ID estável para preservar override antes/depois da materialização. */
function plannedOccurrenceId(
  source: "schedule" | "series",
  sourceId: string,
  date: string
): string {
  const digest = createHash("sha256").update(sourceId).digest("hex").slice(0, 20);
  return `${source}_${digest}_${date.replace(/-/g, "")}`;
}

/** Valida/normaliza uma data civil, Timestamp ou Date no timezone do produto. */
function normalizeCivilDate(value: unknown): string | null {
  if (typeof value === "string" && DATE_PATTERN.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value ? value : null;
  }
  let date: Date | null = value instanceof Date ? value : null;
  if (!date && value && typeof value === "object" &&
      "toDate" in value && typeof value.toDate === "function") {
    const candidate = value.toDate();
    if (candidate instanceof Date) date = candidate;
  }
  if (!date || !Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTHLY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/** Soma dias usando calendário UTC para evitar DST. */
function addCivilDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Retorna o weekday desejado na data ou depois dela. */
function weekdayOnOrAfter(dateValue: string, dayOfWeek: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  const delta = (dayOfWeek - date.getUTCDay() + 7) % 7;
  return addCivilDays(dateValue, delta);
}

/** Calcula a N-ésima ocorrência de um weekday no mês. */
function nthWeekdayOfMonth(
  periodKey: string,
  dayOfWeek: number,
  ordinal: number
): string | null {
  const first = weekdayOnOrAfter(`${periodKey}-01`, dayOfWeek);
  const result = addCivilDays(first, (ordinal - 1) * 7);
  return result.startsWith(`${periodKey}-`) ? result : null;
}

/** Avança uma ocorrência recorrente preservando a regra da série. */
function nextRecurringDate(
  dateValue: string,
  recurrence: "weekly" | "biweekly" | "monthly"
): string {
  if (recurrence === "weekly") return addCivilDays(dateValue, 7);
  if (recurrence === "biweekly") return addCivilDays(dateValue, 14);
  const [year, month, day] = dateValue.split("-").map(Number);
  const firstNextMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(
    firstNextMonth.getUTCFullYear(),
    firstNextMonth.getUTCMonth() + 1,
    0
  )).getUTCDate();
  return `${firstNextMonth.getUTCFullYear()}-${String(
    firstNextMonth.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
/* eslint-enable valid-jsdoc */

/**
 * Valida dinheiro inteiro em centavos dentro do limite do caixa.
 * @param {unknown} value Valor bruto.
 * @param {string} field Nome do campo.
 * @return {number} Valor validado.
 */
function assertCents(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) ||
      (value as number) < 0 ||
      (value as number) > CASHBOX_MAX_AMOUNT_CENTS) {
    throw new Error(`${field} deve ser inteiro e não negativo em centavos.`);
  }
  return value as number;
}

/**
 * Valida uma chave de período no formato AAAA-MM.
 * @param {string} periodKey Chave mensal.
 */
function assertPeriodKey(periodKey: string): void {
  if (!PERIOD_PATTERN.test(periodKey)) {
    throw new Error("periodKey inválido. Use AAAA-MM.");
  }
}

/**
 * Valida uma data civil real pertencente ao período solicitado.
 * @param {string} dateValue Data AAAA-MM-DD.
 * @param {string} periodKey Período esperado.
 */
function assertDateInPeriod(dateValue: string, periodKey: string): void {
  const match = DATE_PATTERN.exec(dateValue);
  if (!match || !dateValue.startsWith(`${periodKey}-`)) {
    throw new Error(`Data ${dateValue} não pertence ao período ${periodKey}.`);
  }
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ));
  if (date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() !== Number(match[2]) - 1 ||
      date.getUTCDate() !== Number(match[3])) {
    throw new Error(`Data ${dateValue} é inválida.`);
  }
}

/**
 * Converte timestamp ou data persistida em uma chave mensal.
 * @param {unknown} value Valor temporal.
 * @return {string | null} Período normalizado.
 */
function temporalPeriod(value: unknown): string | null {
  if (typeof value === "string") {
    if (PERIOD_PATTERN.test(value)) return value;
    if (DATE_PATTERN.test(value)) return value.slice(0, 7);
  }
  if (value && typeof value === "object" &&
      "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1)
        .padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Deriva a competência civil atual no timezone financeiro do produto.
 * @param {Date} now Instante usado no cálculo.
 * @return {string} Competência AAAA-MM em America/Sao_Paulo.
 */
export function currentPeriodInSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTHLY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Não foi possível derivar a competência.");
  return `${year}-${month}`;
}

/**
 * Retorna a chave do mês imediatamente seguinte.
 * @param {string} periodKey Período base.
 * @return {string} Próximo período.
 */
function nextPeriod(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1)
    .padStart(2, "0")}`;
}

/**
 * Normaliza uma chave mensal recebida pelo callable.
 * @param {unknown} value Valor bruto.
 * @return {string} Período validado.
 */
function requirePeriodKey(value: unknown): string {
  const period = typeof value === "string" ? value.trim() : "";
  if (!PERIOD_PATTERN.test(period)) throw invalidArgument("periodKey inválido");
  return period;
}

/**
 * Normaliza um segmento simples e seguro de documento.
 * @param {unknown} value Valor bruto.
 * @param {string} field Campo para feedback.
 * @return {string} ID validado.
 */
function requireSafeId(value: unknown, field: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!isSafeDocumentId(id)) throw invalidArgument(`${field} inválido`);
  return id;
}

/**
 * Aceita qualquer UID/ID Firestore simples, inclusive UIDs customizados.
 * @param {string} value Segmento candidato.
 * @return {boolean} True para segmento não vazio e sem barra.
 */
function isSafeDocumentId(value: string): boolean {
  return value.length > 0 && value.length <= 128 &&
    !value.includes("/") && value !== "." && value !== "..";
}

/**
 * Exige UID autenticado e retorna a forma não opcional.
 * @param {string | undefined} uid UID opcional do request.
 * @return {string} UID autenticado.
 */
function requireAuthenticatedUser(uid: string | undefined): string {
  if (!uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Usuário precisa estar autenticado"
    );
  }
  return uid;
}

/**
 * Exige dinheiro positivo em centavos.
 * @param {unknown} value Valor bruto.
 * @param {string} field Campo para feedback.
 * @return {number} Centavos validados.
 */
function requirePositiveCents(value: unknown, field: string): number {
  const cents = requireNonNegativeCents(value, field);
  if (cents <= 0) throw invalidArgument(`${field} deve ser maior que zero`);
  return cents;
}

/**
 * Exige dinheiro não negativo em centavos.
 * @param {unknown} value Valor bruto.
 * @param {string} field Campo para feedback.
 * @return {number} Centavos validados.
 */
function requireNonNegativeCents(value: unknown, field: string): number {
  try {
    return assertCents(value, field);
  } catch {
    throw invalidArgument(`${field} deve ser um inteiro em centavos`);
  }
}

/**
 * Valida um valor monetário lido do Firestore.
 * @param {unknown} value Valor bruto.
 * @param {string} field Campo persistido.
 * @return {number} Centavos validados.
 */
function requireStoredCents(value: unknown, field: string): number {
  try {
    return assertCents(value, field);
  } catch {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Valor persistido inválido: ${field}`
    );
  }
}

/**
 * Converte somente números em valor numérico anulável.
 * @param {unknown} value Valor bruto.
 * @return {number | null} Número ou null.
 */
function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * Seleciona a primeira string não vazia de uma lista.
 * @return {string | null} Primeira string normalizada.
 */
function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Normaliza revision/contador persistido para inteiro seguro.
 * @param {unknown} value Valor bruto.
 * @return {number} Contador não negativo.
 */
function safeRevision(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ?
    value :
    0;
}

/**
 * Cria erro callable padronizado para argumento inválido.
 * @param {string} message Mensagem segura.
 * @return {functions.https.HttpsError} Erro callable.
 */
function invalidArgument(message: string): functions.https.HttpsError {
  return new functions.https.HttpsError("invalid-argument", message);
}

/**
 * Autoriza owner direto ou membership íntegra ACTIVE OWNER/ADMIN.
 * @param {FirebaseFirestore.DocumentSnapshot} groupDoc Grupo atual.
 * @param {FirebaseFirestore.DocumentSnapshot} memberDoc Membership atual.
 * @param {string} userId UID autenticado.
 */
function authorizeMonthlyManager(
  groupDoc: FirebaseFirestore.DocumentSnapshot,
  memberDoc: FirebaseFirestore.DocumentSnapshot,
  userId: string
): void {
  if (!groupDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Grupo não encontrado");
  }
  const group = groupDoc.data() || {};
  if (group.deleted_at != null || group.deletedAt != null ||
      group.status === "DELETED" || group.is_active === false) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Grupo indisponível"
    );
  }
  if (!isActiveGroupManager(
    memberDoc.exists ? memberDoc.data() : undefined,
    group,
    userId
  )) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas owner ou admin ativo do grupo pode gerenciar mensalistas"
    );
  }
}

/**
 * Impede transações que ultrapassem os limites operacionais documentados.
 * @param {number} rosterSize Tamanho do roster.
 * @param {number} memberSize Quantidade de memberships.
 * @param {number} gameSize Quantidade de jogos.
 * @param {number} payerSize Quantidade de cobranças existentes.
 * @param {number} scheduleSize Quantidade de schedules.
 * @param {number} recurringSourceSize Fontes de séries recorrentes.
 */
function assertQueryLimits(
  rosterSize: number,
  memberSize: number,
  gameSize: number,
  payerSize: number,
  scheduleSize: number,
  recurringSourceSize: number
): void {
  if (rosterSize > MAX_MONTHLY_ROSTER_SIZE ||
      payerSize > MAX_MONTHLY_ROSTER_SIZE) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Quantidade de mensalistas excede o limite seguro"
    );
  }
  if (memberSize > MAX_GROUP_MEMBERS_FOR_MONTHLY) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Quantidade de membros do grupo excede o limite seguro"
    );
  }
  if (gameSize > MAX_MONTHLY_GAMES_PER_PERIOD) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Quantidade de jogos no período excede o limite seguro"
    );
  }
  if (scheduleSize > MAX_MONTHLY_SCHEDULES) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Quantidade de schedules excede o limite seguro"
    );
  }
  if (recurringSourceSize > MAX_MONTHLY_RECURRING_SOURCE_GAMES) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Quantidade de fontes recorrentes excede o limite seguro"
    );
  }
}

/**
 * Converte um jogo Firestore no contrato puro de apuração mensal.
 * @param {FirebaseFirestore.QueryDocumentSnapshot} doc Jogo persistido.
 * @return {MonthlyGameInput} Jogo normalizado.
 */
function rawGameForMonthly(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): MonthlyGameInput {
  const data = doc.data() || {};
  const explicitCents = nullableNumber(data.court_cost_cents) ??
    nullableNumber(data.total_cost_cents);
  const legacyTotal = typeof data.total_cost === "number" &&
    Number.isFinite(data.total_cost) && data.total_cost >= 0 ?
    cashboxAmountToCents(data.total_cost) :
    null;
  const legacyDailyPrice = typeof data.daily_price === "number" &&
    Number.isFinite(data.daily_price) && data.daily_price >= 0 ?
    cashboxAmountToCents(data.daily_price) :
    null;
  const recurrence = normalizeRecurrenceType(data.recurrence);
  const recurrenceParentId = optionalSafeId(data.recurrence_parent_id);
  return {
    id: doc.id,
    gameId: doc.id,
    date: typeof data.date === "string" ? data.date : "",
    status: typeof data.status === "string" ? data.status : "",
    courtCostCents: explicitCents ?? legacyTotal ?? legacyDailyPrice,
    explicitlyExcluded: data.excluded_from_monthly_finance === true ||
      data.monthly_finance_excluded === true,
    source: optionalSafeId(data.schedule_id) ?
      "SCHEDULE" : recurrence ? "RECURRENCE" : "GAME",
    scheduleId: optionalSafeId(data.schedule_id),
    seriesId: recurrenceParentId ?? (recurrence ? doc.id : null),
    label: firstNonEmptyString(
      data.name,
      data.title,
      data.location_name,
      data.field_name
    ),
    recurrence,
    recurrenceIndex: positiveInteger(data.recurrence_index),
    recurrenceCount: positiveInteger(data.recurrence_count),
    recurrenceEndDate: normalizeCivilDate(data.recurrence_end_date),
    recurrenceCancelled: data.recurrence_cancelled === true,
  };
}

/**
 * Converte um schedule Firestore para o expansor mensal puro.
 * @param {FirebaseFirestore.QueryDocumentSnapshot} doc Schedule persistido.
 * @return {MonthlyScheduleInput} Schedule normalizado.
 */
function rawScheduleForMonthly(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): MonthlyScheduleInput {
  const data = doc.data() || {};
  const explicitCents = nullableNumber(data.court_cost_cents) ??
    nullableNumber(data.total_cost_cents);
  const legacyDailyPrice = typeof data.daily_price === "number" &&
    Number.isFinite(data.daily_price) && data.daily_price >= 0 ?
    cashboxAmountToCents(data.daily_price) : null;
  const rawExceptions = Array.isArray(data.exceptions) ? data.exceptions : [];
  return {
    id: doc.id,
    active: data.is_active !== false,
    recurrenceType: typeof data.recurrence_type === "string" ?
      data.recurrence_type : "weekly",
    dayOfWeek: typeof data.day_of_week === "number" ? data.day_of_week : -1,
    anchorDate: normalizeCivilDate(
      data.start_date ?? data.anchor_date ?? data.starts_at ?? data.created_at
    ),
    endDate: normalizeCivilDate(data.end_date ?? data.ends_at),
    exceptions: rawExceptions
      .map((value) => normalizeCivilDate(value))
      .filter((value): value is string => value != null),
    courtCostCents: explicitCents ?? legacyDailyPrice,
    label: firstNonEmptyString(
      data.name,
      data.location_name,
      data.field_name
    ),
  };
}

/**
 * Preserva HttpsError e converte falhas inesperadas sem vazar detalhes.
 * @param {unknown} error Erro original.
 * @param {string} action Ação para log operacional.
 * @param {string} groupId Grupo afetado.
 */
function throwMonthlyCallableError(
  error: unknown,
  action: string,
  groupId: string
): never {
  if (error instanceof functions.https.HttpsError) throw error;
  logger.error(`[MONTHLY_FINANCE] Falha ao ${action} no grupo ${groupId}`, error);
  throw new functions.https.HttpsError(
    "internal",
    "Não foi possível concluir a operação financeira mensal"
  );
}
