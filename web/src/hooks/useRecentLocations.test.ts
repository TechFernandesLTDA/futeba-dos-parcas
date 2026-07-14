import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'games-ref'),
  query: vi.fn((_ref, ...parts) => parts),
  where: vi.fn((...args) => ({ type: 'where', args })),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
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
  }),
}));

import { fetchRecentLocationIds, useRecentLocations } from './useRecentLocations';

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

describe('useRecentLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockOrderBy.mockReturnValue({ type: 'orderBy', args: ['dateTime', 'desc'] });
  });

  it('orders by dateTime desc and dedupes cancelled or repeated locations', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ status: 'SCHEDULED', location_id: 'loc-1' }) },
        { data: () => ({ status: 'CANCELLED', location_id: 'loc-2' }) },
        { data: () => ({ status: 'CONFIRMED', location_id: 'loc-1' }) },
        { data: () => ({ status: 'FINISHED', location_id: 'loc-3' }) },
      ],
    });

    await expect(fetchRecentLocationIds('user-1')).resolves.toEqual(['loc-1', 'loc-3']);
    expect(mockOrderBy).toHaveBeenCalledWith('dateTime', 'desc');
  });

  it('atualiza imediatamente o estado acessível ao alternar favorito', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
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
