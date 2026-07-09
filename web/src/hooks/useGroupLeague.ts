import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  documentId,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { useEffect, useState, useRef } from 'react';
import { compareGroupLeagueStandings } from '../utils/groupLeagueStandings';
import { getEffectiveLevel, getExperiencePoints } from '../utils/xpAccounting';

const logger = createLogger('useGroupLeague');

export interface GroupLeagueStanding {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  favoriteTeam?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  mvpCount: number;
  isCurrentUser?: boolean;
}

export interface GroupLeagueSeason {
  id: string;
  groupId: string;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  createdAt?: Date;
}

export interface GroupLeagueMatch {
  id: string;
  gameId: string;
  seasonId: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  date: string;
  playerResults: {
    userId: string;
    userName: string;
    teamId: string;
    goals: number;
    assists: number;
    isMvp: boolean;
    result: 'WIN' | 'DRAW' | 'LOSS';
  }[];
}

async function fetchGroupLeagueStandings(
  groupId: string,
  seasonId: string,
  currentUserId?: string
): Promise<GroupLeagueStanding[]> {
  const standingsDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  let hasMore = true;

  while (hasMore) {
    const constraints = [
      where('season_id', '==', seasonId),
      orderBy('points', 'desc'),
      limit(200),
    ];
    const standingsSnap: QuerySnapshot<DocumentData> = await getDocs(query(
      collection(db, 'groups', groupId, 'league_standings'),
      ...(lastDoc ? [...constraints, startAfter(lastDoc)] : constraints)
    ));

    standingsDocs.push(...standingsSnap.docs);

    hasMore = standingsSnap.docs.length === 200;
    lastDoc = hasMore ? standingsSnap.docs[standingsSnap.docs.length - 1] : null;
  }

  if (standingsDocs.length === 0) return [];

  const standingData = standingsDocs.map((doc) => {
    const raw = doc.data();
    const data = snakeToCamel(raw) as Record<string, unknown>;
    return {
      id: doc.id,
      userId: (data.userId as string) || (raw.user_id as string) || doc.id,
      level: getEffectiveLevel({ ...raw, ...data }),
      points: (data.points as number) || 0,
      gamesPlayed: (data.gamesPlayed as number) || (raw.games_played as number) || 0,
      wins: (data.wins as number) || 0,
      draws: (data.draws as number) || 0,
      losses: (data.losses as number) || 0,
      goalsScored: (data.goalsScored as number) || (raw.goals_scored as number) || 0,
      goalsConceded: (data.goalsConceded as number) || (raw.goals_conceded as number) || 0,
      goalDifference: (data.goalDifference as number) || (raw.goal_difference as number) || 0,
      mvpCount: (data.mvpCount as number) || (raw.mvp_count as number) || 0,
    };
  });

  const userIds = [...new Set(standingData.map((s) => s.userId))];
  const usersMap = new Map<string, { name: string; photoUrl: string | null; favoriteTeam?: string; level: number }>();

  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
    )
  );

  for (const result of settled) {
    if (result.status === 'rejected') {
      logger.error('Failed to fetch user chunk:', result.reason);
      continue;
    }
    for (const docSnap of result.value.docs) {
      const d = docSnap.data();
      const xp = getExperiencePoints(d);
      usersMap.set(docSnap.id, {
        name: (d.name as string) || 'Jogador',
        photoUrl: (d.photo_url as string) || (d.photoUrl as string) || null,
        favoriteTeam: (d.favorite_team as string) || (d.favoriteTeam as string) || undefined,
        level: getEffectiveLevel(d, xp),
      });
    }
  }

  return standingData.map((s) => {
    const userData = usersMap.get(s.userId) || { name: 'Jogador', photoUrl: null, favoriteTeam: undefined, level: s.level };
    return {
      ...s,
      userName: userData.name,
      userPhoto: userData.photoUrl || undefined,
      favoriteTeam: userData.favoriteTeam,
      level: userData.level,
      isCurrentUser: s.userId === currentUserId,
    };
  }).sort(compareGroupLeagueStandings);
}

async function fetchGroupLeagueSeasons(groupId: string): Promise<GroupLeagueSeason[]> {
  const seasonsSnap = await getDocs(
    query(
      collection(db, 'groups', groupId, 'league_seasons'),
      orderBy('start_date', 'desc'),
      limit(20)
    )
  );

  return seasonsSnap.docs.map((doc) => {
    const raw = doc.data();
    return {
      id: doc.id,
      groupId,
      name: (raw.name as string) || 'Temporada',
      isActive: (raw.is_active as boolean) || false,
      startDate: (raw.start_date as string) || '',
      endDate: (raw.end_date as string) || undefined,
      createdAt: raw.created_at?.toDate?.(),
    };
  });
}

export function useGroupLeague(groupId?: string, currentUserId?: string, selectedSeasonId?: string | null) {
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const [listenerError, setListenerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: seasons = [],
    isLoading: seasonsLoading,
  } = useQuery({
    queryKey: ['groupLeagueSeasons', groupId],
    queryFn: () => fetchGroupLeagueSeasons(groupId!),
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });

  const activeSeason = seasons.find((s) => s.isActive) || null;
  const selectedSeason = (selectedSeasonId ? seasons.find((s) => s.id === selectedSeasonId) : null)
    || activeSeason
    || seasons[0]
    || null;

  const {
    data: standings = [],
    isLoading: standingsLoading,
    error: standingsError,
    refetch,
  } = useQuery({
    queryKey: ['groupLeagueStandings', groupId, selectedSeason?.id],
    queryFn: () => fetchGroupLeagueStandings(groupId!, selectedSeason!.id, currentUserId),
    enabled: !!groupId && !!selectedSeason,
    staleTime: 3 * 60 * 1000,
  });

  useEffect(() => {
    if (!groupId || !selectedSeason) return;

    const standingsRef = collection(db, 'groups', groupId, 'league_standings');
    const q = query(
      standingsRef,
      where('season_id', '==', selectedSeason.id),
      orderBy('points', 'desc')
    );

    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      q,
      () => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        queryClient.invalidateQueries({
          queryKey: ['groupLeagueStandings', groupId, selectedSeason.id],
        });
      },
      (err) => {
        logger.error('Error in group league listener:', err);
        setListenerError(err.message);
        showErrorRef.current('Erro ao carregar classificação em tempo real');
      }
    );

    return () => unsubscribe();
  }, [groupId, selectedSeason, queryClient]);

  const error = listenerError || (standingsError ? (standingsError as Error).message : null);
  const loading = seasonsLoading || standingsLoading;

  return { standings, seasons, activeSeason, selectedSeason, loading, error, refetch };
}
