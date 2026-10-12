import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from './useLocations';
import { fetchAllVenues, fetchStateVenues, fetchVenuesNear } from '../services/venueCatalog';
import {
  CityOption,
  CityRef,
  CitySource,
  GeoPoint,
  buildCityOptions,
  findNearestVenueCity,
  readSavedCity,
  resolveVenueCity,
  saveCity,
  toCityRef,
} from '../utils/venueCity';
import { buildVenueSelectorResult } from '../utils/venueSelector';
import { createLogger } from '../utils/logger';

const logger = createLogger('useVenueSelector');

/** Tempo máximo esperando o GPS/rede depois que o usuário autorizou. */
const GEOLOCATION_TIMEOUT_MS = 6000;

function getCurrentPosition(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false },
    );
  });
}

/** Passo 1 da regra: posição do aparelho → cidade/UF da quadra mais próxima. */
async function resolveGeolocationCity(): Promise<CityRef | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      const status = await navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .catch(() => null);
      if (status?.state === 'denied') return null;
    }
    const position = await getCurrentPosition();
    if (!position) return null;
    const nearby = await fetchVenuesNear(position);
    const nearest = findNearestVenueCity(position, nearby);
    return nearest ? { city: nearest.city, state: nearest.state } : null;
  } catch (error) {
    logger.warn('Não foi possível descobrir a cidade pela posição', error);
    return null;
  }
}

export interface UseVenueSelectorParams {
  /** Termo digitado no seletor. */
  searchQuery: string;
  /** Quadras usadas pelo usuário, da mais recente para a mais antiga. */
  recentIds: readonly string[];
}

/**
 * Dados do seletor de quadras (#4370): cidade atual (GPS → perfil → última
 * escolhida, com "Trocar cidade"), quadras da cidade, e — só quando a busca
 * não acha nada na cidade — resultados em outras cidades.
 */
export function useVenueSelector({ searchQuery, recentIds }: UseVenueSelectorParams) {
  const { user } = useAuth();
  const [manualCity, setManualCity] = useState<CityRef | null>(null);
  const [savedCity] = useState<CityRef | null>(() => readSavedCity());

  const geo = useQuery({
    queryKey: ['venue-selector', 'geolocation-city'],
    queryFn: resolveGeolocationCity,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const profileCity = useMemo(() => toCityRef(user?.city, user?.state), [user?.city, user?.state]);

  const resolved = useMemo(() => resolveVenueCity({
    manual: manualCity,
    geolocation: geo.data,
    profile: profileCity,
    saved: savedCity,
  }), [manualCity, geo.data, profileCity, savedCity]);

  const city = resolved?.ref ?? null;
  const citySource: CitySource | null = resolved?.source ?? null;

  const { locations: cityVenues, loading: cityLoading, error } = useLocations(city);

  const hasQuery = searchQuery.trim().length > 0;
  const firstPass = useMemo(
    () => buildVenueSelectorResult({ cityVenues, query: searchQuery, recentIds }),
    [cityVenues, searchQuery, recentIds],
  );

  const othersQuery = useQuery({
    queryKey: ['venue-selector', 'all-venues'],
    queryFn: fetchAllVenues,
    enabled: hasQuery && firstPass.needsOtherCities && !cityLoading,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const result = useMemo(
    () => buildVenueSelectorResult({
      cityVenues,
      otherVenues: othersQuery.data,
      query: searchQuery,
      recentIds,
    }),
    [cityVenues, othersQuery.data, searchQuery, recentIds],
  );

  const changeCity = useCallback((ref: CityRef) => {
    setManualCity(ref);
    saveCity(ref);
  }, []);

  return {
    city,
    citySource,
    /** Ainda descobrindo a cidade (nenhuma fonte disponível e GPS pendente). */
    resolvingCity: !city && geo.isLoading,
    changeCity,
    cityVenues,
    inCity: result.inCity,
    otherCities: result.otherCities,
    loading: cityLoading,
    loadingOtherCities: hasQuery && result.needsOtherCities && othersQuery.isLoading,
    error,
  };
}

/** Lista de cidades de uma UF (com contagem) para o diálogo "Trocar cidade". */
export function useStateCities(uf: string, enabled = true) {
  const query = useQuery({
    queryKey: ['venue-selector', 'state-venues', uf],
    queryFn: () => fetchStateVenues(uf),
    enabled: enabled && !!uf,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const cities: CityOption[] = useMemo(
    () => buildCityOptions(query.data ?? [], uf),
    [query.data, uf],
  );
  return { cities, loading: query.isLoading, error: query.error ? (query.error as Error).message : null };
}
