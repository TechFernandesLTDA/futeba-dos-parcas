import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit as fsLimit,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Game } from '../types/game';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';

function parsePublicGame(id: string, raw: Record<string, unknown>): Game {
  const converted = snakeToCamel(raw);
  return {
    id,
    ...converted,
    dateTime: ((raw.date_time || raw.dateTime) as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: ((raw.updated_at || raw.updatedAt) as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  } as Game;
}

async function fetchPublicGames(): Promise<Game[]> {
  const now = new Date().toISOString();
  const gamesRef = collection(db, 'games');
  const q = query(
    gamesRef,
    where('is_public', '==', true),
    where('visibility', '==', 'PUBLIC_OPEN'),
    where('status', '==', 'SCHEDULED'),
    where('date', '>=', now.split('T')[0]),
    orderBy('date', 'asc'),
    fsLimit(50),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => parsePublicGame(d.id, d.data()));
}

export function usePublicGames() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  return useQuery({
    queryKey: ['public-games'],
    queryFn: fetchPublicGames,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!uid,
  });
}

export function useJoinPublicGame() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const uid = user?.id ?? '';
  const userName = user?.name ?? '';

  return useMutation({
    mutationFn: async (game: Game) => {
      if (!uid || !userName) throw new Error('Você precisa estar logado.');

      const gameId = game.id;
      const gameRef = doc(db, 'games', gameId);

      try {
        await updateDoc(gameRef, {
          players: arrayUnion(uid),
          players_count: increment(1),
          updated_at: serverTimestamp(),
        });
      } catch (error) {
        showError('Erro ao atualizar jogo público.');
        throw error;
      }
    },
    onSuccess: (_, game) => {
      showSuccess(`Você entrou na pelada "${game.locationName}"!`);
      queryClient.invalidateQueries({ queryKey: ['public-games'] });
    },
    onError: (err) => {
      showError(getFirestoreErrorMessage(err));
    },
  });
}
