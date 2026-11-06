// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
void mockQuery;
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  // firestoreHelpers importa Timestamp (para toDate/instanceof) — precisa existir no mock.
  Timestamp: class TimestampMock {
    static fromDate(d: Date) {
      return { toDate: () => d, toMillis: () => d.getTime() };
    }
    static fromMillis(ms: number) {
      return { toDate: () => new Date(ms), toMillis: () => ms };
    }
  },
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

// Firestore errors são mapeados por código — mock determinístico.
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

let mockAuthReturn: any = {
  currentUser: { uid: 'test-user-id' },
  firebaseUser: { uid: 'test-user-id' },
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useTeams } from './useTeams';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function teamDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

const TEAMS_SNAPSHOT = {
  docs: [
    teamDoc('t-1', { name: 'Corinthians', badge_url: 'https://badge/cor.png', short_name: 'COR', state: 'SP' }),
    teamDoc('t-2', { name: 'Flamengo', badge_url: 'https://badge/fla.png' }),
  ],
};

let setTimeoutSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  // Gate de 800ms disparado imediatamente por padrão: a maioria dos testes não
  // precisa esperar o timer real. APENAS o callback com delay 800 é acelerado —
  // timers de terceiros (waitFor do RTL usa setTimeout) seguem nativos.
  // O teste de gate restaura os timers nativos.
  const originalSetTimeout = window.setTimeout.bind(window);
  setTimeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation(((cb: any, ms?: number, ...rest: any[]) => {
    if (ms === 800) {
      cb();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }
    return originalSetTimeout(cb, ms, ...rest);
  }) as any);
  mockCollection.mockImplementation((_db: unknown, name: string) => ({ path: name }));
  mockOrderBy.mockImplementation((field: string, dir: string) => ({ type: 'orderBy', field, dir }));
  mockGetDocs.mockResolvedValue(TEAMS_SNAPSHOT);
  mockAuthReturn = {
    currentUser: { uid: 'test-user-id' },
    firebaseUser: { uid: 'test-user-id' },
    loading: false,
    error: null,
  };
});

afterEach(() => {
  setTimeoutSpy.mockRestore();
});

describe('useTeams', () => {
  it('sem usuário: query desabilitada, sem consulta, teams vazio e loading=false', async () => {
    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.teams).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('consulta favorite_teams ordenado por name asc', async () => {
    renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(1));
    expect(mockCollection).toHaveBeenCalledWith({}, 'favorite_teams');
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
  });

  it('mapeia docs: snake_case → camelCase e id do doc preservado', async () => {
    const { result } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.teams).toHaveLength(2));

    const [first, second] = result.current.teams;
    expect(first).toEqual({
      id: 't-1',
      name: 'Corinthians',
      badgeUrl: 'https://badge/cor.png',
      shortName: 'COR',
      state: 'SP',
    });
    expect(second).toEqual({
      id: 't-2',
      name: 'Flamengo',
      badgeUrl: 'https://badge/fla.png',
    });
    expect(result.current.error).toBeNull();
  });

  it('teamsById indexa os times por id', async () => {
    const { result } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.teamsById.size).toBe(2));
    expect(result.current.teamsById.get('t-1')?.name).toBe('Corinthians');
    expect(result.current.teamsById.get('t-2')?.name).toBe('Flamengo');
  });

  it('gate de 800ms: query só habilita depois do delay (timers reais)', async () => {
    setTimeoutSpy.mockRestore(); // comportamento nativo do setTimeout
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });

      await act(async () => {});
      expect(mockGetDocs).not.toHaveBeenCalled(); // antes dos 800ms

      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('unmount antes dos 800ms cancela o timer e nunca consulta', async () => {
    setTimeoutSpy.mockRestore();
    vi.useFakeTimers();
    try {
      const { unmount } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      expect(mockGetDocs).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('usuário desloga após carregar: query é desabilitada mas teams permanecem (cache)', async () => {
    const { result, rerender } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.teams).toHaveLength(2));

    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    rerender();

    await act(async () => {});
    expect(result.current.teams).toHaveLength(2); // dados não somem
    expect(mockGetDocs).toHaveBeenCalledTimes(1); // nenhuma reconsulta
    expect(result.current.loading).toBe(false);
  });

  it('erro da query: expõe message e desliga loading', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('permission-denied'));
    expect(result.current.loading).toBe(false);
    expect(result.current.teams).toEqual([]);
  });

  it('sem usuário não fica pendurado: loading é false desde o início', () => {
    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useTeams(), { wrapper: wrapperFor(makeQueryClient()) });
    expect(result.current.loading).toBe(false);
  });
});
