/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks devem ser configurados antes dos imports dos módulos testados
const mockOnSnapshot = vi.fn();
const mockGetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockConfirmGamePresence = vi.fn();
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
let mockGamesSnapshotNext: ((snapshot: { docs: any[] }) => void) | undefined;
let mockGamesSnapshotError: ((error: Error) => void) | undefined;

vi.mock('firebase/firestore', () => {
  // Timestamp precisa ser classe/construtora para instanceof funcionar em
  // firestoreHelpers.ts (`ts instanceof Timestamp`). Objeto literal não funciona. #2330
  class MockTimestamp {
    _ms: number;
    constructor(seconds: number, nanoseconds: number) {
      this._ms = seconds * 1000 + nanoseconds / 1e6;
    }
    toDate() { return new Date(this._ms); }
    toMillis() { return this._ms; }
    static now() { return new MockTimestamp(Date.now() / 1000, 0); }
    static fromDate(d: Date) { return new MockTimestamp(d.getTime() / 1000, 0); }
    static fromMillis(ms: number) { return new MockTimestamp(ms / 1000, 0); }
  }
  return {
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
    Timestamp: MockTimestamp,
    runTransaction: vi.fn(),
    writeBatch: vi.fn(() => ({ set: mockBatchSet, update: mockBatchUpdate, commit: mockBatchCommit })),
  };
});

