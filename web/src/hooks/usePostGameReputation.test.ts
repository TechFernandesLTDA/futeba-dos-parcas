// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
// Importado APÓS o vi.mock: resolve para o MockTimestamp da factory,
// exigido pelo instanceof em utils/firestoreHelpers.toDate.
import { Timestamp } from 'firebase/firestore';

const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
void mockQuery;
const mockWhere = vi.fn();
const mockSubmitPostGameReputation = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    ms: number;
    constructor(ms: number) {
      this.ms = ms;
    }
    toDate(): Date {
      return new Date(this.ms);
    }
    toMillis(): number {
      return this.ms;
    }
    static fromDate(d: Date): MockTimestamp {
      return new MockTimestamp(d.getTime());
    }
    static fromMillis(ms: number): MockTimestamp {
      return new MockTimestamp(ms);
    }
    static now(): MockTimestamp {
      return new MockTimestamp(Date.now());
    }
  }
  return {
    collection: (...args: any[]) => mockCollection(...args),
    query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
    where: (...args: any[]) => mockWhere(...args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../services/cloudFunctions', () => ({
  submitPostGameReputation: (...args: any[]) => mockSubmitPostGameReputation(...args),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Erros determinísticos por código — evita depender do mapa PT-BR real.
vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: any) => `firestore:${err?.code ?? 'desconhecido'}`,
  getFunctionsErrorMessage: (err: any) => `functions:${err?.code ?? 'desconhecido'}`,
}));

let mockAuthReturn: any = {
  currentUser: { uid: 'ctx-user' },
  firebaseUser: { uid: 'test-user-id' },
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { usePostGameReputation } from './usePostGameReputation';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

interface SnapshotCallbacks {
  next: (snapshot: unknown) => void;
  error: (error: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let callbacks: SnapshotCallbacks[];

function reviewDoc(id: string, data: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      game_id: 'game-1',
      reviewer_id: 'test-user-id',
      target_user_id: 'player-1',
      punctuality: 4,
      respect: 5,
      commitment: 3,
      overall: 4,
      comment: 'Bom jogador',
      created_at: Timestamp.fromMillis(1735689600000),
      updated_at: Timestamp.fromMillis(1735776000000),
      ...data,
    }),
  };
}

function act_emitting(emit: () => void) {
  act(() => emit());
}

beforeEach(() => {
  vi.clearAllMocks();
  callbacks = [];
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockWhere.mockImplementation((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }));
  mockOnSnapshot.mockImplementation((_q: unknown, next: SnapshotCallbacks['next'], error: SnapshotCallbacks['error']) => {
    callbacks.push({ next, error, unsubscribe: vi.fn() });
    return callbacks[callbacks.length - 1].unsubscribe;
  });
  mockSubmitPostGameReputation.mockResolvedValue({ data: {} });
  mockAuthReturn = {
    currentUser: { uid: 'ctx-user' },
    firebaseUser: { uid: 'test-user-id' },
    loading: false,
    error: null,
  };
});

