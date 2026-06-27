import { useCallback, useState } from 'react';
import { doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getEndOfToday } from '../utils/lookingForGameToday';

export function useLookingForGameToday(userId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLookingForGameToday = useCallback(async (enabled: boolean) => {
    if (!userId) {
      throw new Error('Missing authenticated user');
    }

    setLoading(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'users', userId), {
        looking_for_game_today: enabled,
        looking_for_game_today_until: enabled ? Timestamp.fromDate(getEndOfToday()) : null,
        looking_for_game_today_updated_at: serverTimestamp(),
      });
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { setLookingForGameToday, loading, error };
}
