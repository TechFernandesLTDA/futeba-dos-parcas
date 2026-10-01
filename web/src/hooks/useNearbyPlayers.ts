import { useCallback, useEffect, useMemo, useState } from 'react';
import { updateMyLocation } from '../services/cloudFunctions';
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { discoverNearbyPlayers, NearbyPlayer } from '../services/cloudFunctions';
import { useAuth } from '../contexts/AuthContext';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';

export type NearbyRadiusKm = 1 | 5 | 10 | 25;
export type NearbySocialFilter = 'all' | 'following';

interface BrowserLocation {
  lat: number;
  lng: number;
}

interface LocationSharingState {
  enabled: boolean;
  updatedAt: Date | null;
}

function getCurrentBrowserLocation(): Promise<BrowserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation_unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });
}

function toDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

export function useNearbyPlayers() {
  const { currentUser } = useAuth();
  const [players, setPlayers] = useState<NearbyPlayer[]>([]);
  const [radiusKm, setRadiusKm] = useState<NearbyRadiusKm>(5);
  const [socialFilter, setSocialFilter] = useState<NearbySocialFilter>('all');
  const [loading, setLoading] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharingState, setSharingState] = useState<LocationSharingState>({
    enabled: false,
    updatedAt: null,
  });

  const canUseLocation = useMemo(
    () => typeof navigator !== 'undefined' && Boolean(navigator.geolocation),
    []
  );

  const loadSharingState = useCallback(async () => {
    if (!currentUser) return;
    const snapshot = await getDoc(doc(db, 'user_locations', currentUser.uid));
    if (!snapshot.exists()) {
      setSharingState({ enabled: false, updatedAt: null });
      return;
    }

    const data = snapshot.data();
    setSharingState({
      enabled: data.location_sharing_enabled === true,
      updatedAt: toDate(data.location_updated_at),
    });
  }, [currentUser]);

  useEffect(() => {
    void loadSharingState().catch(() => {
      setSharingState({ enabled: false, updatedAt: null });
    });
  }, [loadSharingState]);

  const refreshFromCurrentLocation = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const location = await getCurrentBrowserLocation();
      // FIX #4123: refresh do GPS pelo caminho autoritativo antes da busca
      // (respeita cooldown; falha não bloqueia a busca).
      await updateMyLocation({ lat: location.lat, lng: location.lng }).catch(() => undefined);
      const result = await discoverNearbyPlayers({
        ...location,
        radiusKm,
        socialFilter,
      });
      setPlayers(result.data.players);
    } catch (err) {
      setError(getFirestoreErrorMessage(err));
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, radiusKm, socialFilter]);

  const enableSharing = useCallback(async () => {
    if (!currentUser) return;
    setSharingLoading(true);
    setError(null);
    try {
      // FIX #4123: posição só entra pela callable server-owner
      // updateMyLocation (cooldown 10 min, plausibilidade, geohash
      // no servidor). As rules bloqueiam lat/lng via cliente.
      const location = await getCurrentBrowserLocation();
      await updateMyLocation({ lat: location.lat, lng: location.lng });
      await loadSharingState();
      await refreshFromCurrentLocation();
    } catch (err) {
      setError(getFirestoreErrorMessage(err));
      throw err;
    } finally {
      setSharingLoading(false);
    }
  }, [currentUser, loadSharingState, refreshFromCurrentLocation]);

  const disableSharing = useCallback(async () => {
    if (!currentUser) return;
    setSharingLoading(true);
    setError(null);
    try {
      await setDoc(doc(db, 'user_locations', currentUser.uid), {
        user_id: currentUser.uid,
        location_sharing_enabled: false,
        location_updated_at: serverTimestamp(),
        geohash: deleteField(),
        lat: deleteField(),
        lng: deleteField(),
        location_consent_at: deleteField(),
      }, { merge: true });
      setSharingState({ enabled: false, updatedAt: new Date() });
    } catch (err) {
      setError(getFirestoreErrorMessage(err));
      throw err;
    } finally {
      setSharingLoading(false);
    }
  }, [currentUser]);

  return {
    players,
    radiusKm,
    setRadiusKm,
    socialFilter,
    setSocialFilter,
    loading,
    sharingLoading,
    error,
    sharingState,
    canUseLocation,
    refreshFromCurrentLocation,
    enableSharing,
    disableSharing,
  };
}
