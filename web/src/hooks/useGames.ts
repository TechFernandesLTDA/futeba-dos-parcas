import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {

  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { Game, GameConfirmation, GameStatus, ConfirmationStatus } from '../types/game';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { camelToSnake } from '../utils/camelToSnake';
import { createLogger } from '../utils/logger';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { getIsPublicFromVisibility } from '../utils/gameLifecycle';
import { confirmGamePresence as confirmGamePresenceCallable } from '../services/cloudFunctions';
import { realtimeTelemetry, type RealtimeMeasurement } from '../utils/realtimeTelemetry';

const logger = createLogger('useGames');

const MIN_GROUP_MEMBERS_TO_CREATE_GAME = 5;
function shouldCancelRideOnPresenceCancellation(raw: Record<string, unknown>) {
  if (raw.status === 'CANCELLED') return false;
  return !(
    raw.fully_covered === true ||
    raw.fullyCovered === true ||
    raw.covered === true ||
    raw.fulfilled === true
  );
}

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
    xpRewardHeldAt: toDate((raw.xp_reward_held_at ?? raw.xpRewardHeldAt) as Timestamp | Date),
    xpRewardReviewedAt: toDate((raw.xp_reward_reviewed_at ?? raw.xpRewardReviewedAt) as Timestamp | Date),
    validationUpdatedAt: toDate((raw.validation_updated_at ?? raw.validationUpdatedAt) as Timestamp | Date),
    deletedAt: toDate((raw.deleted_at ?? raw.deletedAt) as Timestamp | Date),
  } as Game;
}

// Default limit para evitar full-collection scans (#1121)
const DEFAULT_GAMES_LIMIT = 50;

interface GamesFilters {
  status?: GameStatus;
  statuses?: GameStatus[];
  groupId?: string;
  date?: string;
  startDateTime?: Date;
  limitCount?: number;
  orderDirection?: 'asc' | 'desc';
}

function buildGamesQuery(filters?: GamesFilters): Query<DocumentData> {
  const gamesRef = collection(db, 'games');
  const constraints: QueryConstraint[] = [];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  } else if (filters?.statuses?.length) {
    constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));
  }
  if (filters?.groupId) constraints.push(where('group_id', '==', filters.groupId));
  if (filters?.date) constraints.push(where('date', '==', filters.date));
  if (filters?.startDateTime) constraints.push(where('dateTime', '>=', filters.startDateTime));
  constraints.push(orderBy('dateTime', filters?.orderDirection ?? 'asc'));
  constraints.push(limit(filters?.limitCount ?? DEFAULT_GAMES_LIMIT));
  return query(gamesRef, ...constraints);
}

// Busca jogos com filtros
async function fetchGames(filters?: GamesFilters): Promise<Game[]> {
  const q = buildGamesQuery(filters);
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => parseGameDoc(d.id, d.data()))
    .filter((g) => !g.deletedAt);
}

interface GamesSubscriber {
  onLoading: () => void;
  onData: () => void;
  onError: (error: Error) => void;
}

interface GamesSubscription {
  queryClient: QueryClient;
  queryKey: readonly unknown[];
  firestoreQuery: Query<DocumentData>;
  subscribers: Set<GamesSubscriber>;
  unsubscribe?: () => void;
  lifecycle?: RealtimeMeasurement;
  hasConnected?: boolean;
}

const gamesSubscriptions = new WeakMap<QueryClient, Map<string, GamesSubscription>>();

function startGamesSubscription(subscription: GamesSubscription) {
  subscription.unsubscribe?.();
  subscription.lifecycle?.cancel();
  subscription.lifecycle = realtimeTelemetry.start(
    'games',
    subscription.hasConnected ? 'reconnect' : 'bootstrap',
  );
  subscription.subscribers.forEach((subscriber) => subscriber.onLoading());
  subscription.unsubscribe = onSnapshot(
    subscription.firestoreQuery,
    (snapshot) => {
      const applyMeasurement = realtimeTelemetry.start('games', 'apply');
      try {
        const games = snapshot.docs
          .map((gameDoc) => parseGameDoc(gameDoc.id, gameDoc.data()))
          .filter((game) => !game.deletedAt);
        subscription.queryClient.setQueryData(subscription.queryKey, games);
        applyMeasurement.finish();
        subscription.lifecycle?.finish();
        subscription.lifecycle = undefined;
        subscription.hasConnected = true;
        subscription.subscribers.forEach((subscriber) => subscriber.onData());
      } catch (error) {
        applyMeasurement.error();
        subscription.lifecycle?.cancel();
        subscription.lifecycle = undefined;
        const normalized = error instanceof Error ? error : new Error('Realtime apply failed');
        subscription.subscribers.forEach((subscriber) => subscriber.onError(normalized));
      }
    },
    (error) => {
      if (subscription.lifecycle) {
        subscription.lifecycle.error();
        subscription.lifecycle = undefined;
      } else {
        realtimeTelemetry.record('games', 'error');
      }
      const normalized = error instanceof Error ? error : new Error(getFirestoreErrorMessage(error));
      subscription.subscribers.forEach((subscriber) => subscriber.onError(normalized));
    },
  );
}

