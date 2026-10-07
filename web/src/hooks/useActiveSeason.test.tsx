// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ kind: 'query', base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  getDocs: (...args: any[]) => mockGetDocs(...args),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useActiveSeason } from './useActiveSeason';

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

function seasonDoc(id: string) {
  return { id, data: () => ({ isActive: true }) };
}

// Dispara results distintos para a query camel (isActive) e snake (is_active).
let camelSnapshot: any;
let snakeSnapshot: any;

beforeEach(() => {
  vi.clearAllMocks();
  camelSnapshot = { empty: true, docs: [] };
  snakeSnapshot = { empty: true, docs: [] };
  mockGetDocs.mockImplementation(async (q: any) => {
    const whereConstraint = (q?.constraints ?? []).find((c: any) => c?.type === 'where');
    if (whereConstraint?.field === 'isActive') return camelSnapshot;
    if (whereConstraint?.field === 'is_active') return snakeSnapshot;
    return { empty: true, docs: [] };
  });
});

describe('useActiveSeason', () => {
  it('retorna o id da temporada quando a query camelCase (isActive) encontra docs', async () => {
    camelSnapshot = { empty: false, docs: [seasonDoc('s-camel')] };
    snakeSnapshot = { empty: false, docs: [seasonDoc('s-snake')] };

    const { result } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.seasonId).toBe('s-camel'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    // camelCase tem prioridade: snake não é consultado para o resultado
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('camel vazio e snake preenchido: usa o id da query snake_case', async () => {
    snakeSnapshot = { empty: false, docs: [seasonDoc('s-snake')] };

    const { result } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.seasonId).toBe('s-snake'));
    expect(result.current.loading).toBe(false);
  });

  it('duas temporadas ativas snake: usa a primeira do snapshot', async () => {
    snakeSnapshot = { empty: false, docs: [seasonDoc('s-1'), seasonDoc('s-2')] };

    const { result } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.seasonId).toBe('s-1'));
  });

  it('nenhuma temporada: retorna null sem erro', async () => {
    const { result } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.seasonId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('query camel rejeita mas snake resolve: fallback resiliente via allSettled', async () => {
    camelSnapshot = Promise.reject(new Error('camel quebrou'));
    snakeSnapshot = { empty: false, docs: [seasonDoc('s-snake')] };

    const { result } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.seasonId).toBe('s-snake'));
    expect(result.current.error).toBeNull();
  });

  it('ambas rejeitam: expõe erro (hook reúsa o rejected do allSettled)', async () => {
    const failure = new Error('permission-denied');
    camelSnapshot = Promise.reject(failure);
    snakeSnapshot = Promise.reject(failure);

    const { result } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    // retry: 2 no hook — aguarda as 3 tentativas (~3s de backoff)
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 8000 });
    expect(result.current.seasonId).toBeNull();
    expect(result.current.error?.message).toBe('permission-denied');
    // 2 queries por tentativa × 3 tentativas (retry: 2)
    expect(mockGetDocs).toHaveBeenCalledTimes(6);
  });

  it('enabled:false: não consulta nada e loading=false', () => {
    const { result } = renderHook(() => useActiveSeason({ enabled: false }), { wrapper: wrapperFor(makeQueryClient()) });
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.seasonId).toBeNull();
  });

  it('consulta as duas variantes com where isActive/is_active == true e limit 1', async () => {
    renderHook(() => useActiveSeason(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(2));

    const [firstCall, secondCall] = mockGetDocs.mock.calls.map((call) => call[0] as any);
    expect(firstCall.base.name).toBe('seasons');
    expect(firstCall.constraints).toEqual([
      { type: 'where', field: 'isActive', op: '==', value: true },
      { type: 'limit', value: 1 },
    ]);
    expect(secondCall.constraints).toEqual([
      { type: 'where', field: 'is_active', op: '==', value: true },
      { type: 'limit', value: 1 },
    ]);
  });

  it('compartilha cache entre consumers do mesmo QueryClient (staleTime 10min)', async () => {
    camelSnapshot = { empty: false, docs: [seasonDoc('s-cached')] };
    const client = makeQueryClient();

    const first = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(first.result.current.seasonId).toBe('s-cached'));
    const callsAfterFirst = mockGetDocs.mock.calls.length;

    const second = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(second.result.current.seasonId).toBe('s-cached'));
    expect(mockGetDocs).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('não refaz fetch dentro do staleTime após remount com o mesmo client', async () => {
    camelSnapshot = { empty: false, docs: [seasonDoc('s-1')] };
    const client = makeQueryClient();
    const { unmount } = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(2));

    unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const second = renderHook(() => useActiveSeason(), { wrapper: wrapperFor(client) });
    expect(second.result.current.seasonId).toBe('s-1');
    expect(mockGetDocs).toHaveBeenCalledTimes(2); // cache hit, sem novas queries
  });
});
