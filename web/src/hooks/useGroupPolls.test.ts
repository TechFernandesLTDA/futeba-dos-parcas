// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
  Timestamp: class TimestampMock {
    constructor(private readonly date: Date) {}
    toDate() { return this.date; }
  },
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1', displayName: 'User 1' },
    user: { name: 'User 1' },
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}));

import { useGroupPolls } from './useGroupPolls';
import { Timestamp } from 'firebase/firestore';

describe('useGroupPolls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('collection-ref');
    mockQuery.mockImplementation((...args: unknown[]) => args);
    mockWhere.mockImplementation((...args: unknown[]) => args);
    mockOrderBy.mockImplementation((...args: unknown[]) => args);
    mockLimit.mockImplementation((...args: unknown[]) => args);
  });

  it('exclui votos de membros removidos/inativos das contagens', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { id: 'user-1', data: () => ({ status: 'ACTIVE' }) },
          { id: 'user-2', data: () => ({ status: 'ACTIVE' }) },
          { id: 'user-3', data: () => ({ status: 'REMOVED' }) },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'poll-1',
            data: () => ({
              group_id: 'group-1',
              question: 'Quem joga no sábado?',
              options: [{ id: 'yes', text: 'Sim' }, { id: 'no', text: 'Não' }],
              created_by: 'user-1',
              created_by_name: 'Owner',
              status: 'ACTIVE',
              created_at: new Timestamp(new Date('2026-07-09T12:00:00Z')),
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ user_id: 'user-1', option_id: 'yes' }) },
          { data: () => ({ user_id: 'user-2', option_id: 'yes' }) },
          { data: () => ({ user_id: 'user-3', option_id: 'no' }) },
        ],
      });

    const { result } = renderHook(() => useGroupPolls('group-1'), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.polls).toHaveLength(1);
    expect(result.current.polls[0].voteCounts).toEqual({ yes: 2 });
    expect(result.current.polls[0].totalVotes).toBe(2);
    expect(result.current.polls[0].myVote).toBe('yes');
  });
});
