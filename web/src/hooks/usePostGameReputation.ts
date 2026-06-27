import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { submitPostGameReputation } from '../services/cloudFunctions';
import { useAuth } from '../contexts/AuthContext';
import { toDate } from '../utils/firestoreHelpers';
import { getFirestoreErrorMessage, getFunctionsErrorMessage } from '../utils/firebaseErrors';
import { createLogger } from '../utils/logger';

const logger = createLogger('usePostGameReputation');

export interface PostGameReputationReview {
  id: string;
  gameId: string;
  reviewerId: string;
  targetUserId: string;
  punctuality: number;
  respect: number;
  commitment: number;
  overall: number;
  comment: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SavePostGameReputationInput {
  targetUserId: string;
  punctuality: number;
  respect: number;
  commitment: number;
  comment: string;
}

function parseReviewDoc(id: string, raw: Record<string, unknown>): PostGameReputationReview {
  return {
    id,
    gameId: String(raw.game_id ?? ''),
    reviewerId: String(raw.reviewer_id ?? ''),
    targetUserId: String(raw.target_user_id ?? ''),
    punctuality: Number(raw.punctuality ?? 0),
    respect: Number(raw.respect ?? 0),
    commitment: Number(raw.commitment ?? 0),
    overall: Number(raw.overall ?? 0),
    comment: String(raw.comment ?? ''),
    createdAt: toDate(raw.created_at as Parameters<typeof toDate>[0]),
    updatedAt: toDate(raw.updated_at as Parameters<typeof toDate>[0]),
  };
}

export function usePostGameReputation(gameId: string | null, enabled: boolean) {
  const { currentUser, firebaseUser } = useAuth();
  const currentUserId = firebaseUser?.uid || currentUser?.uid || null;
  const [reviews, setReviews] = useState<PostGameReputationReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTargetId, setSavingTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const reviewsByTarget = useMemo(
    () => new Map(reviews.map((review) => [review.targetUserId, review])),
    [reviews],
  );

  const refetch = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !gameId || !currentUserId) {
      setReviews([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const reviewsQuery = query(
      collection(db, 'post_game_reputation'),
      where('game_id', '==', gameId),
      where('reviewer_id', '==', currentUserId),
    );

    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        setReviews(snapshot.docs.map((docSnap) => parseReviewDoc(docSnap.id, docSnap.data())));
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error('Error loading post-game reputation reviews:', err);
        setReviews([]);
        setLoading(false);
        setError(getFirestoreErrorMessage(err));
      },
    );

    return unsubscribe;
  }, [currentUserId, enabled, gameId, refreshToken]);

  const saveReview = useCallback(async (input: SavePostGameReputationInput) => {
    if (!gameId) return false;

    setSavingTargetId(input.targetUserId);
    setError(null);
    try {
      await submitPostGameReputation({
        gameId,
        targetUserId: input.targetUserId,
        punctuality: input.punctuality,
        respect: input.respect,
        commitment: input.commitment,
        comment: input.comment.trim(),
      });
      return true;
    } catch (err) {
      logger.error('Error saving post-game reputation review:', err);
      setError(getFunctionsErrorMessage(err, 'submitPostGameReputation'));
      throw err;
    } finally {
      setSavingTargetId(null);
    }
  }, [gameId]);

  return {
    reviews,
    reviewsByTarget,
    loading,
    savingTargetId,
    error,
    refetch,
    saveReview,
  };
}
