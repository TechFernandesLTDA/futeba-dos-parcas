import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  documentId,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, storage } from '../services/firebase';
import { Group, GroupMember, GroupRole, CashboxTransaction } from '../types/group';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';

const logger = createLogger('useGroups');

// Converte documento Firestore para objeto Group
function parseGroupDoc(docId: string, raw: Record<string, unknown>): Group {
  const converted = snakeToCamel(raw);
  return {
    id: docId,
    ...converted,
    createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.(),
    updatedAt: ((raw.updated_at || raw.updatedAt) as { toDate?: () => Date })?.toDate?.(),
    nextGameDate: ((raw.next_game_date || raw.nextGameDate) as { toDate?: () => Date })?.toDate?.(),
    deletedAt: ((raw.deleted_at || raw.deletedAt) as { toDate?: () => Date })?.toDate?.(),
  } as Group;
}

// Busca grupos do usuário via subcoleção users/{uid}/groups como fonte primária,
// com follow-up read dos docs completos para dados como type, description, nextGameDate.
async function fetchUserGroups(uid: string): Promise<Group[]> {
  const userGroupsRef = collection(db, 'users', uid, 'groups');
  const q = query(userGroupsRef, orderBy('joined_at', 'desc'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return [];

  const entries = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      groupId: (data.group_id as string) || d.id,
      role: data.role as GroupRole,
      fallbackName: (data.group_name as string) || 'Grupo',
      fallbackPhoto: (data.group_photo as string) || null,
      fallbackMemberCount: (data.member_count as number) || 0,
    };
  });

  const groupIds = entries.map((e) => e.groupId);

  // Follow-up read: buscar docs completos dos grupos (aceitável para ≤10 grupos)
  const groupsMap = new Map<string, Group>();
  const chunks: string[][] = [];
  for (let i = 0; i < groupIds.length; i += 10) {
    chunks.push(groupIds.slice(i, i + 10));
  }

  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'groups'), where(documentId(), 'in', chunk)))
    )
  );

  for (const result of settled) {
    if (result.status === 'rejected') {
      // #1334: não engolir falha de chunk em silêncio. A tela ainda renderiza
      // com os dados de fallback da subcoleção (nome/foto/contagem), então não
      // é perda total — mas a falha precisa ser observável (Pattern 2 web-react).
      logger.error('Falha ao ler chunk de grupos (usando fallback):', result.reason);
      continue;
    }
    for (const docSnap of result.value.docs) {
      const raw = docSnap.data();
      groupsMap.set(docSnap.id, parseGroupDoc(docSnap.id, raw));
    }
  }

  // Merge: dados completos do grupo + dados da subcoleção (role, fallback)
  return entries
    .map((entry) => {
      const groupDoc = groupsMap.get(entry.groupId);
      if (groupDoc) {
        return { ...groupDoc, role: entry.role, memberCount: groupDoc.memberCount || entry.fallbackMemberCount };
      }
      return {
        id: entry.groupId,
        name: entry.fallbackName,
        photoUrl: entry.fallbackPhoto,
        memberCount: entry.fallbackMemberCount,
        role: entry.role,
      } as unknown as Group;
    })
    .filter((g) => !g.deletedAt);
}

/**
 * Discovery de grupos publicos (issue #517 phase 1).
 *
 * Query: groups where is_public == true && deleted_at == null
 * Lista todos os grupos publicos do sistema, paginada client-side.
 * Filtra deleted_at no cliente (a maioria dos grupos publicos NAO esta
 * soft-deleted, entao nao vale criar um composite index).
 */
