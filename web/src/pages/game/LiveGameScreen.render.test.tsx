// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../../test/renderWithProviders';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  navigateBack: vi.fn(),
  showError: vi.fn(),
  submitLiveGameEvent: vi.fn(),
  // Controle dos snapshots do Firestore por stream: 'game' (doc), 'live_scores'
  // (doc), 'game_events' | 'confirmations' | 'teams' (collections).
  snapshot: {
    game: { exists: true, data: {} as Record<string, unknown> },
    liveScores: { exists: false, data: {} as Record<string, unknown> },
    gameEvents: [] as Array<Record<string, unknown>>,
    confirmations: [] as Array<Record<string, unknown>>,
    teams: [] as Array<{ id: string; data: Record<string, unknown> }>,
  },
  silent: false, // true = nunca dispara snapshot (estado de loading)
  errorStreams: new Set<string>(), // streams que disparam o callback de erro
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

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1' },
    user: { id: 'user-1', role: 'PLAYER' },
  }),
}));

vi.mock('../../contexts/ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/ToastContext')>();
  return {
    ...actual,
    useToast: () => ({ showSuccess: vi.fn(), showError: mocks.showError }),
  };
});

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// snakeToCamel identidade: fixtures já em camelCase.
vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (value: unknown) => value,
}));

vi.mock('../../services/firebase', () => ({ app: {}, db: {} }));

vi.mock('../../services/cloudFunctions', () => ({
  deleteLiveGameEvent: vi.fn(),
  finishGameLifecycle: vi.fn(),
  startGameLifecycle: vi.fn(),
  submitLiveGameEvent: (...args: unknown[]) => mocks.submitLiveGameEvent(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    kind: 'doc',
    name: collectionName,
    id,
  })),
  collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
  where: vi.fn(() => ({ kind: 'where' })),
  query: vi.fn((ref: unknown) => ref),
  Timestamp: class Timestamp {
    constructor(public seconds = 0, public nanoseconds = 0) {}
    toMillis() {
      return this.seconds * 1000;
    }
    static fromDate(d: Date) {
      return new Timestamp(Math.floor(d.getTime() / 1000), 0);
    }
  },
  onSnapshot: vi.fn((
    ref: { name: string },
    next: (snap: unknown) => void,
    onError?: (err: unknown) => void,
  ) => {
    if (mocks.silent) return vi.fn();
    if (mocks.errorStreams.has(ref.name)) {
      onError?.(new Error(' firestore unavailable'));
      return vi.fn();
    }
    const s = mocks.snapshot;
    if (ref.name === 'games') {
      next({
        exists: () => s.game.exists,
        id: 'game-1',
        data: () => s.game.data,
      });
    } else if (ref.name === 'live_scores') {
      next({
        exists: () => s.liveScores.exists,
        id: 'game-1',
        data: () => s.liveScores.data,
      });
    } else if (ref.name === 'game_events') {
      next({
        docs: s.gameEvents.map((data, index) => ({
          id: `e${index}`,
          data: () => data,
        })),
      });
    } else if (ref.name === 'confirmations') {
      next({
        docs: s.confirmations.map((data, index) => ({
          id: `c${index}`,
          data: () => data,
        })),
      });
    } else if (ref.name === 'teams') {
      next({
        docs: s.teams.map((team) => ({
          id: team.id,
          data: () => team.data,
        })),
      });
    }
    return vi.fn();
  }),
}));

import { LiveGameScreen } from './LiveGameScreen';

function setLiveGame(overrides: Record<string, unknown> = {}) {
  mocks.snapshot.game = {
    exists: true,
    data: {
      status: 'LIVE',
      ownerId: 'user-1',
      coOrganizers: [],
      team1Name: 'Time Vermelho',
      team2Name: 'Time Azul',
      team1Id: 't1',
      team2Id: 't2',
      date: '2099-01-15',
      time: '19:00',
      dateTime: new Date('2099-01-15T19:00:00'),
      locationName: 'Arena Central',
      locationAddress: 'Rua das Bolas, 123',
      maxPlayers: 14,
      playersCount: 10,
      votingConcluded: false,
      ...overrides,
    },
  };
}

