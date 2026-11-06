// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// t ESTÁVEL: usado em callbacks memoizadas (useMutation) — recriar a função
// por render causaria loop de effect.
const mockT = (key: string) => key;

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockRunTransaction = vi.fn();
const mockTxGet = vi.fn();
const mockTxSet = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGetUsersByIds = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    ms: number;
    constructor(ms: number) { this.ms = ms; }
    toDate(): Date { return new Date(this.ms); }
    toMillis(): number { return this.ms; }
    static fromDate(d: Date): MockTimestamp { return new MockTimestamp(d.getTime()); }
    static fromMillis(ms: number): MockTimestamp { return new MockTimestamp(ms); }
    static now(): MockTimestamp { return new MockTimestamp(Date.now()); }
  }
  return {
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
    orderBy: vi.fn((field: string, direction: string) => ({ type: 'orderBy', field, direction })),
    limit: vi.fn((value: number) => ({ type: 'limit', value })),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    runTransaction: (...args: any[]) => mockRunTransaction(...args),
    serverTimestamp: () => SERVER_TIMESTAMP,
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false, error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mapper determinístico: preserva código p/ erros Firestore, mensagem p/ Errors puros.
vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: unknown) => {
    const code = (err as { code?: string })?.code;
    if (code) return `ff:${code}`;
    return err instanceof Error ? err.message : 'ff:unknown';
  },
}));

vi.mock('../utils/userBatch', () => ({
  getUsersByIds: (...args: any[]) => mockGetUsersByIds(...args),
}));

import { useDreamTeam, usePlayedAgainst, useSaveDreamTeam } from './useDreamTeam';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

// QuerySnapshot do Firestore tem forEach além de docs — usePlayedAgainst
// itera o snapshot direto (gameConfSnap.forEach). #mock
function snapOf(docs: any[]) {
  return { docs, forEach: (cb: any) => docs.forEach(cb) };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const VALID_PLAYERS = [
  { userId: 'u-1', position: 'GOALKEEPER' as const },
  { userId: 'u-2', position: 'DEFENDER' as const },
  { userId: 'u-3', position: 'DEFENDER' as const },
  { userId: 'u-4', position: 'MIDFIELDER' as const },
  { userId: 'u-5', position: 'STRIKER' as const },
];

describe('useDreamTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
    };
  });

  it('não consulta Firestore sem usuário autenticado', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(result.current.dreamTeam).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('carrega o dream team atual de users/{uid}/dream_team/current', async () => {
    const saved = { players: VALID_PLAYERS, createdAt: new Date('2026-01-01') };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => saved });
    const { result } = renderHook(() => useDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.dreamTeam).toEqual(saved));
    expect(mockGetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/test-user-id/dream_team/current' }),
    );
  });

  it('retorna null quando o documento não existe', async () => {
    const { result } = renderHook(() => useDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.data).toBeNull());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('expõe a mensagem do erro da query e o contrato { loading, error, refetch }', async () => {
    mockGetDoc.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.loading).toBe(false);
    expect(typeof result.current.refetch).toBe('function');
  });

  it('refetch consulta o documento novamente', async () => {
    const { result } = renderHook(() => useDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.data).toBeNull());
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });
});