async function fetchPublicGroups(maxResults = 100): Promise<Group[]> {
  const groupsRef = collection(db, 'groups');
  // FIX #1129: limit() server-side para evitar full-scan da collection.
  // Requer composite index: is_public ASC, created_at DESC
  const q = query(groupsRef, where('is_public', '==', true), orderBy('created_at', 'desc'), fsLimit(maxResults));
  const snapshot = await getDocs(q);

  const groups: Group[] = [];
  for (const docSnap of snapshot.docs) {
    const raw = docSnap.data();
    // Skip soft-deleted (filtrado no cliente — sem composite index)
    if (raw.deleted_at) continue;
    if (raw.status === 'DELETED') continue;
    const camel = snakeToCamel(raw) as Partial<Group>;
    groups.push({
      ...(camel as Group),
      id: docSnap.id,
    });
  }

  // Ordenar por createdAt DESC (mais novos primeiro).
  // FIX #1118: aceita Date (getTime), Firestore Timestamp (.toMillis ou .seconds).
  // Antes: só .seconds — quebrava quando createdAt já era Date.
  const tsOf = (g: Group): number => {
    const c = g.createdAt as unknown as
      | { getTime?: () => number; seconds?: number; toMillis?: () => number }
      | undefined;
    if (!c) return 0;
    if (typeof c.getTime === 'function') return c.getTime();
    if (typeof c.toMillis === 'function') return c.toMillis();
    if (typeof c.seconds === 'number') return c.seconds * 1000;
    return 0;
  };
  groups.sort((a, b) => tsOf(b) - tsOf(a));

  return groups;
}

export function useDiscoverPublicGroups() {
  const { user, firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || user?.id;

  const { data: groups = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['public-groups', uid],
    queryFn: () => fetchPublicGroups(),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false, // lista de grupos públicos — não refetch ao focar janela
  });

  return { groups, loading, error: error?.message || null, refetch };
}

// Busca grupos do usuário via subcoleção users/{uid}/groups (igual ao Android)
export function useGroups() {
  const { user, firebaseUser } = useAuth();
  const { showError } = useToast();
  const uid = firebaseUser?.uid || user?.id;
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['groups', uid],
    queryFn: () => fetchUserGroups(uid!),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000, // 2 minutos - grupos mudam com menos frequência
    gcTime: 10 * 60 * 1000, // 10 minutos no garbage collection
  });

  // Listener para atualizações real-time na subcoleção do usuário
  // Invalida o cache quando a subcoleção muda
  useEffect(() => {
    if (!uid) return;

    const userGroupsRef = collection(db, 'users', uid, 'groups');
    const q = query(userGroupsRef, orderBy('joined_at', 'desc'));
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['groups', uid] });
    }, (err) => {
      logger.error('Error in groups listener:', err);
      showError('Erro ao sincronizar grupos.');
    });

    return () => unsubscribe();
  }, [uid, queryClient, showError]);

  const error = queryError ? (queryError as Error).message : null;

  return { groups, loading, error, refetch };
}

export function useGroupDetail(groupId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [groupDeleted, setGroupDeleted] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const groupRef = doc(db, 'groups', groupId);
    const membersRef = collection(db, 'groups', groupId, 'members');

    const unsubscribeGroup = onSnapshot(
      groupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const parsed = parseGroupDoc(docSnap.id, raw);
          // Checar se grupo foi encerrado (soft-delete)
          if (parsed.deletedAt || raw.is_active === false) {
            setGroupDeleted(true);
            setGroup(null);
          } else {
            setGroupDeleted(false);
            setGroup(parsed);
          }
        } else {
          setGroupDeleted(false);
          setGroup(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching group:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    const unsubscribeMembers = onSnapshot(
      query(membersRef, orderBy('joined_at', 'desc')),
      (snapshot) => {
        const membersData = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel<GroupMember>(raw);
          return {
            ...converted,
            id: d.id,
            joinedAt: ((raw.joined_at || raw.joinedAt) as { toDate?: () => Date })?.toDate?.() || new Date(),
          };
        });
        setMembers(membersData);
      },
      (err) => {
        logger.error('Error fetching members:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
    };
  }, [groupId]);

  return { group, groupDeleted, members, loading, error };
}

