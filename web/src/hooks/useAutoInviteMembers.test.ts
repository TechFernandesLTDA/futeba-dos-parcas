// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockWriteBatch = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
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
    firebaseUser: { uid: 'owner-1', displayName: 'Owner' },
    user: { id: 'owner-1', name: 'Owner' },
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
  }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn() }),
}));

import { useAutoInviteMembers } from './useAutoInviteMembers';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((segment) => typeof segment === 'string').join('/');
  return { path, id: path.split('/').at(-1) };
}

describe('useAutoInviteMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      set: mockBatchSet,
      commit: mockBatchCommit,
    });
  });

  it('preserva confirmações existentes ao auto-convidar membros', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'owner-1', data: () => ({ status: 'ACTIVE' }) },
        { id: 'member-1', data: () => ({ status: 'ACTIVE', name: 'Ana' }) },
        { id: 'member-2', data: () => ({ status: 'ACTIVE', name: 'Bia' }) },
      ],
    });
    mockGetDoc.mockImplementation(async (ref: { path: string }) => {
      if (ref.path === 'confirmations/game-1_owner-1') {
        return { exists: () => true };
      }
      if (ref.path === 'confirmations/game-1_member-1') {
        return { exists: () => true };
      }
      return { exists: () => false };
    });

    const { result } = renderHook(() => useAutoInviteMembers(), { wrapper: createTestWrapper() });

    await act(async () => {
      expect(await result.current.autoInvite('game-1', 'group-1')).toBe(1);
    });

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'confirmations/game-1_member-2' }),
      expect.objectContaining({ user_id: 'member-2', status: 'PENDING' }),
    );
  });
});
