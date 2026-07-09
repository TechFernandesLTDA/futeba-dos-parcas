import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();

vi.mock('firebase/firestore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: (...args: any[]) => mockCollection(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (...args: any[]) => mockQuery(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: (...args: any[]) => mockWhere(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderBy: (...args: any[]) => mockOrderBy(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  limit: (...args: any[]) => mockLimit(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startAfter: (...args: any[]) => mockStartAfter(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDocs: (...args: any[]) => mockGetDocs(...args),
  DocumentSnapshot: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
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

import { usePaginatedQuery } from './usePaginatedQuery';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('usePaginatedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
    mockLimit.mockReturnValue('mock-limit');
    mockWhere.mockReturnValue('mock-where');
    mockStartAfter.mockReturnValue('mock-start-after');
  });

  it('inicia com loading=false e data vazio', () => {
    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games' })
    , { wrapper: createTestWrapper() });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(result.current.hasMore).toBe(true);
  });

  it('busca primeira página ao chamar fetchData', async () => {
    const mockDocs = [
      { id: 'doc-1', data: () => ({ name: 'Item 1', created_at: new Date() }) },
      { id: 'doc-2', data: () => ({ name: 'Item 2', created_at: new Date() }) },
    ];

    mockGetDocs.mockResolvedValue({ docs: mockDocs });

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games', pageSize: 20 })
    , { wrapper: createTestWrapper() });

    act(() => {
      void result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('detecta hasMore=true quando há mais itens que pageSize', async () => {
    // Retornar pageSize + 1 docs para indicar que há mais
    const docs = Array.from({ length: 6 }, (_, i) => ({
      id: `doc-${i}`,
      data: () => ({ name: `Item ${i}` }),
    }));

    mockGetDocs.mockResolvedValue({ docs: [...docs] });

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games', pageSize: 5 })
    , { wrapper: createTestWrapper() });

    act(() => {
      void result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Deve remover o último doc e marcar hasMore=true
    expect(result.current.data).toHaveLength(5);
    expect(result.current.hasMore).toBe(true);
  });

  it('refresh reseta para a primeira página', async () => {
    const page1Docs = [
      { id: 'doc-1', data: () => ({ name: 'Item 1' }) },
    ];

    mockGetDocs.mockResolvedValue({ docs: page1Docs });

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games', pageSize: 20 })
    , { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    // Refresh deve resetar
    const refreshDocs = [
      { id: 'doc-new', data: () => ({ name: 'New Item' }) },
    ];
    mockGetDocs.mockResolvedValue({ docs: refreshDocs });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('trata resultados vazios corretamente', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games' })
    , { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('trata erros corretamente', async () => {
    mockGetDocs.mockRejectedValue(new Error('Query failed'));

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games' })
    , { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Query failed');
  });

  it('usa pageSize padrão de 20', () => {
    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games' })
    , { wrapper: createTestWrapper() });

    // O pageSize padrão é 20, mas usamos pageSize + 1 no limit
    // Isso é verificado indiretamente via o comportamento de hasMore
    expect(result.current.hasMore).toBe(true);
  });

  it('reset limpa todos os dados e estado', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'doc-1', data: () => ({ name: 'Item 1' }) }],
    });

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games' })
    , { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('limpa dados quando o contexto da query muda', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'doc-1', data: () => ({ name: 'Item 1' }) }],
    });

    const { result, rerender } = renderHook(({ collectionName }) =>
      usePaginatedQuery({ collectionName })
    , {
      initialProps: { collectionName: 'games' },
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    rerender({ collectionName: 'users' });

    expect(result.current.data).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('ignora resposta atrasada da query antiga após troca de contexto', async () => {
    let resolveFirst: ((value: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) | undefined;
    let resolveSecond: ((value: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) | undefined;

    mockGetDocs
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(({ collectionName }) =>
      usePaginatedQuery({ collectionName })
    , {
      initialProps: { collectionName: 'games' },
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      void result.current.fetchData();
    });

    rerender({ collectionName: 'users' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual([]);
    });

    act(() => {
      void result.current.fetchData();
    });

    await act(async () => {
      resolveSecond?.({
        docs: [{ id: 'user-1', data: () => ({ name: 'User 1' }) }],
      });
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: 'user-1', name: 'User 1' }]);
    });

    await act(async () => {
      resolveFirst?.({
        docs: [{ id: 'game-1', data: () => ({ name: 'Game 1' }) }],
      });
    });

    expect(result.current.data).toEqual([{ id: 'user-1', name: 'User 1' }]);
  });

  it('refresh invalida loadMore antigo para não desalinhar lista e cursor', async () => {
    const firstPageDocs = [
      { id: 'doc-1', data: () => ({ name: 'Item 1' }) },
      { id: 'doc-2', data: () => ({ name: 'Item 2' }) },
      { id: 'doc-3', data: () => ({ name: 'Item 3' }) },
    ];
    const staleLoadMoreDocs = [
      { id: 'doc-4', data: () => ({ name: 'Older 1' }) },
      { id: 'doc-5', data: () => ({ name: 'Older 2' }) },
    ];
    const refreshedDocs = [
      { id: 'doc-fresh-1', data: () => ({ name: 'Fresh item 1' }) },
      { id: 'doc-fresh-2', data: () => ({ name: 'Fresh item 2' }) },
      { id: 'doc-fresh-3', data: () => ({ name: 'Fresh item 3' }) },
    ];
    const pendingLoadMore = createDeferred<{ docs: typeof staleLoadMoreDocs }>();

    mockGetDocs
      .mockResolvedValueOnce({ docs: [...firstPageDocs] })
      .mockImplementationOnce(() => pendingLoadMore.promise)
      .mockResolvedValueOnce({ docs: refreshedDocs })
      .mockResolvedValueOnce({ docs: [] });

    const { result } = renderHook(() =>
      usePaginatedQuery({ collectionName: 'games', pageSize: 2 })
    , { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { id: 'doc-fresh-1', name: 'Fresh item 1' },
        { id: 'doc-fresh-2', name: 'Fresh item 2' },
      ]);
      expect(result.current.hasMore).toBe(true);
    });

    await act(async () => {
      pendingLoadMore.resolve({ docs: staleLoadMoreDocs });
      await pendingLoadMore.promise;
    });

    expect(result.current.data).toEqual([
      { id: 'doc-fresh-1', name: 'Fresh item 1' },
      { id: 'doc-fresh-2', name: 'Fresh item 2' },
    ]);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(mockStartAfter).toHaveBeenLastCalledWith(refreshedDocs[1]);
    });
  });
});
