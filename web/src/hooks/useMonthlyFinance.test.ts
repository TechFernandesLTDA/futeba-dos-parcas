import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../utils/userBatch', () => ({ getUsersByIds: vi.fn() }));

import {
  buildMonthlyFinanceInput,
  mapMonthlyFinanceConfig,
  mapMonthlyFinancePayer,
  mapMonthlyFinancePeriod,
} from './useMonthlyFinance';

describe('monthly finance Firestore mapping', () => {
  it('mapeia config e período canônicos em snake_case', () => {
    const config = mapMonthlyFinanceConfig({
      pricing_mode: 'FIXED_MONTHLY',
      fixed_monthly_cost_cents: 80_000,
      default_game_cost_cents: null,
      revision: 3,
    });
    const period = mapMonthlyFinancePeriod({
      period_key: '2026-07',
      pricing_mode: 'FIXED_MONTHLY',
      fixed_monthly_cost_cents: 80_000,
      status: 'FINALIZED',
      total_court_cost_cents: 80_000,
      game_count: 4,
      excluded_game_count: 1,
      group_member_count: 20,
      monthly_member_count: 10,
      average_per_game_cents: 20_000,
      average_per_monthly_member_cents: 8_000,
      received_cents: 72_000,
      open_cents: 8_000,
      game_snapshot: [{
        id: 'game-1',
        date: '2026-07-02',
        status: 'FINISHED',
        source: 'SCHEDULE',
        schedule_id: 'schedule-1',
        label: 'Quinta à noite',
        court_cost_cents: 20_000,
        allocated_cost_cents: 20_000,
        included: true,
        exclusion_reason: null,
        manual_override: {
          excluded: false,
          cost_cents: 20_000,
          reason: null,
          updated_by: 'owner-1',
        },
      }],
    });

    expect(config).toMatchObject({ fixedMonthlyCostCents: 80_000, revision: 3 });
    expect(period).toMatchObject({
      periodKey: '2026-07',
      status: 'FINALIZED',
      totalCourtCostCents: 80_000,
    });
    expect(period.gameSnapshot[0]).toMatchObject({
      id: 'game-1',
      authoritativeAllocatedCostCents: 20_000,
      included: true,
      source: 'SCHEDULE',
      scheduleId: 'schedule-1',
      label: 'Quinta à noite',
      manualOverride: { excluded: false, costCents: 20_000, reason: null },
    });
  });

  it('mapeia payer autoritativo e ignora identidade divergente no builder', () => {
    const period = mapMonthlyFinancePeriod({
      period_key: '2026-07',
      pricing_mode: 'FIXED_MONTHLY',
      total_court_cost_cents: 10_001,
      game_count: 1,
      game_snapshot: [{
        id: 'game-1',
        date: '2026-07-02',
        status: 'FINISHED',
        allocated_cost_cents: 10_001,
        included: true,
      }],
    });
    const payerA = mapMonthlyFinancePayer('a', {
      user_id: 'a',
      active: true,
      expected_cents: 5001,
      paid_cents: 5001,
      outstanding_cents: 0,
      status: 'PAID',
      user_name: 'Ana',
    });
    const payerB = mapMonthlyFinancePayer('b', {
      user_id: 'b',
      active: true,
      expected_cents: 5000,
      paid_cents: 0,
      outstanding_cents: 5000,
      status: 'PENDING',
      user_name: 'Bia',
    });

    const input = buildMonthlyFinanceInput(
      period,
      null,
      [
        { userId: 'a', name: 'Ana' },
        { userId: 'b', name: 'Bia' },
        { userId: 'guest', name: 'Avulso' },
      ],
      { a: true, b: true, guest: false },
      { a: payerA, b: payerB },
    );

    expect(input).toMatchObject({
      authoritativeTotalCourtCostCents: 10_001,
      members: [
        { userId: 'a', isMonthly: true, authoritativeExpectedCents: 5001 },
        { userId: 'b', isMonthly: true, authoritativeExpectedCents: 5000 },
        { userId: 'guest', isMonthly: false },
      ],
    });
  });

  it('degrada campos inválidos para valores seguros', () => {
    expect(mapMonthlyFinancePayer('user-1', {
      user_id: 'other-user',
      expected_cents: -1,
      paid_cents: 1.5,
      status: 'UNKNOWN',
    })).toMatchObject({
      userId: 'other-user',
      expectedCents: 0,
      paidCents: 0,
      status: 'PENDING',
      active: false,
    });
  });

  it('preserva payer histórico mesmo após sair do grupo e ignora roster atual', () => {
    const period = mapMonthlyFinancePeriod({
      period_key: '2026-06',
      pricing_mode: 'FIXED_MONTHLY',
      status: 'FINALIZED',
      total_court_cost_cents: 5000,
      game_snapshot: [],
    });
    const oldPayer = mapMonthlyFinancePayer('old-player', {
      user_id: 'old-player',
      user_name: 'Ex-jogador',
      active: true,
      expected_cents: 5000,
      paid_cents: 5000,
      outstanding_cents: 0,
      status: 'PAID',
    });

    const input = buildMonthlyFinanceInput(
      period,
      null,
      [{ userId: 'current-player', name: 'Atual' }],
      { 'current-player': true, 'old-player': false },
      { 'old-player': oldPayer },
    );

    expect(input?.members).toEqual([
      expect.objectContaining({ userId: 'current-player', isMonthly: false }),
      expect.objectContaining({
        userId: 'old-player',
        name: 'Ex-jogador',
        isMonthly: true,
        authoritativeExpectedCents: 5000,
      }),
    ]);
  });

  it('usa o snapshot de pagantes em DRAFT mesmo quando o roster atual já mudou', () => {
    const period = mapMonthlyFinancePeriod({
      period_key: '2026-06',
      pricing_mode: 'FIXED_MONTHLY',
      status: 'DRAFT',
      total_court_cost_cents: 10_000,
      game_snapshot: [],
    });
    const historicalPayer = mapMonthlyFinancePayer('historical', {
      user_id: 'historical',
      user_name: 'Mensalista do período',
      active: true,
      expected_cents: 10_000,
      paid_cents: 0,
      outstanding_cents: 10_000,
      status: 'PENDING',
    });

    const input = buildMonthlyFinanceInput(
      period,
      null,
      [
        { userId: 'historical', name: 'Mensalista do período' },
        { userId: 'new-member', name: 'Novo mensalista' },
      ],
      { historical: false, 'new-member': true },
      { historical: historicalPayer },
    );

    expect(input?.members).toEqual([
      expect.objectContaining({ userId: 'historical', isMonthly: true }),
      expect.objectContaining({ userId: 'new-member', isMonthly: false }),
    ]);
  });
});
