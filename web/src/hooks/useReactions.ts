import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { arrayRemove, arrayUnion, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  REACTION_EMOJIS,
  ReactionEmoji,
  ReactionsMap,
  getUserReaction,
} from '../constants/reactions';
import { createLogger } from '../utils/logger';

const logger = createLogger('useReactions');

interface UseReactionsOptions {
  createData?: Record<string, unknown>;
  reactionField?: string;
}

export function useReactions(
  targetPath: string,
  reactions: ReactionsMap | null | undefined,
  options: UseReactionsOptions = {},
) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const [pending, setPending] = useState(false);
  const [optimisticReactions, setOptimisticReactions] = useState<ReactionsMap>(reactions ?? {});
  const reactionField = options.reactionField ?? 'reactions';

  useEffect(() => {
    setOptimisticReactions(reactions ?? {});
  }, [reactions]);

  const toggleReaction = useCallback(async (emoji: ReactionEmoji) => {
    const uid = currentUser?.uid;
    if (!uid || pending) return;

    const previousReactions = optimisticReactions ?? {};
    const currentEmoji = getUserReaction(previousReactions, uid);
    const nextReactions: ReactionsMap = {};
    const updates: Record<string, unknown> = {};
    const mergeReactions: Record<string, unknown> = {};

    for (const reactionEmoji of REACTION_EMOJIS) {
      nextReactions[reactionEmoji] = (previousReactions[reactionEmoji] ?? []).filter(
        (reactionUserId) => reactionUserId !== uid,
      );
      if (currentEmoji === emoji || reactionEmoji !== emoji) {
        const removeValue = arrayRemove(uid);
        updates[`${reactionField}.${reactionEmoji}`] = removeValue;
        mergeReactions[reactionEmoji] = removeValue;
      }
    }

    if (currentEmoji !== emoji) {
      nextReactions[emoji] = [...(nextReactions[emoji] ?? []), uid];
      const addValue = arrayUnion(uid);
      updates[`${reactionField}.${emoji}`] = addValue;
      mergeReactions[emoji] = addValue;
    }

    setPending(true);
    setOptimisticReactions(nextReactions);
    try {
      const targetRef = doc(db, targetPath);
      if (options.createData) {
        await setDoc(targetRef, {
          ...options.createData,
          [reactionField]: mergeReactions,
          updated_at: serverTimestamp(),
        }, { merge: true });
      } else {
        await updateDoc(targetRef, updates);
      }
    } catch (error) {
      setOptimisticReactions(previousReactions);
      logger.error('Erro ao alternar reação:', error);
      showError(t('reactions.updateError'));
    } finally {
      setPending(false);
    }
  }, [currentUser?.uid, optimisticReactions, options.createData, pending, reactionField, showError, t, targetPath]);

  return {
    currentUserId: currentUser?.uid ?? null,
    reactions: optimisticReactions,
    pending,
    toggleReaction,
  };
}
