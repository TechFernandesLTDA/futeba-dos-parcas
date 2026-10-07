// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockGetDocs = vi.fn();
const mockRunTransaction = vi.fn();
const mockTxGet = vi.fn();
const mockTxSet = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
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
  user: { id: 'test-user-id', name: 'Renan', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Renan Teste', photoURL: null },
  currentUser: { uid: 'test-user-id', displayName: 'Renan Teste' },
  loading: false, error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: unknown) => {
    const code = (err as { code?: string })?.code;
    if (code) return `ff:${code}`;
    return err instanceof Error ? err.message : 'ff:unknown';
  },
}));

import { usePostGameMessages, useSavePostGameMessage } from './usePostGameMessages';
import { Timestamp } from 'firebase/firestore';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
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

function messageDoc(id: string, raw: Record<string, unknown>) {
  return { id, data: () => raw };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockTxGet.mockResolvedValue({ exists: () => false });
  mockRunTransaction.mockImplementation(
    async (_db: unknown, cb: (tx: any) => Promise<unknown>) => cb({ get: mockTxGet, set: mockTxSet }),
  );
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Renan', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Renan Teste', photoURL: null },
    currentUser: { uid: 'test-user-id', displayName: 'Renan Teste' },
    loading: false, error: null,
  };
});

describe('usePostGameMessages', () => {
  it('carrega recados do jogo com where game_id, orderBy updated_at desc e limit 20', async () => {
    renderHook(() => usePostGameMessages('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

    const q = mockGetDocs.mock.calls[0][0] as { base: { path: string }; constraints: any[] };
    expect(q.base.path).toBe('post_game_messages');
    expect(q.constraints).toContainEqual({ type: 'where', field: 'game_id', op: '==', value: 'g-1' });
    expect(q.constraints).toContainEqual({ type: 'orderBy', field: 'updated_at', direction: 'desc' });
    expect(q.constraints).toContainEqual({ type: 'limit', value: 20 });
  });

  it('mapeia os docs para PostGameMessage com datas convertidas', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        messageDoc('m-1', {
          game_id: 'g-1', user_id: 'u-1', user_name: 'Beto', message: 'Boa!',
          created_at: Timestamp.fromMillis(1000), updated_at: Timestamp.fromMillis(2000),
        }),
        messageDoc('m-2', {
          game_id: 'g-1', user_id: 'u-2', message: 'Falta transport',
        }),
      ],
    });
    const { result } = renderHook(() => usePostGameMessages('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    const [first, second] = result.current.messages;
    expect(first).toMatchObject({
      id: 'm-1', gameId: 'g-1', userId: 'u-1', userName: 'Beto', message: 'Boa!',
      createdAt: new Date(1000), updatedAt: new Date(2000),
    });
    // userName ausente → 'Jogador'; datas ausentes → undefined
    expect(second).toMatchObject({
      id: 'm-2', userName: 'Jogador', createdAt: undefined, updatedAt: undefined,
    });
    expect(result.current.error).toBeNull();
  });

  it('sem gameId: retorna [] sem consultar', async () => {
    const { result } = renderHook(() => usePostGameMessages(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('expõe a mensagem de erro da query', async () => {
    mockGetDocs.mockRejectedValue(new Error('índice ausente'));
    const { result } = renderHook(() => usePostGameMessages('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('índice ausente'));
    expect(result.current.messages).toEqual([]);
  });

  it('refetch relê os recados', async () => {
    const { result } = renderHook(() => usePostGameMessages('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('useSavePostGameMessage', () => {
  it('grava recado novo com doc id gameId_uid, trim, user_name e created_at', async () => {
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync('  Boa partida!  ');
    });

    expect(mockDoc).toHaveBeenCalledWith({}, 'post_game_messages', 'g-1_test-user-id');
    const payload = mockTxSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      game_id: 'g-1',
      user_id: 'test-user-id',
      user_name: 'Renan', // user.name vence
      message: 'Boa partida!',
      updated_at: SERVER_TIMESTAMP,
      created_at: SERVER_TIMESTAMP,
    });
    expect(mockShowSuccess).toHaveBeenCalledWith('Recado salvo.');
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['post-game-messages', 'g-1'] }),
    );
  });

  it('user_name cai para currentUser.displayName e depois para Jogador', async () => {
    mockAuthReturn = {
      user: null,
      firebaseUser: { uid: 'test-user-id', displayName: null, photoURL: null },
      currentUser: { uid: 'test-user-id', displayName: 'Renan F.' },
      loading: false, error: null,
    };
    const first = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await first.result.current.mutateAsync('Ok');
    });
    expect((mockTxSet.mock.calls[0][1] as any).user_name).toBe('Renan F.');
    first.unmount();

    mockAuthReturn = {
      user: null,
      firebaseUser: { uid: 'test-user-id', displayName: null, photoURL: null },
      currentUser: { uid: 'test-user-id', displayName: null },
      loading: false, error: null,
    };
    const second = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await second.result.current.mutateAsync('Ok');
    });
    expect((mockTxSet.mock.calls[1][1] as any).user_name).toBe('Jogador');
  });

  it('atualiza recado existente sem regravar created_at', async () => {
    mockTxGet.mockResolvedValue({ exists: () => true });
    const { result } = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync('Editado');
    });
    const payload = mockTxSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.created_at).toBeUndefined();
    expect(payload.message).toBe('Editado');
    expect(payload.updated_at).toBe(SERVER_TIMESTAMP);
  });

  it('rejeita recado curto demais e espaços em branco', async () => {
    const { result } = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    for (const bad of ['x', '   ']) {
      await act(async () => {
        try {
          await result.current.mutateAsync(bad);
        } catch (e) {
          expect((e as Error).message).toBe('O recado deve ter entre 2 e 240 caracteres.');
        }
      });
    }
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('aceita 2 e 240 caracteres', async () => {
    const { result } = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync('ok');
      await result.current.mutateAsync('a'.repeat(240));
    });
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });

  it('rejeita recado com mais de 240 caracteres', async () => {
    const { result } = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try {
        await result.current.mutateAsync('a'.repeat(241));
      } catch (e) {
        expect((e as Error).message).toBe('O recado deve ter entre 2 e 240 caracteres.');
      }
    });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('exige gameId e usuário logado', async () => {
    const noGame = renderHook(() => useSavePostGameMessage(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await noGame.result.current.mutateAsync('Ola'); } catch (e) {
        expect((e as Error).message).toBe('Jogo não encontrado.');
      }
    });
    noGame.unmount();

    mockAuthReturn = {
      user: null, firebaseUser: null, currentUser: null, loading: false, error: null,
    };
    const noUser = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await noUser.result.current.mutateAsync('Ola'); } catch (e) {
        expect((e as Error).message).toBe('Jogo não encontrado.');
      }
    });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('erro de Firestore com code vira toast mapeado; Error puro vira a própria mensagem', async () => {
    const { result } = renderHook(() => useSavePostGameMessage('g-1'), { wrapper: wrapperFor(makeQueryClient()) });

    mockRunTransaction.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await act(async () => {
      try { await result.current.mutateAsync('Boa'); } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('ff:permission-denied');

    mockRunTransaction.mockRejectedValueOnce(new Error('deadlock na transação'));
    await act(async () => {
      try { await result.current.mutateAsync('Boa'); } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('deadlock na transação');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
