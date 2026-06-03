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
import { useTranslation } from 'react-i18next';

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

/**
 * #2254: variantes de consulta de jogos públicos consolidadas em um único hook.
 *
 * - 'open': jogos abertos para entrar (discover) — is_public + visibility=PUBLIC_OPEN
 *   + status=SCHEDULED + a partir de hoje. Usado por PublicGamesScreen (lista).
 * - 'map': jogos públicos para exibir no mapa — is_public + status in
 *   [SCHEDULED, CONFIRMED], sem filtro de data. Usado por PublicGamesMapScreen.
 *
 * As duas semânticas são preservadas; consumidores escolhem via parâmetro.
 */
export type PublicGamesVariant = 'open' | 'map';

async function fetchPublicGames(variant: PublicGamesVariant): Promise<Game[]> {
  const gamesRef = collection(db, 'games');

  if (variant === 'map') {
    const q = query(
      gamesRef,
      where('is_public', '==', true),
      where('status', 'in', ['SCHEDULED', 'CONFIRMED']),
      orderBy('date', 'asc'),
      fsLimit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => parsePublicGame(d.id, d.data()))
      .filter((g) => !g.deletedAt);
  }

  // variant === 'open'
  const now = new Date().toISOString();
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

/**
 * Contrato padrão { data, loading, error, refetch } (#2251/#2254).
 */
export function usePublicGames(variant: PublicGamesVariant = 'open') {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  const { data = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['public-games', variant],
    queryFn: () => fetchPublicGames(variant),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!uid,
  });

  const error = queryError ? (queryError as Error).message : null;

  return { data, games: data, loading, error, refetch };
}

export function useJoinPublicGame() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const uid = user?.id ?? '';
  const userName = user?.name ?? '';

  return useMutation({
    mutationFn: async (game: Game) => {
      if (!uid || !userName) throw new Error(t('feedback.publicGames.loginRequired'));

      const gameId = game.id;
      const gameRef = doc(db, 'games', gameId);

      // #2166: sem showError aqui — o onError abaixo já exibe o toast.
      // Antes o usuário via dois toasts idênticos para o mesmo erro.
      await updateDoc(gameRef, {
        players: arrayUnion(uid),
        players_count: increment(1),
        updated_at: serverTimestamp(),
      });
    },
    onSuccess: (_, game) => {
      showSuccess(t('feedback.publicGames.joinSuccess', { location: game.locationName }));
      queryClient.invalidateQueries({ queryKey: ['public-games'] });
    },
    onError: (err) => {
      showError(getFirestoreErrorMessage(err));
    },
  });
}
