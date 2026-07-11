import { describe, expect, it } from 'vitest';
import {
  calculateMonthlyFinance,
  shiftMonthlyPeriod,
  type MonthlyFinanceInput,
} from './monthlyFinance';

const baseInput: MonthlyFinanceInput = {
  periodKey: '2026-07',
  pricingMode: 'FIXED_MONTHLY',
  fixedMonthlyCostCents: 100_00,
  games: [
    { id: 'game-1', date: '2026-07-02', status: 'FINISHED' },
    { id: 'game-2', date: '2026-07-09', status: 'CONFIRMED' },
    { id: 'game-3', date: '2026-07-16', status: 'SCHEDULED' },
    { id: 'game-4', date: '2026-07-23', status: 'SCHEDULED' },
  ],
  members: [
    { userId: 'a', name: 'Ana', isMonthly: true, paidCents: 3334 },
    { userId: 'b', name: 'Bia', isMonthly: true, paidCents: 1000 },
    { userId: 'c', name: 'Caio', isMonthly: true },
    { userId: 'guest', name: 'Convidado', isMonthly: false },
  ],
};

describe('calculateMonthlyFinance', () => {
  it('rateia todos os centavos somente entre mensalistas', () => {
    const result = calculateMonthlyFinance(baseInput);

    expect(result.monthlyMembersCount).toBe(3);
    expect(result.members.map((member) => member.expectedCents)).toEqual([3334, 3333, 3333, 0]);
    expect(result.members.map((member) => member.status)).toEqual([
      'PAID',
      'PARTIAL',
      'PENDING',
      'PENDING',
    ]);
    expect(result.members.reduce((total, member) => total + member.expectedCents, 0)).toBe(100_00);
    expect(result.receivedCents).toBe(4334);
    expect(result.openCents).toBe(5666);
  });

  it.each([3, 4, 5])('preserva o total mensal com %i jogos reais', (gamesCount) => {
    const input: MonthlyFinanceInput = {
      ...baseInput,
      games: baseInput.games.slice(0, gamesCount),
    };
    if (gamesCount === 5) {
      input.games = [
        ...baseInput.games,
        { id: 'game-5', date: '2026-07-30', status: 'SCHEDULED' },
      ];
    }

    const result = calculateMonthlyFinance(input);

    expect(result.games).toHaveLength(gamesCount);
    expect(result.games.reduce((total, game) => total + game.allocatedCostCents, 0)).toBe(100_00);
  });

  it('exclui feriados cancelados e jogos de outro mês', () => {
    const result = calculateMonthlyFinance({
      ...baseInput,
      games: [
        ...baseInput.games,
        { id: 'holiday', date: '2026-07-30', status: 'CANCELLED' },
        { id: 'excluded', date: '2026-07-30', status: 'SCHEDULED', included: false },
        { id: 'august', date: '2026-08-06', status: 'SCHEDULED' },
      ],
    });

    expect(result.games).toHaveLength(4);
    expect(result.excludedGamesCount).toBe(3);
  });

  it('preserva a origem e o override auditável nas ocorrências incluídas', () => {
    const result = calculateMonthlyFinance({
      ...baseInput,
      games: [{
        id: 'schedule-2026-07-02',
        date: '2026-07-02',
        status: 'SCHEDULED',
        source: 'SCHEDULE',
        scheduleId: 'schedule-1',
        label: 'Quinta à noite',
        courtCostCents: 2500,
        manualOverride: { excluded: false, costCents: 2500, reason: null },
      }],
    });

    expect(result.games[0]).toMatchObject({
      source: 'SCHEDULE',
      scheduleId: 'schedule-1',
      label: 'Quinta à noite',
      allocatedCostCents: 10_000,
      manualOverride: { excluded: false, costCents: 2500, reason: null },
    });
  });

  it('soma valores por jogo quando o contrato não é mensal fixo', () => {
    const result = calculateMonthlyFinance({
      ...baseInput,
      pricingMode: 'PER_GAME',
      fixedMonthlyCostCents: undefined,
      defaultGameCostCents: 25_00,
    });

    expect(result.totalCourtCostCents).toBe(100_00);
    expect(result.games.every((game) => game.allocatedCostCents === 25_00)).toBe(true);
  });

  it('mantém isento visível e redistribui todos os centavos entre pagantes', () => {
    const result = calculateMonthlyFinance({
      ...baseInput,
      members: [
        { userId: 'a', name: 'Ana', isMonthly: true, exempt: true },
        { userId: 'b', name: 'Bia', isMonthly: true, paidCents: 10_000 },
      ],
    });

    expect(result.members[0]).toMatchObject({ status: 'EXEMPT', expectedCents: 0 });
    expect(result.members[1]).toMatchObject({ status: 'PAID', expectedCents: 10_000 });
    expect(result.monthlyMembersCount).toBe(2);
    expect(result.payingMonthlyMembersCount).toBe(1);
    expect(result.exemptMonthlyMembersCount).toBe(1);
    expect(result.members.reduce((total, member) => total + member.expectedCents, 0)).toBe(10_000);
    expect(result.openCents).toBe(0);
  });

  it('mantém o custo em aberto quando todos os mensalistas são isentos', () => {
    const result = calculateMonthlyFinance({
      ...baseInput,
      members: [
        { userId: 'a', name: 'Ana', isMonthly: true, exempt: true },
        { userId: 'b', name: 'Bia', isMonthly: true, exempt: true },
      ],
    });

    expect(result.payingMonthlyMembersCount).toBe(0);
    expect(result.members.every((member) => member.expectedCents === 0)).toBe(true);
    expect(result.openCents).toBe(10_000);
  });

  it('preserva o rateio autoritativo do servidor', () => {
    const result = calculateMonthlyFinance({
      ...baseInput,
      authoritativeTotalCourtCostCents: 10_001,
      members: [
        {
          userId: 'a',
          name: 'Ana',
          isMonthly: true,
          authoritativeExpectedCents: 5001,
        },
        {
          userId: 'b',
          name: 'Bia',
          isMonthly: true,
          authoritativeExpectedCents: 5000,
        },
      ],
    });

    expect(result.totalCourtCostCents).toBe(10_001);
    expect(result.members.map((member) => member.expectedCents)).toEqual([5001, 5000]);
  });

  it('rejeita snapshot autoritativo inconsistente', () => {
    expect(() => calculateMonthlyFinance({
      ...baseInput,
      authoritativeTotalCourtCostCents: 10_000,
      members: [
        {
          userId: 'a',
          name: 'Ana',
          isMonthly: true,
          authoritativeExpectedCents: 4999,
        },
        {
          userId: 'b',
          name: 'Bia',
          isMonthly: true,
          authoritativeExpectedCents: 5000,
        },
      ],
    })).toThrow(/Recalcule/);
  });

  it('rejeita alocação autoritativa de jogos que não fecha o total', () => {
    expect(() => calculateMonthlyFinance({
      ...baseInput,
      authoritativeTotalCourtCostCents: 10_000,
      games: [
        {
          id: 'game-1',
          date: '2026-07-02',
          status: 'FINISHED',
          authoritativeAllocatedCostCents: 9999,
        },
      ],
    })).toThrow(/custo salvo dos jogos/);
  });

  it('rejeita dinheiro fracionário, negativo ou incompleto', () => {
    expect(() => calculateMonthlyFinance({
      ...baseInput,
      fixedMonthlyCostCents: 10.5,
    })).toThrow(/inteiro/);

    expect(() => calculateMonthlyFinance({
      ...baseInput,
      pricingMode: 'PER_GAME',
      fixedMonthlyCostCents: undefined,
      defaultGameCostCents: undefined,
    })).toThrow(/courtCostCents/);
  });

  it('rejeita IDs duplicados e datas inexistentes', () => {
    expect(() => calculateMonthlyFinance({
      ...baseInput,
      games: [baseInput.games[0], baseInput.games[0]],
    })).toThrow(/id único/);

    expect(() => calculateMonthlyFinance({
      ...baseInput,
      games: [{ id: 'invalid-date', date: '2026-02-31', status: 'SCHEDULED' }],
    })).toThrow(/Data inválida/);
  });
});

describe('shiftMonthlyPeriod', () => {
  it('navega corretamente entre anos', () => {
    expect(shiftMonthlyPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthlyPeriod('2026-12', 1)).toBe('2027-01');
  });
});