export function useCreateGroup() {
  const { user, firebaseUser } = useAuth();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createGroup = useCallback(
    async (
      groupData: { name: string; description?: string; isPublic?: boolean },
      photoFile?: File | null
    ) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        const batch = writeBatch(db);

        const groupRef = doc(collection(db, 'groups'));
        const memberRef = doc(collection(db, 'groups', groupRef.id, 'members'), uid);
        const displayName = firebaseUser?.displayName || user?.name || 'Dono';

        let photoUrl: string | null = null;
        if (photoFile) {
          const groupPhotoRef = storageRef(storage, `groups/${groupRef.id}/logo.jpg`);
          await uploadBytes(groupPhotoRef, photoFile, { contentType: photoFile.type });
          photoUrl = await getDownloadURL(groupPhotoRef);
        }

        const newGroup = {
          name: groupData.name,
          description: groupData.description || '',
          photo_url: photoUrl,
          type: groupData.isPublic ? 'PUBLIC' : 'PRIVATE',
          is_public: groupData.isPublic || false,
          owner_id: uid,
          owner_name: displayName,
          member_count: 1,
          members: [uid],
          total_games_played: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };

        batch.set(groupRef, newGroup);

        batch.set(memberRef, {
          id: uid,
          user_id: uid,
          user_name: displayName,
          user_photo_url: firebaseUser?.photoURL || user?.photoUrl || null,
          role: 'OWNER' as GroupRole,
          joined_at: serverTimestamp(),
          total_games: 0,
          level: user?.level || 1,
        });

        // Escrever na subcoleção users/{uid}/groups (igual ao Android)
        const userGroupRef = doc(db, 'users', uid, 'groups', groupRef.id);
        batch.set(userGroupRef, {
          group_id: groupRef.id,
          group_name: groupData.name,
          group_photo: photoUrl,
          role: 'OWNER',
          member_count: 1,
          joined_at: serverTimestamp(),
        });

        await batch.commit();
        // Invalidar cache de grupos após criar
        queryClient.invalidateQueries({ queryKey: ['groups', uid] });
        setLoading(false);
        return groupRef.id;
      } catch (err) {
        logger.error('Error creating group:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao criar grupo.');
        throw err;
      }
    },
    [firebaseUser, user, queryClient, showError]
  );

  return { createGroup, loading, error };
}

export function useCashbox(groupId: string | null) {
  const [transactions, setTransactions] = useState<CashboxTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const cashboxRef = collection(db, 'groups', groupId, 'cashbox');

    const unsubscribe = onSnapshot(
      query(cashboxRef, orderBy('date', 'desc')),
      (snapshot) => {
        let totalBalance = 0;
        const transactionsData = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel(raw);
          if (raw.type === 'INCOME') {
            totalBalance += raw.amount as number;
          } else {
            totalBalance -= raw.amount as number;
          }
          return {
            id: d.id,
            ...converted,
            date: (raw.date as { toDate?: () => Date })?.toDate?.(),
            createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.(),
          } as CashboxTransaction;
        });
        setTransactions(transactionsData);
        setBalance(totalBalance);
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching cashbox:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  return { transactions, balance, loading, error };
}

