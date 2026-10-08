import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const leagueState = vi.hoisted(() => ({
  players: [] as Array<Record<string, unknown>>,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
}));

vi.mock('../../../hooks/useLeague', () => ({
  useLeague: () => leagueState,
}));

vi.mock('../../../hooks/useActiveSeason', () => ({
  useActiveSeason: () => ({ seasonId: 'season-1', loading: false }),
}));

vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [{ id: 'gr1', name: 'Pelada de Terça', role: 'OWNER', memberCount: 8 }] }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-2', name: 'Bruno' } }),
}));

vi.mock('../../../hooks/useGamificationColors', () => ({
  useGamificationColors: () => ({
    gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32',
    xp: '#9C27B0', level: '#00BCD4', mvp: '#FFD700', streak: '#FF5722',
  }),
}));

vi.mock('../../../components/player/PlayerCard', () => ({
  PlayerCard: () => null,
}));

vi.mock('../../../components/team/TeamBadge', () => ({
  TeamBadge: () => null,
}));

vi.mock('../../../components/common/DemoDataChip', () => ({
  DemoDataChip: () => null,
}));

vi.mock('../../../components/common/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock('../../../components/common/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  const i18n = { language: 'pt-BR', resolvedLanguage: 'pt-BR' };
  return { useTranslation: () => ({ t, i18n }) };
});

import { RankingsTab } from './RankingsTab';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const theme = createTheme();

const mockPlayers = [
  {
    id: 'p1', userId: 'user-1', userName: 'Ana', userPhoto: null,
    points: 120, gamesPlayed: 10, wins: 6, goals: 8, assists: 2, mvpCount: 1,
    division: 'GOLD', experiencePoints: 1500, isCurrentUser: false,
  },
  {
    id: 'p2', userId: 'user-2', userName: 'Bruno', userPhoto: null,
    points: 90, gamesPlayed: 8, wins: 4, goals: 3, assists: 1, mvpCount: 0,
    division: 'SILVER', experiencePoints: 800, isCurrentUser: true,
  },
];

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <RankingsTab />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RankingsTab', () => {
  beforeEach(() => {
    leagueState.players = mockPlayers;
    leagueState.loading = false;
    leagueState.error = null;
    leagueState.refetch.mockClear();
  });

  it('renderiza header e a lista de jogadores com o pódio', () => {
    renderScreen();
    expect(screen.getAllByText('nav.league').length).toBeGreaterThan(0);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('ranking.myPosition')).toBeInTheDocument();
  });

  it('renderiza chips de filtro por grupo', () => {
    renderScreen();
    expect(screen.getByText('ranking.global')).toBeInTheDocument();
    expect(screen.getByText('Pelada de Terça')).toBeInTheDocument();
  });

  it('mostra skeletons durante loading', () => {
    leagueState.loading = true;
    renderScreen();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('mostra ErrorState em caso de erro', () => {
    leagueState.error = 'Falha ao carregar ranking';
    renderScreen();
    expect(screen.getByText('Falha ao carregar ranking')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há jogadores', () => {
    leagueState.players = [];
    renderScreen();
    expect(screen.getByText('ranking.noPlayers')).toBeInTheDocument();
  });

  it('ao abrir a aba Sistema XP exibe a tabela e divisões', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('tab', { name: 'ranking.xpSystem' }));
    expect(screen.getByText('ranking.howXpWorks')).toBeInTheDocument();
    expect(screen.getByText('league.divisions')).toBeInTheDocument();
    expect(screen.queryByText('ranking.myPosition')).not.toBeInTheDocument();
  });
});
