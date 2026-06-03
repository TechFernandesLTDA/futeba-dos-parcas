import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RatingHistoryEntry } from '../types/user';
import { useTranslation } from 'react-i18next';

export function useRatingHistory(userId: string | null | undefined) {
  const [history, setHistory] = useState<RatingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'users', userId, 'rating_history'),
          orderBy('calculatedAt', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;

        const entries: RatingHistoryEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          calculatedAt: doc.data().calculatedAt?.toDate() || new Date(),
        })) as RatingHistoryEntry[];

        setHistory(entries);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('feedback.ratingHistory.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [userId, t]);

  return { history, loading, error };
}
