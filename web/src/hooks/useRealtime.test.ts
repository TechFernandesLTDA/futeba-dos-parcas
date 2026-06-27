import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
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

import { useRealtimeDocument } from './useRealtime';

describe('useRealtimeDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('doc-ref');
    mockCollection.mockReturnValue('collection-ref');
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('limpa o documento anterior quando documentId fica vazio', async () => {
    let onNext: ((snapshot: { exists: () => boolean; id: string; data: () => Record<string, unknown> }) => void) | undefined;

    mockOnSnapshot.mockImplementation((_ref, next) => {
      onNext = next;
      return vi.fn();
    });

    const { result, rerender } = renderHook(
      ({ documentId }) => useRealtimeDocument<{ id: string; displayName: string }>('users', documentId),
      {
        initialProps: { documentId: 'user-1' as string | undefined },
      }
    );

    act(() => {
      onNext?.({
        exists: () => true,
        id: 'user-1',
        data: () => ({ display_name: 'Renan' }),
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ id: 'user-1', displayName: 'Renan' });
    });

    rerender({ documentId: undefined });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });
});
