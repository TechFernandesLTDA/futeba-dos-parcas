import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

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

function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

/**
 * #2251: expõe INTENCIONALMENTE o resultado bruto de useQuery
 * (data/isLoading/error/refetch). Consumidores usam a API do TanStack Query.
 * Não envolver no contrato { data, loading, error }.
 */
export function useWeeklyRanking() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  return useQuery({
    queryKey: ['weekly-ranking', getWeekKey()],
    queryFn: async () => {
      const weekKey = getWeekKey();
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
