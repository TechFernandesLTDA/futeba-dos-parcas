// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../../test/renderWithProviders';
import type { Game, GameConfirmation } from '../../types/game';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  navigateBack: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  confirmPresence: vi.fn(),
  cancelPresence: vi.fn(),
  detail: {
    game: null as Game | null,
    confirmations: [] as GameConfirmation[],
    loading: false,
    error: null as string | null,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ gameId: 'game-1' }),
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => mocks.navigateBack,
}));

vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));

vi.mock('../../hooks/useGames', () => ({
  useGameDetail: () => mocks.detail,
  useConfirmPresence: () => ({
    confirmPresence: mocks.confirmPresence,
    cancelPresence: mocks.cancelPresence,
    loading: false,
  }),
  useUpdateGameStatus: () => ({ updateStatus: vi.fn(), loading: false }),
}));

vi.mock('../../hooks/useDuplicateGameCopy', () => ({
  useDuplicateGameCopy: () => ({ duplicateGame: vi.fn(), loading: false }),
}));

vi.mock('../../hooks/useWaitlist', () => ({
  useWaitlist: () => ({
    waitlist: [],
    myEntry: null,
    loading: false,
    error: null,
    acting: false,
    joinWaitlist: vi.fn(),
    leaveWaitlist: vi.fn(),
  }),
}));

vi.mock('../../hooks/useGameRides', () => ({
  useGameRides: () => ({
    rides: [],
    currentUserRide: null,
    loading: false,
    saving: false,
    cancelling: false,
    error: null,
    refetch: vi.fn(),
    saveRide: vi.fn(),
    cancelRide: vi.fn(),
  }),
}));

vi.mock('../../hooks/usePostGameMessages', () => ({
  usePostGameMessages: () => ({
    messages: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSavePostGameMessage: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1' },
    user: { id: 'user-1', role: 'PLAYER' },
  }),
}));

vi.mock('../../contexts/BreadcrumbEntityContext', () => ({
  useBreadcrumbEntityLabel: vi.fn(),
}));

vi.mock('../../hooks/useAutoBreadcrumbs', () => ({
  useAppBreadcrumbOverride: vi.fn(),
}));

vi.mock('../../services/cloudFunctions', () => ({
  softDeleteGame: vi.fn(),
  checkInToGame: vi.fn(),
  generateCheckinToken: vi.fn(),
  startGameLifecycle: vi.fn(),
  // usado por PositionReinforcementsPanel (candidatos a reforço)
  getLeaguePlayers: vi.fn().mockResolvedValue({ data: { players: [] } }),
}));

vi.mock('../../services/firebase', () => ({ app: {}, db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ kind: 'doc', name, id })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
  Timestamp: class Timestamp {
    constructor(public seconds = 0, public nanoseconds = 0) {}
    toMillis() {
      return this.seconds * 1000;
    }
    toDate() {
      return new Date(this.seconds * 1000);
    }
    static fromDate(d: Date) {
      return new Timestamp(Math.floor(d.getTime() / 1000), 0);
    }
  },
}));

// Painéis pesados de pós-jogo e mídia: não entram no escopo desta onda
// (render da tela), então são substituídos por no-ops.
vi.mock('./GameCommentsPanel', () => ({ GameCommentsPanel: () => null }));
vi.mock('./GamePhotosTab', () => ({ GamePhotosTab: () => null }));
vi.mock('./GameVideosTab', () => ({ GameVideosTab: () => null }));
vi.mock('./PostGameReputationPanel', () => ({
  PostGameReputationPanel: () => null,
}));
vi.mock('./PostGameHighlightsPanel', () => ({
  PostGameHighlightsPanel: () => null,
}));

// TeamBadge exige TeamsProvider (contexto global do app) — stub visual.
vi.mock('../../components/team/TeamBadge', () => ({ TeamBadge: () => null }));

// Chat é componente real; só o hook Firestore é simulado.
vi.mock('../../hooks/useGameChat', () => ({
  useGameChat: () => ({
    messages: [],
    loading: false,
    error: null,
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    currentUserId: 'user-1',
  }),
  useSendGameMessage: () => ({ send: vi.fn(), sending: false }),
  useDeleteGameMessage: () => ({ remove: vi.fn(), deleting: false }),
}));

vi.mock('../../contexts/ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/ToastContext')>();
  return {
    ...actual,
    useToast: () => ({
      showSuccess: mocks.showSuccess,
      showError: mocks.showError,
    }),
  };
});

import { GameDetailScreen } from './GameDetailScreen';

