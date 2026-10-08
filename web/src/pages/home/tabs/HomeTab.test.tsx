import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.hoisted(() => vi.fn());
const nextGameState = vi.hoisted(() => ({
  nextGame: null as Record<string, unknown> | null,
  isLoading: false,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' })),
  query: vi.fn(() => ({ type: 'query' })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  doc: vi.fn(() => ({ type: 'doc' })),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
}));

vi.mock('../../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../../services/firebaseFunctions', () => ({
  functions: {},
}));

const authUser = vi.hoisted(() => ({
  current: {
    id: 'user-1',
    name: 'Carlos Teste',
    experiencePoints: 850,
    totalGames: 42,
    totalGoals: 15,
    mvpCount: 3,
    currentStreak: 5,
    bestStreak: 10,
    photoUrl: null,
  } as Record<string, unknown> | null,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser.current }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

vi.mock('../../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    state: { checklistDismissed: true, checklistCompletedAt: null },
    loading: false,
    hasSeenCarousel: () => true,
    onChecklistDismissed: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [], loading: false, error: null }),
}));

vi.mock('../../../hooks/useNextGame', () => ({
  useNextGame: () => nextGameState,
}));

vi.mock('../../../hooks/useGames', () => ({
  useConfirmPresence: () => ({ confirmPresence: vi.fn(), cancelPresence: vi.fn(), loading: false }),
}));

vi.mock('../../../hooks/useWaitlist', () => ({
  useWaitlist: () => ({ myEntry: null, acting: false, joinWaitlist: vi.fn(), leaveWaitlist: vi.fn() }),
}));

vi.mock('../../../hooks/useGamificationColors', () => ({
  useGamificationColors: () => ({
    gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32',
    xp: '#9C27B0', level: '#00BCD4', mvp: '#FFD700', streak: '#FF5722',
  }),
}));

vi.mock('../../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../../components/common/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/onboarding/FirstStepsChecklist', () => ({
  FirstStepsChecklist: () => null,
}));

vi.mock('../../../components/team/TeamBadge', () => ({
  TeamBadge: () => null,
}));

vi.mock('../../../components/game/QuickCreateCard', () => ({
  QuickCreateCard: () => <div data-testid="quick-create" />,
}));

vi.mock('../../../components/invite/HomeInviteCard', () => ({
  HomeInviteCard: () => null,
}));

vi.mock('../../../components/player/PlayerCard', () => ({
  PlayerCard: () => null,
}));

vi.mock('./StreakWidget', () => ({
  StreakWidget: ({ streak }: { streak: number }) => <div data-testid="streak-widget">{streak}</div>,
}));

vi.mock('./RecentActivityFeed', () => ({
  RecentActivityFeed: ({ loading }: { loading: boolean }) => (
    <div data-testid="activity-feed">{loading ? 'loading' : 'empty'}</div>
  ),
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { futebaTheme } from '../../../theme';
import { HomeTab } from './HomeTab';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
// Tema real do app: componentes usam tokens custom (theme.radii) que o createTheme() puro não tem.
const theme = futebaTheme;

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <HomeTab />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomeTab', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    nextGameState.nextGame = null;
    nextGameState.isLoading = false;
    authUser.current = {
      id: 'user-1',
      name: 'Carlos Teste',
      experiencePoints: 850,
      totalGames: 42,
      totalGoals: 15,
      mvpCount: 3,
      currentStreak: 5,
      bestStreak: 10,
      photoUrl: null,
    };
  });

  it('renderiza saudação e cartões de estatística', () => {
    renderScreen();
    expect(screen.getByText('profile.greeting')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'home.viewStat' }).length).toBe(3);
    expect(screen.getByRole('button', { name: 'profile.viewLevelJourney' })).toBeInTheDocument();
  });

  it('mostra estado de sem próximo jogo com CTA de criação', async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(screen.getByText('games.noGameScheduled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'games.createGame' }));
    expect(mockNavigate).toHaveBeenCalledWith('/?tab=1');
  });

  it('renderiza streak e feed de atividades em loading', () => {
    renderScreen();
    expect(screen.getByTestId('streak-widget')).toHaveTextContent('5');
    expect(screen.getByTestId('activity-feed')).toHaveTextContent('loading');
  });

  it('mostra convite para competir quando o usuário não tem grupos', () => {
    renderScreen();
    expect(screen.getByText('groups.noRankingMembers')).toBeInTheDocument();
  });

  it('mostra widget do próximo jogo agendado', async () => {
    nextGameState.nextGame = {
      id: 'game-1',
      status: 'SCHEDULED',
      locationName: 'Arena Centro',
      locationAddress: 'Rua 1',
      date: '2026-10-10',
      time: '19:00',
      playersCount: 3,
      maxPlayers: 10,
    };
    renderScreen();
    // O widget só aparece depois da checagem assíncrona de confirmação (skeleton antes).
    expect(await screen.findByText('games.nextGame')).toBeInTheDocument();
    expect(screen.getByText('Arena Centro')).toBeInTheDocument();
  });

  it('não crasha sem usuário autenticado', () => {
    authUser.current = null;
    expect(() => renderScreen()).not.toThrow();
  });
});
