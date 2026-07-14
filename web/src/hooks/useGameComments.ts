import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  documentId,
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
  where,
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
export const COMMENT_PARENT_QUERY_CHUNK_SIZE = 10;
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

export function getMissingCommentParentIds(
  comments: GameComment[],
  knownCommentIds: Iterable<string> = [],
): string[] {
  const knownIds = new Set(knownCommentIds);
  for (const comment of comments) knownIds.add(comment.id);

  const missingIds: string[] = [];
  const seen = new Set<string>();
  for (const comment of comments) {
    if (!comment.parentId || knownIds.has(comment.parentId) || seen.has(comment.parentId)) continue;
    seen.add(comment.parentId);
    missingIds.push(comment.parentId);
  }
  return missingIds;
}

export function mergeGameCommentsById(...groups: GameComment[][]): GameComment[] {
  const merged = new Map<string, GameComment>();
  for (const group of groups) {
    for (const comment of group) merged.set(comment.id, comment);
  }
  return [...merged.values()];
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
  const commentsRef = useRef<GameComment[]>([]);

  const fetchMissingParents = useCallback(async (
    sourceComments: GameComment[],
    knownCommentIds: Iterable<string>,
  ): Promise<GameComment[]> => {
    if (!gameId) return [];
    const missingIds = getMissingCommentParentIds(sourceComments, knownCommentIds);
    if (missingIds.length === 0) return [];

    const commentsCollection = collection(db, 'games', gameId, 'comments');
    const chunks: string[][] = [];
    for (let index = 0; index < missingIds.length; index += COMMENT_PARENT_QUERY_CHUNK_SIZE) {
      chunks.push(missingIds.slice(index, index + COMMENT_PARENT_QUERY_CHUNK_SIZE));
    }

    const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(
      commentsCollection,
      where(documentId(), 'in', chunk),
    ))));

    const fetchedParents = mergeGameCommentsById(
      ...snapshots.map((snapshot) => snapshot.docs.map(mapComment)),
    );
    const parentsById = new Map(fetchedParents.map((parent) => [parent.id, parent]));
    return missingIds.flatMap((parentId) => {
      const parent = parentsById.get(parentId);
      return parent ? [parent] : [];
    });
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      setComments([]);
      commentsRef.current = [];
      setHasMore(false);
      setError(null);
      oldestDocRef.current = null;
      return undefined;
    }

    setLoading(true);
    setError(null);
    setComments([]);
    commentsRef.current = [];
    oldestDocRef.current = null;
    let cancelled = false;
    let snapshotSequence = 0;

    const commentsQuery = query(
      collection(db, 'games', gameId, 'comments'),
      orderBy('created_at', 'desc'),
      limit(COMMENT_PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        const sequence = ++snapshotSequence;
        const snapshotIds = snapshot.docs.map((docSnap) => docSnap.id);
        const data = snapshot.docs.map(mapComment).reverse();
        try {
          const knownIds = commentsRef.current.map((comment) => comment.id);
          const parents = await fetchMissingParents(data, knownIds);
          if (cancelled || sequence !== snapshotSequence) return;

          const liveData = mergeGameCommentsById(parents, data);
          const liveIds = [...parents.map((parent) => parent.id), ...snapshotIds];
          setComments((prev) => {
            const next = mergeRealtimePageById(prev, liveData, liveIds, 'append');
            commentsRef.current = next;
            return next;
          });
          setHasMore(snapshot.size === COMMENT_PAGE_SIZE);
          if (snapshot.docs.length > 0) {
            oldestDocRef.current = snapshot.docs[snapshot.docs.length - 1];
          }
          setError(null);
          setLoading(false);
        } catch (err) {
          if (cancelled || sequence !== snapshotSequence) return;
          logger.error('Erro ao carregar comentarios-pai do jogo:', err);
          setError(getFirestoreErrorMessage(err));
          setLoading(false);
        }
      },
      (err) => {
        snapshotSequence += 1;
        if (cancelled) return;
        logger.error('Erro no listener de comentarios do jogo:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      snapshotSequence += 1;
      unsubscribe();
    };
  }, [fetchMissingParents, gameId]);

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
      const knownIds = mergeGameCommentsById(commentsRef.current, older).map((comment) => comment.id);
      const parents = await fetchMissingParents(older, knownIds);
      oldestDocRef.current = snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : oldestDocRef.current;
      setHasMore(snapshot.size === COMMENT_PAGE_SIZE);
      setComments((prev) => {
        const next = mergeGameCommentsById(parents, older, prev);
        commentsRef.current = next;
        return next;
      });
    } catch (err) {
      logger.error('Erro ao paginar comentarios antigos:', err);
      setError(getFirestoreErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMissingParents, gameId, hasMore, loadingMore]);

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
