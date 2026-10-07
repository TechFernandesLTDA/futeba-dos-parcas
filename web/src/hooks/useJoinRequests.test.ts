// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// t ESTÁVEL: requestJoin/cancelRequest/approve/reject têm useCallback([t]).
const mockT = (key: string) => key;

const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: vi.fn((...args: any[]) => args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
  serverTimestamp: () => ({ __serverTimestamp: true }),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
}));

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false, error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useMyJoinRequest, usePendingJoinRequests, type JoinRequest } from './useJoinRequests';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function requestDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      user_id: `uid-${id}`,
      user_name: `Player ${id}`,
      user_photo: null,
      status: 'PENDING',
      requested_at: { toDate: () => new Date(1700000000000) },
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockQuery.mockImplementation((...args: unknown[]) => args);
  mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
    onNext({ exists: () => false, docs: [] });
    return vi.fn();
  });
  mockSetDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
  };
});

describe('useMyJoinRequest', () => {
  it('não configura listener sem groupId ou uid', async () => {
    const { result } = renderHook(() => useMyJoinRequest(undefined), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.request).toBeNull();
    expect(mockOnSnapshot).not.toHaveBeenCalled();

    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result: result2 } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result2.current.loading).toBe(false));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('escuta o doc proprio groups/{groupId}/join_requests/{uid}', () => {
    renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
    expect(mockDoc).toHaveBeenCalledWith({}, 'groups/group-1/join_requests/test-user-id');
  });

  it('request=null quando o doc não existe', async () => {
    const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.request).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('mapeia o request do snapshot (status, datas, respondido por)', async () => {
    mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
      onNext({
        exists: () => true,
        id: 'test-user-id',
        data: () => ({
          user_id: 'test-user-id',
          user_name: 'Test User',
          user_photo: 'https://photo.example/eu.png',
          status: 'APPROVED',
          requested_at: { toDate: () => new Date(1700000000000) },
          responded_at: { toDate: () => new Date(1700000100000) },
          responded_by: 'owner-1',
        }),
      });
      return vi.fn();
    });
    const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.request).toEqual({
      id: 'test-user-id',
      userId: 'test-user-id',
      userName: 'Test User',
      userPhoto: 'https://photo.example/eu.png',
      status: 'APPROVED',
      requestedAt: new Date(1700000000000),
      respondedAt: new Date(1700000100000),
      respondedBy: 'owner-1',
    } as JoinRequest);
  });

  it('registra erro do snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref: any, _onNext: any, onError: any) => {
      onError(new Error('permission-denied'));
      return vi.fn();
    });
    const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('permission-denied');
  });

  describe('requestJoin', () => {
    it('grava doc PENDING com dados do usuário e toast de sucesso', async () => {
      const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.requestJoin();
      });
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const [ref, payload] = mockSetDoc.mock.calls[0] as any[];
      expect(ref.path).toBe('groups/group-1/join_requests/test-user-id');
      expect(payload).toMatchObject({
        user_id: 'test-user-id',
        user_name: 'Test User',
        user_photo: null,
        status: 'PENDING',
      });
      expect(payload.requested_at).toEqual({ __serverTimestamp: true });
      expect(mockShowSuccess).toHaveBeenCalledWith('feedback.joinRequests.sendSuccess');
      expect(result.current.submitting).toBe(false);
    });

    it('user_name cai para user.email e depois "Anonimo"; photo pode ser null', async () => {
      mockAuthReturn = {
        user: { id: 'test-user-id', name: '', email: 'e@example.com', photoUrl: undefined },
        firebaseUser: { uid: 'test-user-id', displayName: '', photoURL: null },
        loading: false, error: null,
      };
      const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.requestJoin();
      });
      expect((mockSetDoc.mock.calls[0][1] as any).user_name).toBe('e@example.com');
    });

    it('registra erro e mostra toast quando setDoc falha', async () => {
      mockSetDoc.mockRejectedValue(new Error('permission-denied'));
      const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.requestJoin();
      });
      expect(result.current.error).toBe('permission-denied');
      expect(mockShowError).toHaveBeenCalledWith('feedback.joinRequests.sendError');
      expect(result.current.submitting).toBe(false);
    });

    it('não faz nada sem groupId', async () => {
      const { result } = renderHook(() => useMyJoinRequest(undefined), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.requestJoin();
      });
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(result.current.submitting).toBe(false);
    });
  });

  describe('cancelRequest', () => {
    it('deleta o doc proprio com toast de sucesso', async () => {
      const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.cancelRequest();
      });
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect((mockDeleteDoc.mock.calls[0][0] as any).path).toBe('groups/group-1/join_requests/test-user-id');
      expect(mockShowSuccess).toHaveBeenCalledWith('feedback.joinRequests.cancelSuccess');
      expect(result.current.submitting).toBe(false);
    });

    it('registra erro e mostra toast quando deleteDoc falha', async () => {
      mockDeleteDoc.mockRejectedValue(new Error('unavailable'));
      const { result } = renderHook(() => useMyJoinRequest('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.cancelRequest();
      });
      expect(result.current.error).toBe('unavailable');
      expect(mockShowError).toHaveBeenCalledWith('feedback.joinRequests.cancelError');
      expect(result.current.submitting).toBe(false);
    });
  });
});

