import { doc, getDoc } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * GAP-3: hook leve que confere se o user autenticado é membro do grupo.
 * Usado por <GroupMemberRoute> para guardar rotas /group/:id/{edit,settings,cashbox,invite}.
 *
 * Isolado de `useGroups.ts` para que `App.tsx` (chunk de entrada) não puxe
 * estaticamente `firebase/storage` nem `firebase/functions` no boot inicial.
 */
export function useIsGroupMember(
  groupId: string | null | undefined,
): { isMember: boolean; loading: boolean; error: Error | null } {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;

  const { data, isLoading, error } = useQuery<boolean>({
    queryKey: ['groupMember', uid, groupId],
    queryFn: async () => {
      if (!uid || !groupId) return false;
      // Subcoleção groups/{groupId}/members/{uid} é fonte canônica de membership.
      const memberRef = doc(db, 'groups', groupId, 'members', uid);
      const snap = await getDoc(memberRef);
      if (snap.exists() && snap.data().status === 'ACTIVE') return true;

      const groupSnap = await getDoc(doc(db, 'groups', groupId));
      return groupSnap.exists() && groupSnap.data().owner_id === uid;
    },
    enabled: !!uid && !!groupId,
    staleTime: 60_000, // 1 min — membership não muda frequentemente
  });

  return { isMember: data ?? false, loading: isLoading, error: error instanceof Error ? error : null };
}