vi.mock('../services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

vi.mock('../services/cloudFunctions', () => ({
  confirmGamePresence: (...args: unknown[]) => mockConfirmGamePresence(...args),
}));

const mockUseAuth = vi.fn(() => ({
  user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  updateUserProfile: vi.fn(),
  refreshUser: vi.fn(),
  currentUser: { uid: 'test-user-id' },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));
import { useGames, useGameDetail, useConfirmPresence, useCreateGame, useUpdateGameStatus } from './useGames';

describe('useGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGamesSnapshotNext = undefined;
    mockGamesSnapshotError = undefined;
    mockOnSnapshot.mockImplementation((_reference, next, error) => {
      mockGamesSnapshotNext = next;
      mockGamesSnapshotError = error;
      return vi.fn();
    });
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('configura listener na coleção games', () => {
    renderHook(() => useGames(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'games');
  });

  it('retorna jogos quando o snapshot emite dados', async () => {
    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });

    act(() => {
      mockGamesSnapshotNext?.({
        docs: [
        {
          id: 'game-1',
          data: () => ({
            status: 'SCHEDULED',
            owner_id: 'user-1',
            dateTime: { toDate: () => new Date('2026-01-01') },
          }),
        },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].id).toBe('game-1');
  });

  it('filtra jogos por status', () => {
    renderHook(() => useGames({ status: 'LIVE' }), { wrapper: createTestWrapper() });
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'LIVE');
  });

  it('filtra jogos por múltiplos status', () => {
    renderHook(() => useGames({ statuses: ['SCHEDULED', 'CONFIRMED'] }), { wrapper: createTestWrapper() });
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['SCHEDULED', 'CONFIRMED']);
  });

  it('filtra jogos por data/hora inicial', () => {
    const startDateTime = new Date('2026-07-08T00:00:00');
    renderHook(() => useGames({ startDateTime }), { wrapper: createTestWrapper() });
    expect(mockWhere).toHaveBeenCalledWith('dateTime', '>=', startDateTime);
  });

  it('filtra jogos por groupId', () => {
    renderHook(() => useGames({ groupId: 'group-1' }), { wrapper: createTestWrapper() });
    expect(mockWhere).toHaveBeenCalledWith('group_id', '==', 'group-1');
  });

  it('aplica limit quando fornecido', () => {
    renderHook(() => useGames({ limitCount: 5 }), { wrapper: createTestWrapper() });
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('permite ordenar jogos por data descendente', () => {
    renderHook(() => useGames({ orderDirection: 'desc' }), { wrapper: createTestWrapper() });
    expect(mockOrderBy).toHaveBeenCalledWith('dateTime', 'desc');
  });

  it('trata erros do listener', async () => {
    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });
    act(() => mockGamesSnapshotError?.(new Error('Firestore error')));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firestore error');
  });

  it('usa onSnapshot sem fetch duplicado por getDocs', () => {
    renderHook(() => useGames(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'games');
    expect(mockOnSnapshot).toHaveBeenCalledOnce();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('exclui jogos com deletedAt do resultado', async () => {
    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });
    act(() => {
      mockGamesSnapshotNext?.({
        docs: [
        {
          id: 'game-1',
          data: () => ({
            status: 'SCHEDULED',
            dateTime: { toDate: () => new Date() },
          }),
        },
        {
          id: 'game-2',
          data: () => ({
            status: 'FINISHED',
            dateTime: { toDate: () => new Date() },
            // deleted_at como Date simples — firestoreHelpers.toDate reconhece Date diretamente.
            deleted_at: new Date(),
          }),
        },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].id).toBe('game-1');
  });
});

describe('useGameDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockDoc.mockReturnValue('mock-doc-ref');
    mockCollection.mockReturnValue('mock-collection');
    mockQuery.mockReturnValue('mock-query');
    mockWhere.mockReturnValue('mock-where');
  });

  it('retorna null e loading=false para gameId null', async () => {
    const { result } = renderHook(() => useGameDetail(null), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.game).toBeNull();
  });

  it('configura listeners para jogo e confirmação do próprio usuário', () => {
    renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    // Jogo + query segura, filtrada por game_id e user_id.
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    expect(mockWhere).toHaveBeenCalledWith('game_id', '==', 'game-1');
    expect(mockWhere).toHaveBeenCalledWith('user_id', '==', 'test-user-id');
  });

  it('mantém o detalhe disponível para convidado PENDING sem consultar o elenco completo', async () => {
    const listeners: Array<{
      next: (snapshot: any) => void;
      error: (error: Error) => void;
    }> = [];
    mockOnSnapshot.mockImplementation((_ref: any, next: any, error: any) => {
      listeners.push({ next, error });
      return vi.fn();
    });

    const { result } = renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    act(() => {
      listeners[0].next({
        exists: () => true,
        id: 'game-1',
        data: () => ({ status: 'SCHEDULED', owner_id: 'owner-1' }),
      });
      listeners[1].next({
        docs: [{
          id: 'game-1_test-user-id',
          data: () => ({ game_id: 'game-1', user_id: 'test-user-id', status: 'PENDING' }),
        }],
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.confirmations).toHaveLength(1);
    });

    expect(result.current.game?.id).toBe('game-1');
    expect(result.current.confirmations[0].status).toBe('PENDING');
    expect(result.current.error).toBeNull();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('passa a carregar o elenco completo quando a própria confirmação vira CONFIRMED', async () => {
    const listeners: Array<{ next: (snapshot: any) => void }> = [];
    mockOnSnapshot.mockImplementation((_ref: any, next: any) => {
      listeners.push({ next });
      return vi.fn();
    });

    const { result } = renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    act(() => {
      listeners[0].next({
        exists: () => true,
        id: 'game-1',
        data: () => ({ status: 'SCHEDULED', owner_id: 'owner-1' }),
      });
      listeners[1].next({
        docs: [{
          id: 'game-1_test-user-id',
          data: () => ({ game_id: 'game-1', user_id: 'test-user-id', status: 'CONFIRMED' }),
        }],
      });
    });

    await waitFor(() => expect(listeners).toHaveLength(3));

    act(() => listeners[2].next({
      docs: [
        {
          id: 'game-1_test-user-id',
          data: () => ({ game_id: 'game-1', user_id: 'test-user-id', status: 'CONFIRMED', confirmation_order: 1 }),
        },
        {
          id: 'game-1_player-2',
          data: () => ({ game_id: 'game-1', user_id: 'player-2', status: 'CONFIRMED', confirmation_order: 2 }),
        },
      ],
    }));

    await waitFor(() => expect(result.current.confirmations).toHaveLength(2));
    expect(result.current.confirmations.map((confirmation) => confirmation.userId)).toEqual([
      'test-user-id',
      'player-2',
    ]);
  });

  it('remove o elenco alheio quando a própria confirmação deixa de ser CONFIRMED', async () => {
    const listeners: Array<{ next: (snapshot: any) => void }> = [];
    const unsubscribes = [vi.fn(), vi.fn(), vi.fn()];
    mockOnSnapshot.mockImplementation((_ref: any, next: any) => {
      const listenerIndex = listeners.length;
      listeners.push({ next });
      return unsubscribes[listenerIndex];
    });

    const { result } = renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    act(() => {
      listeners[0].next({
        exists: () => true,
        id: 'game-1',
        data: () => ({ status: 'SCHEDULED', owner_id: 'owner-1' }),
      });
      listeners[1].next({
        docs: [{
          id: 'game-1_test-user-id',
          data: () => ({ game_id: 'game-1', user_id: 'test-user-id', status: 'CONFIRMED' }),
        }],
      });
    });

    await waitFor(() => expect(listeners).toHaveLength(3));
    act(() => listeners[2].next({
      docs: [
        {
          id: 'game-1_test-user-id',
          data: () => ({ game_id: 'game-1', user_id: 'test-user-id', status: 'CONFIRMED' }),
        },
        {
          id: 'game-1_player-2',
          data: () => ({ game_id: 'game-1', user_id: 'player-2', status: 'CONFIRMED' }),
        },
      ],
    }));
    await waitFor(() => expect(result.current.confirmations).toHaveLength(2));

    act(() => listeners[1].next({
      docs: [{
        id: 'game-1_test-user-id',
        data: () => ({ game_id: 'game-1', user_id: 'test-user-id', status: 'CANCELLED' }),
      }],
    }));

    await waitFor(() => {
      expect(unsubscribes[2]).toHaveBeenCalledOnce();
      expect(result.current.confirmations).toHaveLength(1);
    });
    expect(result.current.confirmations[0].userId).toBe('test-user-id');
    expect(result.current.confirmations[0].status).toBe('CANCELLED');
  });

  it('não transforma erro auxiliar de confirmações em erro fatal do jogo', async () => {
    const listeners: Array<{
      next: (snapshot: any) => void;
      error: (error: Error) => void;
    }> = [];
    mockOnSnapshot.mockImplementation((_ref: any, next: any, error: any) => {
      listeners.push({ next, error });
      return vi.fn();
    });

    const { result } = renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    act(() => {
      listeners[0].next({
        exists: () => true,
        id: 'game-1',
        data: () => ({ status: 'SCHEDULED', owner_id: 'owner-1' }),
      });
      listeners[1].error(new Error('Missing or insufficient permissions'));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.game?.id).toBe('game-1');
    expect(result.current.error).toBeNull();
    expect(result.current.confirmationsError).toBeTruthy();
  });

  it('retorna dados do jogo quando snapshot emite', async () => {
    let callCount = 0;
    mockOnSnapshot.mockImplementation((ref: any, onNext: any) => {
      callCount++;
      if (callCount === 1) {
        // Game listener
        onNext({
          exists: () => true,
          id: 'game-1',
          data: () => ({
            status: 'LIVE',
            owner_id: 'user-1',
            dateTime: { toDate: () => new Date('2026-03-01') },
          }),
        });
      } else {
        // Confirmations listener
        onNext({
          docs: [],
        });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.game).not.toBeNull();
    expect(result.current.game?.id).toBe('game-1');
  });

  it('remove ambos os listeners no unmount', () => {
    const unsubGame = vi.fn();
    const unsubConfirmations = vi.fn();
    let callCount = 0;

    mockOnSnapshot.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsubGame : unsubConfirmations;
    });

    const { unmount } = renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });
    unmount();

    expect(unsubGame).toHaveBeenCalled();
    expect(unsubConfirmations).toHaveBeenCalled();
  });
});

describe('useConfirmPresence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
    mockSetDoc.mockResolvedValue(undefined);
    mockCollection.mockReturnValue('mock-collection');
    mockQuery.mockReturnValue('mock-query');
    mockGetDoc.mockResolvedValue({
      id: 'game-1',
      exists: () => true,
      data: () => ({
        status: 'SCHEDULED',
        daily_price: 87.5,
        total_cost: 700,
        max_players: 8,
        max_goalkeepers: 2,
        dateTime: new Date('2026-08-10T19:00:00'),
      }),
    });
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockConfirmGamePresence.mockResolvedValue({
      data: {
        success: true,
        alreadyConfirmed: false,
        confirmationId: 'game-1_test-user-id',
        position: 'FIELD',
        expectedPayment: 87.5,
        expectedPaymentCents: 8750,
      },
    });
  });

  it('confirma presença exclusivamente pelo callable canônico', async () => {
    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.confirmPresence('game-1', 'GOALKEEPER');
    });

    expect(mockConfirmGamePresence).toHaveBeenCalledWith({
      gameId: 'game-1',
      position: 'GOALKEEPER',
      isCasualPlayer: false,
    });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('trata retry idempotente do callable como sucesso', async () => {
    mockConfirmGamePresence.mockResolvedValueOnce({
      data: {
        success: true,
        alreadyConfirmed: true,
        confirmationId: 'game-1_test-user-id',
        position: 'FIELD',
        expectedPayment: 87.5,
        expectedPaymentCents: 8750,
      },
    });
    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.confirmPresence('game-1');
    });

    expect(succeeded).toBe(true);
    expect(mockConfirmGamePresence).toHaveBeenCalledTimes(1);
  });

  it('propaga rejeição de capacidade retornada pelo servidor', async () => {
    mockConfirmGamePresence.mockRejectedValueOnce(new Error('Este jogo já está lotado.'));
    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1');
      }),
    ).rejects.toThrow('Este jogo já está lotado.');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('exige autenticação para confirmar presença', async () => {
    mockUseAuth.mockReturnValueOnce({
      user: null,
      firebaseUser: null,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      signInWithGoogle: vi.fn(),
      resetPassword: vi.fn(),
      updateUserProfile: vi.fn(),
      refreshUser: vi.fn(),
      currentUser: null,
    });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1');
      })
    ).rejects.toThrow('User not authenticated');
  });

  it('cancelPresence marca a confirmação como CANCELLED', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'CONFIRMED' }),
      })
      .mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.cancelPresence('game-1');
    });

    expect(mockDoc).toHaveBeenCalledWith({}, 'confirmations', 'game-1_test-user-id');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({
        status: 'CANCELLED',
      }),
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('cancelPresence cancela a carona ativa do usuário', async () => {
    mockDoc.mockImplementation((_db, collectionName) => `${collectionName}-ref`);
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'CONFIRMED' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'ACTIVE' }),
      });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.cancelPresence('game-1');
    });

    expect(mockBatchUpdate).toHaveBeenNthCalledWith(
      2,
      'game_rides-ref',
      expect.objectContaining({ status: 'CANCELLED' }),
    );
  });

  it('cancelPresence preserva carona já totalmente coberta', async () => {
    mockDoc.mockImplementation((_db, collectionName) => `${collectionName}-ref`);
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'CONFIRMED' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'ACTIVE', fully_covered: true }),
      });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.cancelPresence('game-1');
    });

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
  });

  it('cancelPresence falha se confirmação não existir', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.cancelPresence('game-1');
      })
    ).rejects.toThrow('Confirmation not found');
  });
});

