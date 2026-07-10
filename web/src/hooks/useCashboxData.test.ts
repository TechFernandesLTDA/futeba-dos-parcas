import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const mockLimit = vi.fn((value: number) => ({ type: 'limit', value }));
const mockStartAfter = vi.fn((value: unknown) => ({ type: 'startAfter', value }));
const mockQuery = vi.fn((...parts: unknown[]) => ({ type: 'query', parts }));
const mockCollection = vi.fn(() => ({ type: 'collection' }));
const mockDoc = vi.fn(() => ({ type: 'summary' }));
const mockOrderBy = vi.fn(() => ({ type: 'orderBy' }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: (...args: [number]) => mockLimit(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  startAfter: (...args: [unknown]) => mockStartAfter(...args),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

import { CASHBOX_HISTORY_PAGE_SIZE, useCashboxData } from './useCashboxData';

function transactionDoc(id: string, createdAt: number) {
  return {
    id,
    data: () => ({
      group_id: 'group-1',
      type: 'INCOME',
      amount: 1,
      description: id,
      created_by: 'user-1',
      created_by_name: 'Renan',
      created_at: { toDate: () => new Date(createdAt) },
      status: 'ACTIVE',
    }),
  };
}

describe('useCashboxData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lê saldo de summary/current e limita a primeira página', async () => {
    const historyDocs = [transactionDoc('entry-1', 2)];
    mockOnSnapshot.mockImplementation((target, onNext) => {
      if (target.type === 'summary') {
        onNext({
          exists: () => true,
          data: () => ({
            balance_cents: 1234,
            recomputed_by_server: true,
            truncated: false,
          }),
        });
      } else {
        onNext({ docs: historyDocs, size: historyDocs.length });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useCashboxData('group-1', 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.balanceCents).toBe(1234);
    expect(result.current.transactions.map((entry) => entry.id)).toEqual(['entry-1']);
    expect(result.current.summaryNeedsReconciliation).toBe(false);
    expect(mockLimit).toHaveBeenCalledWith(CASHBOX_HISTORY_PAGE_SIZE);
  });

  it('carrega histórico antigo por cursor sem duplicar a página realtime', async () => {
    const firstPage = Array.from(
      { length: CASHBOX_HISTORY_PAGE_SIZE },
      (_, index) => transactionDoc(`entry-${index}`, 1000 - index)
    );
    mockOnSnapshot.mockImplementation((target, onNext) => {
      if (target.type === 'summary') {
        onNext({
          exists: () => true,
          data: () => ({balance_cents: 0, recomputed_by_server: true}),
        });
      } else {
        onNext({docs: firstPage, size: firstPage.length});
      }
      return vi.fn();
    });
    mockGetDocs.mockResolvedValue({
      docs: [transactionDoc('entry-older', 1)],
      size: 1,
    });

    const { result } = renderHook(() => useCashboxData('group-1', 0));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.transactions).toHaveLength(CASHBOX_HISTORY_PAGE_SIZE + 1);
    expect(result.current.transactions.at(-1)?.id).toBe('entry-older');
    expect(mockStartAfter).toHaveBeenCalledWith(firstPage[firstPage.length - 1]);
    expect(result.current.hasMore).toBe(false);
  });
});
