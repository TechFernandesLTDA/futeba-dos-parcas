import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MonthlyFinanceConfigDialog } from './MonthlyFinanceConfigDialog';

describe('MonthlyFinanceConfigDialog', () => {
  it('envia valor mensal como centavos inteiros', () => {
    const onSubmit = vi.fn();
    render(
      <MonthlyFinanceConfigDialog
        open
        groupId="group-1"
        config={null}
        saving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Valor da quadra' }), {
      target: { value: '800,00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e recalcular' }));

    expect(onSubmit).toHaveBeenCalledWith({
      groupId: 'group-1',
      pricingMode: 'FIXED_MONTHLY',
      fixedMonthlyCostCents: 80_000,
    });
  });

  it('envia somente o custo padrão quando a cobrança é por jogo', () => {
    const onSubmit = vi.fn();
    render(
      <MonthlyFinanceConfigDialog
        open
        groupId="group-1"
        config={null}
        saving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Por jogo' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor da quadra' }), {
      target: { value: '200' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e recalcular' }));

    expect(onSubmit).toHaveBeenCalledWith({
      groupId: 'group-1',
      pricingMode: 'PER_GAME',
      defaultGameCostCents: 20_000,
    });
  });

  it('permite custo padrão vazio no modo por jogo', () => {
    const onSubmit = vi.fn();
    render(
      <MonthlyFinanceConfigDialog
        open
        groupId="group-1"
        config={null}
        saving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Por jogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e recalcular' }));

    expect(onSubmit).toHaveBeenCalledWith({
      groupId: 'group-1',
      pricingMode: 'PER_GAME',
      defaultGameCostCents: null,
    });
    expect(screen.getByText(/defina o custo de cada ocorrência/i)).toBeInTheDocument();
  });

  it('rejeita zero como custo padrão e orienta deixar vazio', () => {
    render(
      <MonthlyFinanceConfigDialog
        open
        groupId="group-1"
        config={null}
        saving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Por jogo' }));
    const amountInput = screen.getByRole('textbox', { name: 'Valor da quadra' });
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.blur(amountInput);

    expect(screen.getByText(/maior que zero ou deixe vazio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar e recalcular' })).toBeDisabled();
  });
});
