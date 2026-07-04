import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/firebase';
import { storage } from '../services/firebaseStorage';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('useGroupWall');

const POST_PAGE_SIZE = 20;
const MAX_TEXT_LENGTH = 500;

export interface WallPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  text: string;
  mediaUrl: string | null;
  mediaPath: string | null;
  mediaType: string | null;
  thumbnailPath: string | null;
  highlightRef: { gameId: string; highlightId: string } | null;
  pinned: boolean;
  pinnedBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  editedAt?: Date;
  deletedBy: string | null;
  deletedAt: Date | null;
  reactions: Record<string, string[]> | null;
  commentsCount: number;
}

function mapPost(docSnap: QueryDocumentSnapshot<DocumentData>): WallPost {
  const raw = docSnap.data() as Record<string, unknown>;
  const converted = snakeToCamel<Record<string, unknown>>(raw);
  return {
    id: docSnap.id,
    groupId: (converted.groupId as string) ?? (raw.group_id as string) ?? '',
    authorId: (converted.authorId as string) ?? (raw.author_id as string) ?? '',
    authorName: (converted.authorName as string) ?? (raw.author_name as string) ?? 'Jogador',
    authorPhotoUrl: (converted.authorPhotoUrl as string | null) ?? (raw.author_photo_url as string | null) ?? null,
    text: (converted.text as string) ?? (raw.text as string) ?? '',
    mediaUrl: (converted.mediaUrl as string | null) ?? (raw.media_url as string | null) ?? null,
    mediaPath: (converted.mediaPath as string | null) ?? (raw.media_path as string | null) ?? null,
    mediaType: (converted.mediaType as string | null) ?? (raw.media_type as string | null) ?? null,
    thumbnailPath: (converted.thumbnailPath as string | null) ?? (raw.thumbnail_path as string | null) ?? null,
    highlightRef: (converted.highlightRef as { gameId: string; highlightId: string } | null) ??
      ((raw.highlight_ref as { game_id?: unknown; highlight_id?: unknown } | undefined)
        ? {
            gameId: String((raw.highlight_ref as { game_id?: unknown }).game_id),
            highlightId: String((raw.highlight_ref as { highlight_id?: unknown }).highlight_id),
          }
        : null) ??
      null,
    pinned: (converted.pinned as boolean) ?? (raw.pinned as boolean) ?? false,
    pinnedBy: (converted.pinnedBy as string | null) ?? (raw.pinned_by as string | null) ?? null,
    createdAt: toDate(raw.created_at as never),
    updatedAt: toDate(raw.updated_at as never),
    editedAt: toDate(raw.edited_at as never),
    deletedBy: (converted.deletedBy as string | null) ?? (raw.deleted_by as string | null) ?? null,
    deletedAt: toDate(raw.deleted_at as never) ?? null,
    reactions: (converted.reactions as Record<string, string[]> | null) ?? (raw.reactions as Record<string, string[]> | null) ?? null,
    commentsCount: (converted.commentsCount as number) ?? (raw.comments_count as number) ?? 0,
  };
}

