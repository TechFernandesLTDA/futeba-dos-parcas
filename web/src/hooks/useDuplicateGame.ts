import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { useTranslation } from 'react-i18next';

interface RecentGame {
  id: string;
  locationId: string;
  locationName: string;
  fieldId?: string;
  fieldName?: string;
  date: string;
  time: string;
  endTime?: string;
  fieldType: string;
  maxPlayers: number;
  maxGoalkeepers: number;
  numberOfTeams: number;
  dailyPrice: number;
  totalCost: number;
  priceManualOverride?: boolean;
  visibility: string;
  groupId?: string;
  groupName?: string;
  rules: string;
  recurrence: string;
}

export function useDuplicateGame() {
  const { t } = useTranslation();
  const { firebaseUser, user } = useAuth();
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadRecentGames = useCallback(async () => {
    const uid = firebaseUser?.uid || user?.id;
    if (!uid) return;

    if (!cancelledRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const gamesRef = collection(db, 'games');
      const q = query(
        gamesRef,
        where('owner_id', '==', uid),
        where('status', '!=', 'CANCELLED'),
        orderBy('status'),
        orderBy('date', 'desc'),
        limit(10),
      );

      const snapshot = await getDocs(q);
      const games: RecentGame[] = snapshot.docs.map((d) => {
        const raw = snakeToCamel(d.data() as Record<string, unknown>) as Record<string, unknown>;
        return {
          id: d.id,
          locationId: (raw.locationId as string) || '',
          locationName: (raw.locationName as string) || '',
          fieldId: raw.fieldId as string | undefined,
          fieldName: raw.fieldName as string | undefined,
          date: (raw.date as string) || '',
          time: (raw.time as string) || '',
          endTime: raw.endTime as string | undefined,
          fieldType: (raw.fieldType as string) || 'SOCIETY',
          maxPlayers: (raw.maxPlayers as number) || 14,
          maxGoalkeepers: (raw.maxGoalkeepers as number) || 2,
          numberOfTeams: (raw.numberOfTeams as number) || 2,
          dailyPrice: (raw.dailyPrice as number) || 0,
          totalCost: (raw.totalCost as number) || 0,
          priceManualOverride: raw.priceManualOverride as boolean | undefined,
          visibility: (raw.visibility as string) || 'PUBLIC_CLOSED',
          groupId: raw.groupId as string | undefined,
          groupName: raw.groupName as string | undefined,
          rules: (raw.rules as string) || '',
          recurrence: (raw.recurrence as string) || 'none',
        };
      });

      if (!cancelledRef.current) setRecentGames(games);
    } catch {
      if (!cancelledRef.current) {
        setError(t('feedback.duplicateGame.loadRecentError'));
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [firebaseUser?.uid, user?.id, t]);

  useEffect(() => {
    cancelledRef.current = false;
    loadRecentGames();
    return () => {
      cancelledRef.current = true;
    };
  }, [firebaseUser?.uid, user?.id, loadRecentGames]);

  return { recentGames, loading, error, refetch: loadRecentGames };
}
