import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { PlayerCard } from './PlayerCard';

const mockPlayerCard = {
  id: 'player-1',
  name: 'Renan Fernandes',
  nickname: 'Kakinho',
  photoUrl: undefined,
  level: 8,
  experiencePoints: 6400,
  preferredPosition: 'ATACANTE' as const,
  totalGames: 42,
  totalGoals: 19,
  totalAssists: 11,
  totalSaves: 2,
  mvpCount: 5,
  totalWins: 25,
  totalDraws: 6,
  totalLosses: 11,
  currentStreak: 4,
  bestStreak: 9,
  overallRating: 83,
  strikerRating: 4.5,
  midRating: 3.8,
  defenderRating: 2.9,
  gkRating: 1.2,
  autoStrikerRating: 0,
  autoMidRating: 0,
  autoDefenderRating: 0,
  autoGkRating: 0,
  autoRatingSamples: 12,
  favoriteTeam: undefined,
};

vi.mock('../../hooks/usePlayerCard', () => ({
  usePlayerCard: () => ({
    playerCard: mockPlayerCard,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../contexts/TeamsContext', () => ({
  useTeams: () => ({
    teams: [],
    teamsById: new Map(),
    loading: false,
    error: null,
  }),
}));

describe('PlayerCard', () => {
  it('renderiza o novo card com identidade, nota, posição e métricas principais', () => {
    renderWithProviders(<PlayerCard userId="player-1" onClose={vi.fn()} />);

    expect(screen.getByLabelText('Card do jogador Renan Fernandes')).toBeInTheDocument();
    expect(screen.getByText('FUTEBA DOS PARÇAS')).toBeInTheDocument();
    expect(screen.getByText('ASCENSÃO')).toBeInTheDocument();
    expect(screen.getByText('83')).toBeInTheDocument();
    expect(screen.getByText('ATQ')).toBeInTheDocument();
    expect(screen.getByText('Renan Fernandes')).toBeInTheDocument();
    expect(screen.getByText('Kakinho')).toBeInTheDocument();
    expect(screen.getByText('6.400 XP')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Detalhamento da nota' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Resumo de desempenho' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'ATA' })).toHaveAttribute('aria-valuenow', '4.5');
    expect(screen.getByRole('dialog')).toHaveStyle({ borderRadius: '6px' });
    expect(screen.getByRole('article')).toHaveStyle({ borderRadius: '6px' });
    expect(screen.getByTestId('player-card-inner-outline')).toHaveStyle({ borderRadius: '4px' });
  });
});
