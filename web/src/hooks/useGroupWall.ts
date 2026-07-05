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
import { useTranslation } from 'react-i18next';

const logger = createLogger('useGroupWall');

const POST_PAGE_SIZE = 20;
const MAX_TEXT_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CreateWallPostOptions {
  imageFile?: File;
  highlightRef?: { gameId: string; highlightId: string };
}

interface UploadedWallMedia {
  mediaUrl: string;
  mediaPath: string;
  mediaType: string;
}

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

export function mapPost(docSnap: QueryDocumentSnapshot<DocumentData>): WallPost {
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

async function uploadWallMedia(groupId: string, imageFile: File): Promise<UploadedWallMedia> {
  if (!ACCEPTED_IMAGE_TYPES.includes(imageFile.type)) {
    throw new Error('Tipo de imagem inválido. Use JPG, PNG ou WebP.');
  }
  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Imagem muito grande. O limite é 10MB.');
  }

  const ext = imageFile.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const mediaPath = `groups/${groupId}/wall_media/__draft__/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const fileRef = storageRef(storage, mediaPath);

  await uploadBytes(fileRef, imageFile, { contentType: imageFile.type });
  const mediaUrl = await getDownloadURL(fileRef);

  return {
    mediaUrl,
    mediaPath,
    mediaType: imageFile.type,
  };
}

async function deleteWallMediaPaths(paths: Array<string | null | undefined>) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];

  await Promise.all(
    uniquePaths.map(async (path) => {
      try {
        await deleteObject(storageRef(storage, path));
      } catch (err) {
        const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
        if (code !== 'storage/object-not-found') {
          logger.warn('Erro ao deletar mídia do mural:', err);
        }
      }
    }),
  );
}

async function createWallPostDocument(params: {
  groupId: string;
  currentUserUid: string;
  authorName: string;
  authorPhotoUrl: string | null;
  text: string;
  options?: CreateWallPostOptions;
}) {
  const { groupId, currentUserUid, authorName, authorPhotoUrl, text, options } = params;
  const cleanText = text.trim();

  if (cleanText.length === 0) {
    throw new Error('O texto nao pode estar vazio.');
  }
  if (cleanText.length > MAX_TEXT_LENGTH) {
    throw new Error(`Máximo ${MAX_TEXT_LENGTH} caracteres.`);
  }

  let uploadedMedia: UploadedWallMedia | null = null;

  try {
    if (options?.imageFile) {
      uploadedMedia = await uploadWallMedia(groupId, options.imageFile);
    }

    await addDoc(collection(db, 'groups', groupId, 'wall_posts'), {
      group_id: groupId,
      author_id: currentUserUid,
      author_name: authorName,
      author_photo_url: authorPhotoUrl,
      text: cleanText,
      media_url: uploadedMedia?.mediaUrl ?? null,
      media_path: uploadedMedia?.mediaPath ?? null,
      media_type: uploadedMedia?.mediaType ?? null,
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
  } catch (err) {
    if (uploadedMedia?.mediaPath) {
      await deleteWallMediaPaths([uploadedMedia.mediaPath]);
    }
    throw err;
  }
}

async function softDeleteWallPost(groupId: string, currentUserUid: string, post: WallPost) {
  const batch = writeBatch(db);
  const postRef = doc(db, 'groups', groupId, 'wall_posts', post.id);
  batch.update(postRef, {
    deleted_by: currentUserUid,
    deleted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await batch.commit();
  await deleteWallMediaPaths([post.mediaPath, post.thumbnailPath]);
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
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

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
        const data = snapshot.docs.map(mapPost).filter((post) => post.deletedAt === null);
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
        showErrorRef.current(message);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

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
      const older = snap.docs.map(mapPost).filter((post) => post.deletedAt === null);
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
    async (text: string, options?: CreateWallPostOptions) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      await createWallPostDocument({
        groupId,
        currentUserUid: currentUser.uid,
        authorName: user?.name || currentUser.displayName || 'Jogador',
        authorPhotoUrl: user?.photoUrl ?? currentUser.photoURL ?? null,
        text,
        options,
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
      await softDeleteWallPost(groupId, currentUser.uid, post);
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
  const { currentUser, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);

  const create = useCallback(
    async (text: string, options?: CreateWallPostOptions) => {
      const cleanText = text.trim();
      if (!groupId || !currentUser?.uid) {
        const error = new Error('Grupo não encontrado.');
        showError(error.message);
        throw error;
      }
      if (cleanText.length === 0) {
        const error = new Error(t('groupWall.textRequired'));
        showError(error.message);
        throw error;
      }

      setSending(true);
      try {
        await createWallPostDocument({
          groupId,
          currentUserUid: currentUser.uid,
          authorName: user?.name || currentUser.displayName || 'Jogador',
          authorPhotoUrl: user?.photoUrl ?? currentUser.photoURL ?? null,
          text: cleanText,
          options,
        });
        showSuccess('Publicado no mural.');
      } catch (err) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [groupId, currentUser, user, showError, showSuccess, t],
  );

  return { create, sending };
}

export function useDeleteWallPost(groupId?: string) {
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const [deleting, setDeleting] = useState(false);

  const remove = useCallback(
    async (post: WallPost) => {
      if (!groupId || !currentUser?.uid) {
        const error = new Error('Grupo não encontrado.');
        showError(error.message);
        throw error;
      }

      setDeleting(true);
      try {
        await softDeleteWallPost(groupId, currentUser.uid, post);
      } catch (err) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setDeleting(false);
      }
    },
    [groupId, currentUser, showError],
  );

  return { remove, deleting };
}