export function useGroupWall(groupId?: string) {
  const { currentUser, user } = useAuth();
  const { showError } = useToast();
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const newestDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const oldestDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPosts([]);
    newestDocRef.current = null;
    oldestDocRef.current = null;

    const q = query(
      collection(db, 'groups', groupId, 'wall_posts'),
      orderBy('created_at', 'desc'),
      limit(POST_PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(mapPost);
        setPosts(data);
        setHasMore(snapshot.size === POST_PAGE_SIZE);
        if (snapshot.docs.length > 0) {
          newestDocRef.current = snapshot.docs[0];
          oldestDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener do mural do grupo:', err);
        const message = getFirestoreErrorMessage(err);
        setError(message);
        setLoading(false);
        showError(message);
      },
    );

    return () => unsubscribe();
  }, [groupId, showError]);

  const loadMore = useCallback(async () => {
    if (!groupId || !oldestDocRef.current || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'groups', groupId, 'wall_posts'),
        orderBy('created_at', 'desc'),
        startAfter(oldestDocRef.current),
        limit(POST_PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const older = snap.docs.map(mapPost);
      if (snap.docs.length > 0) {
        oldestDocRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMore(snap.size === POST_PAGE_SIZE);
      setPosts((prev) => [...prev, ...older]);
    } catch (err) {
      logger.error('Erro ao paginar posts antigos:', err);
      const message = getFirestoreErrorMessage(err);
      setError(message);
      showError(message);
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, loadingMore, hasMore, showError]);

  const createPost = useCallback(
    async (text: string, options?: { imageFile?: File; highlightRef?: { gameId: string; highlightId: string } }) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      const cleanText = text.trim();
      if (cleanText.length === 0 && !options?.imageFile) {
        throw new Error('Escreva algo ou anexe uma foto.');
      }
      if (cleanText.length > MAX_TEXT_LENGTH) {
        throw new Error(`Máximo ${MAX_TEXT_LENGTH} caracteres.`);
      }

      let mediaUrl: string | null = null;
      let mediaPath: string | null = null;
      let mediaType: string | null = null;

      if (options?.imageFile) {
        const ext = options.imageFile.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const path = `groups/${groupId}/wall_media/__draft__/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, options.imageFile, { contentType: options.imageFile.type });
        mediaUrl = await getDownloadURL(fileRef);
        mediaPath = path;
        mediaType = options.imageFile.type;
      }

      await addDoc(collection(db, 'groups', groupId, 'wall_posts'), {
        group_id: groupId,
        author_id: currentUser.uid,
        author_name: user?.name || currentUser.displayName || 'Jogador',
        author_photo_url: user?.photoUrl ?? currentUser.photoURL ?? null,
        text: cleanText,
        media_url: mediaUrl,
        media_path: mediaPath,
        media_type: mediaType,
        thumbnail_path: null,
        highlight_ref: options?.highlightRef ?? null,
        pinned: false,
        pinned_by: null,
        pinned_at: null,
        reactions: {},
        comments_count: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        edited_at: null,
        deleted_by: null,
        deleted_at: null,
      });
    },
    [groupId, currentUser, user],
  );

  const editPost = useCallback(
    async (postId: string, text: string) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      const cleanText = text.trim();
      if (cleanText.length < 1 || cleanText.length > MAX_TEXT_LENGTH) {
        throw new Error(`O texto deve ter entre 1 e ${MAX_TEXT_LENGTH} caracteres.`);
      }
      await updateDoc(doc(db, 'groups', groupId, 'wall_posts', postId), {
        text: cleanText,
        edited_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    },
    [groupId, currentUser],
  );

  const togglePin = useCallback(
    async (postId: string, pinned: boolean) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      await updateDoc(doc(db, 'groups', groupId, 'wall_posts', postId), {
        pinned,
        pinned_by: pinned ? currentUser.uid : null,
        pinned_at: pinned ? serverTimestamp() : null,
        updated_at: serverTimestamp(),
      });
    },
    [groupId, currentUser],
  );

  const deletePost = useCallback(
    async (post: WallPost) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      const batch = writeBatch(db);
      const postRef = doc(db, 'groups', groupId, 'wall_posts', post.id);
      batch.update(postRef, {
        deleted_by: currentUser.uid,
        deleted_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      if (post.mediaPath) {
        try {
          await deleteObject(storageRef(storage, post.mediaPath));
        } catch (err) {
          const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
          if (code !== 'storage/object-not-found') {
            logger.warn('Erro ao deletar mídia do mural:', err);
          }
        }
      }

      await batch.commit();
    },
    [groupId, currentUser],
  );

  return {
    posts,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    createPost,
    editPost,
    togglePin,
    deletePost,
    currentUserId: currentUser?.uid,
  };
}

export function useCreateWallPost(groupId?: string) {
  const { createPost } = useGroupWall(groupId);
  const { showError, showSuccess } = useToast();
  const [sending, setSending] = useState(false);

  const create = useCallback(
    async (text: string, options?: { imageFile?: File; highlightRef?: { gameId: string; highlightId: string } }) => {
      setSending(true);
      try {
        await createPost(text, options);
        showSuccess('Publicado no mural.');
      } catch (err) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [createPost, showError, showSuccess],
  );

  return { create, sending };
}

export function useDeleteWallPost(groupId?: string) {
  const { deletePost } = useGroupWall(groupId);
  const { showError } = useToast();
  const [deleting, setDeleting] = useState(false);

  const remove = useCallback(
    async (post: WallPost) => {
      setDeleting(true);
      try {
        await deletePost(post);
      } catch (err) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setDeleting(false);
      }
    },
    [deletePost, showError],
  );

  return { remove, deleting };
}
