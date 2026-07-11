export type MonthlyCourtPricingMode = 'FIXED_MONTHLY' | 'PER_GAME';

export type MonthlyFinanceGameStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'LIVE'
  | 'FINISHED'
  | 'CANCELLED';

export type MonthlyPayerStatus = 'PAID' | 'PENDING' | 'PARTIAL' | 'EXEMPT';

export type MonthlyFinanceGameSource = 'GAME' | 'SCHEDULE' | 'RECURRENCE';

export type MonthlyFinanceExclusionReason = 'HOLIDAY' | 'CANCELLED' | 'OTHER';

export interface MonthlyFinanceGameOverride {
  excluded: boolean;
  costCents: number | null;
  reason: MonthlyFinanceExclusionReason | null;
}

export interface MonthlyFinanceGame {
  id: string;
  date: string;
  status: MonthlyFinanceGameStatus;
  source?: MonthlyFinanceGameSource;
  scheduleId?: string;
  label?: string;
  courtCostCents?: number;
  authoritativeAllocatedCostCents?: number;
  included?: boolean;
  exclusionReason?: MonthlyFinanceExclusionReason;
  manualOverride?: MonthlyFinanceGameOverride;
}

export interface MonthlyFinanceMember {
  userId: string;
  name: string;
  photoUrl?: string;
  isMonthly: boolean;
  paidCents?: number;
  authoritativeExpectedCents?: number;
  exempt?: boolean;
}

export interface MonthlyFinanceInput {
  periodKey: string;
  pricingMode: MonthlyCourtPricingMode;
  fixedMonthlyCostCents?: number;
  defaultGameCostCents?: number;
  authoritativeTotalCourtCostCents?: number;
  games: MonthlyFinanceGame[];
  members: MonthlyFinanceMember[];
}

export interface MonthlyGameShare extends MonthlyFinanceGame {
  allocatedCostCents: number;
}

export interface MonthlyMemberShare extends MonthlyFinanceMember {
  expectedCents: number;
  paidCents: number;
  openCents: number;
  status: MonthlyPayerStatus;
}

export interface MonthlyFinanceSummary {
  periodKey: string;
  pricingMode: MonthlyCourtPricingMode;
  games: MonthlyGameShare[];
  excludedGamesCount: number;
  groupMembersCount: number;
  monthlyMembersCount: number;
  payingMonthlyMembersCount: number;
  exemptMonthlyMembersCount: number;
  totalCourtCostCents: number;
  averagePerGameCents: number | null;
  averagePerPayingMonthlyMemberCents: number | null;
  receivedCents: number;
  openCents: number;
  members: MonthlyMemberShare[];
}

