import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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
vi.mock('firebase/firestore', () => {
  const timestamp = {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  };
  return {
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    Timestamp: timestamp,
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

import { useGames, useGameDetail, useConfirmPresence, useCreateGame, useUpdateGameStatus } from './useGames';

describe('useGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn()); // retorna unsubscribe
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useGames());
    expect(result.current.loading).toBe(true);
  });

  it('configura listener onSnapshot na coleção games', () => {
    renderHook(() => useGames());
    expect(mockCollection).toHaveBeenCalledWith({}, 'games');
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('retorna jogos quando snapshot emite dados', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
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
      return vi.fn();
    });

    const { result } = renderHook(() => useGames());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].id).toBe('game-1');
  });

  it('filtra jogos por status', () => {
    renderHook(() => useGames({ status: 'LIVE' }));
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'LIVE');
  });

  it('filtra jogos por groupId', () => {
    renderHook(() => useGames({ groupId: 'group-1' }));
    expect(mockWhere).toHaveBeenCalledWith('group_id', '==', 'group-1');
  });

  it('aplica limit quando fornecido', () => {
    renderHook(() => useGames({ limitCount: 5 }));
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('trata erros do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('Firestore error'));
      return vi.fn();
    });

    const { result } = renderHook(() => useGames());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firestore error');
  });

  it('remove listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useGames());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('exclui jogos com deletedAt do resultado', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
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
              deleted_at: { toDate: () => new Date() },
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useGames());

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
    const { result } = renderHook(() => useGameDetail(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.game).toBeNull();
  });

  it('configura listeners para jogo e confirmações', () => {
    renderHook(() => useGameDetail('game-1'));

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

    const { result } = renderHook(() => useGameDetail('game-1'));

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

    const { unmount } = renderHook(() => useGameDetail('game-1'));
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
    mockGetDoc.mockResolvedValue({ exists: () => true });
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('cria confirmação com o padrão correto de doc ID (gameId_userId)', async () => {
    const { result } = renderHook(() => useConfirmPresence());

    await act(async () => {
      await result.current.confirmPresence('game-1');
    });

    // Verifica que o doc ID é determinístico
    expect(mockDoc).toHaveBeenCalledWith({}, 'confirmations', 'game-1_test-user-id');
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

    const { result } = renderHook(() => useConfirmPresence());

    await expect(
      act(async () => {
        await result.current.confirmPresence('game-1');
      })
    ).rejects.toThrow('User not authenticated');
  });

  it('cancelPresence deleta o documento de confirmação', async () => {
    const { result } = renderHook(() => useConfirmPresence());

    await act(async () => {
      await result.current.cancelPresence('game-1');
    });

    expect(mockDoc).toHaveBeenCalledWith({}, 'confirmations', 'game-1_test-user-id');
  });

  it('cancelPresence falha se confirmação não existir', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const { result } = renderHook(() => useConfirmPresence());

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
    mockAddDoc.mockResolvedValue({ id: 'new-game-id' });
  });

  it('cria jogo com campos corretos', async () => {
    const { result } = renderHook(() => useCreateGame());

    await act(async () => {
      const id = await result.current.createGame({
        date: '2026-03-20',
        time: '19:00',
        maxPlayers: 14,
      });
      expect(id).toBe('new-game-id');
    });

    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection',
      expect.objectContaining({
        owner_id: 'test-user-id',
        owner_name: 'Test User',
        status: 'SCHEDULED',
        players_count: 0,
        xp_processed: false,
      })
    );
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

    const { result } = renderHook(() => useCreateGame());

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

    const { result } = renderHook(() => useUpdateGameStatus());

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

    const { result } = renderHook(() => useUpdateGameStatus());

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

    const { result } = renderHook(() => useUpdateGameStatus());

    await expect(
      act(async () => {
        await result.current.updateStatus('game-1', 'CANCELLED');
      })
    ).rejects.toThrow('Invalid status transition from FINISHED to CANCELLED');
  });

  it('falha se o jogo não for encontrado', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const { result } = renderHook(() => useUpdateGameStatus());

    await expect(
      act(async () => {
        await result.current.updateStatus('game-1', 'CONFIRMED');
      })
    ).rejects.toThrow('Game not found');
  });
});
