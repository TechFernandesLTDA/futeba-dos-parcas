import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationMock = vi.hoisted(() => ({
  permission: 'default' as NotificationPermission,
  loading: false,
  requestPermission: vi.fn(),
}));

vi.mock('./useNotificationPermission', () => ({
  useNotificationPermission: () => ({
    permission: notificationMock.permission,
    loading: notificationMock.loading,
    requestPermission: notificationMock.requestPermission,
  }),
}));

import { useAppPermissions } from './useAppPermissions';

function defineNavigatorProperty(key: keyof Navigator, value: unknown) {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
}

describe('useAppPermissions', () => {
  const permissionStatus: { state: PermissionState; onchange: ((this: PermissionStatus, ev: Event) => unknown) | null } = {
    state: 'prompt',
    onchange: null,
  };
  const getCurrentPosition = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    notificationMock.permission = 'default';
    notificationMock.loading = false;
    notificationMock.requestPermission.mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn(),
      },
    });

    permissionStatus.state = 'prompt';
    defineNavigatorProperty('permissions', {
      query: vi.fn().mockResolvedValue(permissionStatus),
    });
    defineNavigatorProperty('geolocation', { getCurrentPosition });
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      permissionStatus.state = 'granted';
      success({ coords: {}, timestamp: Date.now() } as GeolocationPosition);
    });
  });

  it('expõe permissões pendentes quando o navegador suporta os recursos', async () => {
    const { result } = renderHook(() => useAppPermissions());

    await waitFor(() => {
      expect(result.current.permissions.notifications.state).toBe('prompt');
      expect(result.current.permissions.location.state).toBe('prompt');
    });

    expect(result.current.permissions.notifications.supported).toBe(true);
    expect(result.current.permissions.location.supported).toBe(true);
  });

  it('solicita geolocalização por gesto explícito', async () => {
    const { result } = renderHook(() => useAppPermissions());

    await act(async () => {
      const nextState = await result.current.requestLocation();
      expect(nextState).toBe('granted');
    });

    expect(getCurrentPosition).toHaveBeenCalled();
    await waitFor(() => expect(result.current.permissions.location.state).toBe('granted'));
  });

  it('reusa o fluxo existente de notificação', async () => {
    const { result } = renderHook(() => useAppPermissions());

    await act(async () => {
      await result.current.requestNotifications();
    });

    expect(notificationMock.requestPermission).toHaveBeenCalled();
  });
});
