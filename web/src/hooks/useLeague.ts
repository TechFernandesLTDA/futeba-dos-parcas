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
  startAfter,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { LeagueDivision, getLevelForXp } from '../types/gamification';
import type { GameGender } from '../types/game';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';

const logger = createLogger('useLeague');

// Fase 4b: gêneros válidos para segmentação do ranking.
const SEGMENT_GENDERS: readonly GameGender[] = ['MALE', 'FEMALE', 'MIXED'];

/**
 * Resolve o filtro de gênero para a chave de leitura do ranking.
 * Ausente/inválido = null (combinado, campos planos). MALE/FEMALE/MIXED
 * = segmentado (by_gender.{G}).
 */
function resolveSegmentGender(g?: GameGender | null): GameGender | null {
  return g && SEGMENT_GENDERS.includes(g) ? g : null;
}

// #2276: interface tipada para o doc de season_participation (substitui Record<string, any>).
interface RawSeasonParticipation {
  userId?: string;
  level?: number;
  points?: number;
  gamesPlayed?: number;
  wins?: number;
  goals?: number;
  assists?: number;
  mvpCount?: number;
  division?: string;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

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
  canReceiveInvites?: boolean;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

// Busca dados de usuários em batch (chunks de 10)
// Privacy: jogadores com is_searchable=false ficam ocultos no ranking (#1027)
interface LeagueUserData {
  name: string;
  photoUrl: string | null;
  xp: number;
  favoriteTeam?: string;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

function addLeagueUser(usersMap: Map<string, LeagueUserData>, userId: string, raw: Record<string, unknown>) {
  if (raw.is_searchable === false || raw.isSearchable === false) return;

  const xp = (raw.experience_points ?? raw.experiencePoints ?? 0) as number;
  usersMap.set(userId, {
    name: (raw.name as string) || 'Jogador',
    photoUrl: (raw.photo_url as string) || (raw.photoUrl as string) || null,
    xp,
    favoriteTeam: (raw.favorite_team as string) || (raw.favoriteTeam as string) || undefined,
    isMock: raw.is_mock === true || raw.isMock === true,
    demoData: raw.demo_data === true || raw.demoData === true,
    dataOrigin: (raw.data_origin as string) || (raw.dataOrigin as string) || undefined,
    seedId: (raw.seed_id as string) || (raw.seedId as string) || undefined,
    demoDataReason: (raw.demo_data_reason as string) || (raw.demoDataReason as string) || undefined,
  });
}

async function fetchUserDataBatch(userIds: string[]): Promise<Map<string, LeagueUserData>> {
  const usersMap = new Map<string, LeagueUserData>();
  if (userIds.length === 0) return usersMap;

  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  // Usar allSettled para que falha em um chunk não derrube os demais
  const settled = await Promise.allSettled(
    chunks.flatMap((chunk) => [
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk), where('is_searchable', '==', true))),
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk), where('isSearchable', '==', true))),
    ])
  );

  for (const result of settled) {
    if (result.status === 'rejected') {
      logger.error('Falha ao ler chunk de usuários da liga (dados parciais):', result.reason);
      continue;
    }
    for (const docSnap of result.value.docs) {
      addLeagueUser(usersMap, docSnap.id, docSnap.data());
    }
  }

  return usersMap;
}

async function fetchSearchableUsers(): Promise<Map<string, LeagueUserData>> {
  const usersMap = new Map<string, LeagueUserData>();
  const settled = await Promise.allSettled([
    getDocs(query(collection(db, 'users'), where('is_searchable', '==', true))),
    getDocs(query(collection(db, 'users'), where('isSearchable', '==', true))),
  ]);

  for (const result of settled) {
    if (result.status === 'rejected') {
      logger.error('Falha ao ler usuários da liga (dados parciais):', result.reason);
      continue;
    }
    for (const docSnap of result.value.docs) {
      addLeagueUser(usersMap, docSnap.id, docSnap.data());
    }
  }

  return usersMap;
}

async function fetchGroupMemberUserIds(groupId: string): Promise<string[]> {
  const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
  return membersSnap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return (data.user_id as string) || (data.userId as string) || docSnap.id;
    })
    .filter(Boolean);
}

