/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
// httpsCallable mockado: o export `deleteAccount` do serviço é este callable
const mockCallable = vi.hoisted(() => vi.fn());
const mockQueryClientClear = vi.hoisted(() => vi.fn());
const mockReauthCredential = vi.hoisted(() => vi.fn());
const mockReauthPopup = vi.hoisted(() => vi.fn());
const mockGetIdToken = vi.hoisted(() => vi.fn());
const mockCurrentUser = vi.hoisted(() => ({
  value: null as any,
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ logout: mockLogout }) }));
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }),
}));
vi.mock('../services/queryClient', () => ({ queryClient: { clear: mockQueryClientClear } }));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('../utils/firebaseErrors', () => ({
  getAuthErrorMessage: () => 'auth-error',
  getFunctionErrorMessage: (_e: unknown, _fn: string, fallback?: string) => fallback ?? 'fn-error',
}));
vi.mock('../services/firebase', () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser.value;
    },
  },
  googleProvider: { providerId: 'google.com' },
}));
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email: string, pw: string) => ({ email, pw }) },
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthCredential(...args),
  reauthenticateWithPopup: (...args: unknown[]) => mockReauthPopup(...args),
}));
// Em vez de mockar o httpsCallable do SDK, mocka-se o serviço que o embrulha
vi.mock('../services/cloudFunctions', () => ({
  deleteAccount: (...args: unknown[]) => mockCallable(...args),
}));

import { useDeleteAccount } from './useDeleteAccount';

function functionsError(code: string, details?: unknown) {
  return Object.assign(new Error(code), { code: `functions/${code}`, details });
}

function setUser(providers: string[]) {
  mockCurrentUser.value = {
    email: 'a@b.com',
    providerData: providers.map((providerId) => ({ providerId })),
    getIdToken: mockGetIdToken,
  };
}

describe('useDeleteAccount (#4391)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    mockGetIdToken.mockResolvedValue('token');
    mockReauthCredential.mockResolvedValue({});
    mockReauthPopup.mockResolvedValue({});
    setUser(['password']);
  });

  it('sucesso: desloga, mostra toast e navega para /login', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockShowSuccess).toHaveBeenCalledWith('settings.deleteAccountSuccess');
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(result.current.status).toBe('success');
  });

  it('sucesso: falha no logout local não mascara a exclusão', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });
    mockLogout.mockRejectedValue(new Error('signOut falhou'));
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });

    expect(mockQueryClientClear).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('requires-recent-login com senha: reautentica, renova o token e repete a chamada', async () => {
    mockCallable
      .mockRejectedValueOnce(functionsError('failed-precondition', { reason: 'requires-recent-login' }))
      .mockResolvedValueOnce({ data: { success: true } });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('needs-reauth');
    expect(result.current.reauthMethods).toEqual({ password: true, google: false });
    expect(mockLogout).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.reauthenticateWithPassword('segredo');
    });

    expect(mockReauthCredential).toHaveBeenCalledWith(mockCurrentUser.value, { email: 'a@b.com', pw: 'segredo' });
    expect(mockGetIdToken).toHaveBeenCalledWith(true);
    expect(mockCallable).toHaveBeenCalledTimes(2);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('requires-recent-login com Google: usa reauthenticateWithPopup e repete', async () => {
    setUser(['google.com']);
    mockCallable
      .mockRejectedValueOnce(functionsError('failed-precondition', { reason: 'requires-recent-login' }))
      .mockResolvedValueOnce({ data: { success: true } });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.reauthenticateWithGoogle();
    });

    expect(mockReauthPopup).toHaveBeenCalledTimes(1);
    expect(mockCallable).toHaveBeenCalledTimes(2);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('requires-recent-login: senha errada volta para o diálogo, sem logout nem nova chamada', async () => {
    mockCallable.mockRejectedValueOnce(functionsError('failed-precondition', { reason: 'requires-recent-login' }));
    mockReauthCredential.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/wrong-password' }));
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.reauthenticateWithPassword('errada');
    });

    expect(result.current.status).toBe('needs-reauth');
    expect(result.current.errorMessage).toBe('auth-error');
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('requires-recent-login persistente após reautenticar: erro, sem laço e sem logout', async () => {
    mockCallable.mockRejectedValue(functionsError('failed-precondition', { reason: 'requires-recent-login' }));
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.reauthenticateWithPassword('segredo');
    });

    expect(mockCallable).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('error');
    expect(mockShowError).toHaveBeenCalledWith('settings.deleteRecentLoginStillRequired');
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('sole-owner-groups: expõe a lista de grupos e NÃO desloga', async () => {
    const groups = [
      { id: 'g1', name: 'Pelada de Quarta' },
      { id: 'g2', name: 'Racha do Sábado' },
    ];
    mockCallable.mockRejectedValue(
      functionsError('failed-precondition', { reason: 'sole-owner-groups', groupCount: 2, groups }),
    );
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('blocked-groups');
    expect(result.current.blockingGroups).toEqual(groups);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.blockingGroups).toEqual([]);
  });

  it.each([
    ['resource-exhausted', undefined, 'settings.deleteRateLimited'],
    ['internal', undefined, 'settings.deleteAccountError'],
    ['failed-precondition', { reason: 'outro-motivo' }, 'settings.deleteAccountError'],
  ])('erro %s: mostra a mensagem e NÃO desloga', async (code, details, message) => {
    mockCallable.mockRejectedValue(functionsError(code, details));
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(message);
    expect(mockShowError).toHaveBeenCalledWith(message);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
