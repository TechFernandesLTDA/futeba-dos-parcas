import { useMemo } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

const FAVORITES_STORAGE_KEY = 'favorite_locations';

function getFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteLocation(locationId: string): boolean {
  const favorites = getFavoriteIds();
  const index = favorites.indexOf(locationId);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.unshift(locationId);
    if (favorites.length > 10) favorites.pop();
  }
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  return index < 0;
}

async function fetchRecentLocationIds(uid: string): Promise<string[]> {
  if (!uid) return [];

  const gamesRef = collection(db, 'games');
  const q = query(
    gamesRef,
    where('owner_id', '==', uid),
    where('status', '!=', 'CANCELLED'),
    limit(20),
  );

  const snapshot = await getDocs(q);
  const seen = new Set<string>();
  const ids: string[] = [];

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const locId = data.location_id as string;
    if (locId && !seen.has(locId)) {
      seen.add(locId);
      ids.push(locId);
    }
  });

  return ids.slice(0, 5);
}

export function useRecentLocations() {
  const { firebaseUser, user } = useAuth();
  const uid = firebaseUser?.uid || user?.id;

  const { data: recentIds = [], isLoading, error } = useQuery({
    queryKey: ['recent-locations', uid],
    queryFn: () => fetchRecentLocationIds(uid!),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const favoriteIds = useMemo(() => getFavoriteIds(), []);

  return {
    recentIds,
    favoriteIds,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    isFavorite: (locationId: string) => favoriteIds.includes(locationId),
  };
}
