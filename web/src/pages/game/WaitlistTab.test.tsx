// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import type { GameConfirmation } from '../../types/game';
import WaitlistTab from './WaitlistTab';

vi.mock('../../components/common/GameCard', () => ({
  PlayerAvatar: () => null,
  StatusChip: () => null,
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));
vi.mock('../../components/team/TeamBadge', () => ({
  TeamBadge: () => null,
}));

const waitlisted = {
  id: 'wl-1',
  userName: 'Reserva Parça',
  position: 'FIELD',
  status: 'WAITLIST',
} as GameConfirmation;

describe('WaitlistTab', () => {
  it('exibe empty state quando a lista de espera está vazia', () => {
    renderWithProviders(<WaitlistTab waitlist={[]} />);

    expect(screen.getByText('Nenhum jogador na lista de espera')).toBeInTheDocument();
    expect(
      screen.getByText('Quando a lista estiver cheia, novos jogadores entram aqui'),
    ).toBeInTheDocument();
  });

  it('lista os jogadores na fila de espera', () => {
    renderWithProviders(<WaitlistTab waitlist={[waitlisted]} />);

    expect(screen.getAllByText('Reserva Parça').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Nenhum jogador na lista de espera'),
    ).not.toBeInTheDocument();
  });
});
