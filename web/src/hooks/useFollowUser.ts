import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/firebase';
import { toggleFollowUser } from '../services/cloudFunctions';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { createLogger } from '../utils/logger';

const logger = createLogger('useFollowUser');

export function useFollowUser(targetUserId?: string | null) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const currentUserId = currentUser?.uid ?? null;
  const canFollow = !!currentUserId && !!targetUserId && currentUserId !== targetUserId;

  useEffect(() => {
    if (!canFollow || !currentUserId || !targetUserId) {
      setFollowing(false);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'users', currentUserId, 'following', targetUserId),
      (snapshot) => {
        setFollowing(snapshot.exists());
        setLoading(false);
      },
      (err) => {
        logger.error('Erro ao observar follow:', err);
        showError(getFirestoreErrorMessage(err));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [canFollow, currentUserId, showError, targetUserId]);

  const toggle = useCallback(async () => {
    if (!canFollow || !targetUserId || updating) return;

    const next = !following;
    setUpdating(true);
    setFollowing(next);
    try {
      const result = await toggleFollowUser({ targetUserId, follow: next });
      setFollowing(result.data.following);
      showSuccess(result.data.following ? t('follow.followed') : t('follow.unfollowed'));
    } catch (err) {
      setFollowing(!next);
      logger.error('Erro ao alternar follow:', err);
      showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  }, [canFollow, following, showError, showSuccess, t, targetUserId, updating]);

  return {
    canFollow,
    following,
    loading,
    updating,
    toggle,
  };
}
