import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotificationPermission } from './useNotificationPermission';

export type AppPermissionId = 'notifications' | 'location';
export type AppPermissionState = PermissionState | 'unsupported' | 'unknown';

export interface AppPermissionItem {
  id: AppPermissionId;
  state: AppPermissionState;
  supported: boolean;
  loading: boolean;
}

function mapNotificationState(permission: NotificationPermission): AppPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return permission === 'default' ? 'prompt' : permission;
}

async function queryBrowserPermission(name: PermissionName): Promise<AppPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({ name });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export function useAppPermissions() {
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
    loading: notificationLoading,
  } = useNotificationPermission();
  const [locationState, setLocationState] = useState<AppPermissionState>('unknown');
  const [locationLoading, setLocationLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined') return;

    if (navigator.geolocation) {
      setLocationState(await queryBrowserPermission('geolocation'));
    } else {
      setLocationState('unsupported');
    }

  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;

    let cancelled = false;
    let locationStatus: PermissionStatus | null = null;

    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (cancelled) return;
      locationStatus = status;
      status.onchange = () => setLocationState(status.state);
    }).catch(() => {
      // Permissions API is optional; direct geolocation request still works.
    });

    return () => {
      cancelled = true;
      if (locationStatus) {
        locationStatus.onchange = null;
      }
    };
  }, []);

  const requestNotifications = useCallback(async () => {
    await requestNotificationPermission();
  }, [requestNotificationPermission]);

  const requestLocation = useCallback(async (): Promise<AppPermissionState> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationState('unsupported');
      return 'unsupported';
    }

    setLocationLoading(true);
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 10_000,
        });
      });
      setLocationState('granted');
      return 'granted';
    } catch (error) {
      const code = (error as GeolocationPositionError | undefined)?.code;
      const nextState: AppPermissionState = code === 1
        ? 'denied'
        : await queryBrowserPermission('geolocation');
      setLocationState(nextState);
      return nextState;
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const permissions = useMemo<Record<AppPermissionId, AppPermissionItem>>(() => ({
    notifications: {
      id: 'notifications',
      state: mapNotificationState(notificationPermission),
      supported: typeof Notification !== 'undefined',
      loading: notificationLoading,
    },
    location: {
      id: 'location',
      state: locationState,
      supported: typeof navigator !== 'undefined' && Boolean(navigator.geolocation),
      loading: locationLoading,
    },
  }), [locationLoading, locationState, notificationLoading, notificationPermission]);

  return {
    permissions,
    requestNotifications,
    requestLocation,
    refresh,
  };
}
