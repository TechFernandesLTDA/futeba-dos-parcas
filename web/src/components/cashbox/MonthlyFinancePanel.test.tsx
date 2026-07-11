import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { MonthlyFinancePanel } from './MonthlyFinancePanel';
import type { MonthlyFinanceInput } from '../../utils/monthlyFinance';

const input: MonthlyFinanceInput = {
  periodKey: '2026-07',
  pricingMode: 'FIXED_MONTHLY',
  fixedMonthlyCostCents: 120_00,
  games: [
    { id: 'g1', date: '2026-07-02', status: 'FINISHED' },
    { id: 'g2', date: '2026-07-09', status: 'CONFIRMED' },
    { id: 'g3', date: '2026-07-16', status: 'SCHEDULED' },
    { id: 'g4', date: '2026-07-23', status: 'SCHEDULED' },
  ],
  members: [
    { userId: 'ana', name: 'Ana', isMonthly: true, paidCents: 6000 },
    { userId: 'bia', name: 'Bia', isMonthly: true },
    { userId: 'caio', name: 'Caio', isMonthly: false },
  ],
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof MonthlyFinancePanel>> = {}) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MonthlyFinancePanel input={input} canManage {...overrides} />
    </ThemeProvider>,
  );
}

describe('MonthlyFinancePanel', () => {
  it('mostra o total, jogos reais e somente mensalistas no divisor', () => {
    renderPanel();

    expect(screen.getByText('julho de 2026')).toBeInTheDocument();
    expect(screen.getByText('2 de 3 mensalistas')).toBeInTheDocument();
    expect(screen.getByText(/120,00/)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText(/30,00/)).toHaveLength(5);
    expect(screen.getByText('Jogador avulso — não entra no rateio')).toBeInTheDocument();
  });

  it('navega de mês sem calcular datas no componente pai', () => {
    const onPeriodChange = vi.fn();
    renderPanel({ onPeriodChange });

    fireEvent.click(screen.getByRole('button', { name: 'Ver agosto de 2026' }));

    expect(onPeriodChange).toHaveBeenCalledWith('2026-08');
  });

  it('permite ao gestor escolher mensalista e dar baixa individual', () => {
    const onToggleMonthlyMember = vi.fn();
    const onSettleMember = vi.fn();
    renderPanel({ onToggleMonthlyMember, onSettleMember });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Caio é mensalista' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dar baixa de R$ 60,00' }));

    expect(onToggleMonthlyMember).toHaveBeenCalledWith('caio', true);
    expect(onSettleMember).toHaveBeenCalledWith({
      periodKey: '2026-07',
      userId: 'bia',
      userName: 'Bia',
      expectedCents: 6000,
      alreadyPaidCents: 0,
      amountToSettleCents: 6000,
    });
  });

  it('fica somente leitura para membros comuns', () => {
    renderPanel({ canManage: false });

    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dar baixa/ })).not.toBeInTheDocument();
  });

  it('mantém feriados visíveis e permite reincluir com uma ação direta', () => {
    const onSetGameOverride = vi.fn();
    const inputWithHoliday: MonthlyFinanceInput = {
      ...input,
      games: input.games.map((game) => game.id === 'g2' ? {
        ...game,
        source: 'SCHEDULE',
        label: 'Quinta à noite',
        included: false,
        exclusionReason: 'HOLIDAY',
        manualOverride: { excluded: true, costCents: null, reason: 'HOLIDAY' },
      } : game),
    };

    renderPanel({ input: inputWithHoliday, onSetGameOverride });

    expect(screen.getByText('Feriado')).toBeInTheDocument();
    expect(screen.getByText('Agenda fixa')).toBeInTheDocument();
    expect(screen.getByText('Quinta à noite')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {
      name: /Incluir quinta-feira, 09 de julho no rateio/i,
    }));

    expect(onSetGameOverride).toHaveBeenCalledWith({
      occurrenceId: 'g2',
      excluded: false,
      costCents: null,
      reason: null,
    });
  });

  it('edita custo individual e marca uma ocorrência como feriado', () => {
    const onSetGameOverride = vi.fn();
    renderPanel({
      input: {
        ...input,
        pricingMode: 'PER_GAME',
        fixedMonthlyCostCents: undefined,
        defaultGameCostCents: 3000,
      },
      onSetGameOverride,
    });

    const costInput = screen.getByRole('textbox', {
      name: /Custo de quinta-feira, 02 de julho/i,
    });
    fireEvent.change(costInput, { target: { value: '250,00' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar custo' })[0]);
    fireEvent.click(screen.getByRole('button', {
      name: /Marcar quinta-feira, 02 de julho como feriado/i,
    }));

    expect(onSetGameOverride).toHaveBeenNthCalledWith(1, {
      occurrenceId: 'g1',
      excluded: false,
      costCents: 25_000,
      reason: null,
    });
    expect(onSetGameOverride).toHaveBeenNthCalledWith(2, {
      occurrenceId: 'g1',
      excluded: true,
      costCents: null,
      reason: 'HOLIDAY',
    });
  });

  it('não oferece custo individual em contrato fixo nem reinclusão de jogo cancelado', () => {
    renderPanel({
      input: {
        ...input,
        games: input.games.map((game) => game.id === 'g1'
          ? { ...game, status: 'CANCELLED', included: false }
          : game),
      },
      onSetGameOverride: vi.fn(),
    });

    expect(screen.queryByRole('textbox', { name: /Custo de/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Incluir quinta-feira, 02 de julho/i }))
      .toBeDisabled();
    expect(screen.getByText('Cancelado no jogo')).toBeInTheDocument();
  });

  it('mostra carregamento e erro na própria ocorrência', () => {
    renderPanel({
      busyGameIds: new Set(['g1']),
      gameOverrideErrors: { g1: 'A agenda mudou. Tente novamente.' },
      onSetGameOverride: vi.fn(),
    });

    expect(screen.getByRole('status')).toHaveTextContent(/Atualizando rateio/i);
    expect(screen.getByRole('alert')).toHaveTextContent('A agenda mudou. Tente novamente.');
    expect(screen.getByRole('button', {
      name: /Marcar quinta-feira, 02 de julho como feriado/i,
    })).toBeDisabled();
  });
});
