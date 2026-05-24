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
        const snap = await getDocs(
          query(collection(db, 'seasons'), where('isActive', '==', true), limit(1))
        );
        return snap.docs[0]?.id || null;
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
