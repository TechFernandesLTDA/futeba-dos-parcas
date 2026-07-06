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
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/firebase';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { mergeRealtimePageById } from './realtimePageMerge';

const logger = createLogger('useGameChat');

export interface GameChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  text: string;
  createdAt?: Date;
  deletedBy: string | null;
  deletedAt: Date | null;
}

const MESSAGE_PAGE_SIZE = 50;
const MAX_TEXT_LENGTH = 500;

function mapMessage(docSnap: QueryDocumentSnapshot<DocumentData>): GameChatMessage {
  const raw = docSnap.data() as Record<string, unknown>;
  const converted = snakeToCamel<Record<string, unknown>>(raw);
  const createdRaw = raw.created_at as { toDate?: () => Date } | undefined;
  const deletedRaw = raw.deleted_at as { toDate?: () => Date } | undefined;
  return {
    id: docSnap.id,
    senderId: (converted.senderId as string) ?? (raw.sender_id as string),
    senderName: (converted.senderName as string) ?? (raw.sender_name as string) ?? 'Jogador',
    senderPhotoUrl: (converted.senderPhotoUrl as string | null) ?? (raw.sender_photo_url as string | null) ?? null,
    text: (converted.text as string) ?? (raw.text as string),
    createdAt: createdRaw?.toDate?.() ?? toDate(raw.created_at as never),
    deletedBy: (converted.deletedBy as string | null) ?? (raw.deleted_by as string | null) ?? null,
    deletedAt: deletedRaw?.toDate?.() ?? null,
  };
}

export function useGameChat(gameId?: string) {
  const { currentUser, user } = useAuth();
  const [messages, setMessages] = useState<GameChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const oldestDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (!gameId) {
      setMessages([]);
      setError(null);
      setHasMore(false);
      oldestDocRef.current = null;
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'games', gameId, 'chat'),
      orderBy('created_at', 'desc'),
      limit(MESSAGE_PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const snapshotIds = snapshot.docs.map((docSnap) => docSnap.id);
        const data = snapshot.docs.map(mapMessage).reverse();
        setMessages((prev) => mergeRealtimePageById(prev, data, snapshotIds, 'append'));
        setHasMore(snapshot.size === MESSAGE_PAGE_SIZE);
        if (snapshot.docs.length > 0) {
          oldestDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener do chat do jogo:', err);
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
      const q = query(
        collection(db, 'games', gameId, 'chat'),
        orderBy('created_at', 'desc'),
        startAfter(oldestDocRef.current),
        limit(MESSAGE_PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const older = snap.docs.map(mapMessage).reverse();
      if (snap.docs.length > 0) {
        oldestDocRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMore(snap.size === MESSAGE_PAGE_SIZE);
      setMessages((prev) => [...older, ...prev]);
    } catch (err) {
      logger.error('Erro ao paginar mensagens antigas:', err);
      setError(getFirestoreErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [gameId, loadingMore, hasMore]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!gameId || !currentUser?.uid) throw new Error('Jogo não encontrado.');
      const cleanText = text.trim();
      if (cleanText.length < 1 || cleanText.length > MAX_TEXT_LENGTH) {
        throw new Error(`A mensagem deve ter entre 1 e ${MAX_TEXT_LENGTH} caracteres.`);
      }
      await addDoc(collection(db, 'games', gameId, 'chat'), {
        sender_id: currentUser.uid,
        sender_name: user?.name || currentUser.displayName || 'Jogador',
        sender_photo_url: user?.photoUrl ?? currentUser.photoURL ?? null,
        text: cleanText,
        created_at: serverTimestamp(),
        deleted_by: null,
        deleted_at: null,
      });
    },
    [gameId, currentUser, user],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!gameId || !currentUser?.uid) throw new Error('Jogo não encontrado.');
      await updateDoc(doc(db, 'games', gameId, 'chat', messageId), {
        deleted_by: currentUser.uid,
        deleted_at: serverTimestamp(),
      });
    },
    [gameId, currentUser],
  );

  return {
    messages,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    deleteMessage,
    currentUserId: currentUser?.uid,
  };
}

export function useSendGameMessage(gameId?: string) {
  const { sendMessage } = useGameChat(gameId);
  const { showError, showSuccess } = useToast();
  const [sending, setSending] = useState(false);

  const send = useCallback(
    async (text: string) => {
      setSending(true);
      try {
        await sendMessage(text);
        showSuccess('Mensagem enviada.');
      } catch (err) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [sendMessage, showError, showSuccess],
  );

  return { send, sending };
}

export function useDeleteGameMessage(gameId?: string) {
  const { deleteMessage } = useGameChat(gameId);
  const { showError } = useToast();
  const [deleting, setDeleting] = useState(false);

  const remove = useCallback(
    async (messageId: string) => {
      setDeleting(true);
      try {
        await deleteMessage(messageId);
      } catch (err) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setDeleting(false);
      }
    },
    [deleteMessage, showError],
  );

  return { remove, deleting };
}
