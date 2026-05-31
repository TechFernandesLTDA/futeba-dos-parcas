import { useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';

interface PopularTime {
  time: string;
  count: number;
  percentage: number;
}

async function fetchPopularTimes(fieldId: string): Promise<PopularTime[]> {
  if (!fieldId) return [];

  const gamesRef = collection(db, 'games');
  const q = query(
    gamesRef,
    where('field_id', '==', fieldId),
    where('status', '!=', 'CANCELLED'),
    orderBy('status'),
    orderBy('date', 'desc'),
    limit(30),
  );

  const snapshot = await getDocs(q);
  const timeCounts = new Map<string, number>();
  let total = 0;

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const time = data.time as string;
    if (time) {
      timeCounts.set(time, (timeCounts.get(time) || 0) + 1);
      total++;
    }
  });

  return Array.from(timeCounts.entries())
    .map(([time, count]) => ({
      time,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export function usePopularTimes(fieldId: string) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['popular-times', fieldId],
    queryFn: () => fetchPopularTimes(fieldId),
    enabled: !!fieldId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const popularTimes = useMemo(() => data, [data]);

  return { popularTimes, loading: isLoading, error: error ? (error as Error).message : null };
}

export function getAverageDuration(fieldId: string, popularTimes: PopularTime[]): number {
  const duration = popularTimes.length > 0 ? 120 : 60;
  return duration;
}
