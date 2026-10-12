import { useCallback, useState } from 'react';
import { collection, query, where, limit, getDocs, getDoc, doc, orderBy } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';
import { RecentLocationUsage, mergeRecentLocationUsage } from '../utils/recentVenues';

const logger = createLogger('useRecentLocations');

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

/** Quantas utilizações recentes (jogos) cada fonte traz. */
const RECENT_GAMES_LIMIT = 30;
/** Participações que contam como "jogou" (presença confirmada ou check-in feito). */
const PLAYED_CONFIRMATION_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

interface RawGameData {
  status?: unknown;
  location_id?: unknown;
  dateTime?: unknown;
  date_time?: unknown;
  deleted_at?: unknown;
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function toUsage(data: RawGameData): RecentLocationUsage | null {
  if (data.status === 'CANCELLED' || data.deleted_at) return null;
  const locationId = data.location_id;
  if (typeof locationId !== 'string' || !locationId) return null;
  return { locationId, usedAt: toMillis(data.dateTime ?? data.date_time) };
}

/**
 * Quadras que o usuário usou: jogos que criou + jogos em que jogou
 * (confirmações), da utilização mais recente para a mais antiga.
 */
export async function fetchRecentLocationUsage(uid: string): Promise<string[]> {
  if (!uid) return [];

  const ownedQuery = query(
    collection(db, 'games'),
    where('owner_id', '==', uid),
    orderBy('dateTime', 'desc'),
    limit(RECENT_GAMES_LIMIT),
  );
  const confirmationsQuery = query(
    collection(db, 'confirmations'),
    where('user_id', '==', uid),
    where('status', 'in', PLAYED_CONFIRMATION_STATUSES),
    orderBy('created_at', 'desc'),
    limit(RECENT_GAMES_LIMIT),
  );

  const [owned, played] = await Promise.allSettled([
    getDocs(ownedQuery).then((snapshot) =>
      snapshot.docs.map((d) => toUsage(d.data() as RawGameData))),
    getDocs(confirmationsQuery).then(async (snapshot) => {
      const gameIds = [...new Set(
        snapshot.docs.map((d) => d.data().game_id).filter((id): id is string => typeof id === 'string' && !!id),
      )];
      const games = await Promise.allSettled(gameIds.map((id) => getDoc(doc(db, 'games', id))));
      return games.map((game) =>
        game.status === 'fulfilled' && game.value.exists()
          ? toUsage(game.value.data() as RawGameData)
          : null);
    }),
  ]);

  if (owned.status === 'rejected' && played.status === 'rejected') {
    logger.error('useRecentLocations: failed to fetch recent location ids', owned.reason);
    throw owned.reason;
  }
  if (owned.status === 'rejected') logger.warn('useRecentLocations: owned games failed', owned.reason);
  if (played.status === 'rejected') logger.warn('useRecentLocations: played games failed', played.reason);

  return mergeRecentLocationUsage([
    ...(owned.status === 'fulfilled' ? owned.value : []),
    ...(played.status === 'fulfilled' ? played.value : []),
  ]);
}

export async function fetchRecentLocationIds(uid: string): Promise<string[]> {
  return (await fetchRecentLocationUsage(uid)).slice(0, 5);
}

export function useRecentLocations() {
  const { firebaseUser, user } = useAuth();
  const uid = firebaseUser?.uid || user?.id;

  const { data: recentIds = [], isLoading, error } = useQuery({
    queryKey: ['recent-locations', uid],
    queryFn: () => fetchRecentLocationUsage(uid!),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [favoriteIds, setFavoriteIds] = useState<string[]>(getFavoriteIds);
  const isFavorite = useCallback(
    (locationId: string) => favoriteIds.includes(locationId),
    [favoriteIds],
  );
  const toggleFavorite = useCallback((locationId: string) => {
    const added = toggleFavoriteLocation(locationId);
    setFavoriteIds(getFavoriteIds());
    return added;
  }, []);

  return {
    /** Todas as quadras usadas, da mais recente para a mais antiga. */
    usedLocationIds: recentIds,
    /** Atalhos rápidos: as 5 mais recentes. */
    recentIds: recentIds.slice(0, 5),
    favoriteIds,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    isFavorite,
    toggleFavorite,
  };
}
