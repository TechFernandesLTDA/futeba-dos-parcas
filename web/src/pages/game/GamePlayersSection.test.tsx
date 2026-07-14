// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import type { Game } from '../../types/game';
import { GamePlayersSection } from './GamePlayersSection';

vi.mock('../../components/common/GameCard', () => ({
  PlayerAvatar: ({ name }: { name: string }) => <span>{name}</span>,
  StatusChip: () => null,
}));
vi.mock('../../components/team/TeamBadge', () => ({
  TeamBadge: () => null,
}));

describe('GamePlayersSection waitlist', () => {
  it('mantém a ação da lista de espera acessível dentro da aba Espera', () => {
    renderWithProviders(
      <GamePlayersSection
        game={{ status: 'SCHEDULED', rules: '' } as Game}
        confirmedPlayers={[]}
        goalkeepers={[]}
        waitlist={[]}
        waitlistLoading={false}
        waitlistError={null}
        waitlistAction={<button type="button">Entrar na fila pelo painel</button>}
        confirmations={[]}
        tabValue={2}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Entrar na fila pelo painel' })).toBeVisible();
    expect(screen.getByText('Nenhum jogador na lista de espera')).toBeVisible();
  });
});
