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
import { gameDateTimeFromLocal } from '../utils/gameDateTime';
import { createLogger } from '../utils/logger';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { getIsPublicFromVisibility } from '../utils/gameLifecycle';
import { confirmGamePresence as confirmGamePresenceCallable } from '../services/cloudFunctions';
import { realtimeTelemetry, type RealtimeMeasurement } from '../utils/realtimeTelemetry';
import { trackEvent } from '../utils/analytics';

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

function parseConfirmationDoc(docId: string, raw: Record<string, unknown>): GameConfirmation {
  const converted = snakeToCamel(raw);
  return {
    id: docId,
    ...converted,
    confirmedAt: ((raw.confirmed_at || raw.confirmedAt) as { toDate?: () => Date })?.toDate?.(),
    createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.(),
    checkedInAt: ((raw.checked_in_at || raw.checkedInAt) as { toDate?: () => Date })?.toDate?.(),
  } as GameConfirmation;
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
  /**
   * #4578: grupos em que o usuário é membro. Sem `groupId`, a lista junta os
   * jogos públicos com os jogos de cada um desses grupos (uma consulta por
   * grupo). Ignorado quando `groupId` está presente.
   */
  memberGroupIds?: string[];
}

// #4578: teto de consultas por grupo na lista geral. Cada grupo abre um
// listener; o Android usa o mesmo teto (`userGroupIds.take(10)`).
const MAX_MEMBER_GROUP_QUERIES = 10;

// FIX #4126: visibilities acessíveis por LIST sem vínculo. Com as rules
// restritas, toda query de LIST em games precisa de filtro server-side que
// torne a regra provável: visibilidade pública OU group_id OU owner_id.
const ACCESSIBLE_VISIBILITIES = ['PUBLIC_OPEN', 'PUBLIC_CLOSED'] as const;

function buildGamesQuery(filters?: GamesFilters): Query<DocumentData> {
  const gamesRef = collection(db, 'games');
  const constraints: QueryConstraint[] = [];

  // FIX #4572: NÃO filtrar `deleted_at == null` no servidor. Nenhum escritor
  // grava `deleted_at: null` na criação (web, Android e as rules de create
  // recusam o campo), e o Firestore não casa `== null` com campo ausente: o
  // filtro escondia todos os jogos. Soft-deleted saem no cliente
  // (`!game.deletedAt`, em fetchGames e no listener), como as rules de LIST
  // de `games` já assumem.

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  } else if (filters?.statuses?.length) {
    constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));
  }
  if (filters?.groupId) {
    constraints.push(where('group_id', '==', filters.groupId));
  } else {
    // Sem vínculo de grupo: apenas jogos públicos (GROUP_ONLY vaza se
    // não houver constraint de visibilidade).
    constraints.push(where('visibility', 'in', [...ACCESSIBLE_VISIBILITIES]));
  }
  if (filters?.date) constraints.push(where('date', '==', filters.date));
  if (filters?.startDateTime) constraints.push(where('dateTime', '>=', filters.startDateTime));
  constraints.push(orderBy('dateTime', filters?.orderDirection ?? 'asc'));
  constraints.push(limit(filters?.limitCount ?? DEFAULT_GAMES_LIMIT));
  return query(gamesRef, ...constraints);
}

/**
 * #4578: consultas que alimentam a lista. A primeira é a de sempre (pública
 * ou do `groupId`). Com `memberGroupIds`, entra uma consulta por grupo do
 * usuário, no mesmo formato da tela do grupo (`group_id == X`), que as rules
 * de LIST de `games` aceitam para membro ativo.
 *
 * Uma por grupo, e não `group_id in [...]`: a rule lê `groups/{id}/members/{uid}`
 * por grupo distinto do resultado, e um `in` com 10 grupos encosta no teto de
 * leituras de rules por consulta. Além disso, um vínculo desatualizado em
 * `users/{uid}/groups` derrubaria a consulta inteira; assim derruba só a dele.
 */
