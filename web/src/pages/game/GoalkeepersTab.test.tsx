// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import type { GameConfirmation } from '../../types/game';
import GoalkeepersTab from './GoalkeepersTab';

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

const goalkeeper = {
  id: 'gk-1',
  userName: 'Wall Teste',
  position: 'GOALKEEPER',
  status: 'CONFIRMED',
} as GameConfirmation;

describe('GoalkeepersTab', () => {
  it('exibe empty state quando não há goleiro confirmado', () => {
    renderWithProviders(<GoalkeepersTab goalkeepers={[]} />);

    expect(screen.getByText('Nenhum goleiro')).toBeInTheDocument();
    expect(screen.getByText('Nenhum goleiro confirmado ainda')).toBeInTheDocument();
  });

  it('lista os goleiros confirmados com o nome de cada um', () => {
    renderWithProviders(
      <GoalkeepersTab goalkeepers={[goalkeeper]} />,
    );

    expect(screen.getAllByText('Wall Teste').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nenhum goleiro')).not.toBeInTheDocument();
  });
});
