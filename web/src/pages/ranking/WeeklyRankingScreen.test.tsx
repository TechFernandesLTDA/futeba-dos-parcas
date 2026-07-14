// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import { WeeklyRankingScreen } from './WeeklyRankingScreen';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../hooks/useGamificationColors', () => ({
  useGamificationColors: () => ({ gold: '#a66d00', silver: '#616161', bronze: '#795548' }),
}));
vi.mock('../../hooks/useWeeklyRanking', () => ({
  useWeeklyRanking: () => ({
    isLoading: false,
    data: {
      weekKey: '2026-W28',
      rankings: [{
        userId: 'player-1',
        userName: 'Ana',
        points: 10,
        goals: 1,
        assists: 0,
        saves: 0,
        presence: 1,
        mvp: 0,
        wins: 1,
        draws: 0,
        bolaMurcha: 0,
      }],
    },
  }),
}));

describe('WeeklyRankingScreen keyboard navigation', () => {
  beforeEach(() => navigate.mockClear());

  it('expõe cada linha como controle com nome acessível', () => {
    renderWithProviders(<WeeklyRankingScreen />);

    expect(screen.getByRole('button', { name: 'Ver perfil de Ana' })).toBeVisible();
  });

  it('abre o perfil pelo teclado', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WeeklyRankingScreen />);

    const row = screen.getByRole('button', { name: 'Ver perfil de Ana' });
    row.focus();
    await user.keyboard('{Enter}');

    expect(navigate).toHaveBeenCalledWith('/profile/player-1');
  });
});
