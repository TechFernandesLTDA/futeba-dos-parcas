import { useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { confirmGamePresence } from '../services/cloudFunctions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { getActiveMembersToInvite } from '../utils/autoInviteMembers';

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

        const membersToInvite = getActiveMembersToInvite(snapshot.docs, uid);
        if (membersToInvite.length === 0) return 0;

        const batch = writeBatch(db);

        // Criar PENDING para os membros do grupo
        let inviteCount = 0;
        for (const memberDoc of membersToInvite) {
          const memberData = memberDoc.data();
          const memberId = memberDoc.id;
          const memberName = memberData.display_name || memberData.name || 'Membro';

          const confirmationRef = doc(db, 'confirmations', `${gameId}_${memberId}`);
          const confirmationSnap = await getDoc(confirmationRef);
          if (confirmationSnap.exists()) continue;
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

        if (inviteCount === 0) return 0;

        await batch.commit();

        // Confirmar presenca do owner via callable transacional (#3501):
        // regras Firestore bloqueiam client writes com status CONFIRMED.
        try {
          await confirmGamePresence({
            gameId,
            position: 'FIELD',
            isCasualPlayer: false,
          });
          // eslint-disable-next-line no-restricted-syntax
        } catch (confirmErr) {
          logger.error('Owner auto-confirm failed (members still invited):', confirmErr);
        }

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