describe('useCreateGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc');
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        owner_id: 'test-user-id',
        member_count: 5,
        status: 'ACTIVE',
      }),
    });
    mockAddDoc.mockResolvedValue({ id: 'new-game-id' });
  });

  it('cria jogo com campos corretos', async () => {
    const { result } = renderHook(() => useCreateGame(), { wrapper: createTestWrapper() });

    await act(async () => {
      const id = await result.current.createGame({
        date: '2026-03-20',
        time: '19:00',
        maxPlayers: 14,
        groupId: 'group-qualified',
      });
      expect(id).toBe('new-game-id');
    });

    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection',
      expect.objectContaining({
        owner_id: 'test-user-id',
        owner_name: 'Test User',
        status: 'SCHEDULED',
        group_id: 'group-qualified',
        players_count: 0,
      })
    );
  });

  it('bloqueia criação sem grupo qualificado', async () => {
    const { result } = renderHook(() => useCreateGame(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.createGame({
          date: '2026-03-20',
          time: '19:00',
          maxPlayers: 14,
        });
      })
    ).rejects.toThrow('Selecione um grupo seu com pelo menos 5 membros para criar o jogo.');

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('exige autenticação para criar jogo', async () => {
    mockUseAuth.mockReturnValueOnce({
      user: null,
      firebaseUser: null,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      signInWithGoogle: vi.fn(),
      resetPassword: vi.fn(),
      updateUserProfile: vi.fn(),
      refreshUser: vi.fn(),
      currentUser: null,
    });

    const { result } = renderHook(() => useCreateGame(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.createGame({ date: '2026-03-20' });
      })
    ).rejects.toThrow('User not authenticated');
  });
});

