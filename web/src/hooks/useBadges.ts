import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { UserBadge, BadgeDefinition, BADGE_DEFINITIONS } from '../types/gamification';

export const useBadges = (userId?: string) => {
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBadges(BADGE_DEFINITIONS);
    
    if (!userId) {
      setLoading(false);
      return;
    }

    const badgesRef = collection(db, 'user_badges');
    const q = query(badgesRef, where('user_id', '==', userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        const converted = snakeToCamel(raw);
        return {
          id: d.id,
          ...converted,
          unlockedAt: (raw.unlocked_at || raw.unlockedAt)?.toDate?.() || new Date(),
        };
      }) as UserBadge[];

      setUserBadges(data);
      setUnlockedIds(new Set(data.map((b) => b.badgeId)));
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { badges, userBadges, unlockedIds, loading, error };
};
