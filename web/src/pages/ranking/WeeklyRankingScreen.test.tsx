// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { getContrastRatio } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, renderWithProviders, screen } from '../../test/renderWithProviders';
import { futebaDarkOledTheme, futebaDarkTheme, futebaTheme } from '../../theme';
import { WeeklyRankingScreen } from './WeeklyRankingScreen';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../hooks/useWeeklyRanking', () => ({
  useWeeklyRanking: () => ({
    isLoading: false,
    data: {
      weekKey: '2026-W28',
      rankings: ['Ana', 'Bruno', 'Carla'].map((userName, index) => ({
        userId: `player-${index + 1}`,
        userName,
        points: 10 - index,
        goals: index === 0 ? 1 : 0,
        assists: 0,
        saves: 0,
        presence: 1,
        mvp: 0,
        wins: index === 0 ? 1 : 0,
        draws: 0,
        bolaMurcha: 0,
      })),
    },
  }),
}));

describe('WeeklyRankingScreen keyboard navigation', () => {
  beforeEach(() => {
    navigate.mockClear();
    cleanup();
  });

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

  it.each([
    ['claro', futebaTheme],
    ['escuro', futebaDarkTheme],
    ['OLED', futebaDarkOledTheme],
  ])('mantém contraste mínimo das três medalhas no tema %s', (_name, theme) => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <WeeklyRankingScreen />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const medals = container.querySelectorAll<HTMLElement>('[data-ranking-medal]');
    expect(medals).toHaveLength(3);
    medals.forEach((medal) => {
      const styles = getComputedStyle(medal);
      expect(getContrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(3);
    });
  });
});
