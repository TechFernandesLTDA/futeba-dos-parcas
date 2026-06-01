import { useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface HabitualTime {
  dayOfWeek: number;
  dayLabel: string;
  time: string;
  count: number;
}

const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

async function fetchHabitualTime(
  uid: string,
  locationId: string,
): Promise<HabitualTime | null> {
  if (!uid || !locationId) return null;

  const gamesRef = collection(db, 'games');
  const q = query(
    gamesRef,
    where('owner_id', '==', uid),
    where('location_id', '==', locationId),
    where('status', '!=', 'CANCELLED'),
    orderBy('status'),
    orderBy('date', 'desc'),
    limit(30),
  );

  const snapshot = await getDocs(q);

  const patternMap = new Map<string, { dayOfWeek: number; time: string; count: number }>();

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const date = data.date as string;
    const time = data.time as string;
    if (!date || !time) return;

    const [year, month, day] = date.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    const key = `${dayOfWeek}_${time}`;
    const existing = patternMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      patternMap.set(key, { dayOfWeek, time, count: 1 });
    }
  });

  if (patternMap.size === 0) return null;

  const sorted = Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
  const top = sorted[0];

  if (top.count < 2) return null;

  return {
    dayOfWeek: top.dayOfWeek,
    dayLabel: DAY_LABELS[top.dayOfWeek] || '',
    time: top.time,
    count: top.count,
  };
}

export function useHabitualTime(locationId: string) {
  const { firebaseUser, user } = useAuth();
  const uid = firebaseUser?.uid || user?.id;

  const { data = null, isLoading, error } = useQuery({
    queryKey: ['habitual-time', uid, locationId],
    queryFn: () => fetchHabitualTime(uid!, locationId),
    enabled: !!uid && !!locationId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const habitualTime = useMemo(() => data, [data]);

  return { habitualTime, loading: isLoading, error: error ? (error as Error).message : null };
}
