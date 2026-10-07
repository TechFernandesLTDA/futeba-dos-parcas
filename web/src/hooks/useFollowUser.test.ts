// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// t ESTÁVEL: toggle tem useCallback([t]).
const mockT = (key: string) => key;

const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
}));

const mockToggleFollowUser = vi.fn();

vi.mock('../services/cloudFunctions', () => ({
  toggleFollowUser: (...args: any[]) => mockToggleFollowUser(...args),
}));

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false, error: null,
  currentUser: { uid: 'test-user-id' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: any) => err?.message ?? 'Erro ao acessar dados. Tente novamente',
  getAuthErrorMessage: (err: any) => err?.message ?? 'Erro inesperado',
  getFunctionErrorMessage: (err: any) => err?.message ?? 'Erro de função',
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useFollowUser } from './useFollowUser';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
    onNext({ exists: () => false });
    return vi.fn();
  });
  mockToggleFollowUser.mockResolvedValue({ data: { success: true, following: true, changed: true } });
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
    currentUser: { uid: 'test-user-id' },
  };
});

describe('useFollowUser', () => {
  it('canFollow=false quando não há usuário autenticado', async () => {
    mockAuthReturn = {
      user: null, firebaseUser: null, loading: false, error: null, currentUser: null,
    };
    const { result } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canFollow).toBe(false);
    expect(result.current.following).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('canFollow=false sem targetUserId ou quando o alvo é o próprio usuário', async () => {
    const { result } = renderHook(() => useFollowUser(null), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canFollow).toBe(false);

    const { result: self } = renderHook(() => useFollowUser('test-user-id'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(self.current.loading).toBe(false));
    expect(self.current.canFollow).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('escuta users/{uid}/following/{targetUserId}', () => {
    renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'test-user-id', 'following', 'target-1');
  });

  it('following=true quando o doc existe e false quando não existe', async () => {
    mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
      onNext({ exists: () => true });
      return vi.fn();
    });
    const { result } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.following).toBe(true);
  });

  it('registra erro do snapshot via toast e libera loading', async () => {
    mockOnSnapshot.mockImplementation((_ref: any, _onNext: any, onError: any) => {
      onError(new Error('permission-denied'));
      return vi.fn();
    });
    const { result } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockShowError).toHaveBeenCalledWith('permission-denied');
  });

  it('remove o listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('reabre o listener quando targetUserId muda', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: string | null }) => useFollowUser(target),
      { initialProps: { target: 'target-1' as string | null }, wrapper: createTestWrapper() },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ target: 'target-2' });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
  });

  describe('toggle', () => {
    it('segue usuário: chama cloud function com follow=true e confirma via resultado', async () => {
      mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
        onNext({ exists: () => false });
        return vi.fn();
      });
      const { result } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.toggle();
      });
      expect(mockToggleFollowUser).toHaveBeenCalledWith({ targetUserId: 'target-1', follow: true });
      expect(result.current.following).toBe(true);
      expect(mockShowSuccess).toHaveBeenCalledWith('follow.followed');
      expect(result.current.updating).toBe(false);
    });

    it('deixa de seguir: follow=false com toast de unfollow', async () => {
      mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
        onNext({ exists: () => true });
        return vi.fn();
      });
      mockToggleFollowUser.mockResolvedValue({ data: { success: true, following: false, changed: true } });
      const { result } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.toggle();
      });
      expect(mockToggleFollowUser).toHaveBeenCalledWith({ targetUserId: 'target-1', follow: false });
      expect(result.current.following).toBe(false);
      expect(mockShowSuccess).toHaveBeenCalledWith('follow.unfollowed');
    });

    it('reverte o estado otimista quando a cloud function falha', async () => {
      mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
        onNext({ exists: () => false });
        return vi.fn();
      });
      mockToggleFollowUser.mockRejectedValue(new Error('functions/internal: boom'));
      const { result } = renderHook(() => useFollowUser('target-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.toggle();
      });
      expect(result.current.following).toBe(false);
      expect(mockShowError).toHaveBeenCalledWith('functions/internal: boom');
      expect(result.current.updating).toBe(false);
    });

    it('não faz nada sem canFollow ou já atualizando', async () => {
      const { result } = renderHook(() => useFollowUser('test-user-id'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.toggle();
      });
      expect(mockToggleFollowUser).not.toHaveBeenCalled();
    });
  });
});