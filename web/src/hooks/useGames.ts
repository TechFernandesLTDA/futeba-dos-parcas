import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Game, GameConfirmation, GameStatus, ConfirmationStatus } from '../types/game';
import { useAuth } from '../contexts/AuthContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { camelToSnake } from '../utils/camelToSnake';
import { createLogger } from '../utils/logger';

const logger = createLogger('useGames');

export function useGames(filters?: {
  status?: GameStatus;
  groupId?: string;
  date?: string;
  limitCount?: number;
}) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const gamesRef = collection(db, 'games');
    // Ordenar por dateTime (mesmo campo usado pelo Android)
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
    if (filters?.limitCount) {
      q = query(q, limit(filters.limitCount));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gamesData = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel(raw);
          return {
            id: d.id,
            ...converted,
            dateTime: raw.dateTime?.toDate?.() || raw.date_time?.toDate?.() || converted.dateTime,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
            updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
            votingDeadline: (raw.voting_deadline || raw.votingDeadline)?.toDate?.(),
            xpProcessedAt: (raw.xp_processed_at || raw.xpProcessedAt)?.toDate?.(),
            deletedAt: (raw.deleted_at || raw.deletedAt)?.toDate?.(),
          } as Game;
        });
        setGames(gamesData.filter((g) => !g.deletedAt));
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching games:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters?.status, filters?.groupId, filters?.date, filters?.limitCount]);

  return { games, loading, error };
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
          const converted = snakeToCamel(raw);
          setGame({
            id: docSnap.id,
            ...converted,
            dateTime: (raw.dateTime || raw.date_time)?.toDate?.() || converted.dateTime,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
            updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
            votingDeadline: (raw.voting_deadline || raw.votingDeadline)?.toDate?.(),
            xpProcessedAt: (raw.xp_processed_at || raw.xpProcessedAt)?.toDate?.(),
            deletedAt: (raw.deleted_at || raw.deletedAt)?.toDate?.(),
          } as Game);
        } else {
          setGame(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching game:', err);
        setError(err.message);
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
            confirmedAt: (raw.confirmed_at || raw.confirmedAt)?.toDate?.(),
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
            checkedInAt: (raw.checked_in_at || raw.checkedInAt)?.toDate?.(),
          } as GameConfirmation;
        });
        // Ordenar por confirmation_order client-side
        confirmationsData.sort((a, b) => (a.confirmationOrder || 0) - (b.confirmationOrder || 0));
        setConfirmations(confirmationsData);
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
  const { user, firebaseUser } = useAuth();
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
          created_at: Timestamp.now(),
        };

        const { setDoc } = await import('firebase/firestore');
        await setDoc(confirmationRef, confirmationData);
        setLoading(false);
        return true;
      } catch (err) {
        logger.error('Error confirming presence:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    [firebaseUser, user]
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
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(confirmationRef);
        setLoading(false);
        return true;
      } catch (err) {
        logger.error('Error cancelling presence:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    [firebaseUser, user]
  );

  return { confirmPresence, cancelPresence, loading, error };
}

export function useCreateGame() {
  const { user, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // Remover campos undefined (Firestore não aceita)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanData: Record<string, any> = {};
        for (const [key, value] of Object.entries(snakeGameData)) {
          if (value !== undefined) {
            cleanData[key] = value;
          }
        }

        const newGame = {
          ...cleanData,
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
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        };

        const docRef = await addDoc(gamesRef, newGame);
        setLoading(false);
        return docRef.id;
      } catch (err) {
        logger.error('Error creating game:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    [firebaseUser, user]
  );

  return { createGame, loading, error };
}

export function useUpdateGameStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        const gameData = gameDoc.data() as Game;

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
          updated_at: Timestamp.now(),
        });

        setLoading(false);
        return true;
      } catch (err) {
        logger.error('Error updating game status:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    []
  );

  return { updateStatus, loading, error };
}
