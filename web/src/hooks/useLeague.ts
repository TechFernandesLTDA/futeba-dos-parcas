import { useEffect, useMemo, useState, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { getLeaguePlayers } from '../services/cloudFunctions';
import { LeagueDivision, normalizeLeagueDivision } from '../types/gamification';
import type { GameGender } from '../types/game';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';

const logger = createLogger('useLeague');

export type LeagueSortField =
  | 'experiencePoints'
  | 'points'
  | 'name'
  | 'gamesPlayed'
  | 'wins'
  | 'goals'
  | 'assists'
  | 'mvpCount'
  | 'losses'
  | 'winRate';

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
  draws?: number;
  losses?: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: LeagueDivision;
  leagueRating?: number;
  isCurrentUser?: boolean;
  experiencePoints?: number;
  canReceiveInvites?: boolean;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
}

export interface LeagueFilters {
  groupId?: string | null;
  seasonId?: string | null;
  maxResults?: number;
  // Fase 4b: filtro de gênero. Ausente/inválido = combinado (campos
  // planos). MALE/FEMALE/MIXED = segmentado (by_gender.{G}).
  gender?: GameGender | null;
  search?: string | null;
  sortField?: LeagueSortField | null;
  sortDirection?: 'asc' | 'desc' | null;
}

interface LeaguePage {
  players: LeaguePlayer[];
  hasMore: boolean;
  nextPageToken: string | null;
  totalCount: number;
}

async function fetchLeagueData(
  currentUserId?: string,
  filters?: LeagueFilters,
  pageToken?: string | null,
): Promise<LeaguePage> {
  const response = await getLeaguePlayers({
    seasonId: filters?.seasonId ?? null,
    groupId: filters?.groupId ?? null,
    limit: filters?.maxResults ?? 200,
    gender: resolveSegmentGender(filters?.gender),
    search: filters?.search ?? null,
    sortField: filters?.sortField ?? 'experiencePoints',
    sortDirection: filters?.sortDirection ?? 'desc',
    pageToken: pageToken ?? null,
  });

  return {
    players: response.data.players.map((player) => ({
      ...player,
      division: normalizeLeagueDivision(player.division),
      isCurrentUser: player.userId === currentUserId,
    })),
    hasMore: response.data.hasMore === true,
    nextPageToken: response.data.nextPageToken ?? null,
    totalCount: response.data.totalCount ?? response.data.players.length,
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
    queryKey: [
      'league',
      currentUserId,
      filters?.groupId,
      filters?.seasonId,
      filters?.maxResults,
      filters?.gender,
      filters?.search,
      filters?.sortField,
      filters?.sortDirection,
    ],
    queryFn: ({ pageParam }) => fetchLeagueData(currentUserId, filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPageToken : undefined,
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000,
    // Anti-flicker: trocar filtro/ordenação/busca/divisão muda a queryKey e
    // trocava a lista inteira por skeletons. Com keepPreviousData a lista
    // anterior permanece visível enquanto a nova página chega.
    placeholderData: keepPreviousData,
    // O listener em tempo real já invalida o ranking quando os dados mudam.
    // Evita uma segunda chamada apenas por retornar à janela do navegador.
    refetchOnWindowFocus: false,
    enabled,
  });

  // Mantém a referência estável entre renders sem mudança de dados. A tela da
  // Liga deriva filtros, posições e contadores desta lista.
  const players = useMemo(
    () => data?.pages.flatMap((page) => page.players) ?? [],
    [data?.pages],
  );

  // Listener real-time: único por seasonId/groupId (sem division)
  // Usa showErrorRef para não recriar listener quando showError muda
  useEffect(() => {
    if (!enabled) {
      setListenerError(null);
      return;
    }

    let isFirstSeasonSnapshot = true;
    let isFirstMemberSnapshot = true;

    const invalidateLeague = () => {
      if (isFirstSeasonSnapshot) {
        isFirstSeasonSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ['league', currentUserId],
      });
    };

    const unsubscribers: Array<() => void> = [];

    if (filters?.seasonId) {
      const seasonRef = collection(db, 'season_participation');
      const segGender = resolveSegmentGender(filters?.gender);
      const listenerOrderField = segGender ? `by_gender.${segGender}.points` : 'points';
      const listenerConstraints: QueryConstraint[] = [
        where('season_id', '==', filters.seasonId),
        orderBy(listenerOrderField, 'desc'),
        limit(filters?.maxResults ?? 200)
      ];
      if (filters?.groupId) {
        listenerConstraints.push(where('group_id', '==', filters.groupId));
      }
      const q = query(seasonRef, ...listenerConstraints);
      unsubscribers.push(onSnapshot(
        q,
        () => {
          setListenerError(null);
          invalidateLeague();
        },
        (err) => {
          logger.error('Error in league listener:', err);
          setListenerError(err.message);
          showErrorRef.current('Erro ao carregar ranking em tempo real');
        },
      ));
    }

    const handleBaseSnapshotError = (err: Error) => {
      logger.error('Error in league base listener:', err);
      setListenerError(err.message);
      showErrorRef.current('Erro ao atualizar jogadores da liga em tempo real');
    };
    if (filters?.groupId) {
      unsubscribers.push(onSnapshot(
        collection(db, 'groups', filters.groupId, 'members'),
        () => {
          setListenerError(null);
          if (isFirstMemberSnapshot) {
            isFirstMemberSnapshot = false;
            return;
          }
          queryClient.invalidateQueries({
            queryKey: ['league', currentUserId],
          });
        },
        handleBaseSnapshotError,
      ));
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient, currentUserId, filters?.seasonId, filters?.groupId, filters?.maxResults, filters?.gender, enabled]);

  const error = listenerError || (queryError ? (queryError as Error).message : null);
  const totalCount = data?.pages[0]?.totalCount ?? players.length;

  return {
    players,
    totalCount,
    loading,
    error,
    refetch,
    loadMore: fetchNextPage,
    hasMore: hasNextPage === true,
    loadingMore,
  };
};
