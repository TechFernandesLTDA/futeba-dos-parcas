import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotificationPermission } from './useNotificationPermission';

export type AppPermissionId = 'notifications' | 'location' | 'storage';
export type AppPermissionState = PermissionState | 'unsupported' | 'unknown';

export interface AppPermissionItem {
  id: AppPermissionId;
  state: AppPermissionState;
  supported: boolean;
  loading: boolean;
}

interface StorageEstimateState {
  persisted: boolean | null;
  quota: number | null;
  usage: number | null;
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

async function readStorageEstimate(): Promise<StorageEstimateState> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { persisted: null, quota: null, usage: null };
  }

  const [persisted, estimate] = await Promise.all([
    typeof navigator.storage.persisted === 'function'
      ? navigator.storage.persisted().catch(() => null)
      : Promise.resolve(null),
    typeof navigator.storage.estimate === 'function'
      ? navigator.storage.estimate().catch(() => ({}))
      : Promise.resolve({} as StorageEstimate),
  ]);

  const storageEstimate = estimate as StorageEstimate;

  return {
    persisted,
    quota: typeof storageEstimate.quota === 'number' ? storageEstimate.quota : null,
    usage: typeof storageEstimate.usage === 'number' ? storageEstimate.usage : null,
  };
}

export function useAppPermissions() {
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
    loading: notificationLoading,
  } = useNotificationPermission();
  const [locationState, setLocationState] = useState<AppPermissionState>('unknown');
  const [locationLoading, setLocationLoading] = useState(false);
  const [storageState, setStorageState] = useState<AppPermissionState>('unknown');
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateState>({
    persisted: null,
    quota: null,
    usage: null,
  });

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined') return;

    if (navigator.geolocation) {
      setLocationState(await queryBrowserPermission('geolocation'));
    } else {
      setLocationState('unsupported');
    }

    if (navigator.storage) {
      const estimate = await readStorageEstimate();
      setStorageEstimate(estimate);
      setStorageState(estimate.persisted ? 'granted' : 'prompt');
    } else {
      setStorageState('unsupported');
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

  const requestStorage = useCallback(async (): Promise<AppPermissionState> => {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      setStorageState('unsupported');
      return 'unsupported';
    }

    setStorageLoading(true);
    try {
      const persisted = await navigator.storage.persist();
      const estimate = await readStorageEstimate();
      setStorageEstimate({ ...estimate, persisted });
      const nextState: AppPermissionState = persisted ? 'granted' : 'denied';
      setStorageState(nextState);
      return nextState;
    } finally {
      setStorageLoading(false);
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
    storage: {
      id: 'storage',
      state: storageState,
      supported: typeof navigator !== 'undefined' && Boolean(navigator.storage?.persist),
      loading: storageLoading,
    },
  }), [locationLoading, locationState, notificationLoading, notificationPermission, storageLoading, storageState]);

  return {
    permissions,
    requestNotifications,
    requestLocation,
    requestStorage,
    refresh,
    storageEstimate,
  };
}
