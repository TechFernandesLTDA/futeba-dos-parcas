import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: vi.fn(() => 'Firestore error'),
}));

import { useFirestoreQuery } from './useFirestoreQuery';

describe('useFirestoreQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('limpa dados e erro quando a query é desabilitada', async () => {
    let onNext: ((snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) | undefined;

    mockOnSnapshot.mockImplementation((_query, next) => {
      onNext = next;
      return vi.fn();
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useFirestoreQuery<{ id: string; userName: string }>({
        query: 'mock-query' as never,
        enabled,
      }),
      {
        initialProps: { enabled: true },
      }
    );

    act(() => {
      onNext?.({
        docs: [
          {
            id: 'u1',
            data: () => ({ user_name: 'Renan' }),
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual([{ id: 'u1', userName: 'Renan' }]);
    });

    rerender({ enabled: false });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([]);
  });
});
