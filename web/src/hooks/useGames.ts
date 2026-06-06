import { useState, useEffect, useCallback, useMemo } from 'react';
import {

  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { Game, GameConfirmation, GameStatus, ConfirmationStatus } from '../types/game';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { camelToSnake } from '../utils/camelToSnake';
import { createLogger } from '../utils/logger';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useGames');

// Converte documento Firestore para objeto Game
function parseGameDoc(docId: string, raw: Record<string, unknown>): Game {
  const converted = snakeToCamel(raw);
  return {
    id: docId,
    ...converted,
    dateTime: toDate((raw.dateTime ?? raw.date_time) as Timestamp | Date) || converted.dateTime,
    createdAt: toDate((raw.created_at ?? raw.createdAt) as Timestamp | Date),
    updatedAt: toDate((raw.updated_at ?? raw.updatedAt) as Timestamp | Date),
    votingDeadline: toDate((raw.voting_deadline ?? raw.votingDeadline) as Timestamp | Date),
    xpProcessedAt: toDate((raw.xp_processed_at ?? raw.xpProcessedAt) as Timestamp | Date),
    deletedAt: toDate((raw.deleted_at ?? raw.deletedAt) as Timestamp | Date),
  } as Game;
}

// Default limit para evitar full-collection scans (#1121)
const DEFAULT_GAMES_LIMIT = 50;

// Busca jogos com filtros
async function fetchGames(filters?: {
  status?: GameStatus;
  groupId?: string;
  date?: string;
  limitCount?: number;
}): Promise<Game[]> {
  const gamesRef = collection(db, 'games');
  let q = query(gamesRef, orderBy('dateTime', 'asc'));

  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters?.groupId) {
    q = query(q, where('group_id', '==', filters.groupId));
  }
  if (filters?.date) {
    q = query(q, where('date', '==', filters.date));
  }

  // SEMPRE aplicar limit p/ evitar scan completo da collection (#1121).
  // Default 50; caller pode override via filters.limitCount.
  const limitCount = filters?.limitCount ?? DEFAULT_GAMES_LIMIT;
  q = query(q, limit(limitCount));

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => parseGameDoc(d.id, d.data()))
    .filter((g) => !g.deletedAt);
}

// Busca jogos públicos (scheduled/confirmed, is_public=true)
// #2254: usePublicGames consolidado em hooks/usePublicGames.ts (variantes
// 'open' e 'map'). A versão duplicada que existia aqui foi removida.

export function useGames(filters?: {
  status?: GameStatus;
  groupId?: string;
  date?: string;
  limitCount?: number;
}) {
  // Chave de query estável baseada nos filtros primitivos
  const queryKey = useMemo(
    () => ['games', filters?.status, filters?.groupId, filters?.date, filters?.limitCount] as const,
    [filters?.status, filters?.groupId, filters?.date, filters?.limitCount]
  );

  const { data: games = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchGames(filters),
    staleTime: 1 * 60 * 1000, // 1 minuto - jogos mudam com frequência
    gcTime: 5 * 60 * 1000,
    // PERF: mutations (useCreateGame, useUpdateGameStatus) já chamam invalidateQueries.
    // Remover onSnapshot redundante que causava double-fetch a cada mudança:
    // snapshot disparava invalidação → getDocs era chamado novamente além do fetch da mutation.
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  return { games, loading, error, refetch };
}

export function useGameDetail(gameId: string | null) {
  const [game, setGame] = useState<Game | null>(null);
  const [confirmations, setConfirmations] = useState<GameConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    const gameRef = doc(db, 'games', gameId);
    // Usar coleção raiz 'confirmations' (igual ao Android)
    const confirmationsRef = collection(db, 'confirmations');

    const unsubscribeGame = onSnapshot(
      gameRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          setGame(parseGameDoc(docSnap.id, raw));
        } else {
          setGame(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching game:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    // Consultar confirmações da coleção raiz filtradas por game_id (igual ao Android)
    const unsubscribeConfirmations = onSnapshot(
      query(confirmationsRef, where('game_id', '==', gameId)),
      (snapshot) => {
        const confirmationsData = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel(raw);
          return {
            id: d.id,
            ...converted,
            confirmedAt: ((raw.confirmed_at || raw.confirmedAt) as { toDate?: () => Date })?.toDate?.(),
            createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.(),
            checkedInAt: ((raw.checked_in_at || raw.checkedInAt) as { toDate?: () => Date })?.toDate?.(),
          } as GameConfirmation;
        });
        // Ordenar por confirmation_order client-side
        confirmationsData.sort((a, b) => (a.confirmationOrder || 0) - (b.confirmationOrder || 0));
        setConfirmations(confirmationsData);
      },
      (err) => {
        logger.error('Error in confirmations listener:', err);
        setConfirmations([]);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    return () => {
      unsubscribeGame();
      unsubscribeConfirmations();
    };
  }, [gameId]);

  return { game, confirmations, loading, error };
}

export function useConfirmPresence() {
  const { t } = useTranslation();
  const { user, firebaseUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmPresence = useCallback(
    async (gameId: string, position: 'GOALKEEPER' | 'FIELD' = 'FIELD') => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        // Doc ID determinístico {gameId}_{userId} (igual ao Android)
        const confirmationId = `${gameId}_${uid}`;
        const confirmationRef = doc(db, 'confirmations', confirmationId);

        const displayName = firebaseUser?.displayName || user?.name || 'Jogador';
        const photoURL = firebaseUser?.photoURL || user?.photoUrl || null;

        // Apenas escrever na coleção confirmations (igual ao Android)
        // O Cloud Function trigger (onConfirmationWrite) atualiza os contadores do jogo
        const confirmationData = {
          id: confirmationId,
          game_id: gameId,
          user_id: uid,
          user_name: displayName,
          user_photo: photoURL || '',
          position,
          status: 'CONFIRMED' as ConfirmationStatus,
          is_casual_player: false,
          created_at: serverTimestamp(),
        };

        await setDoc(confirmationRef, confirmationData);
        queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
        showSuccess(t('feedback.games.confirmSuccess'));
        setLoading(false);
        return true;
      } catch (err) {
        logger.error('Error confirming presence:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao confirmar presença.');
        throw err;
      }
    },
    [firebaseUser, user, queryClient, showSuccess, showError, t]
  );

  const cancelPresence = useCallback(
    async (gameId: string) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        // Doc ID determinístico {gameId}_{userId} (igual ao Android)
        const confirmationId = `${gameId}_${uid}`;
        const confirmationRef = doc(db, 'confirmations', confirmationId);

        const confirmationDoc = await getDoc(confirmationRef);

        if (!confirmationDoc.exists()) {
          throw new Error('Confirmation not found');
        }

        // Apenas deletar a confirmação (igual ao Android)
        // O Cloud Function trigger (onConfirmationWrite) atualiza os contadores do jogo
        await deleteDoc(confirmationRef);
        queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
        showSuccess(t('feedback.games.cancelSuccess'));
        setLoading(false);
        return true;
      } catch (err) {
        logger.error('Error cancelling presence:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao cancelar presença.');
        throw err;
      }
    },
    [firebaseUser, user, queryClient, showSuccess, showError, t]
  );

  return { confirmPresence, cancelPresence, loading, error };
}

