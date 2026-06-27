import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks
const mockOnSnapshot = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch = vi.fn(() => ({
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  set: vi.fn(),
  commit: mockBatchCommit,
}));

vi.mock('firebase/firestore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: (...args: any[]) => mockCollection(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: (...args: any[]) => mockDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (...args: any[]) => mockQuery(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: (...args: any[]) => mockWhere(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderBy: (...args: any[]) => mockOrderBy(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  limit: (...args: any[]) => mockLimit(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
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

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }) => children,
}));
import { useNotifications } from './useNotifications';

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc-ref');
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('retorna loading=false sem userId', async () => {
    const { result } = renderHook(() => useNotifications(undefined), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toEqual([]);
  });

  it('configura listener com query correta (user_id, ordered, limited)', () => {
    renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    expect(mockCollection).toHaveBeenCalledWith({}, 'notifications');
    expect(mockWhere).toHaveBeenCalledWith('user_id', '==', 'user-1');
    expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('calcula contagem de não-lidos corretamente', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'notif-1',
            data: () => ({
              user_id: 'user-1',
              type: 'GAME_INVITE',
              title: 'Convite',
              message: 'Você foi convidado',
              read: false,
              created_at: { toDate: () => new Date() },
            }),
          },
          {
            id: 'notif-2',
            data: () => ({
              user_id: 'user-1',
              type: 'LEVEL_UP',
              title: 'Level Up',
              message: 'Subiu de nível',
              read: true,
              created_at: { toDate: () => new Date() },
            }),
          },
          {
            id: 'notif-3',
            data: () => ({
              user_id: 'user-1',
              type: 'BADGE',
              title: 'Badge',
              message: 'Nova badge',
              read: false,
              created_at: { toDate: () => new Date() },
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.unreadCount).toBe(2);
  });

  it('markAsRead atualiza o documento da notificação', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.markAsRead('notif-1');
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { read: true });
  });

  it('markAllAsRead atualiza todas as notificações não-lidas', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'notif-1',
            data: () => ({
              user_id: 'user-1',
              title: 'A',
              message: 'msg',
              read: false,
              type: 'SYSTEM',
              created_at: { toDate: () => new Date() },
            }),
          },
          {
            id: 'notif-2',
            data: () => ({
              user_id: 'user-1',
              title: 'B',
              message: 'msg',
              read: true,
              type: 'SYSTEM',
              created_at: { toDate: () => new Date() },
            }),
          },
          {
            id: 'notif-3',
            data: () => ({
              user_id: 'user-1',
              title: 'C',
              message: 'msg',
              read: false,
              type: 'SYSTEM',
              created_at: { toDate: () => new Date() },
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    // markAllAsRead usa writeBatch.update (não updateDoc individual). #2330
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('deleteNotification remove o documento', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.deleteNotification('notif-1');
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
  });

  it('declineGameInvite remove confirmação e marca notificação como lida em batch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.declineGameInvite('notif-1', 'game-1');
    });

    expect(mockDoc).toHaveBeenCalledWith({}, 'confirmations', 'game-1_user-1');
    expect(mockDoc).toHaveBeenCalledWith({}, 'notifications', 'notif-1');
    expect(mockBatchDelete).toHaveBeenCalledWith('mock-doc-ref');
    expect(mockBatchUpdate).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({ read: true }));
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('declineGameInvite marca notificação como lida se não conseguir apagar confirmação', async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error('permission denied'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await act(async () => {
      await result.current.declineGameInvite('notif-1', 'game-1');
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({ read: true }));
  });

  it('trata erros do snapshot', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('Notification error'));
      return vi.fn();
    });

    const { result } = renderHook(() => useNotifications('user-1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      // Erro passa por getFirestoreErrorMessage → retorna mensagem genérica para
      // erros não mapeados. O teste verifica presença de mensagem de erro. #2330
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });
});
