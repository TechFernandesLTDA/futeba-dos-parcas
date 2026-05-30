import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UserBadge {
  badgeId: string;
  name: string;
  icon: string;
  description: string;
  type: string;
  earnedAt: Date;
  earned: boolean;
}

/**
 * #2251: expõe INTENCIONALMENTE o resultado bruto de useQuery
 * (data/isLoading/error/refetch). Consumidores usam a API do TanStack Query.
 * Não envolver no contrato { data, loading, error }.
 */
export function useUserBadges(userId?: string) {
  const { user } = useAuth();
  const uid = userId || user?.id || '';

  return useQuery({
    queryKey: ['user-badges', uid],
    queryFn: async () => {
      if (!uid) return [];
      const ref = collection(db, 'users', uid, 'badges');
      const q = query(ref, orderBy('earned_at', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          badgeId: data.badge_id || d.id,
          name: data.name || '',
          icon: data.icon || '',
          description: data.description || '',
          type: data.type || '',
          earnedAt: data.earned_at?.toDate() || new Date(),
          earned: data.earned !== false,
        } as UserBadge;
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!uid,
  });
}