describe('usePendingJoinRequests', () => {
  it('não configura listener sem groupId ou uid', async () => {
    const { result } = renderHook(() => usePendingJoinRequests(undefined), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requests).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('consulta a coleção join_requests filtrando status PENDING', () => {
    renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'groups/group-1/join_requests');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('mapeia requests e ordena por requested_at asc (mais antigos primeiro)', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext({
        docs: [
          requestDoc('r2', { requested_at: { toDate: () => new Date(1700000100000) } }),
          requestDoc('r1', { requested_at: { toDate: () => new Date(1700000000000) } }),
          requestDoc('r3', { requested_at: undefined }),
        ],
      });
      return vi.fn();
    });
    const { result } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // r3 sem requestedAt fica com getTime()=0 → primeiro.
    expect(result.current.requests.map((r) => r.id)).toEqual(['r3', 'r1', 'r2']);
    expect(result.current.requests[1]).toMatchObject({
      userId: 'uid-r1',
      userName: 'Player r1',
      status: 'PENDING',
      requestedAt: new Date(1700000000000),
    });
  });

  it('registra erro do snapshot', async () => {
    mockOnSnapshot.mockImplementation((_q: any, _onNext: any, onError: any) => {
      onError(new Error('permission-denied'));
      return vi.fn();
    });
    const { result } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('permission-denied');
  });

  it('remove o listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  describe('approve / reject', () => {
    function setupTransaction(snapshot: { exists: () => boolean; data?: () => any }) {
      const updates: Array<{ path: string; data: any }> = [];
      mockRunTransaction.mockImplementation(async (_db: unknown, callback: (tx: any) => Promise<void>) => {
        await callback({
          get: async () => snapshot,
          update: (ref: any, data: any) => updates.push({ path: ref.path, data }),
        });
      });
      return updates;
    }

    it('approve marca APPROVED com responded_at/responded_by dentro da transação', async () => {
      const updates = setupTransaction({ exists: () => true, data: () => ({ status: 'PENDING' }) });
      const { result } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.approve('requester-1');
      });
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(updates).toEqual([
        {
          path: 'groups/group-1/join_requests/requester-1',
          data: {
            status: 'APPROVED',
            responded_at: { __serverTimestamp: true },
            responded_by: 'test-user-id',
          },
        },
      ]);
      expect(result.current.error).toBeNull();
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('reject marca REJECTED com responded_at/responded_by', async () => {
      const updates = setupTransaction({ exists: () => true, data: () => ({ status: 'PENDING' }) });
      const { result } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.reject('requester-1');
      });
      expect(updates[0].data).toMatchObject({ status: 'REJECTED', responded_by: 'test-user-id' });
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('approve falha quando o request não existe mais', async () => {
      setupTransaction({ exists: () => false });
      const { result } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.approve('requester-1');
      });
      expect(result.current.error).toBe('Solicitação não encontrada.');
      expect(mockShowError).toHaveBeenCalledWith('feedback.joinRequests.approveError');
    });

    it('approve/reject falham quando o request já foi respondido', async () => {
      setupTransaction({ exists: () => true, data: () => ({ status: 'APPROVED' }) });
      const { result } = renderHook(() => usePendingJoinRequests('group-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.approve('requester-1');
      });
      await act(async () => {
        await result.current.reject('requester-1');
      });
      expect(result.current.error).toBe('Esta solicitação já foi respondida.');
      expect(mockShowError).toHaveBeenCalledWith('feedback.joinRequests.approveError');
      expect(mockShowError).toHaveBeenCalledWith('feedback.joinRequests.rejectError');
    });

    it('não faz nada sem groupId', async () => {
      const { result } = renderHook(() => usePendingJoinRequests(undefined), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.approve('requester-1');
        await result.current.reject('requester-1');
      });
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });
});