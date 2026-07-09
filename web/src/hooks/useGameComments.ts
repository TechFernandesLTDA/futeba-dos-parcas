import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { mergeRealtimePageById } from './realtimePageMerge';
import type { ReactionsMap } from '../constants/reactions';

const logger = createLogger('useGameComments');

const COMMENT_PAGE_SIZE = 30;
export const GAME_COMMENT_MAX_LENGTH = 500;
export const VOTE_RESULT_COMMENT_MAX_LENGTH = 200;
export type GameCommentContext = 'game' | 'vote_result';

export interface GameComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  text: string;
  parentId: string | null;
  createdAt?: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  reactions: ReactionsMap;
  context: GameCommentContext;
}

function mapComment(docSnap: QueryDocumentSnapshot<DocumentData>): GameComment {
  const raw = docSnap.data() as Record<string, unknown>;
  const converted = snakeToCamel<Record<string, unknown>>(raw);
  return {
    id: docSnap.id,
    authorId: (converted.authorId as string) ?? (raw.author_id as string),
    authorName: (converted.authorName as string) ?? (raw.author_name as string) ?? 'Jogador',
    authorPhotoUrl: (converted.authorPhotoUrl as string | null) ?? (raw.author_photo_url as string | null) ?? null,
    text: (converted.text as string) ?? (raw.text as string),
    parentId: (converted.parentId as string | null) ?? (raw.parent_id as string | null) ?? null,
    createdAt: toDate(raw.created_at as never),
    editedAt: toDate(raw.edited_at as never) ?? null,
    deletedAt: toDate(raw.deleted_at as never) ?? null,
    deletedBy: (converted.deletedBy as string | null) ?? (raw.deleted_by as string | null) ?? null,
    reactions: (raw.reactions as ReactionsMap | undefined) ?? {},
    context: ((raw.context as GameCommentContext | undefined) ?? 'game'),
  };
}

export function useGameComments(gameId?: string, context: GameCommentContext = 'game') {
  const { currentUser, user } = useAuth();
  const [comments, setComments] = useState<GameComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const oldestDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      setComments([]);
      setHasMore(false);
      oldestDocRef.current = null;
      return undefined;
    }

    setLoading(true);
    setError(null);

    const commentsQuery = query(
      collection(db, 'games', gameId, 'comments'),
      orderBy('created_at', 'desc'),
      limit(COMMENT_PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const snapshotIds = snapshot.docs.map((docSnap) => docSnap.id);
        const data = snapshot.docs.map(mapComment).reverse();
        setComments((prev) => mergeRealtimePageById(prev, data, snapshotIds, 'append'));
        setHasMore(snapshot.size === COMMENT_PAGE_SIZE);
        if (snapshot.docs.length > 0) {
          oldestDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener de comentarios do jogo:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [gameId]);

  const loadMore = useCallback(async () => {
    if (!gameId || !oldestDocRef.current || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const commentsQuery = query(
        collection(db, 'games', gameId, 'comments'),
        orderBy('created_at', 'desc'),
        startAfter(oldestDocRef.current),
        limit(COMMENT_PAGE_SIZE),
      );
      const snapshot = await getDocs(commentsQuery);
      const older = snapshot.docs.map(mapComment).reverse();
      oldestDocRef.current = snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : oldestDocRef.current;
      setHasMore(snapshot.size === COMMENT_PAGE_SIZE);
      setComments((prev) => [...older, ...prev]);
    } catch (err) {
      logger.error('Erro ao paginar comentarios antigos:', err);
      setError(getFirestoreErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [gameId, hasMore, loadingMore]);

  const maxLength = context === 'vote_result' ? VOTE_RESULT_COMMENT_MAX_LENGTH : GAME_COMMENT_MAX_LENGTH;

  const addComment = useCallback(async (text: string, parentId: string | null = null) => {
    if (!gameId || !currentUser?.uid) throw new Error('Jogo não encontrado.');
    const cleanText = text.trim();
    if (cleanText.length < 1 || cleanText.length > maxLength) {
      throw new Error(`O comentário deve ter entre 1 e ${maxLength} caracteres.`);
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'games', gameId, 'comments'), {
        author_id: currentUser.uid,
        author_name: user?.name || currentUser.displayName || 'Jogador',
        author_photo_url: user?.photoUrl ?? currentUser.photoURL ?? null,
        text: cleanText,
        parent_id: parentId,
        created_at: serverTimestamp(),
        edited_at: null,
        deleted_by: null,
        deleted_at: null,
        reactions: {},
        context,
      });
    } finally {
      setSaving(false);
    }
  }, [context, currentUser, gameId, maxLength, user]);

  const editComment = useCallback(async (commentId: string, text: string) => {
    if (!gameId) throw new Error('Jogo não encontrado.');
    const cleanText = text.trim();
    if (cleanText.length < 1 || cleanText.length > GAME_COMMENT_MAX_LENGTH) {
      throw new Error(`O comentário deve ter entre 1 e ${GAME_COMMENT_MAX_LENGTH} caracteres.`);
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'games', gameId, 'comments', commentId), {
        text: cleanText,
        edited_at: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  }, [gameId]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!gameId || !currentUser?.uid) throw new Error('Jogo não encontrado.');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'games', gameId, 'comments', commentId), {
        deleted_by: currentUser.uid,
        deleted_at: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  }, [currentUser?.uid, gameId]);

  return {
    comments,
    loading,
    error,
    hasMore,
    loadingMore,
    saving,
    loadMore,
    maxLength,
    addComment,
    editComment,
    deleteComment,
    currentUserId: currentUser?.uid ?? null,
  };
}
