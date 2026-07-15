import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Game, GameConfirmation } from '../types/game';
import type { User } from '../types/user';
import { getFirestoreErrorMessage, getFunctionErrorMessage } from '../utils/firebaseErrors';
import { createLogger } from '../utils/logger';
import { getLeaguePlayers } from '../services/cloudFunctions';
import {
  toReinforcementSignals,
  toReinforcementUser,
} from '../utils/publicPlayerProjection';
import {
  buildReinforcementCandidates,
  getConfirmationPositionForNeed,
  type ReinforcementCandidate,
  type ReinforcementNeed,
} from '../utils/positionReinforcements';

const logger = createLogger('usePositionReinforcements');
const CANDIDATES_LIMIT = 80;
const NEED_NOTIFICATION_LABELS: Record<ReinforcementNeed, string> = {
  GOALKEEPER: 'goleiro',
  DEFENDER: 'defesa',
  MIDFIELDER: 'meio-campo',
  STRIKER: 'ataque',
  ANY_FIELD: 'linha',
};

export function usePositionReinforcements(
  game: Game | null,
  confirmations: GameConfirmation[],
  need: ReinforcementNeed,
  recentPresenceOnly = false,
) {
  const { user, firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<User[]>([]);
  const [signalsByUserId, setSignalsByUserId] = useState(
    new Map<string, ReturnType<typeof toReinforcementSignals>>(),
  );
  const [loading, setLoading] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const excludedUserIds = useMemo(
    () => new Set(confirmations
      .filter((confirmation) => confirmation.status !== 'CANCELLED')
      .map((confirmation) => confirmation.userId)),
    [confirmations],
  );

  const candidates = useMemo(
    () => buildReinforcementCandidates(users, need, excludedUserIds, {
      recentPresenceOnly,
      signalsByUserId,
    }),
    [excludedUserIds, need, recentPresenceOnly, signalsByUserId, users],
  );

  const refetch = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!game?.id) {
      setUsers([]);
      setSignalsByUserId(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchCandidates = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getLeaguePlayers({
          limit: CANDIDATES_LIMIT,
          sortField: 'experiencePoints',
          sortDirection: 'desc',
        });
        if (cancelled) return;

        setUsers(response.data.players.map(toReinforcementUser));
        setSignalsByUserId(new Map(response.data.players.map((player) => [
          player.userId,
          toReinforcementSignals(player),
        ])));
      } catch (err) {
        logger.error('Error loading reinforcement candidates:', err);
        if (!cancelled) {
          setUsers([]);
          setSignalsByUserId(new Map());
          setError(getFunctionErrorMessage(
            err,
            'getLeaguePlayers',
            'Não foi possível carregar os reforços.',
          ));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCandidates();

    return () => {
      cancelled = true;
    };
  }, [game?.id, refreshToken]);

  const sendReinforcement = useCallback(
    async (candidate: ReinforcementCandidate) => {
      const senderId = firebaseUser?.uid || user?.id;
      if (!senderId || !game?.id) return false;
      if (candidate.user.id === senderId) return false;

      setSendingUserId(candidate.user.id);
      setError(null);
      try {
        const confirmationId = `${game.id}_${candidate.user.id}`;
        const confirmationRef = doc(db, 'confirmations', confirmationId);
        const existingConfirmation = await getDoc(confirmationRef);
        if (existingConfirmation.exists()) {
          throw new Error('Este jogador ja tem uma confirmacao ou convite para este jogo.');
        }

        const summonRef = doc(collection(db, 'game_summons'));
        const notificationRef = doc(collection(db, 'notifications'));
        const batch = writeBatch(db);
        const senderName = firebaseUser?.displayName || user?.name || game.ownerName || 'Organizador';
        const targetName = candidate.user.name || candidate.user.nickname || 'Jogador';
        const confirmationPosition = getConfirmationPositionForNeed(candidate.need);
        const needLabel = NEED_NOTIFICATION_LABELS[candidate.need];
        const notificationMessage = `${senderName} chamou voce para reforcar o jogo como ${needLabel}.`;

        batch.set(confirmationRef, {
          id: confirmationId,
          game_id: game.id,
          user_id: candidate.user.id,
          user_name: targetName,
          user_photo: candidate.user.photoUrl || '',
          position: confirmationPosition,
          status: 'PENDING',
          is_casual_player: false,
          created_at: serverTimestamp(),
        });

        batch.set(summonRef, {
          game_id: game.id,
          group_id: game.groupId || null,
          user_id: candidate.user.id,
          user_name: targetName,
          summoned_by: senderId,
          summoned_by_name: senderName,
          position: candidate.need,
          confirmation_position: confirmationPosition,
          status: 'PENDING',
          game_location: game.locationName,
          game_date: game.date,
          game_time: game.time,
          created_at: serverTimestamp(),
        });

        batch.set(notificationRef, {
          user_id: candidate.user.id,
          created_by: senderId,
          type: 'GAME_SUMMON',
          title: `Reforco pedido: ${game.locationName}`,
          body: notificationMessage,
          message: notificationMessage,
          reference_id: game.id,
          reference_type: 'game',
          action_type: 'OPEN_GAME',
          game_id: game.id,
          group_id: game.groupId || null,
          read: false,
          created_at: serverTimestamp(),
        });

        await batch.commit();
        queryClient.invalidateQueries({ queryKey: ['game', game.id] });
        queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
        setUsers((current) => current.filter((candidateUser) => candidateUser.id !== candidate.user.id));
        return true;
      } catch (err) {
        logger.error('Error sending position reinforcement:', err);
        setError(getFirestoreErrorMessage(err));
        throw err;
      } finally {
        setSendingUserId(null);
      }
    },
    [firebaseUser, game, queryClient, user],
  );

  return {
    candidates,
    loading,
    error,
    refetch,
    sendReinforcement,
    sendingUserId,
  };
}
