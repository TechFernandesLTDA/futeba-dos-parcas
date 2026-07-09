import { useCallback, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useGroups } from './useGroups';
import type { Group } from '../types/group';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLeagueInvites');

const INVITE_EXPIRATION_MS = 48 * 60 * 60 * 1000;
const MAX_PENDING_GROUP_INVITES = 20;

export interface LeagueInviteTarget {
  userId: string;
  userName: string;
  userPhoto?: string;
}

export interface LeagueInviteOption {
  id: string;
  label: string;
  helper: string;
  group: Group;
}

export function useLeagueInvites() {
  const { user, firebaseUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const uid = firebaseUser?.uid || user?.id;
  const displayName = firebaseUser?.displayName || user?.name || 'Organizador';
  const [sending, setSending] = useState(false);

  const { groups, loading: groupsLoading } = useGroups();

  const manageableGroups = useMemo(
    () =>
      groups.filter((group) =>
        group.ownerId === uid,
      ),
    [groups, uid],
  );

  const inviteOptions = useMemo<LeagueInviteOption[]>(() => {
    return manageableGroups.map((group) => ({
      id: `group:${group.id}`,
      label: group.name,
      helper: `${group.memberCount || 0} membros`,
      group,
    }));
  }, [manageableGroups]);

  const sendGroupInvite = useCallback(
    async (target: LeagueInviteTarget, group: Group) => {
      if (!uid) throw new Error('Usuário não autenticado.');
      if (target.userId === uid) throw new Error('Não é possível convidar você mesmo.');
      if (group.ownerId !== uid) throw new Error('Apenas o dono do grupo pode convidar jogadores.');

      const memberSnap = await getDoc(doc(db, 'groups', group.id, 'members', target.userId));
      if (memberSnap.exists()) {
        const status = memberSnap.data().status;
        if (status !== 'REMOVED' && status !== 'INACTIVE') {
          throw new Error('Este jogador já possui vínculo ativo ou bloqueado neste grupo.');
        }
      }

      const pendingQuery = query(
        collection(db, 'group_invites'),
        where('invited_by_id', '==', uid),
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

  const sendInvite = useCallback(
    async (target: LeagueInviteTarget, option: LeagueInviteOption) => {
      setSending(true);
      try {
        await sendGroupInvite(target, option.group);
        showSuccess('Convite enviado.');
      } catch (error) {
        logger.error('Erro ao enviar convite pela Liga:', error);
        showError(
          error instanceof Error && !(error as { code?: string }).code
            ? error.message
            : getFirestoreErrorMessage(error)
        );
        throw error;
      } finally {
        setSending(false);
      }
    },
    [sendGroupInvite, showError, showSuccess],
  );

  return {
    inviteOptions,
    loading: groupsLoading,
    error: null,
    sending,
    sendInvite,
  };
}
