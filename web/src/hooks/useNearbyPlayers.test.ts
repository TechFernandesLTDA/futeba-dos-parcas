// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockUpdateMyLocation = vi.fn();
const mockDiscoverNearbyPlayers = vi.fn();

vi.mock('../services/cloudFunctions', () => ({
  updateMyLocation: (...args: any[]) => mockUpdateMyLocation(...args),
  discoverNearbyPlayers: (...args: any[]) => mockDiscoverNearbyPlayers(...args),
}));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;
const DELETE_FIELD = { __deleteField: true } as any;

vi.mock('firebase/firestore', () => ({
  deleteField: vi.fn(() => DELETE_FIELD),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  serverTimestamp: vi.fn(() => SERVER_TIMESTAMP),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  // services/firebase.ts precisa existir no mock. #2330
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

let mockAuthReturn: any = {
  currentUser: { uid: 'u-1' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: any) => `fb:${err?.code ?? err?.message ?? 'unknown'}`,
}));

import { useNearbyPlayers } from './useNearbyPlayers';

// jsdom não tem navigator.geolocation — stub controlado por teste.
let geoResult: { lat: number; lng: number } | { error: string } | null = null;

function stubGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (pos: { coords: { latitude: number; longitude: number } }) => void,
        error: (err: unknown) => void,
      ) => {
        if (geoResult && 'error' in geoResult) {
          error(new Error(geoResult.error));
        } else if (geoResult) {
          success({ coords: { latitude: geoResult.lat, longitude: geoResult.lng } });
        }
      },
    },
  });
}

function unstubGeolocation() {
  // @ts-expect-error remoção do stub por teste
  delete navigator.geolocation;
}

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function makePlayer(id: string) {
  return {
    id,
    displayName: `Jogador ${id}`,
    photoUrl: null,
    nickname: null,
    preferredPosition: null,
    followersCount: 0,
    isFollowing: false,
    distanceKmApprox: 2,
    distanceBand: 'under_5km',
    socialContext: 'none',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  unstubGeolocation();
  geoResult = null;
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateMyLocation.mockResolvedValue({ data: {} });
  mockDiscoverNearbyPlayers.mockResolvedValue({ data: { players: [] } });
  mockAuthReturn = { currentUser: { uid: 'u-1' } };
});

afterEach(() => {
  unstubGeolocation();
});

