import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockOrderBy = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: vi.fn((ref, ...parts) => ({ ref, parts })),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: vi.fn((_db: unknown, _col: string, id: string) => `game-ref-${id}`),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { uid: 'user-1' }, user: null }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { fetchRecentLocationIds, fetchRecentLocationUsage, useRecentLocations } from './useRecentLocations';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => React.createElement(
    QueryClientProvider,
    { client },
    children,
  );
}

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

/** getDocs por coleção: games (criados) e confirmations (jogou). */
function mockSources(owned: unknown[], confirmations: unknown[]) {
  mockCollection.mockImplementation((_db: unknown, name: string) => name);
  mockGetDocs.mockImplementation(async (q: { ref: string }) =>
    ({ docs: q.ref === 'games' ? owned : confirmations }));
}

describe('useRecentLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockOrderBy.mockImplementation((...args: unknown[]) => ({ type: 'orderBy', args }));
    mockWhere.mockImplementation((...args: unknown[]) => ({ type: 'where', args }));
  });

  it('orders by dateTime desc and dedupes cancelled or repeated locations', async () => {
    mockSources([
      { data: () => ({ status: 'SCHEDULED', location_id: 'loc-1' }) },
      { data: () => ({ status: 'CANCELLED', location_id: 'loc-2' }) },
      { data: () => ({ status: 'CONFIRMED', location_id: 'loc-1' }) },
      { data: () => ({ status: 'FINISHED', location_id: 'loc-3' }) },
    ], []);

    await expect(fetchRecentLocationIds('user-1')).resolves.toEqual(['loc-1', 'loc-3']);
    expect(mockOrderBy).toHaveBeenCalledWith('dateTime', 'desc');
  });

  it('inclui quadras dos jogos em que o usuário jogou, da mais recente para a mais antiga', async () => {
    mockSources(
      [
        { data: () => ({ status: 'FINISHED', location_id: 'criado-antigo', dateTime: ts('2026-01-10T20:00:00Z') }) },
        { data: () => ({ status: 'FINISHED', location_id: 'criado-recente', dateTime: ts('2026-09-01T20:00:00Z') }) },
      ],
      [
        { data: () => ({ game_id: 'g-jogado-meio' }) },
        { data: () => ({ game_id: 'g-jogado-mais-novo' }) },
        { data: () => ({ game_id: 'g-cancelado' }) },
        { data: () => ({ game_id: 'g-sumiu' }) },
      ],
    );
    const games: Record<string, unknown> = {
      'g-jogado-meio': { status: 'FINISHED', location_id: 'jogado-meio', dateTime: ts('2026-05-01T20:00:00Z') },
      'g-jogado-mais-novo': { status: 'FINISHED', location_id: 'jogado-novo', dateTime: ts('2026-10-01T20:00:00Z') },
      'g-cancelado': { status: 'CANCELLED', location_id: 'cancelado', dateTime: ts('2026-10-05T20:00:00Z') },
    };
    mockGetDoc.mockImplementation(async (ref: string) => {
      const data = games[ref.replace('game-ref-', '')];
      return data ? { exists: () => true, data: () => data } : { exists: () => false };
    });

    await expect(fetchRecentLocationUsage('user-1')).resolves.toEqual([
      'jogado-novo',
      'criado-recente',
      'jogado-meio',
      'criado-antigo',
    ]);
    expect(mockWhere).toHaveBeenCalledWith('user_id', '==', 'user-1');
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['CONFIRMED', 'CHECKED_IN']);
    expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
  });

  it('uma quadra usada em vários jogos vale pelo jogo mais recente', async () => {
    mockSources(
      [
        { data: () => ({ status: 'FINISHED', location_id: 'a', dateTime: ts('2026-01-01T20:00:00Z') }) },
        { data: () => ({ status: 'FINISHED', location_id: 'b', dateTime: ts('2026-06-01T20:00:00Z') }) },
      ],
      [{ data: () => ({ game_id: 'g1' }) }],
    );
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'FINISHED', location_id: 'a', dateTime: ts('2026-09-01T20:00:00Z') }),
    });

    await expect(fetchRecentLocationUsage('user-1')).resolves.toEqual(['a', 'b']);
  });

  it('jogo que o usuário não consegue ler não derruba a lista', async () => {
    mockSources(
      [{ data: () => ({ status: 'FINISHED', location_id: 'a', dateTime: ts('2026-01-01T20:00:00Z') }) }],
      [{ data: () => ({ game_id: 'g-privado' }) }],
    );
    mockGetDoc.mockRejectedValue(new Error('permission-denied'));

    await expect(fetchRecentLocationUsage('user-1')).resolves.toEqual(['a']);
  });

  it('falha de uma das fontes ainda devolve a outra', async () => {
    mockCollection.mockImplementation((_db: unknown, name: string) => name);
    mockGetDocs.mockImplementation(async (q: { ref: string }) => {
      if (q.ref === 'confirmations') throw new Error('sem índice');
      return { docs: [{ data: () => ({ status: 'FINISHED', location_id: 'a' }) }] };
    });

    await expect(fetchRecentLocationUsage('user-1')).resolves.toEqual(['a']);
  });

  it('propaga o erro quando as duas fontes falham', async () => {
    mockGetDocs.mockRejectedValue(new Error('offline'));
    await expect(fetchRecentLocationUsage('user-1')).rejects.toThrow('offline');
  });

  it('sem uid não consulta nada', async () => {
    await expect(fetchRecentLocationUsage('')).resolves.toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('o atalho de recentes mostra só as 5 mais recentes e o hook expõe a lista completa', async () => {
    mockSources(
      Array.from({ length: 8 }, (_, i) => ({
        data: () => ({ status: 'FINISHED', location_id: `loc-${i}`, dateTime: ts(`2026-0${i + 1}-01T20:00:00Z`) }),
      })),
      [],
    );
    const { result } = renderHook(() => useRecentLocations(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.usedLocationIds).toHaveLength(8);
    expect(result.current.usedLocationIds[0]).toBe('loc-7');
    expect(result.current.recentIds).toEqual(result.current.usedLocationIds.slice(0, 5));
  });

  it('atualiza imediatamente o estado acessível ao alternar favorito', async () => {
    mockSources([], []);
    const { result } = renderHook(() => useRecentLocations(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFavorite('loc-1')).toBe(false);
    act(() => expect(result.current.toggleFavorite('loc-1')).toBe(true));
    expect(result.current.isFavorite('loc-1')).toBe(true);
    expect(result.current.favoriteIds).toContain('loc-1');

    act(() => expect(result.current.toggleFavorite('loc-1')).toBe(false));
    expect(result.current.isFavorite('loc-1')).toBe(false);
    expect(result.current.favoriteIds).not.toContain('loc-1');
  });
});