describe('usePlayedAgainst', () => {
  function confDoc(gameId: string) {
    return {
      id: `conf-${gameId}`,
      data: () => ({ user_id: 'test-user-id', game_id: gameId, was_present: true }),
    };
  }
  function gameConfDoc(gameId: string, userId: string) {
    return {
      id: `${gameId}_${userId}`,
      data: () => ({ user_id: userId, game_id: gameId, was_present: true }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetUsersByIds.mockResolvedValue(new Map());
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
    };
  });

  it('coleta oponentes das confirmações, deduplica, exclui o próprio uid e busca via getUsersByIds', async () => {
    mockGetDocs.mockImplementation(async (q: any) => {
      const w = (q?.constraints ?? []).find((c: any) => c?.type === 'where');
      if (w?.field === 'user_id') {
        return snapOf([
          confDoc('game-1'),
          confDoc('game-2'),
          // confirmação sem game_id — deve ser ignorada (continue)
          { id: 'conf-x', data: () => ({ user_id: 'test-user-id', was_present: true }) },
        ]);
      }
      if (w?.field === 'game_id' && w.value === 'game-1') {
        return snapOf([
          gameConfDoc('game-1', 'op-1'),
          gameConfDoc('game-1', 'test-user-id'), // próprio uid — excluído
          gameConfDoc('game-1', 'op-1'), // duplicado — Set remove
        ]);
      }
      if (w?.field === 'game_id' && w.value === 'game-2') {
        return snapOf([gameConfDoc('game-2', 'op-2')]);
      }
      return snapOf([]);
    });
    mockGetUsersByIds.mockResolvedValue(new Map([
      ['op-1', { name: 'Op Um' }],
      ['op-2', { name: 'Op Dois', photoUrl: 'p.png', autoStrikerRating: 3.5 }],
    ]));

    const { result } = renderHook(() => usePlayedAgainst(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.players).toHaveLength(2));

    expect(mockGetUsersByIds).toHaveBeenCalledWith(['op-1', 'op-2']);
    expect(result.current.players?.[0]).toEqual({
      id: 'op-1', name: 'Op Um', photoUrl: undefined, autoStrikerRating: 0,
    });
    expect(result.current.players?.[1]).toEqual({
      id: 'op-2', name: 'Op Dois', photoUrl: 'p.png', autoStrikerRating: 3.5,
    });

    // Só 2 buscas por game_id: a confirmação sem game_id não gerou consulta.
    const gameIdQueries = mockGetDocs.mock.calls.filter((call: any[]) => {
      const cs = call[0]?.constraints ?? [];
      return cs.some((c: any) => c?.type === 'where' && c.field === 'game_id');
    });
    expect(gameIdQueries).toHaveLength(2);
  });

  it('fallbacks de nome "Jogador" e rating 0 quando o usuário não veio no batch', async () => {
    mockGetDocs.mockImplementation(async (q: any) => {
      const w = (q?.constraints ?? []).find((c: any) => c?.type === 'where');
      if (w?.field === 'user_id') return snapOf([confDoc('game-1')]);
      if (w?.field === 'game_id') return snapOf([gameConfDoc('game-1', 'op-1')]);
      return snapOf([]);
    });
    // oponente presente no batch, mas sem name e sem autoStrikerRating
    mockGetUsersByIds.mockResolvedValue(new Map([['op-1', {}]]));

    const { result } = renderHook(() => usePlayedAgainst(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.players).toHaveLength(1));
    expect(result.current.players?.[0]).toEqual({
      id: 'op-1', name: 'Jogador', photoUrl: undefined, autoStrikerRating: 0,
    });
  });

  it('limita a busca por batch a 50 oponentes', async () => {
    mockGetDocs.mockImplementation(async (q: any) => {
      const w = (q?.constraints ?? []).find((c: any) => c?.type === 'where');
      if (w?.field === 'user_id') return snapOf([confDoc('game-big')]);
      return snapOf(
        Array.from({ length: 60 }, (_, i) => gameConfDoc('game-big', `op-${i}`)),
      );
    });
    mockGetUsersByIds.mockResolvedValue(new Map());

    const { result } = renderHook(() => usePlayedAgainst(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockGetUsersByIds).toHaveBeenCalled());
    const ids = mockGetUsersByIds.mock.calls[0][0] as string[];
    expect(ids).toHaveLength(50);
    void result;
  });

  it('sem confirmações: retorna [] sem chamar getUsersByIds com oponentes', async () => {
    const { result } = renderHook(() => usePlayedAgainst(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.players).toEqual([]);
    expect(mockGetUsersByIds).toHaveBeenCalledWith([]);
  });

  it('sem usuário autenticado: query desabilitada, players undefined e nenhuma consulta', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => usePlayedAgainst(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(result.current.players).toBeUndefined();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('expõe erro da query', async () => {
    mockGetDocs.mockRejectedValue(new Error('stream-falhou'));
    const { result } = renderHook(() => usePlayedAgainst(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('stream-falhou'));
  });
});

describe('useSaveDreamTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockTxGet.mockResolvedValue({ exists: () => false });
    mockRunTransaction.mockImplementation(
      async (_db: unknown, cb: (tx: any) => Promise<unknown>) => cb({ get: mockTxGet, set: mockTxSet }),
    );
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
    };
  });

  it('salva 5 jogadores com merge, created_at apenas em novo doc, toast e invalidação', async () => {
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSaveDreamTeam(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync(VALID_PLAYERS);
    });

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/test-user-id/dream_team/current' }),
      expect.objectContaining({ players: VALID_PLAYERS, updated_at: SERVER_TIMESTAMP, created_at: SERVER_TIMESTAMP }),
      { merge: true },
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('feedback.dreamTeam.saveSuccess');
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['dream-team', 'test-user-id'] }),
    );
  });

  it('não regrava created_at quando o doc já existe', async () => {
    mockTxGet.mockResolvedValue({ exists: () => true });
    const { result } = renderHook(() => useSaveDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      await result.current.mutateAsync(VALID_PLAYERS);
    });

    const payload = mockTxSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.created_at).toBeUndefined();
    expect(payload.updated_at).toBe(SERVER_TIMESTAMP);
  });

  it('rejeita sem login, sem gravar e sem toast de sucesso', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useSaveDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      try {
        await result.current.mutateAsync(VALID_PLAYERS);
      } catch (err) {
        expect((err as Error).message).toBe('Você precisa estar logado.');
      }
    });
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('rejeita lista com número diferente de 5 jogadores', async () => {
    const { result } = renderHook(() => useSaveDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });

    for (const wrong of [[], VALID_PLAYERS.slice(0, 4), [...VALID_PLAYERS, { userId: 'u-6', position: 'STRIKER' as const }]]) {
      await act(async () => {
        try {
          await result.current.mutateAsync(wrong as any);
        } catch (err) {
          expect((err as Error).message).toBe('Selecione exatamente 5 jogadores.');
        }
      });
    }
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith('Selecione exatamente 5 jogadores.');
  });

  it('erro do Firestore exibe toast de erro e não exibe sucesso', async () => {
    mockRunTransaction.mockRejectedValue(Object.assign(new Error('negado'), { code: 'permission-denied' }));
    const { result } = renderHook(() => useSaveDreamTeam(), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      try {
        await result.current.mutateAsync(VALID_PLAYERS);
      } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('ff:permission-denied');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
