import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { db } from '../services/firebase';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useFieldGames');

const DEFAULT_GAME_DURATION_MINUTES = 60;

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export interface FieldGame {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export interface FieldGameSet {
  byDate: Map<string, FieldGame[]>;
  fullyBookedDates: Set<string>;
  conflictDates: Set<string>;
}

export function useFieldGames(fieldId: string, daysAhead: number = 60) {
  const { t } = useTranslation();
  const [data, setData] = useState<FieldGameSet>({
    byDate: new Map(),
    fullyBookedDates: new Set(),
    conflictDates: new Set(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!fieldId) {
      setData({ byDate: new Map(), fullyBookedDates: new Set(), conflictDates: new Set() });
      return;
    }

    cancelledRef.current = false;
    const fetchGames = async () => {
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const startDate = format(today, 'yyyy-MM-dd');
        const endDate = format(addDays(today, daysAhead), 'yyyy-MM-dd');

        const gamesRef = collection(db, 'games');
        const q = query(
          gamesRef,
          where('field_id', '==', fieldId),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
        );

        const snapshot = await getDocs(q);

        if (cancelledRef.current) return;

        const byDate = new Map<string, FieldGame[]>();

        snapshot.docs.forEach((d) => {
          const g = d.data();
          if (g.status === 'CANCELLED') return;
          const gDate = g.date as string;
          const gStart = g.time ? parseTime(g.time as string) : 0;
          const gEnd = g.end_time ? parseTime(g.end_time as string) : gStart + DEFAULT_GAME_DURATION_MINUTES;

          if (!byDate.has(gDate)) byDate.set(gDate, []);
          byDate.get(gDate)!.push({ date: gDate, startMinutes: gStart, endMinutes: gEnd });
        });

        const fullyBookedDates = new Set<string>();
        const conflictDates = new Set<string>();

        for (const [date, games] of byDate) {
          games.sort((a, b) => a.startMinutes - b.startMinutes);

          let bookedSlots = 0;
          let lastEnd = 6 * 60;
          for (const g of games) {
            if (g.startMinutes > lastEnd) {
              bookedSlots += g.startMinutes - lastEnd;
            }
            lastEnd = Math.max(lastEnd, g.endMinutes);
          }
          const dayEnd = 23 * 60;
          if (lastEnd < dayEnd) bookedSlots += dayEnd - lastEnd;

          if (bookedSlots <= 0) fullyBookedDates.add(date);
          if (games.length >= 1) conflictDates.add(date);
        }

        if (!cancelledRef.current) {
          setData({ byDate, fullyBookedDates, conflictDates });
        }
      } catch (err) {
        if (cancelledRef.current) return;
        logger.error('Error fetching field games:', err);
        setError(t('feedback.fieldGames.loadError'));
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    };

    fetchGames();
    return () => { cancelledRef.current = true; };
  }, [fieldId, daysAhead, t]);

  return { data, loading, error };
}
