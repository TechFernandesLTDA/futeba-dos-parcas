import { useCallback, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useGroups } from './useGroups';
import type { Game, GameStatus } from '../types/game';
import type { Group } from '../types/group';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLeagueInvites');

const ACTIVE_GAME_STATUSES: GameStatus[] = ['SCHEDULED', 'CONFIRMED'];
const INVITE_EXPIRATION_MS = 48 * 60 * 60 * 1000;
const MAX_PENDING_GROUP_INVITES = 20;

export interface LeagueInviteTarget {
  userId: string;
  userName: string;
  userPhoto?: string;
}

export type LeagueInviteOption =
  | {
      id: string;
      type: 'group';
      label: string;
      helper: string;
      group: Group;
    }
  | {
      id: string;
      type: 'game';
      label: string;
      helper: string;
      game: Game;
    };

function parseGameDoc(id: string, raw: Record<string, unknown>): Game {
  const converted = snakeToCamel(raw);
  return {
    id,
    ...converted,
    dateTime: toDate((raw.dateTime ?? raw.date_time) as Timestamp | Date),
    createdAt: toDate((raw.created_at ?? raw.createdAt) as Timestamp | Date),
    updatedAt: toDate((raw.updated_at ?? raw.updatedAt) as Timestamp | Date),
  } as Game;
}

async function fetchOwnedUpcomingGames(ownerId: string): Promise<Game[]> {
  const now = new Date();
  const gamesQuery = query(
    collection(db, 'games'),
    where('owner_id', '==', ownerId),
    where('status', 'in', ACTIVE_GAME_STATUSES),
    where('dateTime', '>=', Timestamp.fromDate(now)),
    orderBy('dateTime', 'asc'),
    limit(50),
  );
  const snapshot = await getDocs(gamesQuery);
  const nowMs = now.getTime();

  return snapshot.docs
    .map((gameDoc) => parseGameDoc(gameDoc.id, gameDoc.data()))
    .filter((game) => {
      const gameDateTime = game.dateTime?.getTime?.() ?? null;
      const hasOpenSpot = (game.playersCount ?? 0) < (game.maxPlayers ?? 0);
      return (
        hasOpenSpot &&
        (!gameDateTime || gameDateTime >= nowMs)
      );
    });
}

