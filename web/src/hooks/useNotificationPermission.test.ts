import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetToken = vi.fn();
const mockOnMessage = vi.fn();
const mockRegisterBrowserFcmToken = vi.fn();
const mockShouldShowForegroundNotification = vi.fn((..._args: unknown[]) => true);
const mockShowError = vi.fn();

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  isSupported: vi.fn(() => Promise.resolve(true)),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  onMessage: (...args: unknown[]) => mockOnMessage(...args),
}));

vi.mock('../services/firebaseMessaging', () => ({
  messagingPromise: Promise.resolve({}),
  registerBrowserFcmToken: (...args: unknown[]) => mockRegisterBrowserFcmToken(...args),
  shouldShowForegroundNotification: (...args: unknown[]) => mockShouldShowForegroundNotification(...args),
}));

vi.mock('firebase/firestore', () => ({
  limit: vi.fn((...args) => args[0]),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
}));

vi.mock('../services/firebase', () => ({
  app: {},
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

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError }),
}));

import { useNotificationPermission } from './useNotificationPermission';

describe('useNotificationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
    mockOnMessage.mockReturnValue(vi.fn());
    mockRegisterBrowserFcmToken.mockResolvedValue(null);
    mockShouldShowForegroundNotification.mockReturnValue(true);
  });

  it('retorna estado de permissão padrão', () => {
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe('default');
  });

  it('requestPermission chama Notification.requestPermission()', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: mockRequestPermission,
      },
      writable: true,
    });

    const { result } = renderHook(() => useNotificationPermission());

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(result.current.permission).toBe('granted');
  });

  it('define loading=true durante solicitação de permissão', async () => {
    let resolvePromise: (value: string) => void;
    const requestPromise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const mockRequestPermission = vi.fn().mockReturnValue(requestPromise);
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: mockRequestPermission,
      },
      writable: true,
    });

    const { result } = renderHook(() => useNotificationPermission());

    act(() => {
      result.current.requestPermission();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolvePromise!('granted');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('trata erros gracefully durante requestPermission', async () => {
    // O hook loga o erro e re-lança (finally: setLoading(false)).
    // O teste captura o erro esperado e verifica que loading volta a false. #2330
    const mockRequestPermission = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: mockRequestPermission,
      },
      writable: true,
    });

    const { result } = renderHook(() => useNotificationPermission());

    await act(async () => {
      try {
        await result.current.requestPermission();
      } catch {
        // erro esperado — hook re-throws após logar
      }
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.permission).toBe('default');
  });

  it('não faz nada se permissão já foi concedida', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: vi.fn(),
      },
      writable: true,
    });

    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe('granted');

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(result.current.permission).toBe('granted');
  });

  it('mostra feedback quando a permissão é negada', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('denied');
    Object.defineProperty(globalThis, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: mockRequestPermission,
      },
      writable: true,
    });

    const { result } = renderHook(() => useNotificationPermission());

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(mockShowError).toHaveBeenCalledWith(
      'As notificações foram bloqueadas no navegador. Libere a permissão para receber alertas.',
    );
    expect(result.current.permission).toBe('denied');
  });
});
