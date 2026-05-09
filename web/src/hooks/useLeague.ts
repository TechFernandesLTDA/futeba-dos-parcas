import { useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  documentId,
  where,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { LeagueDivision } from '../types/gamification';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLeague');

export interface LeaguePlayer {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: LeagueDivision;
  isCurrentUser?: boolean;
}

// Busca dados de usuários em batch (chunks de 10)
async function fetchUserDataBatch(userIds: string[]): Promise<Map<string, { name: string; photoUrl: string | null }>> {
  const usersMap = new Map<string, { name: string; photoUrl: string | null }>();
  if (userIds.length === 0) return usersMap;

  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
    )
  );

  for (const result of results) {
    for (const docSnap of result.docs) {
      const d = docSnap.data();
      usersMap.set(docSnap.id, {
        name: (d.name as string) || 'Jogador',
        photoUrl: (d.photo_url as string) || (d.photoUrl as string) || null,
      });
    }
  }

  return usersMap;
}

// Busca ranking da liga com batch reads para dados de usuários
async function fetchLeagueData(currentUserId?: string, division?: LeagueDivision): Promise<LeaguePlayer[]> {
  const seasonRef = collection(db, 'season_participation');
  const q = query(seasonRef, orderBy('points', 'desc'), limit(100));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return [];

  // Extrair dados de participação e IDs de usuários
  const participationData = snapshot.docs.map((docSnapshot) => {
    const raw = docSnapshot.data();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = snakeToCamel(raw) as Record<string, any>;
    const userId = data.userId || raw.user_id || docSnapshot.id;

    return {
      id: docSnapshot.id,
      userId,
      level: data.level || 1,
      points: data.points || 0,
      gamesPlayed: data.gamesPlayed || raw.games_played || 0,
      wins: data.wins || 0,
      goals: data.goals || 0,
      assists: data.assists || 0,
      mvpCount: data.mvpCount || raw.mvp_count || 0,
      division: data.division || 'BRONZE',
    };
  });

  // Batch fetch de todos os dados de usuários (elimina N+1)
  const userIds = [...new Set(participationData.map((p) => p.userId))];
  const usersMap = await fetchUserDataBatch(userIds);

  // Combinar dados
  const players: LeaguePlayer[] = participationData.map((p) => {
    const userData = usersMap.get(p.userId) || { name: 'Jogador', photoUrl: null };
    return {
      ...p,
      userName: userData.name,
      userPhoto: userData.photoUrl || undefined,
      isCurrentUser: p.userId === currentUserId,
    };
  });

  // Filtrar por divisão se especificado
  return division ? players.filter((p) => p.division === division) : players;
}

export const useLeague = (currentUserId?: string, division?: LeagueDivision) => {
  const queryClient = useQueryClient();

  const { data: players = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['league', currentUserId, division],
    queryFn: () => fetchLeagueData(currentUserId, division),
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000,
  });

  // Listener real-time para invalidar cache quando rankings mudam
  useEffect(() => {
    const seasonRef = collection(db, 'season_participation');
    const q = query(seasonRef, orderBy('points', 'desc'), limit(100));
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['league'] });
    }, (err) => {
      logger.error('Error in league listener:', err);
    });

    return () => unsubscribe();
  }, [queryClient]);

  const error = queryError ? (queryError as Error).message : null;

  return { players, loading, error };
};
