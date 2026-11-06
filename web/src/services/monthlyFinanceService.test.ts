import { beforeEach, describe, expect, it, vi } from 'vitest';

const { httpsCallableMock, functionsMock } = vi.hoisted(() => ({
  httpsCallableMock: vi.fn((..._args: unknown[]) => vi.fn()),
  functionsMock: { region: 'southamerica-east1' },
}));

vi.mock('firebase/functions', () => ({ httpsCallable: httpsCallableMock }));
vi.mock('./firebaseFunctions', () => ({ functions: functionsMock }));

describe('monthlyFinanceService', () => {
  beforeEach(() => {
    httpsCallableMock.mockClear();
    vi.resetModules();
  });

  it('solicita tokens App Check de uso limitado em todos os writes', async () => {
    await import('./monthlyFinanceService');

    expect(httpsCallableMock).toHaveBeenCalledTimes(5);
    for (const call of httpsCallableMock.mock.calls) {
      expect(call[0]).toBe(functionsMock);
      expect(call[2]).toEqual({ limitedUseAppCheckTokens: true });
    }
    expect(httpsCallableMock.mock.calls.map((call) => call[1])).toEqual([
      'configureMonthlyFinance',
      'setMonthlyMember',
      'rebuildMonthlyCycle',
      'settleMonthlyCharge',
      'setMonthlyGameOverride',
    ]);
  });
});
