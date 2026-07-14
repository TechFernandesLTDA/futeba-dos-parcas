// @vitest-environment jsdom
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import { PositionChoiceDialog } from './PositionChoiceDialog';

const defaultProps = {
  open: true,
  fullScreen: true,
  loading: false,
  expectedPayment: 25,
  totalCost: 250,
  playersFull: false,
  goalkeepersFull: false,
};

describe('PositionChoiceDialog', () => {
  it('oferece saída visível no modo mobile sem confirmar presença', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <PositionChoiceDialog {...defaultProps} onClose={onClose} onConfirm={onConfirm} />,
    );

    expect(screen.getByRole('dialog', { name: 'Escolha sua posição' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('bloqueia ações concorrentes e mostra progresso apenas na posição enviada', async () => {
    const user = userEvent.setup();
    let finishConfirmation: (() => void) | undefined;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      finishConfirmation = resolve;
    }));

    renderWithProviders(
      <PositionChoiceDialog
        {...defaultProps}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Jogador de Linha' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith('FIELD');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Goleiro' })).toBeDisabled();

    expect(onConfirm).toHaveBeenCalledOnce();

    await act(async () => finishConfirmation?.());
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('mantém cancelar e posições bloqueados quando o hook está carregando', () => {
    renderWithProviders(
      <PositionChoiceDialog
        {...defaultProps}
        loading
        onClose={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jogador de Linha' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Goleiro' })).toBeDisabled();
  });
});