export function useLeagueInvites() {
  const { user, firebaseUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const uid = firebaseUser?.uid || user?.id;
  const displayName = firebaseUser?.displayName || user?.name || 'Organizador';
  const [sending, setSending] = useState(false);

  const { groups, loading: groupsLoading } = useGroups();

  const manageableGroups = useMemo(
    () =>
      groups.filter((group) =>
        group.role === 'OWNER' ||
        group.role === 'ADMIN' ||
        group.ownerId === uid,
      ),
    [groups, uid],
  );

  const {
    data: ownedGames = [],
    isLoading: gamesLoading,
    error: gamesError,
  } = useQuery({
    queryKey: ['league-invite-games', uid],
    queryFn: () => fetchOwnedUpcomingGames(uid!),
    enabled: !!uid,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const inviteOptions = useMemo<LeagueInviteOption[]>(() => {
    const groupOptions: LeagueInviteOption[] = manageableGroups.map((group) => ({
      id: `group:${group.id}`,
      type: 'group',
      label: group.name,
      helper: `${group.memberCount || 0} membros`,
      group,
    }));

    const gameOptions: LeagueInviteOption[] = ownedGames.map((game) => ({
      id: `game:${game.id}`,
      type: 'game',
      label: game.locationName || game.groupName || 'Jogo',
      helper: [game.date, game.time].filter(Boolean).join(' - '),
      game,
    }));

    return [...groupOptions, ...gameOptions];
  }, [manageableGroups, ownedGames]);

  const sendGroupInvite = useCallback(
    async (target: LeagueInviteTarget, group: Group) => {
      if (!uid) throw new Error('Usuário não autenticado.');
      if (target.userId === uid) throw new Error('Não é possível convidar você mesmo.');

      const memberSnap = await getDoc(doc(db, 'groups', group.id, 'members', target.userId));
      if (memberSnap.exists()) {
        const status = memberSnap.data().status;
        if (status !== 'REMOVED' && status !== 'INACTIVE') {
          throw new Error('Este jogador já possui vínculo ativo ou bloqueado neste grupo.');
        }
      }

      const pendingQuery = query(
        collection(db, 'group_invites'),
        where('group_id', '==', group.id),
        where('invited_user_id', '==', target.userId),
        where('status', '==', 'PENDING'),
      );
      const pending = await getDocs(pendingQuery);
      if (!pending.empty) {
        throw new Error('Já existe um convite pendente para este jogador neste grupo.');
      }

      const senderPendingQuery = query(
        collection(db, 'group_invites'),
        where('invited_by_id', '==', uid),
        where('group_id', '==', group.id),
        where('status', '==', 'PENDING'),
      );
      const senderPending = await getDocs(senderPendingQuery);
      if (senderPending.size >= MAX_PENDING_GROUP_INVITES) {
        throw new Error(`Você já tem ${senderPending.size} convites pendentes neste grupo. Aguarde respostas antes de enviar mais.`);
      }

      await setDoc(doc(collection(db, 'group_invites')), {
        group_id: group.id,
        group_name: group.name,
        group_photo: group.photoUrl || null,
        invited_by_id: uid,
        invited_by_name: displayName,
        invited_user_id: target.userId,
        invited_user_name: target.userName,
        invited_user_photo: target.userPhoto || null,
        status: 'PENDING',
        expires_at: Timestamp.fromDate(new Date(Date.now() + INVITE_EXPIRATION_MS)),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    },
    [displayName, uid],
  );

  const sendGameInvite = useCallback(
    async (target: LeagueInviteTarget, game: Game) => {
      if (!uid) throw new Error('Usuário não autenticado.');
      if (target.userId === uid) throw new Error('Não é possível convidar você mesmo.');

      const confirmationId = `${game.id}_${target.userId}`;
      const confirmationRef = doc(db, 'confirmations', confirmationId);
      const summonRef = doc(db, 'game_summons', confirmationId);
      const pendingSummon = await getDoc(summonRef);
      if (pendingSummon.exists() && pendingSummon.data().status === 'PENDING') {
        throw new Error('Este jogador já tem presença ou convite para este jogo.');
      }

      const notificationRef = doc(collection(db, 'notifications'));
      const message = `${displayName} chamou você para jogar em ${game.locationName || 'um jogo'}.`;

      await runTransaction(db, async (transaction) => {
        const existingConfirmation = await transaction.get(confirmationRef);
        if (existingConfirmation.exists()) {
          throw new Error('Este jogador já tem presença ou convite para este jogo.');
        }

        const existingSummon = await transaction.get(summonRef);
        if (existingSummon.exists() && existingSummon.data().status === 'PENDING') {
          throw new Error('Este jogador já tem presença ou convite para este jogo.');
        }

        transaction.set(confirmationRef, {
          id: confirmationId,
          game_id: game.id,
          user_id: target.userId,
          user_name: target.userName,
          user_photo: target.userPhoto || '',
          position: 'FIELD',
          status: 'PENDING',
          is_casual_player: false,
          payment_status: 'PENDING',
          created_at: serverTimestamp(),
        });

        transaction.set(summonRef, {
          game_id: game.id,
          group_id: game.groupId || null,
          user_id: target.userId,
          user_name: target.userName,
          summoned_by: uid,
          summoned_by_name: displayName,
          position: 'ANY_FIELD',
          confirmation_position: 'FIELD',
          status: 'PENDING',
          game_location: game.locationName || '',
          game_date: game.date || '',
          game_time: game.time || '',
          created_at: serverTimestamp(),
        });

        transaction.set(notificationRef, {
          user_id: target.userId,
          created_by: uid,
          type: 'GAME_SUMMON',
          title: `Convite para jogo: ${game.locationName || 'Futeba'}`,
          body: message,
          message,
          reference_id: game.id,
          reference_type: 'game',
          action_type: 'OPEN_GAME',
          game_id: game.id,
          group_id: game.groupId || null,
          sender_id: uid,
          sender_name: displayName,
          read: false,
          created_at: serverTimestamp(),
        });
      });
      queryClient.invalidateQueries({ queryKey: ['game', game.id] });
      queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
    },
    [displayName, queryClient, uid],
  );

  const sendInvite = useCallback(
    async (target: LeagueInviteTarget, option: LeagueInviteOption) => {
      setSending(true);
      try {
        if (option.type === 'group') {
          await sendGroupInvite(target, option.group);
        } else {
          await sendGameInvite(target, option.game);
        }
        showSuccess('Convite enviado.');
      } catch (error) {
        logger.error('Erro ao enviar convite pela Liga:', error);
        showError(getFirestoreErrorMessage(error));
        throw error;
      } finally {
        setSending(false);
      }
    },
    [sendGameInvite, sendGroupInvite, showError, showSuccess],
  );

  return {
    inviteOptions,
    loading: groupsLoading || gamesLoading,
    error: gamesError instanceof Error ? gamesError.message : null,
    sending,
    sendInvite,
  };
}
