import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetToken = vi.fn();
const mockOnMessage = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockArrayUnion = vi.fn();
const mockArrayRemove = vi.fn();

vi.mock('firebase/messaging', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  onMessage: (...args: unknown[]) => mockOnMessage(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
  messagingPromise: Promise.resolve({}),
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

import { useNotificationPermission } from './useNotificationPermission';

describe('useNotificationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
    mockOnMessage.mockReturnValue(vi.fn());
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
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
      await result.current.requestPermission();
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
});
