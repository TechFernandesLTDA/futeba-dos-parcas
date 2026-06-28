import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { UserStats } from '../types/user';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { normalizePlayerStats } from '../utils/playerStats';

const logger = createLogger('useStatistics');

interface UseStatisticsResult {
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useStatistics(userId: string | undefined): UseStatisticsResult {
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [userSnap, statsSnap, streakSnap] = await Promise.all([
        getDoc(doc(db, 'users', userId)),
        getDoc(doc(db, 'statistics', userId)),
        getDocs(query(collection(db, 'user_streaks'), where('user_id', '==', userId), limit(1))),
      ]);
      if (cancelledRef.current) return;
      if (userSnap.exists() || statsSnap.exists()) {
        const userRaw = userSnap.exists() ? userSnap.data() : {};
        const userData = snakeToCamel<Record<string, unknown>>(userRaw);
        const statsRaw = statsSnap.exists() ? statsSnap.data() : undefined;
        const streakRaw = streakSnap.docs[0]?.data();
        const normalized = normalizePlayerStats(
          { ...(statsRaw ?? {}), ...(streakRaw ?? {}) },
          userRaw,
          userId,
        );

        setStats({
          ...normalized,
          level: (userData.level as number) ?? normalized.level,
          experiencePoints: (userData.experiencePoints as number) ?? normalized.experiencePoints,
        } as UserStats);
      } else {
        setStats(null);
      }
    } catch (err) {
      if (cancelledRef.current) return;
      logger.error('Error loading stats:', err);
      setError(t('feedback.statistics.loadError'));
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [userId, t]);

  useEffect(() => {
    cancelledRef.current = false;
    if (userId) {
      fetchStats();
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [userId, fetchStats]);

  const retry = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, retry };
}