describe('useUpdateGameStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('aceita transição válida SCHEDULED -> CONFIRMED', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'SCHEDULED' }),
    });

    const { result } = renderHook(() => useUpdateGameStatus(), { wrapper: createTestWrapper() });

    await act(async () => {
      const success = await result.current.updateStatus('game-1', 'CONFIRMED');
      expect(success).toBe(true);
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({ status: 'CONFIRMED' })
    );
  });

  it('rejeita transição inválida SCHEDULED -> FINISHED', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'SCHEDULED' }),
    });

    const { result } = renderHook(() => useUpdateGameStatus(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.updateStatus('game-1', 'FINISHED');
      })
    ).rejects.toThrow('Invalid status transition from SCHEDULED to FINISHED');
  });

  it('rejeita transição de FINISHED (sem transições válidas)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'FINISHED' }),
    });

    const { result } = renderHook(() => useUpdateGameStatus(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.updateStatus('game-1', 'CANCELLED');
      })
    ).rejects.toThrow('Invalid status transition from FINISHED to CANCELLED');
  });

  it('falha se o jogo não for encontrado', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const { result } = renderHook(() => useUpdateGameStatus(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.updateStatus('game-1', 'CONFIRMED');
      })
    ).rejects.toThrow('Game not found');
  });
});
