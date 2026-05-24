import { useEffect, useState, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  documentId,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { LeagueDivision, getLevelForXp } from '../types/gamification';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';

const logger = createLogger('useLeague');

export interface LeaguePlayer {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  favoriteTeam?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: LeagueDivision;
  isCurrentUser?: boolean;
  experiencePoints?: number;
}

// Busca dados de usuários em batch (chunks de 10)
// Privacy: jogadores com is_searchable=false ficam ocultos no ranking (#1027)
async function fetchUserDataBatch(userIds: string[]): Promise<Map<string, { name: string; photoUrl: string | null; xp: number; favoriteTeam?: string }>> {
  const usersMap = new Map<string, { name: string; photoUrl: string | null; xp: number; favoriteTeam?: string }>();
  if (userIds.length === 0) return usersMap;

  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  // Usar allSettled para que falha em um chunk não derrube os demais
  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk), where('is_searchable', '==', true)))
    )
  );

  for (const result of settled) {
    if (result.status === 'rejected') {
      logger.error('Falha ao ler chunk de usuários da liga (dados parciais):', result.reason);
      continue;
    }
    for (const docSnap of result.value.docs) {
      const d = docSnap.data();
      const xp = (d.experience_points ?? d.experiencePoints ?? 0) as number;
      usersMap.set(docSnap.id, {
        name: (d.name as string) || 'Jogador',
        photoUrl: (d.photo_url as string) || (d.photoUrl as string) || null,
        xp,
        favoriteTeam: (d.favorite_team as string) || (d.favoriteTeam as string) || undefined,
      });
    }
  }

  return usersMap;
}

export interface LeagueFilters {
  groupId?: string | null;
  seasonId?: string | null;
  maxResults?: number;
}

async function fetchLeagueData(
  currentUserId?: string,
  filters?: LeagueFilters
): Promise<LeaguePlayer[]> {
  const seasonRef = collection(db, 'season_participation');

  const constraints: QueryConstraint[] = [
    orderBy('points', 'desc'),
    limit(filters?.maxResults ?? 200)
  ];
  if (filters?.seasonId) {
    constraints.push(where('season_id', '==', filters.seasonId));
  }
  if (filters?.groupId) {
    constraints.push(where('group_id', '==', filters.groupId));
  }

  const q = query(seasonRef, ...constraints);
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
    const userData = usersMap.get(p.userId) || { name: 'Jogador', photoUrl: null, xp: 0, favoriteTeam: undefined };
    return {
      ...p,
      userName: userData.name,
      userPhoto: userData.photoUrl || undefined,
      favoriteTeam: userData.favoriteTeam,
      level: getLevelForXp(userData.xp),
      experiencePoints: userData.xp,
      isCurrentUser: p.userId === currentUserId,
    };
  });

  // BUG 13 fix: Deduplicação defensiva por userId (protege contra dados legacy ou race conditions)
  const uniqueMap = new Map<string, LeaguePlayer>();
  for (const p of players) {
    const existing = uniqueMap.get(p.userId);
    if (!existing || p.points > existing.points) {
      uniqueMap.set(p.userId, p);
    }
  }
  return Array.from(uniqueMap.values());
}

export interface UseLeagueOptions {
  enabled?: boolean;
}

export const useLeague = (
  currentUserId?: string,
  filters?: LeagueFilters,
  options?: UseLeagueOptions
) => {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const [listenerError, setListenerError] = useState<string | null>(null);

  const enabled = options?.enabled ?? true;

  const { data: players = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['league', currentUserId, filters?.groupId, filters?.seasonId, filters?.maxResults],
    queryFn: () => fetchLeagueData(currentUserId, filters),
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000,
    enabled,
  });

  // Listener real-time: único por seasonId/groupId (sem division)
  // Usa showErrorRef para não recriar listener quando showError muda
  useEffect(() => {
    if (!enabled) return;

    const seasonRef = collection(db, 'season_participation');
    const listenerConstraints: QueryConstraint[] = [
      orderBy('points', 'desc'),
      limit(filters?.maxResults ?? 200)
    ];
    if (filters?.seasonId) {
      listenerConstraints.push(where('season_id', '==', filters.seasonId));
    }
    if (filters?.groupId) {
      listenerConstraints.push(where('group_id', '==', filters.groupId));
    }
    const q = query(seasonRef, ...listenerConstraints);
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ['league', currentUserId, filters?.groupId, filters?.seasonId, filters?.maxResults],
      });
    }, (err) => {
      logger.error('Error in league listener:', err);
      setListenerError(err.message);
      showErrorRef.current('Erro ao carregar ranking em tempo real');
    });

    return () => unsubscribe();
  }, [queryClient, currentUserId, filters?.seasonId, filters?.groupId, filters?.maxResults, enabled]);

  const error = listenerError || (queryError ? (queryError as Error).message : null);

  return { players, loading, error, refetch };
};
