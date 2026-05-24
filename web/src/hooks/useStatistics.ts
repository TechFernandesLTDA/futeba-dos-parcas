import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { UserStats } from '../types/user';
import { createLogger } from '../utils/logger';

const logger = createLogger('useStatistics');

interface UseStatisticsResult {
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useStatistics(userId: string | undefined): UseStatisticsResult {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userRef);
      if (cancelledRef.current) return;
      if (docSnap.exists()) {
        setStats(snakeToCamel(docSnap.data()) as UserStats);
      } else {
        setStats(null);
      }
    } catch (err) {
      if (cancelledRef.current) return;
      logger.error('Error loading stats:', err);
      setError('Erro ao carregar estatísticas');
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

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