describe('usePostGameReputation — listener', () => {
  it('disabled: não configura listener e não fica em loading', () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', false));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.reviews).toEqual([]);
  });

  it('gameId null: não configura listener', () => {
    renderHook(() => usePostGameReputation(null, true));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('sem usuário autenticado: não configura listener', () => {
    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    renderHook(() => usePostGameReputation('game-1', true));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('prioriza firebaseUser.uid sobre currentUser.uid', () => {
    mockAuthReturn = {
      currentUser: { uid: 'ctx-user' },
      firebaseUser: { uid: 'fb-user' },
      loading: false,
      error: null,
    };
    renderHook(() => usePostGameReputation('game-1', true));
    expect(mockWhere).toHaveBeenCalledWith('reviewer_id', '==', 'fb-user');
  });

  it('usa currentUser.uid quando firebaseUser está ausente', () => {
    mockAuthReturn = {
      currentUser: { uid: 'ctx-user' },
      firebaseUser: null,
      loading: false,
      error: null,
    };
    renderHook(() => usePostGameReputation('game-1', true));
    expect(mockWhere).toHaveBeenCalledWith('reviewer_id', '==', 'ctx-user');
  });

  it('consulta post_game_reputation com where game_id + reviewer_id', () => {
    renderHook(() => usePostGameReputation('game-1', true));
    expect(mockCollection).toHaveBeenCalledWith({}, 'post_game_reputation');
    expect(mockWhere).toHaveBeenCalledWith('game_id', '==', 'game-1');
    expect(mockWhere).toHaveBeenCalledWith('reviewer_id', '==', 'test-user-id');
  });

  it('parseia reviews: campos snake_case, datas e índice por target_user_id', async () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    act_emitting(() => callbacks[0].next({
      docs: [reviewDoc('r-1', { target_user_id: 'player-1' }), reviewDoc('r-2', { target_user_id: 'player-2', overall: 5 })],
    }));
    await waitFor(() => expect(result.current.reviews).toHaveLength(2));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reviews[0]).toMatchObject({
      id: 'r-1',
      gameId: 'game-1',
      reviewerId: 'test-user-id',
      targetUserId: 'player-1',
      punctuality: 4,
      respect: 5,
      commitment: 3,
      overall: 4,
      comment: 'Bom jogador',
    });
    expect(result.current.reviews[0].createdAt).toBeInstanceOf(Date);
    expect(result.current.reviews[0].createdAt!.getTime()).toBe(1735689600000);
    expect(result.current.reviews[0].updatedAt!.getTime()).toBe(1735776000000);

    expect(result.current.reviewsByTarget.get('player-1')?.id).toBe('r-1');
    expect(result.current.reviewsByTarget.get('player-2')?.overall).toBe(5);
    expect(result.current.reviewsByTarget.size).toBe(2);
  });

  it('dois targets: cada entrada do mapa aponta para a review correta (Map por target)', async () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    act_emitting(() => callbacks[0].next({
      docs: [
        reviewDoc('r-a', { target_user_id: 'p-a', overall: 2 }),
        reviewDoc('r-b', { target_user_id: 'p-b', overall: 3 }),
      ],
    }));
    await waitFor(() => expect(result.current.reviewsByTarget.size).toBe(2));
    // keys em ordem de chegada dos docs
    expect([...result.current.reviewsByTarget.keys()]).toEqual(['p-a', 'p-b']);
  });

  it('snapshot com docs vazios: reviews vazio e loading=false', async () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    act_emitting(() => callbacks[0].next({ docs: [] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reviews).toEqual([]);
    expect(result.current.reviewsByTarget.size).toBe(0);
  });

  it('erro do snapshot: reviews vazio, loading=false e mensagem via getFirestoreErrorMessage', async () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    act_emitting(() => callbacks[0].next({ docs: [reviewDoc('r-1')] }));
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));

    act_emitting(() => callbacks[0].error(Object.assign(new Error('denied'), { code: 'permission-denied' })));
    await waitFor(() => expect(result.current.error).toBe('firestore:permission-denied'));
    expect(result.current.reviews).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('refetch reinscreve o listener (cancela o antigo)', async () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    await waitFor(() => expect(callbacks.length).toBe(1));

    act(() => result.current.refetch());
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
    expect(callbacks[0].unsubscribe).toHaveBeenCalled();
  });

  it('unmount cancela o listener', async () => {
    const { unmount } = renderHook(() => usePostGameReputation('game-1', true));
    await waitFor(() => expect(callbacks.length).toBe(1));
    unmount();
    expect(callbacks[0].unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('usePostGameReputation — saveReview', () => {
  const baseInput = {
    targetUserId: 'player-9',
    punctuality: 5,
    respect: 4,
    commitment: 3,
    comment: '  Ótimo goleiro  ',
  };

  it('retorna false sem gameId e não chama a Cloud Function', async () => {
    const { result } = renderHook(() => usePostGameReputation(null, true));
    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.saveReview(baseInput);
    });
    expect(returned).toBe(false);
    expect(mockSubmitPostGameReputation).not.toHaveBeenCalled();
    expect(result.current.savingTargetId).toBeNull();
  });

  it('envia payload com gameId e comentário trimado; retorna true', async () => {
    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.saveReview(baseInput);
    });
    expect(returned).toBe(true);
    expect(mockSubmitPostGameReputation).toHaveBeenCalledWith({
      gameId: 'game-1',
      targetUserId: 'player-9',
      punctuality: 5,
      respect: 4,
      commitment: 3,
      comment: 'Ótimo goleiro',
    });
    expect(result.current.error).toBeNull();
    expect(result.current.savingTargetId).toBeNull();
  });

  it('marca savingTargetId durante o envio e limpa no finally', async () => {
    let resolveSubmit!: (v: unknown) => void;
    mockSubmitPostGameReputation.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve; }));

    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    let promise!: Promise<boolean>;
    await act(async () => {
      promise = result.current.saveReview(baseInput);
    });
    expect(result.current.savingTargetId).toBe('player-9');

    await act(async () => {
      resolveSubmit({ data: {} });
      await promise;
    });
    expect(result.current.savingTargetId).toBeNull();
  });

  it('erro da Cloud Function: define mensagem, repropaga e limpa savingTargetId', async () => {
    const failure = Object.assign(new Error('limite atingido'), { code: 'resource-exhausted' });
    mockSubmitPostGameReputation.mockRejectedValue(failure);

    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    await act(async () => {
      await expect(result.current.saveReview(baseInput)).rejects.toThrow('limite atingido');
    });

    expect(result.current.error).toBe('functions:resource-exhausted');
    expect(result.current.savingTargetId).toBeNull();
  });

  it('erro de um save não bloqueia o próximo (error é limpo no início do novo save)', async () => {
    mockSubmitPostGameReputation
      .mockRejectedValueOnce(Object.assign(new Error('falhou'), { code: 'internal' }))
      .mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => usePostGameReputation('game-1', true));
    await act(async () => {
      await expect(result.current.saveReview({ ...baseInput, targetUserId: 'p-1' })).rejects.toThrow('falhou');
    });
    expect(result.current.error).toBe('functions:internal');

    await act(async () => {
      await result.current.saveReview({ ...baseInput, targetUserId: 'p-2' });
    });
    expect(result.current.error).toBeNull();
  });
});