async function fetchLeagueUsers(filters?: LeagueFilters): Promise<Map<string, LeagueUserData>> {
  if (!filters?.groupId) {
    return fetchSearchableUsers();
  }

  const userIds = await fetchGroupMemberUserIds(filters.groupId);
  return fetchUserDataBatch([...new Set(userIds)]);
}

export interface LeagueFilters {
  groupId?: string | null;
  seasonId?: string | null;
  maxResults?: number;
  // Fase 4b: filtro de gênero. Ausente/inválido = combinado (campos
  // planos). MALE/FEMALE/MIXED = segmentado (by_gender.{G}).
  gender?: GameGender | null;
}

interface LeaguePage {
  players: LeaguePlayer[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

async function fetchLeagueData(
  currentUserId?: string,
  filters?: LeagueFilters,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<LeaguePage> {
  const seasonRef = collection(db, 'season_participation');

  // Combinado ordena pelo ponto plano; segmentado pelo ponto da
  // categoria (by_gender.{G}.points). Docs sem aquele gênero não têm o
  // campo → naturalmente excluídos da query.
  const segGender = resolveSegmentGender(filters?.gender);
  const orderField = segGender ? `by_gender.${segGender}.points` : 'points';

  const constraints: QueryConstraint[] = [
    orderBy(orderField, 'desc'),
  ];
  if (filters?.seasonId) {
    constraints.push(where('season_id', '==', filters.seasonId));
  }
  if (filters?.groupId) {
    constraints.push(where('group_id', '==', filters.groupId));
  }
  if (cursor) {
    constraints.push(startAfter(cursor));
  }
  const pageSize = filters?.maxResults ?? 200;
  constraints.push(limit(pageSize));

  const q = query(seasonRef, ...constraints);
  const [snapshot, usersMap] = await Promise.all([
    getDocs(q),
    fetchLeagueUsers(filters),
  ]);

  // Extrair dados de participação e IDs de usuários
  const participationData = snapshot.docs.map((docSnapshot) => {
    const raw = docSnapshot.data();
    const data = snakeToCamel<RawSeasonParticipation>(raw);
    const userId = data.userId || raw.user_id || docSnapshot.id;

    // Segmentado: stats vêm do sub-objeto by_gender.{G} (snake).
    // Combinado: campos planos (comportamento histórico).
    const seg = segGender
      ? ((raw.by_gender as Record<string, Record<string, number>> | undefined)?.[segGender] ?? {})
      : null;
    const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

    return {
      id: docSnapshot.id,
      userId,
      level: data.level || 1,
      points: seg ? num(seg.points) : data.points || 0,
      gamesPlayed: seg ? num(seg.games_played) : data.gamesPlayed || raw.games_played || 0,
      wins: seg ? num(seg.wins) : data.wins || 0,
      goals: seg ? num(seg.goals_scored) : data.goals || 0,
      assists: seg ? num(seg.assists) : data.assists || 0,
      mvpCount: seg ? num(seg.mvp_count) : data.mvpCount || raw.mvp_count || 0,
      division: (data.division || 'BRONZE') as LeagueDivision,
      isMock: data.isMock === true || raw.is_mock === true,
      demoData: data.demoData === true || raw.demo_data === true,
      dataOrigin: data.dataOrigin || raw.data_origin,
      seedId: data.seedId || raw.seed_id,
      demoDataReason: data.demoDataReason || raw.demo_data_reason,
    };
  });

  const participationByUser = new Map<string, typeof participationData[number]>();
  for (const participation of participationData) {
    const existing = participationByUser.get(participation.userId);
    if (!existing || participation.points > existing.points) {
      participationByUser.set(participation.userId, participation);
    }
  }

  // Combinar usuarios pesquisaveis com stats da temporada.
  // Quem ainda nao pontuou entra com zeros, mas continua visivel na Liga.
  const players: LeaguePlayer[] = Array.from(usersMap.entries()).map(([userId, userData]) => {
    const participation = participationByUser.get(userId);
    return {
      id: participation?.id ?? userId,
      userId,
      userName: userData.name,
      userPhoto: userData.photoUrl || undefined,
      favoriteTeam: userData.favoriteTeam,
      level: getLevelForXp(userData.xp),
      points: participation?.points ?? 0,
      gamesPlayed: participation?.gamesPlayed ?? 0,
      wins: participation?.wins ?? 0,
      goals: participation?.goals ?? 0,
      assists: participation?.assists ?? 0,
      mvpCount: participation?.mvpCount ?? 0,
      division: participation?.division ?? 'BRONZE',
      experiencePoints: userData.xp,
      isCurrentUser: userId === currentUserId,
      canReceiveInvites: true,
      isMock: userData.isMock === true || participation?.isMock === true,
      demoData: userData.demoData === true || participation?.demoData === true,
      dataOrigin: userData.dataOrigin || (participation?.dataOrigin as string | undefined),
      seedId: userData.seedId || (participation?.seedId as string | undefined),
      demoDataReason: userData.demoDataReason || (participation?.demoDataReason as string | undefined),
    };
  });

  return {
    players: players.sort((a, b) =>
      b.points - a.points ||
      (b.experiencePoints ?? 0) - (a.experiencePoints ?? 0) ||
      a.userName.localeCompare(b.userName)
    ),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: false,
  };
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

  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
    error: queryError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['league', currentUserId, filters?.groupId, filters?.seasonId, filters?.maxResults, filters?.gender],
    queryFn: ({ pageParam }) => fetchLeagueData(currentUserId, filters, pageParam),
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000,
    enabled,
  });

  const players = data?.pages.flatMap((page) => page.players) ?? [];

  // Listener real-time: único por seasonId/groupId (sem division)
  // Usa showErrorRef para não recriar listener quando showError muda
  useEffect(() => {
    if (!enabled) return;

    const seasonRef = collection(db, 'season_participation');
    const segGender = resolveSegmentGender(filters?.gender);
    const listenerOrderField = segGender ? `by_gender.${segGender}.points` : 'points';
    const listenerConstraints: QueryConstraint[] = [
      orderBy(listenerOrderField, 'desc'),
      limit(filters?.maxResults ?? 200)
    ];
    if (filters?.seasonId) {
      listenerConstraints.push(where('season_id', '==', filters.seasonId));
    }
    if (filters?.groupId) {
      listenerConstraints.push(where('group_id', '==', filters.groupId));
    }
    const q = query(seasonRef, ...listenerConstraints);
    let isFirstSeasonSnapshot = true;
    let isFirstBaseSnapshot = true;

    const invalidateLeague = (source: 'season' | 'base') => {
      if (source === 'season' && isFirstSeasonSnapshot) {
        isFirstSeasonSnapshot = false;
        return;
      }
      if (source === 'base' && isFirstBaseSnapshot) {
        isFirstBaseSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ['league', currentUserId, filters?.groupId, filters?.seasonId, filters?.maxResults, filters?.gender],
      });
    };

    const unsubscribeSeason = onSnapshot(q, () => invalidateLeague('season'), (err) => {
      logger.error('Error in league listener:', err);
      setListenerError(err.message);
      showErrorRef.current('Erro ao carregar ranking em tempo real');
    });

    const handleBaseSnapshotError = (err: Error) => {
      logger.error('Error in league users listener:', err);
      setListenerError(err.message);
      showErrorRef.current('Erro ao carregar jogadores da liga em tempo real');
    };
    const unsubscribeBase = filters?.groupId
      ? [
          onSnapshot(
            collection(db, 'groups', filters.groupId, 'members'),
            () => invalidateLeague('base'),
            handleBaseSnapshotError,
          ),
        ]
      : [
          onSnapshot(
            query(collection(db, 'users'), where('is_searchable', '==', true)),
            () => invalidateLeague('base'),
            handleBaseSnapshotError,
          ),
          onSnapshot(
            query(collection(db, 'users'), where('isSearchable', '==', true)),
            () => invalidateLeague('base'),
            handleBaseSnapshotError,
          ),
        ];

    return () => {
      unsubscribeSeason();
      unsubscribeBase.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient, currentUserId, filters?.seasonId, filters?.groupId, filters?.maxResults, filters?.gender, enabled]);

  const error = listenerError || (queryError ? (queryError as Error).message : null);

  return {
    players,
    loading,
    error,
    refetch,
    loadMore: fetchNextPage,
    hasMore: hasNextPage === true,
    loadingMore,
  };
};