function acquireGamesSubscription(
  queryClient: QueryClient,
  registryKey: string,
  queryKey: readonly unknown[],
  firestoreQuery: Query<DocumentData>,
  subscriber: GamesSubscriber,
) {
  let clientSubscriptions = gamesSubscriptions.get(queryClient);
  if (!clientSubscriptions) {
    clientSubscriptions = new Map();
    gamesSubscriptions.set(queryClient, clientSubscriptions);
  }
  let subscription = clientSubscriptions.get(registryKey);
  if (!subscription) {
    subscription = {
      queryClient,
      queryKey,
      firestoreQuery,
      subscribers: new Set(),
    };
    clientSubscriptions.set(registryKey, subscription);
  }
  subscription.subscribers.add(subscriber);
  if (!subscription.unsubscribe) startGamesSubscription(subscription);
  else if (queryClient.getQueryData(queryKey) !== undefined) subscriber.onData();

  return {
    restart: () => startGamesSubscription(subscription!),
    release: () => {
      subscription!.subscribers.delete(subscriber);
      if (subscription!.subscribers.size === 0) {
        subscription!.unsubscribe?.();
        subscription!.lifecycle?.cancel();
        clientSubscriptions!.delete(registryKey);
      }
    },
  };
}

// Busca jogos públicos (scheduled/confirmed, is_public=true)
// #2254: usePublicGames consolidado em hooks/usePublicGames.ts (variantes
// 'open' e 'map'). A versão duplicada que existia aqui foi removida.

export function useGames(filters?: GamesFilters) {
  const queryClient = useQueryClient();
  const status = filters?.status;
  const statusesKey = filters?.statuses?.join(',');
  const groupId = filters?.groupId;
  const date = filters?.date;
  const startDateTimeMs = filters?.startDateTime?.getTime();
  const limitCount = filters?.limitCount;
  const orderDirection = filters?.orderDirection;
  const normalizedFilters = useMemo<GamesFilters>(() => ({
    status,
    statuses: statusesKey ? statusesKey.split(',') as GameStatus[] : undefined,
    groupId,
    date,
    startDateTime: startDateTimeMs === undefined ? undefined : new Date(startDateTimeMs),
    limitCount,
    orderDirection,
  }), [date, groupId, limitCount, orderDirection, startDateTimeMs, status, statusesKey]);
  // Chave de query estável baseada nos filtros primitivos
  const queryKey = useMemo(
    () => [
      'games',
      status,
      statusesKey,
      groupId,
      date,
      startDateTimeMs,
      limitCount,
      orderDirection,
    ] as const,
    [date, groupId, limitCount, orderDirection, startDateTimeMs, status, statusesKey]
  );
  const registryKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const firestoreQuery = useMemo(() => buildGamesQuery(normalizedFilters), [normalizedFilters]);
  const [listenerLoading, setListenerLoading] = useState(
    () => queryClient.getQueryData(queryKey) === undefined,
  );
  const [listenerError, setListenerError] = useState<string | null>(null);
  const subscriptionControlRef = useRef<{ restart: () => void; release: () => void } | null>(null);
  const { data: games = [] } = useQuery({
    queryKey,
    queryFn: () => fetchGames(normalizedFilters),
    enabled: false,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setListenerLoading(queryClient.getQueryData(queryKey) === undefined);
    setListenerError(null);
    const subscriber: GamesSubscriber = {
      onLoading: () => setListenerLoading(true),
      onData: () => {
        setListenerLoading(false);
        setListenerError(null);
      },
      onError: (error) => {
        setListenerLoading(false);
        setListenerError(error.message);
      },
    };
    const control = acquireGamesSubscription(
      queryClient,
      registryKey,
      queryKey,
      firestoreQuery,
      subscriber,
    );
    subscriptionControlRef.current = control;
    return () => {
      control.release();
      if (subscriptionControlRef.current === control) subscriptionControlRef.current = null;
    };
  }, [firestoreQuery, queryClient, queryKey, registryKey]);

  const refetch = useCallback(async () => {
    subscriptionControlRef.current?.restart();
  }, []);

  return { games, loading: listenerLoading, error: listenerError, refetch };
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
        await confirmGamePresenceCallable({
          gameId,
          position,
          isCasualPlayer: false,
        });
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

        const batch = writeBatch(db);
        batch.update(confirmationRef, {
          status: 'CANCELLED' as ConfirmationStatus,
          updated_at: serverTimestamp(),
        });

        const rideRef = doc(db, 'game_rides', `${gameId}_${uid}`);
        const rideDoc = await getDoc(rideRef);
        if (rideDoc.exists() && shouldCancelRideOnPresenceCancellation(rideDoc.data() as Record<string, unknown>)) {
          batch.update(rideRef, {
            status: 'CANCELLED',
            updated_at: serverTimestamp(),
          });
        }

        // Mantem a confirmação marcada como CANCELLED para disparar os triggers
        // server-side de vacancy/waitlist promotion.
        await batch.commit();
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

        if (!gameData.groupId) {
          throw new Error(t('games.create.errorQualifiedOwnerGroupRequired'));
        }

        const groupSnap = await getDoc(doc(db, 'groups', gameData.groupId));
        if (!groupSnap.exists()) {
          throw new Error(t('games.create.errorQualifiedOwnerGroupRequired'));
        }

        const groupData = snakeToCamel(groupSnap.data()) as {
          ownerId?: string;
          memberCount?: number;
          status?: string;
        };
        const memberCount = Number(groupData.memberCount ?? 0);

        if (
          groupData.ownerId !== uid ||
          groupData.status === 'DELETED' ||
          memberCount < MIN_GROUP_MEMBERS_TO_CREATE_GAME
        ) {
          throw new Error(t('games.create.errorQualifiedOwnerGroupRequired'));
        }

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
          is_public: getIsPublicFromVisibility(cleanData.visibility as string | undefined),
          owner_id: uid,
          owner_name: displayName,
          status: 'SCHEDULED' as GameStatus,
          players_count: 0,
          goalkeepers_count: 0,
          players: [],
          team1_score: 0,
          team2_score: 0,
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
        queryClient.invalidateQueries({ queryKey: ['nextGame'] });
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
