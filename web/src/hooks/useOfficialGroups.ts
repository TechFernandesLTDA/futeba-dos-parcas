import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {

  collection,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { OfficialGroup } from '../types/group';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';

function parseOfficialGroup(id: string, raw: Record<string, unknown>): OfficialGroup {
  const converted = snakeToCamel(raw);
  return {
    id,
    ...converted,
    createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  } as OfficialGroup;
}

async function fetchOfficialGroups(): Promise<OfficialGroup[]> {
  const ref = collection(db, 'official-groups');
  const q = query(ref, orderBy('category'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => parseOfficialGroup(d.id, d.data()));
}

/**
 * #2251: expõe INTENCIONALMENTE o resultado bruto de useQuery
 * (data/isLoading/error/refetch). Consumidores usam a API do TanStack Query.
 * Não envolver no contrato { data, loading, error }.
 */
export function useOfficialGroups() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  return useQuery({
    queryKey: ['official-groups'],
    queryFn: fetchOfficialGroups,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!uid,
  });
}

/**
 * #2251: expõe INTENCIONALMENTE o resultado bruto de useQuery.
 * Não envolver no contrato { data, loading, error }.
 */
export function useIsInOfficialGroup(groupId?: string) {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  return useQuery({
    queryKey: ['official-group-member', uid, groupId],
    queryFn: async () => {
      if (!uid || !groupId) return false;
      const q = query(
        collection(db, 'users', uid, 'groups'),
        where('group_id', '==', groupId),
      );
      const snap = await getDocs(q);
      return !snap.empty;
    },
    staleTime: 60 * 1000,
    enabled: !!uid && !!groupId,
  });
}

export function useJoinOfficialGroup() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const uid = user?.id ?? '';
  const userName = user?.name ?? '';

  return useMutation({
    mutationFn: async (officialGroup: OfficialGroup) => {
      if (!uid || !userName) throw new Error('Você precisa estar logado.');

      const batch = writeBatch(db);
      const memberRef = doc(db, 'groups', officialGroup.id, 'members', uid);
      const userGroupRef = doc(db, 'users', uid, 'groups', officialGroup.id);
      const groupRef = doc(db, 'groups', officialGroup.id);

      batch.set(memberRef, {
        user_id: uid,
        user_name: userName,
        user_photo_url: null,
        role: 'MEMBER',
        joined_at: serverTimestamp(),
        total_games: 0,
        level: 1,
        status: 'ACTIVE',
      });

      batch.set(userGroupRef, {
        group_id: officialGroup.id,
        group_name: officialGroup.name,
        group_photo: null,
        role: 'MEMBER',
        member_count: officialGroup.memberCount,
        joined_at: serverTimestamp(),
      });

      batch.update(groupRef, {
        member_count: (officialGroup.memberCount || 0) + 1,
        members: [uid],
      });

      await batch.commit();
    },
    onSuccess: (_, officialGroup) => {
      showSuccess(`Você entrou em "${officialGroup.name}"!`);
      queryClient.invalidateQueries({ queryKey: ['official-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', uid] });
      queryClient.invalidateQueries({ queryKey: ['official-group-member', uid, officialGroup.id] });
    },
    onError: (err) => {
      showError(getFirestoreErrorMessage(err));
    },
  });
}