export function useInvitePlayers() {
  const { user, firebaseUser } = useAuth();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const generateInviteCode = useCallback(
    async (groupId: string, groupName: string) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const displayName = firebaseUser?.displayName || user?.name || 'Organizador';

        // #1541: expires_at precisa ser 7 dias no futuro; serverTimestamp() criava
        // convites já expirados imediatamente.
        const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await addDoc(collection(db, 'invites'), {
          code,
          group_id: groupId,
          group_name: groupName,
          inviter_id: uid,
          inviter_name: displayName,
          created_at: serverTimestamp(),
          expires_at: expiresAt,
          used: false,
        });

        setLoading(false);
        return code;
      } catch (err) {
        logger.error('Error generating invite:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao gerar código de convite.');
        throw err;
      }
    },
    [firebaseUser, user, showError]
  );

  const joinByInviteCode = useCallback(
    async (code: string) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('code', '==', code.toUpperCase()), where('used', '==', false));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          throw new Error('Invalid or expired invite code');
        }

        const inviteDoc = snapshot.docs[0];
        const inviteData = inviteDoc.data();

        // #1541: verificar se o convite expirou
        if (inviteData.expires_at && (inviteData.expires_at as Timestamp).toMillis() < Date.now()) {
          throw new Error('Convite expirado');
        }

        const groupId = inviteData.group_id || inviteData.groupId;

        const batch = writeBatch(db);

        const memberRef = doc(db, 'groups', groupId, 'members', uid);
        const groupRef = doc(db, 'groups', groupId);
        const displayName = firebaseUser?.displayName || user?.name || 'Jogador';

        batch.set(memberRef, {
          id: uid,
          user_id: uid,
          user_name: displayName,
          user_photo_url: firebaseUser?.photoURL || user?.photoUrl || null,
          role: 'MEMBER' as GroupRole,
          joined_at: serverTimestamp(),
          total_games: 0,
          level: user?.level || 1,
        });

        // Escrever na subcoleção users/{uid}/groups (igual ao Android)
        const groupSnap = await getDoc(groupRef);
        const groupData = groupSnap.data();
        const userGroupRef = doc(db, 'users', uid, 'groups', groupId);
        batch.set(userGroupRef, {
          group_id: groupId,
          group_name: groupData?.name || inviteData.group_name || 'Grupo',
          group_photo: groupData?.photo_url || null,
          role: 'MEMBER',
          // FIX #611 / #626: member_count é SERVER-AUTHORITATIVE. Cloud Function
          // `onMemberWritten` increment automático ao detectar member doc creation.
          // Cliente lê member_count via real-time snapshot da group quando precisar.
          joined_at: serverTimestamp(),
        });

        // FIX #611 / #626: REMOVIDO o client-side increment de groups/{gid}.member_count.
        // Antes: privilege escalation (qualquer auth podia overwrite) + quebrava
        // join-via-invite quando rule restringia a member-only.
        // Agora: trigger `onMemberWritten` faz increment via admin SDK ao detectar
        // o batch.set(memberRef) acima.

        batch.update(inviteDoc.ref, {
          used: true,
          used_by: uid,
        });

        await batch.commit();
        // Invalidar cache de grupos após entrar em um
        queryClient.invalidateQueries({ queryKey: ['groups', uid] });
        setLoading(false);
        return groupId;
      } catch (err) {
        logger.error('Error joining group:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao entrar no grupo.');
        throw err;
      }
    },
    [firebaseUser, user, queryClient, showError]
  );

  return { generateInviteCode, joinByInviteCode, loading, error };
}

/**
 * GAP-3: hook leve que confere se o user autenticado é membro do grupo.
 * Usado por <GroupMemberRoute> para guardar rotas /group/:id/{edit,settings,cashbox,invite}.
 *
 * Retorna:
 * - loading: true enquanto checa (UI deve mostrar fallback)
 * - isMember: true se é membro, false se não é (UI deve redirecionar)
 * - error: erro de leitura, se houver
 *
 * Usa TanStack Query — cacheia por (uid, groupId) e reaproveita entre rotas.
 */
export function useIsGroupMember(groupId: string | null | undefined): { isMember: boolean; loading: boolean; error: Error | null } {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;

  const { data, isLoading, error } = useQuery<boolean>({
    queryKey: ['groupMember', uid, groupId],
    queryFn: async () => {
      if (!uid || !groupId) return false;
      // Subcoleção groups/{groupId}/members/{uid} é fonte canônica de membership.
      const memberRef = doc(db, 'groups', groupId, 'members', uid);
      const snap = await getDoc(memberRef);
      return snap.exists();
    },
    enabled: !!uid && !!groupId,
    staleTime: 60_000, // 1 min — membership não muda frequentemente
  });

  return { isMember: data ?? false, loading: isLoading, error: error instanceof Error ? error : null };
}
