import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getCompletedWeekKey } from '../utils/weeklyRankingWeek';

interface WeeklyRankingPlayer {
  userId: string;
  userName: string;
  userPhoto?: string;
  points: number;
  goals: number;
  assists: number;
  saves: number;
  presence: number;
  mvp: number;
  wins: number;
  draws: number;
  bolaMurcha: number;
}

interface WeeklyRanking {
  weekKey: string;
  startDate: Date;
  endDate: Date;
  rankings: WeeklyRankingPlayer[];
  totalGames: number;
}

/**
 * #2251: expõe INTENCIONALMENTE o resultado bruto de useQuery
 * (data/isLoading/error/refetch). Consumidores usam a API do TanStack Query.
 * Não envolver no contrato { data, loading, error }.
 */
export function useWeeklyRanking() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const weekKey = getCompletedWeekKey();

  return useQuery({
    queryKey: ['weekly-ranking', weekKey],
    queryFn: async () => {
      const ref = doc(db, 'weekly-rankings', weekKey);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        weekKey: data.week_key,
        startDate: data.start_date?.toDate(),
        endDate: data.end_date?.toDate(),
        rankings: data.rankings || [],
        totalGames: data.total_games || 0,
      } as WeeklyRanking;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!uid,
  });
}
