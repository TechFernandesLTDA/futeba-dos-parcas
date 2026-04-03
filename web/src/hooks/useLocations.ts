import { useEffect } from 'react';
import { collection, query, orderBy, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Location } from '../types/location';

// Busca todas as localizações
async function fetchLocations(): Promise<Location[]> {
  const locRef = collection(db, 'locations');
  const q = query(locRef, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    ...snakeToCamel<Location>(d.data()),
    id: d.id,
  }));
}

// Busca uma localização específica
async function fetchLocationById(locationId: string): Promise<Location | null> {
  const locDoc = await getDoc(doc(db, 'locations', locationId));
  if (!locDoc.exists()) return null;
  return { ...snakeToCamel<Location>(locDoc.data()), id: locDoc.id };
}

export const useLocations = () => {
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
    staleTime: 10 * 60 * 1000, // 10 minutos - localizações mudam muito raramente
    gcTime: 30 * 60 * 1000,
  });

  // Listener real-time para invalidar cache quando localizações mudam
  useEffect(() => {
    const locRef = collection(db, 'locations');
    const q = query(locRef, orderBy('name', 'asc'));
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    });

    return () => unsubscribe();
  }, [queryClient]);

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
  });

  const error = queryError ? (queryError as Error).message : null;

  return { location, loading, error };
};
