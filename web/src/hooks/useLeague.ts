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

async function fetchUserDataBatch(userIds: string[]): Promise<Map<string, LeagueUserData>> {
  const usersMap = new Map<string, LeagueUserData>();
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
        isMock: d.is_mock === true || d.isMock === true,
        demoData: d.demo_data === true || d.demoData === true,
        dataOrigin: (d.data_origin as string) || (d.dataOrigin as string) || undefined,
        seedId: (d.seed_id as string) || (d.seedId as string) || undefined,
        demoDataReason: (d.demo_data_reason as string) || (d.demoDataReason as string) || undefined,
      });
    }
  }

  return usersMap;
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
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { players: [], lastDoc: null, hasMore: false };
  }

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
      canReceiveInvites: true,
      isMock: userData.isMock === true || p.isMock === true,
      demoData: userData.demoData === true || p.demoData === true,
      dataOrigin: userData.dataOrigin || (p.dataOrigin as string | undefined),
      seedId: userData.seedId || (p.seedId as string | undefined),
      demoDataReason: userData.demoDataReason || (p.demoDataReason as string | undefined),
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
  return {
    players: Array.from(uniqueMap.values()),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.docs.length === pageSize,
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
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ['league', currentUserId, filters?.groupId, filters?.seasonId, filters?.maxResults, filters?.gender],
      });
    }, (err) => {
      logger.error('Error in league listener:', err);
      setListenerError(err.message);
      showErrorRef.current('Erro ao carregar ranking em tempo real');
    });

    return () => unsubscribe();
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
