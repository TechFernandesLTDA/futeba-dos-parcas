import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { MonthlyFinanceMemberSummary } from './MonthlyFinanceMemberSummary';
import type {
  MonthlyFinancePayerRecord,
  MonthlyFinancePeriodRecord,
} from '../../hooks/useMonthlyFinance';

const period: MonthlyFinancePeriodRecord = {
  periodKey: '2026-07',
  pricingMode: 'FIXED_MONTHLY',
  fixedMonthlyCostCents: 80_000,
  defaultGameCostCents: null,
  status: 'FINALIZED',
  revision: 2,
  totalCourtCostCents: 80_000,
  gameCount: 4,
  excludedGameCount: 1,
  groupMemberCount: 20,
  monthlyMemberCount: 10,
  averagePerGameCents: 20_000,
  averagePerMonthlyMemberCents: 8_000,
  receivedCents: 72_000,
  openCents: 8_000,
  gameSnapshot: [],
};

const payer: MonthlyFinancePayerRecord = {
  userId: 'user-1',
  userName: 'Jordi',
  active: true,
  expectedCents: 8_000,
  paidCents: 3_000,
  outstandingCents: 5_000,
  status: 'PARTIAL',
  revision: 1,
};

describe('MonthlyFinanceMemberSummary', () => {
  it('mostra somente resumo e pagamento próprio no modo privado', () => {
    const onPeriodChange = vi.fn();
    render(
      <ThemeProvider theme={createTheme()}>
        <MonthlyFinanceMemberSummary
          period={period}
          payer={payer}
          isMonthlyMember
          accessLimited
          onPeriodChange={onPeriodChange}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('Meu mensal')).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText(/5.000|50,00/)).toBeInTheDocument();
    expect(screen.getByText(/privacidade/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver agosto de 2026' }));
    expect(onPeriodChange).toHaveBeenCalledWith('2026-08');
  });
});
