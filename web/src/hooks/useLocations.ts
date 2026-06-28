import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Location, isLocationCommerciallyAvailable } from '../types/location';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLocations');

// Busca todas as localizações
// FIX #1129: limit(200) server-side para evitar full-scan da collection.
async function fetchLocations(): Promise<Location[]> {
  const locRef = collection(db, 'locations');
  const q = query(locRef, orderBy('name', 'asc'), limit(200));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => ({
        ...snakeToCamel<Location>(d.data()),
        id: d.id,
      }))
      .filter(isLocationCommerciallyAvailable);
  } catch (error) {
    logger.error('useLocations: failed to fetch locations', error);
    throw error;
  }
}

// Busca uma localização específica
async function fetchLocationById(locationId: string): Promise<Location | null> {
  try {
    const locDoc = await getDoc(doc(db, 'locations', locationId));
    if (!locDoc.exists()) return null;
    return { ...snakeToCamel<Location>(locDoc.data()), id: locDoc.id };
  } catch (error) {
    logger.error('useLocations: failed to fetch location by id', error);
    throw error;
  }
}

export const useLocations = () => {
  const { data: locations = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
    staleTime: 10 * 60 * 1000, // 10 minutos - localizações mudam muito raramente
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false, // localizações são dados estáticos — não refetch ao focar
  });

  const error = queryError ? (queryError as Error).message : null;

  return { locations, loading, error };
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
