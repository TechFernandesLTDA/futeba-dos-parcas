// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import { GameWaitlistAction } from './GameWaitlistAction';
import { isGameWaitlistEligible } from './gameWaitlistEligibility';

describe('GameWaitlistAction', () => {
  it('permite entrar na lista quando ainda não há uma entrada', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();

    renderWithProviders(
      <GameWaitlistAction
        queuePosition={null}
        loading={false}
        acting={false}
        error={null}
        onJoin={onJoin}
        onLeave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Jogo lotado — Entrar na lista de espera' }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it('mostra progresso e bloqueia ação concorrente', () => {
    renderWithProviders(
      <GameWaitlistAction
        queuePosition={null}
        loading={false}
        acting
        error={null}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('diferencia carregamento inicial de uma entrada em andamento', () => {
    renderWithProviders(
      <GameWaitlistAction
        queuePosition={null}
        loading
        acting={false}
        error={null}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Carregando...' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('exibe a posição e permite sair da lista', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();

    renderWithProviders(
      <GameWaitlistAction
        queuePosition={3}
        loading={false}
        acting={false}
        error={null}
        onJoin={vi.fn()}
        onLeave={onLeave}
      />,
    );

    expect(screen.getByText('Na lista de espera (posição 3)')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sair da lista' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('prioriza o erro do listener em vez de oferecer uma ação insegura', () => {
    renderWithProviders(
      <GameWaitlistAction
        queuePosition={null}
        loading={false}
        acting={false}
        error="Erro ao carregar a lista de espera"
        onJoin={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao carregar a lista de espera');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('isGameWaitlistEligible', () => {
  const fullGame = {
    status: 'SCHEDULED' as const,
    playersCount: 12,
    maxPlayers: 12,
  };

  it('aceita somente jogador não confirmado em jogo aberto e lotado', () => {
    expect(isGameWaitlistEligible(fullGame, false)).toBe(true);
    expect(isGameWaitlistEligible(fullGame, true)).toBe(false);
    expect(isGameWaitlistEligible({ ...fullGame, playersCount: 11 }, false)).toBe(false);
    expect(isGameWaitlistEligible({ ...fullGame, maxPlayers: 0 }, false)).toBe(false);
    expect(isGameWaitlistEligible({ ...fullGame, status: 'LIVE' }, false)).toBe(false);
    expect(isGameWaitlistEligible({ ...fullGame, status: 'FINISHED' }, false)).toBe(false);
  });

  it('também permite fila em jogo confirmado que ainda está lotado', () => {
    expect(isGameWaitlistEligible({ ...fullGame, status: 'CONFIRMED' }, false)).toBe(true);
  });
});
