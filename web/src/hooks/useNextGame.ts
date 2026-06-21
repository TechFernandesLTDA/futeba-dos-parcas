import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Game } from '../types/game';
import { getGameStartDate, isUpcomingGame, UPCOMING_GAME_STATUSES } from '../utils/gameLifecycle';

function toGame(id: string, raw: Record<string, unknown>): Game {
  const converted = snakeToCamel<Record<string, unknown>>(raw);

  return {
    id,
    ...converted,
    dateTime: (raw.dateTime as { toDate?: () => Date })?.toDate?.() ||
              (raw.date_time as { toDate?: () => Date })?.toDate?.() ||
              converted.dateTime,
    createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.(),
    updatedAt: ((raw.updated_at || raw.updatedAt) as { toDate?: () => Date })?.toDate?.(),
    votingDeadline: ((raw.voting_deadline || raw.votingDeadline) as { toDate?: () => Date })?.toDate?.(),
    xpProcessedAt: ((raw.xp_processed_at || raw.xpProcessedAt) as { toDate?: () => Date })?.toDate?.(),
    deletedAt: ((raw.deleted_at || raw.deletedAt) as { toDate?: () => Date })?.toDate?.(),
  } as Game;
}

/**
 * Hook otimizado para buscar o próximo jogo do usuário atual.
 * Considera jogos organizados pelo usuário e jogos onde ele tem confirmação ativa.
 */
export function useNextGame() {
  const { user } = useAuth();

  const { data: nextGame = null, isLoading } = useQuery<Game | null>({
    queryKey: ['nextGame', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const now = new Date();
      const ownedGamesQuery = query(
        collection(db, 'games'),
        where('owner_id', '==', user.id),
        where('status', 'in', [...UPCOMING_GAME_STATUSES]),
        where('dateTime', '>=', Timestamp.fromDate(now)),
        orderBy('dateTime', 'asc'),
        limit(10)
      );

      const confirmationsQuery = query(
        collection(db, 'confirmations'),
        where('user_id', '==', user.id),
        where('status', 'in', ['CONFIRMED', 'ON_THE_WAY', 'CHECKED_IN']),
        limit(50)
      );

      const [ownedSnapshot, confirmationsSnapshot] = await Promise.all([
        getDocs(ownedGamesQuery),
        getDocs(confirmationsQuery),
      ]);

      const candidates: Game[] = ownedSnapshot.docs.map((docSnap) => toGame(docSnap.id, docSnap.data()));
      const confirmedGameIds = [
        ...new Set(confirmationsSnapshot.docs.map((docSnap) => String(docSnap.data().game_id || '')).filter(Boolean)),
      ];

      const confirmedGames = await Promise.all(
        confirmedGameIds.map(async (gameId) => {
          const gameSnap = await getDoc(doc(db, 'games', gameId));
          if (!gameSnap.exists()) return null;
          return toGame(gameSnap.id, gameSnap.data());
        })
      );

      for (const game of confirmedGames) {
        if (game) candidates.push(game);
      }

      return candidates
        .filter((game) => !game.deletedAt && isUpcomingGame(game, now))
        .sort((a, b) => {
          const dateA = getGameStartDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const dateB = getGameStartDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return dateA - dateB;
        })[0] ?? null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { nextGame, isLoading };
}