describe('LiveGameScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.silent = false;
    mocks.snapshot.liveScores = { exists: false, data: {} };
    mocks.snapshot.gameEvents = [];
    mocks.snapshot.confirmations = [];
    mocks.snapshot.teams = [];
    mocks.submitLiveGameEvent.mockResolvedValue({ data: {} });
    mocks.errorStreams = new Set();
    setLiveGame();
  });

  it('exibe skeleton enquanto os listeners não disparam', () => {
    mocks.silent = true;
    renderWithProviders(<LiveGameScreen />);

    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Jogo ao Vivo' })).not.toBeInTheDocument();
  });

  it('renderiza header, placar 2x1 e lista de eventos ao vivo', () => {
    mocks.snapshot.liveScores = {
      exists: true,
      data: {
        team1_id: 't1',
        team1_score: 2,
        team2_id: 't2',
        team2_score: 1,
        started_at: { toDate: () => new Date('2026-01-01T19:00:00') },
      },
    };
    mocks.snapshot.gameEvents = [
      {
        eventType: 'GOAL',
        playerId: 'user-2',
        playerName: 'Jogador A',
        teamId: 't1',
        minute: 10,
        createdAt: { toDate: () => new Date('2026-01-01T19:10:00') },
      },
    ];
    renderWithProviders(<LiveGameScreen />);

    expect(screen.getByRole('heading', { name: 'Jogo ao Vivo' })).toBeInTheDocument();
    expect(screen.getByText('Time Vermelho')).toBeInTheDocument();
    expect(screen.getByText('Time Azul')).toBeInTheDocument();
    expect(screen.getByText('Eventos do Jogo')).toBeInTheDocument();
    expect(screen.getByText(/Jogador A/)).toBeInTheDocument();
    // Organizador (owner) vê a barra de ações do jogo ao vivo.
    expect(screen.getByRole('button', { name: 'Finalizar Jogo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar Evento' })).toBeInTheDocument();
  });

  it('exibe erro quando o jogo não é encontrado', () => {
    mocks.snapshot.game = { exists: false, data: {} };
    renderWithProviders(<LiveGameScreen />);

    expect(screen.getByText('Jogo não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('registra evento de gol via diálogo com jogador confirmado', async () => {
    mocks.snapshot.confirmations = [
      { user_id: 'user-2', user_name: 'Jogador A', status: 'CONFIRMED', team_id: 't1' },
    ];
    const user = userEvent.setup();
    renderWithProviders(<LiveGameScreen />);

    await user.click(screen.getByRole('button', { name: 'Adicionar Evento' }));

    const typeSelect = await screen.findByLabelText('Tipo de Evento');
    await user.click(typeSelect);
    await user.click(await screen.findByRole('option', { name: 'Gol' }));

    const playerSelect = screen.getByLabelText(/Jogadores/);
    await user.click(playerSelect);
    await user.click(await screen.findByRole('option', { name: 'Jogador A' }));

    await user.click(screen.getByRole('button', { name: /^Adicionar$/ }));

    await waitFor(() =>
      expect(mocks.submitLiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId: 'game-1',
          eventType: 'GOAL',
          playerId: 'user-2',
          playerName: 'Jogador A',
          teamId: 't1',
        }),
      ),
    );
    // Organizador: minuto derivado do cronômetro (0s → minuto 0).
    expect(mocks.submitLiveGameEvent.mock.calls[0][0]).toHaveProperty('minute', 0);
  }, 20000);

  it('exibe alerta de erro do listener de placar com botão de tentar novamente', () => {
    mocks.errorStreams = new Set(['live_scores']);
    renderWithProviders(<LiveGameScreen />);

    // Erro do stream de placar não derruba a tela: alerta com retry.
    expect(screen.getByText('Erro ao carregar placar do jogo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jogo ao Vivo' })).toBeInTheDocument();
    expect(mocks.showError).toHaveBeenCalledWith('Erro ao carregar placar do jogo');
  });
});
