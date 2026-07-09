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
// mockGetDocs é usado pelos testes de useGames (migrado para useQuery/getDocs)
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });

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
    // useGames usa useQuery/getDocs (migrado de onSnapshot em #2351)
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockOnSnapshot.mockReturnValue(vi.fn()); // useGameDetail ainda usa onSnapshot
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('configura query na coleção games via getDocs', () => {
    // useGames foi migrado de onSnapshot → useQuery/getDocs (#2351).
    renderHook(() => useGames(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'games');
  });

  it('retorna jogos quando getDocs emite dados', async () => {
    // useGames usa useQuery/getDocs — simular retorno via mockGetDocs.
    mockGetDocs.mockResolvedValueOnce({
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

    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });

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

  it('trata erros do getDocs', async () => {
    // useGames usa useQuery/getDocs — simular erro via mockRejectedValue.
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firestore error');
  });

  it('usa getDocs (não onSnapshot) para buscar jogos', () => {
    // useGames usa useQuery/getDocs — não cria listener onSnapshot.
    // Garantir que a collection 'games' é consultada via getDocs.
    renderHook(() => useGames(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'games');
    // onSnapshot NÃO deve ser chamado pelo hook useGames principal
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('exclui jogos com deletedAt do resultado', async () => {
    // useGames usa getDocs e filtra deletedAt no lado cliente.
    mockGetDocs.mockResolvedValueOnce({
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

    const { result } = renderHook(() => useGames(), { wrapper: createTestWrapper() });

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

  it('configura listeners para jogo e confirmações', () => {
    renderHook(() => useGameDetail('game-1'), { wrapper: createTestWrapper() });

    // Deve chamar onSnapshot duas vezes (jogo + confirmações)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
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
  });

  it('cria confirmação com o padrão correto de doc ID (gameId_userId)', async () => {
    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.confirmPresence('game-1');
    });

    // Verifica que o doc ID é determinístico
    expect(mockDoc).toHaveBeenCalledWith({}, 'confirmations', 'game-1_test-user-id');
  });

  it('grava o valor esperado da confirmação a partir do daily_price proporcional do jogo', async () => {
    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.confirmPresence('game-1');
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({
        payment_status: 'PENDING',
        partial_payment: 0,
        expected_payment: 87.5,
        expected_payment_cents: 8750,
      })
    );
  });

  it('bloqueia confirmação quando o jogo não aceita mais confirmações', async () => {
    mockGetDoc.mockResolvedValueOnce({
      id: 'game-1',
      exists: () => true,
      data: () => ({
        status: 'LIVE',
        daily_price: 87.5,
        total_cost: 700,
        max_players: 8,
        max_goalkeepers: 2,
        dateTime: new Date('2026-08-10T19:00:00'),
      }),
    });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1');
      }),
    ).rejects.toThrow('Este jogo não aceita mais confirmações.');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('bloqueia confirmação quando o horário do jogo já passou', async () => {
    mockGetDoc.mockResolvedValueOnce({
      id: 'game-1',
      exists: () => true,
      data: () => ({
        status: 'SCHEDULED',
        daily_price: 87.5,
        total_cost: 700,
        max_players: 8,
        max_goalkeepers: 2,
        dateTime: new Date('2020-08-10T19:00:00'),
      }),
    });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1');
      }),
    ).rejects.toThrow('Não é possível confirmar presença depois do horário do jogo.');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('bloqueia confirmação quando a lista já está cheia', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: Array.from({ length: 8 }, (_, index) => ({
        data: () => ({
          status: 'CONFIRMED',
          user_id: `user-${index}`,
          position: 'FIELD',
        }),
      })),
    });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1');
      }),
    ).rejects.toThrow('Lista Cheia');
  });

  it('permite jogador de linha mesmo quando as vagas de goleiro estão cheias', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ status: 'CONFIRMED', user_id: 'gk-1', position: 'GOALKEEPER' }) },
        { data: () => ({ status: 'CONFIRMED', user_id: 'gk-2', position: 'GOALKEEPER' }) },
      ],
    });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.confirmPresence('game-1', 'FIELD');
    });

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('bloqueia confirmação de goleiro quando as vagas de goleiro acabaram', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ status: 'CONFIRMED', user_id: 'gk-1', position: 'GOALKEEPER' }) },
        { data: () => ({ status: 'CONFIRMED', user_id: 'gk-2', position: 'GOALKEEPER' }) },
      ],
    });

    const { result } = renderHook(() => useConfirmPresence(), { wrapper: createTestWrapper() });

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1', 'GOALKEEPER');
      }),
    ).rejects.toThrow('As vagas de goleiro já foram preenchidas.');
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
        xp_processed: false,
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