const gameFixture = {
  id: 'game-1',
  status: 'CONFIRMED',
  visibility: 'GROUP_ONLY',
  isPublic: false,
  date: '2099-01-15',
  time: '19:00',
  endTime: '20:00',
  maxPlayers: 14,
  maxGoalkeepers: 2,
  playersCount: 10,
  goalkeepersCount: 1,
  players: [],
  gameType: 'Pelada',
  fieldType: 'SOCIETY',
  recurrence: 'none',
  locationId: 'loc-1',
  locationName: 'Arena Central',
  locationAddress: 'Rua das Bolas, 123',
  locationLat: -23.55,
  locationLng: -46.63,
  dailyPrice: 0,
  totalCost: 210,
  priceManualOverride: false,
  pixKey: 'pix@parcas.com',
  pixKeyType: 'EMAIL',
  pixBeneficiaryName: '',
  pixPaymentEnabled: false,
  numberOfTeams: 2,
  team1Name: 'Time A',
  team2Name: 'Time B',
  team1Score: 0,
  team2Score: 0,
  ownerId: 'user-1',
  ownerName: 'Eu Parça',
  coOrganizers: [],
  confirmationDeadlineHours: 24,
  autoClosed: false,
  rules: '',
  requireCheckin: false,
  checkinRadiusMeters: 100,
  waitlistAutoPromoteMinutes: 10,
  votingConcluded: false,
  xpProcessed: false,
} as Game;

const otherPlayer: GameConfirmation = {
  id: 'conf-1',
  gameId: 'game-1',
  userId: 'user-2',
  userName: 'Jogador B',
  position: 'FIELD',
  status: 'CONFIRMED',
  paymentStatus: 'PENDING',
  isCasualPlayer: false,
  goals: 0,
  assists: 0,
  saves: 0,
  yellowCards: 0,
  redCards: 0,
  xpEarned: 0,
  isMvp: false,
  isBestGk: false,
  isWorstPlayer: false,
  partialPayment: 0,
  wasPresent: false,
  isOnTheWay: false,
  checkedIn: false,
  isGuest: false,
  confirmationOrder: 1,
} as GameConfirmation;

function setDetail(overrides: Partial<typeof mocks.detail> = {}) {
  mocks.detail = {
    game: gameFixture,
    confirmations: [otherPlayer],
    loading: false,
    error: null,
    ...overrides,
  };
}

describe('GameDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmPresence.mockResolvedValue(undefined);
    mocks.cancelPresence.mockResolvedValue(undefined);
    setDetail();
  });

  it('exibe skeleton enquanto o jogo carrega', () => {
    setDetail({ loading: true, game: null });
    renderWithProviders(<GameDetailScreen />);

    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('Arena Central')).not.toBeInTheDocument();
  });

  it('exibe ErrorScreen padronizado quando o snapshot falha', () => {
    setDetail({ game: null, error: 'Permissão negada' });
    renderWithProviders(<GameDetailScreen />);

    expect(screen.getByText('Permissão negada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('exibe estado "jogo não encontrado" quando o doc não existe', () => {
    setDetail({ game: null });
    renderWithProviders(<GameDetailScreen />);

    expect(screen.getByText('Jogo não encontrado')).toBeInTheDocument();
    expect(
      screen.getByText('O jogo que você procura não está disponível.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('renderiza o detalhe completo: header, info, jogadores e chat', () => {
    renderWithProviders(<GameDetailScreen />);

    expect(screen.getAllByRole('heading', { name: 'Arena Central' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Rua das Bolas, 123')).toBeInTheDocument();
    expect(screen.getByText('10/14')).toBeInTheDocument();
    expect(screen.getByText('Jogadores')).toBeInTheDocument();
    // Aba de chat com estado vazio.
    expect(screen.getByText('Nenhuma mensagem ainda')).toBeInTheDocument();
    // Barra inferior: usuário não confirmado vê o CTA de presença.
    expect(
      screen.getByRole('button', { name: 'Confirmar Presença' }),
    ).toBeInTheDocument();
  });

  it('confirma presença como jogador de linha via diálogo de posição', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameDetailScreen />);

    await user.click(screen.getByRole('button', { name: 'Confirmar Presença' }));

    expect(await screen.findByText('Escolha sua posição')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jogador de Linha' }));

    await waitFor(() =>
      expect(mocks.confirmPresence).toHaveBeenCalledWith('game-1', 'FIELD'),
    );
  }, 20000);

  it('usa o rótulo de status do jogo no chip do painel de informações', () => {
    renderWithProviders(<GameDetailScreen />);

    // getStatusChipColors aplica o rótulo pt-BR do status CONFIRMED.
    expect(screen.getByText('Fechado')).toBeInTheDocument();
  });
});
