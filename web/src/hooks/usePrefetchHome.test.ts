import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockPrefetchQuery = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../services/queryClient', () => ({
  queryClient: {
    prefetchQuery: (...args: unknown[]) => mockPrefetchQuery(...args),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123', name: 'Test' } }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { usePrefetchHome } from './usePrefetchHome';

describe('usePrefetchHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  });

  it('prefetch dados na montagem quando usuário está logado', () => {
    renderHook(() => usePrefetchHome());

    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('chama getDocs na coleção games, grupos e notificações', async () => {
    renderHook(() => usePrefetchHome());

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  it('dispara queries em paralelo (nextGame, groups, activities)', async () => {
    const snapshot = { empty: false, docs: [{ id: 'game-1' }] };
    mockGetDocs.mockResolvedValue(snapshot);

    renderHook(() => usePrefetchHome());

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledTimes(3);
    });
  });

  it('faz prefetch da confirmação do jogo quando existe próximo jogo', async () => {
    const snapshot = { empty: false, docs: [{ id: 'game-1' }] };
    mockGetDocs.mockResolvedValue(snapshot);

    renderHook(() => usePrefetchHome());

    await waitFor(() => {
      expect(mockPrefetchQuery).toHaveBeenCalled();
    });
  });

  it('trata erro de prefetch sem lançar exceção', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetDocs.mockRejectedValue(new Error('Network error'));

    expect(() => renderHook(() => usePrefetchHome())).not.toThrow();

    consoleSpy.mockRestore();
  });

  it('não faz prefetch duplicado no mesmo mount', () => {
    const { rerender } = renderHook(() => usePrefetchHome());

    mockGetDocs.mockClear();

    rerender();

    expect(mockGetDocs).not.toHaveBeenCalled();
  });
});
