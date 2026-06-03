import { useCallback } from 'react';
import {

  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useAutoInviteMembers');

export function useAutoInviteMembers() {
  const { t } = useTranslation();
  const { firebaseUser, user } = useAuth();
  const { showError } = useToast();

  const autoInvite = useCallback(
    async (gameId: string, groupId: string): Promise<number> => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid || !groupId || !gameId) return 0;

      try {
        const membersRef = collection(db, 'groups', groupId, 'members');
        const snapshot = await getDocs(membersRef);

        const membersToInvite = snapshot.docs.filter((d) => d.id !== uid);
        if (membersToInvite.length === 0) return 0;

        const ownerName = firebaseUser?.displayName || user?.name || 'Organizador';

        // Criar confirmação do owner como CONFIRMED
        const ownerConfirmationRef = doc(db, 'confirmations', `${gameId}_${uid}`);
        const batch = writeBatch(db);
        batch.set(ownerConfirmationRef, {
          game_id: gameId,
          user_id: uid,
          user_name: ownerName,
          status: 'CONFIRMED',
          position: 'FIELD',
          is_casual_player: false,
          created_at: serverTimestamp(),
        });

        // Criar PENDING para os membros do grupo
        let inviteCount = 0;
        for (const memberDoc of membersToInvite) {
          const memberData = memberDoc.data();
          const memberId = memberDoc.id;
          const memberName = memberData.display_name || memberData.name || 'Membro';

          const confirmationRef = doc(db, 'confirmations', `${gameId}_${memberId}`);
          batch.set(confirmationRef, {
            game_id: gameId,
            user_id: memberId,
            user_name: memberName,
            status: 'PENDING',
            position: 'FIELD',
            is_casual_player: false,
            created_at: serverTimestamp(),
          });

          inviteCount++;
        }

        await batch.commit();
        return inviteCount;
      } catch (err) {
        logger.error('Error auto-inviting members:', err);
        showError(t('feedback.groups.autoInviteError'));
        return 0;
      }
    },
    [firebaseUser, user, showError, t],
  );

  return { autoInvite };
}
