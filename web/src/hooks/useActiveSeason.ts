import { useQuery } from '@tanstack/react-query';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('useActiveSeason');

/**
 * Hook compartilhado para buscar a temporada ativa.
 * Usado por LeagueScreen, RankingScreen e RankingsTab.
 * 
 * Cache de 10 minutos (staleTime) para evitar queries repetidas.
 * Retorna { seasonId, loading, error }.
 */
export function useActiveSeason() {
  const { data: seasonId = null, isLoading: loading, error } = useQuery<string | null, Error>({
    queryKey: ['activeSeason'],
    queryFn: async () => {
      try {
        const [camelResult, snakeResult] = await Promise.allSettled([
          getDocs(query(collection(db, 'seasons'), where('isActive', '==', true), limit(1))),
          getDocs(query(collection(db, 'seasons'), where('is_active', '==', true), limit(1))),
        ]);

        if (camelResult.status === 'fulfilled' && !camelResult.value.empty) {
          return camelResult.value.docs[0].id;
        }
        if (snakeResult.status === 'fulfilled' && !snakeResult.value.empty) {
          return snakeResult.value.docs[0].id;
        }

        const rejected = [camelResult, snakeResult]
          .find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (rejected) throw rejected.reason;

        return null;
      } catch (err) {
        logger.error('Error fetching active season:', err);
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    retry: 2,
  });

  return { seasonId, loading, error };
}