function buildGamesQueries(filters?: GamesFilters): Query<DocumentData>[] {
  const primary = buildGamesQuery(filters);
  if (filters?.groupId || !filters?.memberGroupIds?.length) return [primary];
  const groupIds = [...new Set(filters.memberGroupIds.filter(Boolean))].slice(0, MAX_MEMBER_GROUP_QUERIES);
  return [primary, ...groupIds.map((groupId) => buildGamesQuery({ ...filters, groupId }))];
}

function gameTime(game: Game): number {
  const time = game.dateTime instanceof Date ? game.dateTime.getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** Junta as fontes sem repetir jogo e reaplica ordem e limite da consulta. */
function mergeGameSources(sources: Game[][], filters?: GamesFilters): Game[] {
  if (sources.length === 1) return sources[0];
  const byId = new Map<string, Game>();
  sources.forEach((source) => source.forEach((game) => {
    if (!byId.has(game.id)) byId.set(game.id, game);
  }));
  const direction = filters?.orderDirection === 'desc' ? -1 : 1;
  return [...byId.values()]
    .sort((a, b) => (gameTime(a) - gameTime(b)) * direction)
    .slice(0, filters?.limitCount ?? DEFAULT_GAMES_LIMIT);
}

function parseGamesSnapshot(docs: { id: string; data: () => DocumentData }[]): Game[] {
  return docs
    .map((gameDoc) => parseGameDoc(gameDoc.id, gameDoc.data()))
    .filter((game) => !game.deletedAt);
}

// Busca jogos com filtros
async function fetchGames(filters?: GamesFilters): Promise<Game[]> {
  const [primary, ...memberGroupQueries] = buildGamesQueries(filters);
  const primaryGames = parseGamesSnapshot((await getDocs(primary)).docs);
  const memberGroupGames = await Promise.all(memberGroupQueries.map(async (q) => {
    try {
      return parseGamesSnapshot((await getDocs(q)).docs);
    } catch (err) {
      // Mesmo critério do listener: grupo que não puder ser lido fica de fora.
      logger.warn('Jogos de um grupo do usuário não puderam ser lidos:', err);
      return [];
    }
  }));
  return mergeGameSources([primaryGames, ...memberGroupGames], filters);
}

interface GamesSubscriber {
  onLoading: () => void;
  onData: () => void;
  onError: (error: Error) => void;
}

interface GamesSubscription {
  queryClient: QueryClient;
  queryKey: readonly unknown[];
  firestoreQueries: Query<DocumentData>[];
  filters?: GamesFilters;
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

  // #4578: uma fonte por consulta. A lista só é publicada quando todas já
  // responderam, para não piscar com a lista pública antes de os jogos dos
  // grupos chegarem.
  const sources: (Game[] | undefined)[] = subscription.firestoreQueries.map(() => undefined);
  let stopped = false;

  const publish = () => {
    if (stopped || sources.some((source) => source === undefined)) return;
    const applyMeasurement = realtimeTelemetry.start('games', 'apply');
    try {
      const games = mergeGameSources(sources as Game[][], subscription.filters);
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
  };

  const unsubscribes = subscription.firestoreQueries.map((firestoreQuery, index) => onSnapshot(
    firestoreQuery,
    (snapshot) => {
      try {
        sources[index] = parseGamesSnapshot(snapshot.docs);
      } catch (error) {
        subscription.lifecycle?.cancel();
        subscription.lifecycle = undefined;
        const normalized = error instanceof Error ? error : new Error('Realtime apply failed');
        subscription.subscribers.forEach((subscriber) => subscriber.onError(normalized));
        return;
      }
      publish();
    },
    (error) => {
      if (index > 0) {
        // Consulta de um grupo do usuário. Falha aqui (vínculo desatualizado em
        // `users/{uid}/groups`, por exemplo) não pode esconder os jogos
        // públicos nem os dos outros grupos: o grupo fica de fora e a lista segue.
        logger.warn('Jogos de um grupo do usuário não puderam ser lidos:', error);
        realtimeTelemetry.record('games', 'error');
        sources[index] = [];
        publish();
        return;
      }
      if (subscription.lifecycle) {
        subscription.lifecycle.error();
        subscription.lifecycle = undefined;
      } else {
        realtimeTelemetry.record('games', 'error');
      }
      const normalized = error instanceof Error ? error : new Error(getFirestoreErrorMessage(error));
      subscription.subscribers.forEach((subscriber) => subscriber.onError(normalized));
    },
  ));
  subscription.unsubscribe = () => {
    stopped = true;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

function acquireGamesSubscription(
  queryClient: QueryClient,
  registryKey: string,
  queryKey: readonly unknown[],
  firestoreQueries: Query<DocumentData>[],
  filters: GamesFilters | undefined,
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
      firestoreQueries,
      filters,
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

/**
 * @param options.enabled `false` adia o listener e mantém `loading`. Serve para
 *   quem monta `memberGroupIds` a partir de outra consulta: evita abrir a lista
 *   só com os jogos públicos e reabrir quando os grupos chegam (#4578).
 */
export function useGames(filters?: GamesFilters, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const status = filters?.status;
  const statusesKey = filters?.statuses?.join(',');
  const groupId = filters?.groupId;
  const date = filters?.date;
  const startDateTimeMs = filters?.startDateTime?.getTime();
  const limitCount = filters?.limitCount;
  const orderDirection = filters?.orderDirection;
  // Ordenado para a chave não mudar com a ordem em que os grupos chegam.
  const memberGroupIdsKey = groupId
    ? ''
    : [...new Set(filters?.memberGroupIds ?? [])].filter(Boolean).sort().join(',');
  const normalizedFilters = useMemo<GamesFilters>(() => ({
    status,
    statuses: statusesKey ? statusesKey.split(',') as GameStatus[] : undefined,
    groupId,
    date,
    startDateTime: startDateTimeMs === undefined ? undefined : new Date(startDateTimeMs),
    limitCount,
    orderDirection,
    memberGroupIds: memberGroupIdsKey ? memberGroupIdsKey.split(',') : undefined,
  }), [date, groupId, limitCount, memberGroupIdsKey, orderDirection, startDateTimeMs, status, statusesKey]);
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
      memberGroupIdsKey,
    ] as const,
    [date, groupId, limitCount, memberGroupIdsKey, orderDirection, startDateTimeMs, status, statusesKey]
  );
  const registryKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const firestoreQueries = useMemo(() => buildGamesQueries(normalizedFilters), [normalizedFilters]);
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
    if (!enabled) {
      setListenerLoading(true);
      setListenerError(null);
      return;
    }
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
      firestoreQueries,
      normalizedFilters,
      subscriber,
    );
    subscriptionControlRef.current = control;
    return () => {
      control.release();
      if (subscriptionControlRef.current === control) subscriptionControlRef.current = null;
    };
  }, [enabled, firestoreQueries, normalizedFilters, queryClient, queryKey, registryKey]);

  const refetch = useCallback(async () => {
    subscriptionControlRef.current?.restart();
  }, []);

  return { games, loading: listenerLoading, error: listenerError, refetch };
}

