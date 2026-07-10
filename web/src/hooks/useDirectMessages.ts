import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
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
  type DocumentData,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { createDirectChat, submitDirectMessage } from '../services/cloudFunctions';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { toDate } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { mergeRealtimePageById } from './realtimePageMerge';

const logger = createLogger('useDirectMessages');

export const DIRECT_MESSAGE_PAGE_SIZE = 50;
export const DIRECT_MESSAGE_MAX_LENGTH = 1000;

export interface DirectChat {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string | null>;
  createdBy: string;
  createdAt?: Date;
  lastMessage: string | null;
  lastMessageAt?: Date;
  lastSenderId: string | null;
  unreadCount: Record<string, number>;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  text: string;
  createdAt?: Date;
  deletedBy: string | null;
  deletedAt?: Date;
}

function asStringMap(value: unknown): Record<string, string> {
  return value && typeof value === 'object' ? value as Record<string, string> : {};
}

function asNullableStringMap(value: unknown): Record<string, string | null> {
  return value && typeof value === 'object' ? value as Record<string, string | null> : {};
}

function asNumberMap(value: unknown): Record<string, number> {
  return value && typeof value === 'object' ? value as Record<string, number> : {};
}

function mapChat(docSnap: QueryDocumentSnapshot<DocumentData>): DirectChat {
  const raw = docSnap.data() as Record<string, unknown>;
  return {
    id: docSnap.id,
    participants: Array.isArray(raw.participants) ? raw.participants.filter((item): item is string => typeof item === 'string') : [],
    participantNames: asStringMap(raw.participant_names),
    participantPhotos: asNullableStringMap(raw.participant_photos),
    createdBy: typeof raw.created_by === 'string' ? raw.created_by : '',
    createdAt: toDate(raw.created_at as never),
    lastMessage: typeof raw.last_message === 'string' ? raw.last_message : null,
    lastMessageAt: toDate(raw.last_message_at as never),
    lastSenderId: typeof raw.last_sender_id === 'string' ? raw.last_sender_id : null,
    unreadCount: asNumberMap(raw.unread_count),
  };
}

function mapMessage(docSnap: QueryDocumentSnapshot<DocumentData>): DirectMessage {
  const raw = docSnap.data() as Record<string, unknown>;
  return {
    id: docSnap.id,
    senderId: typeof raw.sender_id === 'string' ? raw.sender_id : '',
    senderName: typeof raw.sender_name === 'string' ? raw.sender_name : 'Jogador',
    senderPhotoUrl: typeof raw.sender_photo_url === 'string' ? raw.sender_photo_url : null,
    text: typeof raw.text === 'string' ? raw.text : '',
    createdAt: toDate(raw.created_at as never),
    deletedBy: typeof raw.deleted_by === 'string' ? raw.deleted_by : null,
    deletedAt: toDate(raw.deleted_at as never),
  };
}

export function getDirectChatPeer(chat: DirectChat, currentUserId?: string) {
  const peerId = chat.participants.find((participant) => participant !== currentUserId) ?? chat.participants[0] ?? '';
  return {
    id: peerId,
    name: chat.participantNames[peerId] || 'Jogador',
    photoUrl: chat.participantPhotos[peerId] ?? null,
  };
}

export function useDirectChats() {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<DirectChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('last_message_at', 'desc'),
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        setChats(snapshot.docs.map(mapChat));
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener de mensagens diretas:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  return { chats, loading, error, currentUserId: currentUser?.uid };
}

export function useDirectChat(chatId?: string) {
  const { currentUser } = useAuth();
  const [chat, setChat] = useState<DirectChat | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const oldestDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const historyLoadedRef = useRef(false);

  const peer = useMemo(() => chat ? getDirectChatPeer(chat, currentUser?.uid) : null, [chat, currentUser?.uid]);

  useEffect(() => {
    if (!chatId || !currentUser?.uid) {
      setChat(null);
      setMessages([]);
      setError(null);
      setHasMore(false);
      oldestDocRef.current = null;
      historyLoadedRef.current = false;
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMessages([]);
    setHasMore(false);
    oldestDocRef.current = null;
    historyLoadedRef.current = false;

    const chatRef = doc(db, 'chats', chatId);
    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('created_at', 'desc'),
      limit(DIRECT_MESSAGE_PAGE_SIZE),
    );

    const unsubscribeChat = onSnapshot(
      chatRef,
      (snapshot) => {
        setChat(snapshot.exists() ? mapChat(snapshot as QueryDocumentSnapshot<DocumentData>) : null);
      },
      (err) => {
        logger.error('Erro no listener do chat direto:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      },
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const snapshotIds = snapshot.docs.map((docSnapshot) => docSnapshot.id);
        const liveMessages = snapshot.docs.map(mapMessage).reverse();
        setMessages((current) => mergeRealtimePageById(current, liveMessages, snapshotIds, 'append'));

        // Once older pages have been loaded, the history cursor must not move
        // back to the edge of the live window whenever a new message arrives.
        if (!historyLoadedRef.current) {
          setHasMore(snapshot.size === DIRECT_MESSAGE_PAGE_SIZE);
          oldestDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener das mensagens diretas:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      },
    );

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, currentUser?.uid]);

  useEffect(() => {
    if (!chatId || !currentUser?.uid || !chat) return;
    if ((chat.unreadCount[currentUser.uid] ?? 0) <= 0) return;
    updateDoc(doc(db, 'chats', chatId), {
      [`unread_count.${currentUser.uid}`]: 0,
    }).catch((err) => {
      logger.error('Erro ao marcar chat direto como lido:', err);
    });
  }, [chatId, chat, currentUser?.uid]);

  const loadMore = useCallback(async () => {
    if (!chatId || !oldestDocRef.current || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const olderQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('created_at', 'desc'),
        startAfter(oldestDocRef.current),
        limit(DIRECT_MESSAGE_PAGE_SIZE),
      );
      const snapshot = await getDocs(olderQuery);
      const older = snapshot.docs.map(mapMessage).reverse();
      const olderIds = snapshot.docs.map((docSnapshot) => docSnapshot.id);
      oldestDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? oldestDocRef.current;
      historyLoadedRef.current = true;
      setHasMore(snapshot.size === DIRECT_MESSAGE_PAGE_SIZE);
      setMessages((current) => mergeRealtimePageById(current, older, olderIds, 'prepend'));
    } catch (err) {
      logger.error('Erro ao paginar mensagens diretas:', err);
      setError(getFirestoreErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, hasMore, loadingMore]);

  const sendMessage = useCallback(async (text: string) => {
    if (!chatId || !currentUser?.uid || !chat) throw new Error('Conversa não encontrada.');
    const cleanText = text.trim();
    if (cleanText.length < 1 || cleanText.length > DIRECT_MESSAGE_MAX_LENGTH) {
      throw new Error(`A mensagem deve ter entre 1 e ${DIRECT_MESSAGE_MAX_LENGTH} caracteres.`);
    }

    await submitDirectMessage({
      chatId,
      text: cleanText,
    });
  }, [chat, chatId, currentUser]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId || !currentUser?.uid) throw new Error('Conversa não encontrada.');
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      deleted_by: currentUser.uid,
      deleted_at: serverTimestamp(),
    });
  }, [chatId, currentUser?.uid]);

  return {
    chat,
    peer,
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

export function useCreateDirectChat() {
  const [creating, setCreating] = useState(false);

  const create = useCallback(async (targetUid: string) => {
    setCreating(true);
    try {
      const result = await createDirectChat({ targetUid });
      return result.data.chatId;
    } catch (err) {
      throw new Error(getFirestoreErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating };
}
