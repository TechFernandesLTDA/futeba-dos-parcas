import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Game } from '../types/game';

/**
 * Hook otimizado para buscar apenas o próximo jogo (HomeTab).
 * Diferente de useGames() que busca 50 jogos, este busca apenas 1.
 * Reduz tempo de carregamento de ~500ms para ~100ms.
 */
export function useNextGame() {
  const { user } = useAuth();

  const { data: nextGame = null, isLoading } = useQuery<Game | null>({
    queryKey: ['nextGame', user?.id],
    queryFn: async () => {
      const gamesRef = collection(db, 'games');
      const q = query(
        gamesRef,
        where('status', 'in', ['SCHEDULED', 'CONFIRMED', 'LIVE']),
        orderBy('dateTime', 'asc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const docSnap = snapshot.docs[0];
      const raw = docSnap.data();
      const converted = snakeToCamel(raw);
      
      return {
        id: docSnap.id,
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
    },
    enabled: !!user?.id,
    staleTime: 60_000, // 1 minuto
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { nextGame, isLoading };
}
