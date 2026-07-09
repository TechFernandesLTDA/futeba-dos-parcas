import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/firebase';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';

export interface PostGameMessage {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function usePostGameMessages(gameId?: string) {
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['post-game-messages', gameId],
    queryFn: async () => {
      if (!gameId) return [];
      const snap = await getDocs(query(
        collection(db, 'post_game_messages'),
        where('game_id', '==', gameId),
        orderBy('updated_at', 'desc'),
        limit(20),
      ));
      return snap.docs.map((messageDoc) => {
        const raw = messageDoc.data();
        const data = snakeToCamel(raw) as { gameId: string; userId: string; userName?: string; message: string };
        return {
          id: messageDoc.id,
          gameId: data.gameId,
          userId: data.userId,
          userName: data.userName || 'Jogador',
          message: data.message,
          createdAt: toDate(raw.created_at),
          updatedAt: toDate(raw.updated_at),
        } as PostGameMessage;
      });
    },
    enabled: !!gameId,
    staleTime: 30 * 1000,
  });

  return { messages: data, loading: isLoading, error: error ? (error as Error).message : null, refetch };
}

export function useSavePostGameMessage(gameId?: string) {
  const { currentUser, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: string) => {
      if (!gameId || !currentUser?.uid) throw new Error('Jogo não encontrado.');
      const cleanMessage = message.trim();
      if (cleanMessage.length < 2 || cleanMessage.length > 240) throw new Error('O recado deve ter entre 2 e 240 caracteres.');
      const messageRef = doc(db, 'post_game_messages', `${gameId}_${currentUser.uid}`);
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(messageRef);
        transaction.set(messageRef, {
          game_id: gameId,
          user_id: currentUser.uid,
          user_name: user?.name || currentUser.displayName || 'Jogador',
          message: cleanMessage,
          updated_at: serverTimestamp(),
          ...(current.exists() ? {} : { created_at: serverTimestamp() }),
        }, { merge: true });
      });
    },
    onSuccess: () => {
      showSuccess('Recado salvo.');
      queryClient.invalidateQueries({ queryKey: ['post-game-messages', gameId] });
    },
    onError: (err) => showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err)),
  });
}
