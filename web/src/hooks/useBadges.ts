import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { UserBadge, BadgeDefinition, BADGE_DEFINITIONS } from '../types/gamification';

// #1330: cap deliberado na leitura de badges. Um usuário detém no máx 1 badge
// por definição (BADGE_DEFINITIONS = 25); 50 dá folga p/ futuras badges sem
// risco de perda silenciosa de dados. Evita query Firestore ilimitada.
const BADGES_QUERY_LIMIT = 50;

// Busca badges desbloqueadas do usuário
async function fetchUserBadges(userId: string): Promise<{
  userBadges: UserBadge[];
  unlockedIds: Set<string>;
}> {
  const badgesRef = collection(db, 'user_badges');
  const q = query(badgesRef, where('user_id', '==', userId), limit(BADGES_QUERY_LIMIT));
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
  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['badges', userId],
    queryFn: () => fetchUserBadges(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos - badges mudam raramente
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false, // listener real-time abaixo já invalida quando necessário
  });

  const badges: BadgeDefinition[] = BADGE_DEFINITIONS;
  const userBadges: UserBadge[] = data?.userBadges ?? [];
  const unlockedIds: Set<string> = data?.unlockedIds ?? new Set();
  const error = queryError ? (queryError as Error).message : null;

  return { badges, userBadges, unlockedIds, loading, error };
};