export function useCreateGame() {
  const { t } = useTranslation();
  const { user, firebaseUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createGame = useCallback(
    async (gameData: Partial<Game>) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        const gamesRef = collection(db, 'games');
        const displayName = firebaseUser?.displayName || user?.name || 'Organizador';

        // Converter campos do formulário para snake_case do Firestore
        const snakeGameData = camelToSnake(gameData);

        // dateTime is an exception to snake_case convention (canonical field in Firestore)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((gameData as any).dateTime) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (snakeGameData as any).date_time;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (snakeGameData as any).dateTime = (gameData as any).dateTime;
        }

        // Remover campos undefined (Firestore não aceita)
        const cleanData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(snakeGameData)) {
          if (value !== undefined) {
            cleanData[key] = value;
          }
        }

        const newGame = {
          ...cleanData,
          // Garante valor padrão mesmo em fluxos sem seletor (quick-create, duplicate)
          gender: (cleanData.gender as string) ?? 'MIXED',
          owner_id: uid,
          owner_name: displayName,
          status: 'SCHEDULED' as GameStatus,
          players_count: 0,
          goalkeepers_count: 0,
          players: [],
          team1_score: 0,
          team2_score: 0,
          xp_processed: false,
          voting_concluded: false,
          post_game_report_generated: false,
          auto_closed: false,
          co_organizers: [],
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };

        const docRef = await addDoc(gamesRef, newGame);
        // Invalidar cache de jogos após criar
        queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
        // #2254: public-games agora usa key própria (não está mais sob ['games']),
        // então invalida explicitamente para o mapa/lista refletirem o novo jogo.
        queryClient.invalidateQueries({ queryKey: ['public-games'], exact: false });
        showSuccess(t('feedback.games.createSuccess'));
        setLoading(false);
        return docRef.id;
      } catch (err) {
        logger.error('Error creating game:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao criar jogo.');
        throw err;
      }
    },
    [firebaseUser, user, queryClient, showSuccess, showError, t]
  );

  return { createGame, loading, error };
}

export function useUpdateGameStatus() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateStatus = useCallback(
    async (gameId: string, newStatus: GameStatus) => {
      setLoading(true);
      setError(null);

      try {
        const gameRef = doc(db, 'games', gameId);

        const gameDoc = await getDoc(gameRef);
        if (!gameDoc.exists()) {
          throw new Error('Game not found');
        }

        const gameData = parseGameDoc(gameDoc.id, gameDoc.data());

        const validTransitions: Record<GameStatus, GameStatus[]> = {
          SCHEDULED: ['CONFIRMED', 'CANCELLED'],
          CONFIRMED: ['LIVE', 'CANCELLED'],
          LIVE: ['FINISHED'],
          FINISHED: [],
          CANCELLED: [],
        };

        if (!validTransitions[gameData.status]?.includes(newStatus)) {
          throw new Error(`Invalid status transition from ${gameData.status} to ${newStatus}`);
        }

        await updateDoc(gameRef, {
          status: newStatus,
          updated_at: serverTimestamp(),
        });

        // Invalidar cache de jogos após mudar status
        queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
        // #2254: public-games tem key própria — invalida para refletir mudança de status.
        queryClient.invalidateQueries({ queryKey: ['public-games'], exact: false });
        showSuccess(t('feedback.games.statusUpdateSuccess'));
        setLoading(false);
        return true;
      } catch (err) {
        logger.error('Error updating game status:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao atualizar status do jogo.');
        throw err;
      }
    },
    [queryClient, showSuccess, showError, t]
  );

  return { updateStatus, loading, error };
}