describe('useNearbyPlayers', () => {
  describe('canUseLocation', () => {
    it('false quando navigator não expõe geolocation', () => {
      const { result } = renderHook(() => useNearbyPlayers());
      expect(result.current.canUseLocation).toBe(false);
    });

    it('true quando geolocation está disponível', () => {
      stubGeolocation();
      const { result } = renderHook(() => useNearbyPlayers());
      expect(result.current.canUseLocation).toBe(true);
    });
  });

  describe('estado de compartilhamento (loadSharingState no mount)', () => {
    it('reflete location_sharing_enabled=true e updatedAt convertido', async () => {
      const updatedAt = new Date('2026-10-01T10:00:00');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ location_sharing_enabled: true, location_updated_at: { toDate: () => updatedAt } }),
      });
      const { result } = renderHook(() => useNearbyPlayers());
      await waitFor(() => expect(result.current.sharingState.enabled).toBe(true));
      expect(result.current.sharingState.updatedAt).toEqual(updatedAt);
    });

    it('doc inexistente: compartilhamento desligado', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
      const { result } = renderHook(() => useNearbyPlayers());
      await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
      expect(result.current.sharingState).toEqual({ enabled: false, updatedAt: null });
    });

    it('sharing_enabled não-booleano é tratado como false', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ location_sharing_enabled: 1, location_updated_at: null }),
      });
      const { result } = renderHook(() => useNearbyPlayers());
      await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
      expect(result.current.sharingState.enabled).toBe(false);
    });

    it('falha ao carregar estado: reset silencioso, sem crash nem error state', async () => {
      mockGetDoc.mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useNearbyPlayers());
      await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
      await act(async () => {});
      expect(result.current.sharingState).toEqual({ enabled: false, updatedAt: null });
      expect(result.current.error).toBeNull();
    });

    it('sem currentUser: não consulta user_locations', async () => {
      mockAuthReturn = { currentUser: null };
      renderHook(() => useNearbyPlayers());
      await act(async () => {});
      expect(mockGetDoc).not.toHaveBeenCalled();
    });
  });

  describe('refreshFromCurrentLocation', () => {
    it('busca jogadores com GPS atual, respeitando radiusKm e socialFilter', async () => {
      stubGeolocation();
      geoResult = { lat: -23.55, lng: -46.63 };
      mockDiscoverNearbyPlayers.mockResolvedValue({ data: { players: [makePlayer('p1'), makePlayer('p2')] } });
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.refreshFromCurrentLocation();
      });
      expect(mockUpdateMyLocation).toHaveBeenCalledWith({ lat: -23.55, lng: -46.63 });
      expect(mockDiscoverNearbyPlayers).toHaveBeenCalledWith({
        lat: -23.55,
        lng: -46.63,
        radiusKm: 5,
        socialFilter: 'all',
      });
      expect(result.current.players).toHaveLength(2);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('updateMyLocation falhando não bloqueia a busca (FIX #4123)', async () => {
      stubGeolocation();
      geoResult = { lat: 1, lng: 2 };
      mockUpdateMyLocation.mockRejectedValue(new Error('cooldown'));
      mockDiscoverNearbyPlayers.mockResolvedValue({ data: { players: [makePlayer('p1')] } });
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.refreshFromCurrentLocation();
      });
      expect(mockDiscoverNearbyPlayers).toHaveBeenCalled();
      expect(result.current.players).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('discover falhando: setError via getFirestoreErrorMessage e players=[]', async () => {
      stubGeolocation();
      geoResult = { lat: 1, lng: 2 };
      mockDiscoverNearbyPlayers.mockRejectedValue(
        Object.assign(new Error('functions/unavailable'), { code: 'functions/unavailable' }),
      );
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.refreshFromCurrentLocation();
      });
      expect(result.current.error).toBe('fb:functions/unavailable');
      expect(result.current.players).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('geolocation negado: setError e sem chamada à callable', async () => {
      stubGeolocation();
      geoResult = { error: 'PERMISSION_DENIED' };
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.refreshFromCurrentLocation();
      });
      expect(mockDiscoverNearbyPlayers).not.toHaveBeenCalled();
      expect(result.current.error).toBe('fb:PERMISSION_DENIED');
      expect(result.current.players).toEqual([]);
    });

    it('sem currentUser: retorna cedo sem tocar GPS nem callable', async () => {
      mockAuthReturn = { currentUser: null };
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.refreshFromCurrentLocation();
      });
      expect(mockDiscoverNearbyPlayers).not.toHaveBeenCalled();
      expect(mockUpdateMyLocation).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('setRadiusKm/setSocialFilter mudam os parâmetros enviados', async () => {
      stubGeolocation();
      geoResult = { lat: 1, lng: 2 };
      const { result } = renderHook(() => useNearbyPlayers());
      act(() => {
        result.current.setRadiusKm(25);
        result.current.setSocialFilter('following');
      });
      await act(async () => {
        await result.current.refreshFromCurrentLocation();
      });
      expect(mockDiscoverNearbyPlayers).toHaveBeenCalledWith({
        lat: 1,
        lng: 2,
        radiusKm: 25,
        socialFilter: 'following',
      });
    });
  });

  describe('enableSharing', () => {
    it('feliz: grava posição via callable, recarrega estado e busca jogadores', async () => {
      stubGeolocation();
      geoResult = { lat: -23.5, lng: -46.6 };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ location_sharing_enabled: true, location_updated_at: { toDate: () => new Date() } }),
      });
      mockDiscoverNearbyPlayers.mockResolvedValue({ data: { players: [makePlayer('p1')] } });
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.enableSharing();
      });
      expect(mockUpdateMyLocation).toHaveBeenCalledWith({ lat: -23.5, lng: -46.6 });
      expect(mockDiscoverNearbyPlayers).toHaveBeenCalled();
      expect(result.current.sharingState.enabled).toBe(true);
      expect(result.current.sharingLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('falha no updateMyLocation: setError, repropaga e desliga sharingLoading', async () => {
      stubGeolocation();
      geoResult = { lat: 1, lng: 2 };
      mockUpdateMyLocation.mockRejectedValue(
        Object.assign(new Error('unavailable'), { code: 'unavailable' }),
      );
      const { result } = renderHook(() => useNearbyPlayers());
      let caught: unknown = null;
      await act(async () => {
        try {
          await result.current.enableSharing();
        } catch (err) {
          caught = err;
        }
      });
      expect((caught as Error).message).toBe('unavailable');
      expect(result.current.error).toBe('fb:unavailable');
      expect(result.current.sharingLoading).toBe(false);
      expect(mockDiscoverNearbyPlayers).not.toHaveBeenCalled();
    });

    it('sem currentUser: não faz nada', async () => {
      mockAuthReturn = { currentUser: null };
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.enableSharing();
      });
      expect(mockUpdateMyLocation).not.toHaveBeenCalled();
      expect(result.current.sharingLoading).toBe(false);
    });
  });

  describe('disableSharing', () => {
    it('setDoc com merge desligando flag e apagando campos de localização', async () => {
      const { result } = renderHook(() => useNearbyPlayers());
      await act(async () => {
        await result.current.disableSharing();
      });
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const [ref, payload, options] = mockSetDoc.mock.calls[0] as unknown as [
        { path: string },
        Record<string, unknown>,
        { merge: boolean },
      ];
      expect(ref.path).toBe('user_locations/u-1');
      expect(options).toEqual({ merge: true });
      expect(payload).toMatchObject({
        user_id: 'u-1',
        location_sharing_enabled: false,
        location_updated_at: SERVER_TIMESTAMP,
        geohash: DELETE_FIELD,
        lat: DELETE_FIELD,
        lng: DELETE_FIELD,
        location_consent_at: DELETE_FIELD,
      });
      expect(result.current.sharingState.enabled).toBe(false);
      expect(result.current.sharingState.updatedAt).toBeInstanceOf(Date);
    });

    it('falha no setDoc: setError e repropaga', async () => {
      mockSetDoc.mockRejectedValue(
        Object.assign(new Error('permission-denied'), { code: 'permission-denied' }),
      );
      const { result } = renderHook(() => useNearbyPlayers());
      let caught: unknown = null;
      await act(async () => {
        try {
          await result.current.disableSharing();
        } catch (err) {
          caught = err;
        }
      });
      expect((caught as Error).message).toBe('permission-denied');
      expect(result.current.error).toBe('fb:permission-denied');
      expect(result.current.sharingLoading).toBe(false);
    });
  });
});
