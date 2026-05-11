import { useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { UserBadge, BadgeDefinition, BADGE_DEFINITIONS } from '../types/gamification';
import { createLogger } from '../utils/logger';

const logger = createLogger('useBadges');

// Busca badges desbloqueadas do usuário
async function fetchUserBadges(userId: string): Promise<{
  userBadges: UserBadge[];
  unlockedIds: Set<string>;
}> {
  const badgesRef = collection(db, 'user_badges');
  const q = query(badgesRef, where('user_id', '==', userId));
  const snapshot = await getDocs(q);

  const data = snapshot.docs.map((d) => {
    const raw = d.data();
    const converted = snakeToCamel(raw);
    return {
      id: d.id,
      ...converted,
      unlockedAt: ((raw.unlocked_at || raw.unlockedAt) as { toDate?: () => Date })?.toDate?.() || new Date(),
    };
  }) as UserBadge[];

  return {
    userBadges: data,
    unlockedIds: new Set(data.map((b) => b.badgeId)),
  };
}

export const useBadges = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['badges', userId],
    queryFn: () => fetchUserBadges(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos - badges mudam raramente
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false, // listener real-time abaixo já invalida quando necessário
  });

  // Listener real-time para invalidar cache quando novas badges são desbloqueadas
  useEffect(() => {
    if (!userId) return;

    const badgesRef = collection(db, 'user_badges');
    const q = query(badgesRef, where('user_id', '==', userId));
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['badges', userId] });
    }, (err) => {
      logger.error('Error in badges listener:', err);
    });

    return () => unsubscribe();
  }, [userId, queryClient]);

  const badges: BadgeDefinition[] = BADGE_DEFINITIONS;
  const userBadges: UserBadge[] = data?.userBadges ?? [];
  const unlockedIds: Set<string> = data?.unlockedIds ?? new Set();
  const error = queryError ? (queryError as Error).message : null;

  return { badges, userBadges, unlockedIds, loading, error };
};
