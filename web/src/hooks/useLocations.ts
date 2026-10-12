import { doc, getDoc } from 'firebase/firestore';
import { useQueries, useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { fetchCityVenues } from '../services/venueCatalog';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Location } from '../types/location';
import { CityRef, cityKey } from '../utils/venueCity';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLocations');

// Busca uma localização específica
export async function fetchLocationById(locationId: string): Promise<Location | null> {
  try {
    const locDoc = await getDoc(doc(db, 'locations', locationId));
    if (!locDoc.exists()) return null;
    return { ...snakeToCamel<Location>(locDoc.data()), id: locDoc.id };
  } catch (error) {
    logger.error('useLocations: failed to fetch location by id', error);
    throw error;
  }
}

/**
 * Quadras de UMA cidade (#4370). Não há mais `orderBy('name') limit(200)`:
 * a consulta é por cidade/UF e pagina por cursor, então nenhuma quadra some.
 * Sem cidade definida a consulta fica desligada.
 */
export const useLocations = (city?: CityRef | null) => {
  const { data: locations = [], isLoading, error: queryError } = useQuery({
    queryKey: ['locations', 'city', city ? cityKey(city) : null],
    queryFn: async () => {
      try {
        return await fetchCityVenues(city!);
      } catch (error) {
        logger.error('useLocations: failed to fetch city venues', error);
        throw error;
      }
    },
    enabled: !!city,
    staleTime: 10 * 60 * 1000, // 10 minutos - localizações mudam muito raramente
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false, // localizações são dados estáticos — não refetch ao focar
  });

  const error = queryError ? (queryError as Error).message : null;

  return { locations, loading: !!city && isLoading, error };
};

/** Quadras específicas por id (favoritas/recentes que podem ser de outra cidade). */
export const useLocationsByIds = (ids: readonly string[]) => {
  const unique = [...new Set(ids.filter(Boolean))];
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['location', id],
      queryFn: () => fetchLocationById(id),
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
  return results.flatMap((result) => (result.data ? [result.data] : []));
};

export const useLocationDetail = (locationId?: string) => {
  const { data: location = null, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['location', locationId],
    queryFn: () => fetchLocationById(locationId!),
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false, // localização específica é estática — não refetch ao focar
  });

  const error = queryError ? (queryError as Error).message : null;

  return { location, loading, error };
};