export function useGameDetail(gameId: string | null) {
  const { user, firebaseUser } = useAuth();
  const currentUserId = firebaseUser?.uid || user?.id || null;
  const isAdmin = user?.role === 'ADMIN';
  const [game, setGame] = useState<Game | null>(null);
  const [ownConfirmation, setOwnConfirmation] = useState<GameConfirmation | null>(null);
  const [confirmations, setConfirmations] = useState<GameConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationsError, setConfirmationsError] = useState<string | null>(null);
  // #4573: membro ativo do grupo do jogo vê os confirmados antes de confirmar.
  const [isGameGroupMember, setIsGameGroupMember] = useState(false);
  const gameGroupId = game?.groupId || null;

  useEffect(() => {
    if (!gameGroupId || !currentUserId) {
      setIsGameGroupMember(false);
      return;
    }

    return onSnapshot(
      doc(db, 'groups', gameGroupId, 'members', currentUserId),
      (memberSnap) => {
        const status = memberSnap.data()?.status;
        setIsGameGroupMember(memberSnap.exists() && (status === undefined || status === 'ACTIVE'));
      },
      (err) => {
        // Sem vínculo legível o elenco continua restrito à própria confirmação.
        logger.warn('Error in game group membership listener:', err);
        setIsGameGroupMember(false);
      },
    );
  }, [currentUserId, gameGroupId]);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    const gameRef = doc(db, 'games', gameId);

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

    return unsubscribeGame;
  }, [gameId]);

  // A query restrita ao próprio usuário é autorizável pelas rules mesmo antes
  // de ele confirmar presença. Isso evita tentar listar dados de terceiros para
  // convidados PENDING e visitantes de jogos públicos (#3684).
  useEffect(() => {
    if (!gameId || !currentUserId) {
      setOwnConfirmation(null);
      return;
    }

    const ownConfirmationQuery = query(
      collection(db, 'confirmations'),
      where('game_id', '==', gameId),
      where('user_id', '==', currentUserId),
    );

    return onSnapshot(
      ownConfirmationQuery,
      (snapshot) => {
        const ownDoc = snapshot.docs[0];
        setOwnConfirmation(ownDoc ? parseConfirmationDoc(ownDoc.id, ownDoc.data()) : null);
        setConfirmationsError(null);
      },
      (err) => {
        logger.warn('Error fetching own game confirmation:', err);
        setOwnConfirmation(null);
        setConfirmationsError(getFirestoreErrorMessage(err));
      },
    );
  }, [currentUserId, gameId]);

  const canReadAllConfirmations = Boolean(
    game && currentUserId && (
      isAdmin ||
      game.ownerId === currentUserId ||
      ownConfirmation?.status === 'CONFIRMED' ||
      isGameGroupMember
    ),
  );

  useEffect(() => {
    if (!canReadAllConfirmations || !gameId) {
      setConfirmations(ownConfirmation ? [ownConfirmation] : []);
      return;
    }

    const confirmationsQuery = query(
      collection(db, 'confirmations'),
      where('game_id', '==', gameId),
    );

    return onSnapshot(
      confirmationsQuery,
      (snapshot) => {
        const confirmationsData = snapshot.docs.map((d) => parseConfirmationDoc(d.id, d.data()));
        confirmationsData.sort((a, b) => (a.confirmationOrder || 0) - (b.confirmationOrder || 0));
        setConfirmations(confirmationsData);
        setConfirmationsError(null);
      },
      (err) => {
        // O documento do jogo continua utilizável mesmo quando o elenco não
        // pode ser carregado. Não promover erro auxiliar a falha fatal da tela.
        logger.warn('Error in confirmations roster listener:', err);
        setConfirmations(ownConfirmation ? [ownConfirmation] : []);
        setConfirmationsError(getFirestoreErrorMessage(err));
      },
    );
  }, [canReadAllConfirmations, gameId, ownConfirmation]);

  return { game, confirmations, loading, error, confirmationsError };
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
        const confirmationResult = await confirmGamePresenceCallable({
          gameId,
          position,
          isCasualPlayer: false,
        });
        if (!confirmationResult.data.alreadyConfirmed) {
          trackEvent('game_confirmed', { gameId, position });
        }
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

        // dateTime é exceção ao snake_case (campo canônico no Firestore). O formulário
        // manda só date e time em texto; sem dateTime o jogo some das listas, dos
        // lembretes e do chat (spec bugfix-2026-11-23-jogo-do-web-sem-datetime).
        const formDateTime = (gameData as { dateTime?: unknown }).dateTime;
        const dateTime = formDateTime ?? gameDateTimeFromLocal(gameData.date, gameData.time);
        if (!dateTime) {
          throw new Error(t('games.create.errorInvalidDateTime'));
        }
        delete (snakeGameData as Record<string, unknown>).date_time;
        (snakeGameData as Record<string, unknown>).dateTime = dateTime;

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
        trackEvent('game_created', {
          fieldType: gameData.fieldType ?? 'UNKNOWN',
          groupId: gameData.groupId,
        });
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