const PERIOD_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function assertCents(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} deve ser um valor inteiro e não negativo em centavos.`);
  }
  return value;
}

function allocateCents(totalCents: number, ids: string[]): Map<string, number> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;

  const stableIds = [...ids].sort((left, right) => left.localeCompare(right));
  const baseShare = Math.floor(totalCents / stableIds.length);
  const remainder = totalCents % stableIds.length;

  stableIds.forEach((id, index) => {
    result.set(id, baseShare + (index < remainder ? 1 : 0));
  });

  return result;
}

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function getPeriodGames(periodKey: string, games: MonthlyFinanceGame[]) {
  const included: MonthlyFinanceGame[] = [];
  let excludedGamesCount = 0;

  games.forEach((game) => {
    if (!isValidIsoDate(game.date)) {
      throw new Error(`Data inválida no jogo ${game.id}. Use AAAA-MM-DD.`);
    }

    if (
      !game.date.startsWith(`${periodKey}-`) ||
      game.status === 'CANCELLED' ||
      game.included === false
    ) {
      excludedGamesCount += 1;
      return;
    }

    included.push(game);
  });

  return {
    included: included.sort((left, right) => left.date.localeCompare(right.date)),
    excludedGamesCount,
  };
}

function calculateCourtTotal(
  input: MonthlyFinanceInput,
  games: MonthlyFinanceGame[],
): number {
  if (input.authoritativeTotalCourtCostCents !== undefined) {
    return assertCents(
      input.authoritativeTotalCourtCostCents,
      'authoritativeTotalCourtCostCents',
    );
  }

  if (input.pricingMode === 'FIXED_MONTHLY') {
    return assertCents(input.fixedMonthlyCostCents ?? Number.NaN, 'fixedMonthlyCostCents');
  }

  const defaultGameCostCents = input.defaultGameCostCents;
  if (defaultGameCostCents !== undefined) {
    assertCents(defaultGameCostCents, 'defaultGameCostCents');
  }

  return games.reduce((total, game) => {
    const value = game.courtCostCents ?? defaultGameCostCents;
    return assertCents(
      total + assertCents(value ?? Number.NaN, `courtCostCents do jogo ${game.id}`),
      'totalCourtCostCents',
    );
  }, 0);
}

function payerStatus(
  expectedCents: number,
  paidCents: number,
  exempt: boolean,
): MonthlyPayerStatus {
  if (exempt) return 'EXEMPT';
  if (paidCents >= expectedCents) return 'PAID';
  if (paidCents > 0) return 'PARTIAL';
  return 'PENDING';
}

export function calculateMonthlyFinance(input: MonthlyFinanceInput): MonthlyFinanceSummary {
  if (!PERIOD_KEY_PATTERN.test(input.periodKey)) {
    throw new Error('periodKey inválido. Use AAAA-MM.');
  }

  const memberIds = new Set<string>();
  input.members.forEach((member) => {
    if (!member.userId || memberIds.has(member.userId)) {
      throw new Error('Cada membro precisa ter um userId único.');
    }
    memberIds.add(member.userId);
    assertCents(member.paidCents ?? 0, `paidCents de ${member.userId}`);
  });

  const gameIds = new Set<string>();
  input.games.forEach((game) => {
    if (!game.id || gameIds.has(game.id)) {
      throw new Error('Cada jogo precisa ter um id único.');
    }
    gameIds.add(game.id);
  });

  const { included: periodGames, excludedGamesCount } = getPeriodGames(
    input.periodKey,
    input.games,
  );
  const totalCourtCostCents = calculateCourtTotal(input, periodGames);
  const gameAllocation = allocateCents(
    totalCourtCostCents,
    periodGames.map((game) => game.id),
  );
  const hasCompleteAuthoritativeGameShares = periodGames.length > 0 &&
    periodGames.every((game) => game.authoritativeAllocatedCostCents !== undefined);
  if (
    hasCompleteAuthoritativeGameShares &&
    periodGames.reduce(
      (total, game) => total + (game.authoritativeAllocatedCostCents ?? 0),
      0,
    ) !== totalCourtCostCents
  ) {
    throw new Error('O custo salvo dos jogos está desatualizado. Recalcule o mês.');
  }
  const monthlyMembers = input.members.filter((member) => member.isMonthly);
  const payingMonthlyMembers = monthlyMembers.filter((member) => !member.exempt);
  const hasCompleteAuthoritativeShares = payingMonthlyMembers.length > 0 &&
    payingMonthlyMembers.every((member) => member.authoritativeExpectedCents !== undefined);
  const memberAllocation = hasCompleteAuthoritativeShares
    ? new Map(payingMonthlyMembers.map((member) => [
      member.userId,
      assertCents(
        member.authoritativeExpectedCents ?? Number.NaN,
        `authoritativeExpectedCents de ${member.userId}`,
      ),
    ]))
    : allocateCents(
      totalCourtCostCents,
      payingMonthlyMembers.map((member) => member.userId),
    );

  if (
    hasCompleteAuthoritativeShares &&
    [...memberAllocation.values()].reduce((total, value) => total + value, 0) !== totalCourtCostCents
  ) {
    throw new Error('O rateio salvo está desatualizado. Recalcule o mês.');
  }

  const members = input.members.map<MonthlyMemberShare>((member) => {
    if (!member.isMonthly) {
      return {
        ...member,
        expectedCents: 0,
        paidCents: 0,
        openCents: 0,
        status: 'PENDING',
      };
    }

    const allocatedCents = memberAllocation.get(member.userId) ?? 0;
    const expectedCents = member.exempt ? 0 : allocatedCents;
    const paidCents = member.paidCents ?? 0;
    return {
      ...member,
      expectedCents,
      paidCents,
      openCents: Math.max(expectedCents - paidCents, 0),
      status: payerStatus(expectedCents, paidCents, member.exempt === true),
    };
  });

  const receivedCents = members.reduce(
    (total, member) => total + Math.min(member.paidCents, member.expectedCents),
    0,
  );

  return {
    periodKey: input.periodKey,
    pricingMode: input.pricingMode,
    games: periodGames.map((game) => ({
      ...game,
      allocatedCostCents: game.authoritativeAllocatedCostCents !== undefined
        ? assertCents(
          game.authoritativeAllocatedCostCents,
          `authoritativeAllocatedCostCents do jogo ${game.id}`,
        )
        : input.pricingMode === 'PER_GAME' && input.authoritativeTotalCourtCostCents === undefined
        ? assertCents(
          game.courtCostCents ?? input.defaultGameCostCents ?? Number.NaN,
          `courtCostCents do jogo ${game.id}`,
        )
        : gameAllocation.get(game.id) ?? 0,
    })),
    excludedGamesCount,
    groupMembersCount: input.members.length,
    monthlyMembersCount: monthlyMembers.length,
    payingMonthlyMembersCount: payingMonthlyMembers.length,
    exemptMonthlyMembersCount: monthlyMembers.length - payingMonthlyMembers.length,
    totalCourtCostCents,
    averagePerGameCents: periodGames.length > 0
      ? Math.round(totalCourtCostCents / periodGames.length)
      : null,
    averagePerPayingMonthlyMemberCents: payingMonthlyMembers.length > 0
      ? Math.round(totalCourtCostCents / payingMonthlyMembers.length)
      : null,
    receivedCents,
    openCents: Math.max(totalCourtCostCents - receivedCents, 0),
    members,
  };
}

export function shiftMonthlyPeriod(periodKey: string, offset: number): string {
  const match = PERIOD_KEY_PATTERN.exec(periodKey);
  if (!match || !Number.isInteger(offset)) {
    throw new Error('Período ou deslocamento inválido.');
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
