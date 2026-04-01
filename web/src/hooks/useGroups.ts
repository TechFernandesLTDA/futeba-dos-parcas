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
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Group, GroupMember, GroupRole, CashboxTransaction } from '../types/group';
import { useAuth } from '../contexts/AuthContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('useGroups');

// Busca grupos do usuário via subcoleção users/{uid}/groups (igual ao Android)
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, firebaseUser } = useAuth();

  useEffect(() => {
    const uid = firebaseUser?.uid || user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    // Consultar subcoleção users/{uid}/groups (mesma abordagem do Android)
    const userGroupsRef = collection(db, 'users', uid, 'groups');
    const q = query(userGroupsRef, orderBy('joined_at', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          setGroups([]);
          setLoading(false);
          return;
        }

        // Buscar dados completos de cada grupo
        const groupPromises = snapshot.docs.map(async (userGroupDoc) => {
          const userGroupData = userGroupDoc.data();
          const groupId = userGroupData.group_id || userGroupDoc.id;

          try {
            const groupSnap = await getDoc(doc(db, 'groups', groupId));
            if (groupSnap.exists()) {
              const raw = groupSnap.data();
              const converted = snakeToCamel(raw);
              return {
                id: groupSnap.id,
                ...converted,
                createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
                updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
                nextGameDate: (raw.next_game_date || raw.nextGameDate)?.toDate?.(),
                deletedAt: (raw.deleted_at || raw.deletedAt)?.toDate?.(),
              } as Group;
            }
            return null;
          } catch (err) {
            logger.warn(`Erro ao buscar grupo ${groupId}: ${err}`);
            // Fallback: usar dados da subcoleção
            return {
              id: groupId,
              name: userGroupData.group_name || 'Grupo',
              photoUrl: userGroupData.group_photo || null,
              memberCount: userGroupData.member_count || 0,
            } as Group;
          }
        });

        const results = await Promise.all(groupPromises);
        const validGroups = results.filter(
          (g): g is Group => g !== null && !g.deletedAt
        );
        setGroups(validGroups);
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching user groups:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, user]);

  return { groups, loading, error };
}

export function useGroupDetail(groupId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const groupRef = doc(db, 'groups', groupId);
    const membersRef = collection(db, 'groups', groupId, 'members');

    const unsubscribeGroup = onSnapshot(
      groupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const converted = snakeToCamel(raw);
          setGroup({
            id: docSnap.id,
            ...converted,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
            updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
            nextGameDate: (raw.next_game_date || raw.nextGameDate)?.toDate?.(),
            deletedAt: (raw.deleted_at || raw.deletedAt)?.toDate?.(),
          } as Group);
        } else {
          setGroup(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching group:', err);
        setError(err.message);
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
            joinedAt: (raw.joined_at || raw.joinedAt)?.toDate?.(),
          };
        });
        setMembers(membersData);
      }
    );

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
    };
  }, [groupId]);

  return { group, members, loading, error };
}

export function useCreateGroup() {
  const { user, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGroup = useCallback(
    async (groupData: { name: string; description?: string; isPublic?: boolean }) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        const batch = writeBatch(db);

        const groupRef = doc(collection(db, 'groups'));
        const memberRef = doc(collection(db, 'groups', groupRef.id, 'members'), uid);
        const displayName = firebaseUser?.displayName || user?.name || 'Dono';

        const newGroup = {
          name: groupData.name,
          description: groupData.description || '',
          photo_url: null,
          type: groupData.isPublic ? 'PUBLIC' : 'PRIVATE',
          is_public: groupData.isPublic || false,
          owner_id: uid,
          owner_name: displayName,
          member_count: 1,
          members: [uid],
          total_games_played: 0,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        };

        batch.set(groupRef, newGroup);

        batch.set(memberRef, {
          id: uid,
          user_id: uid,
          user_name: displayName,
          user_photo_url: firebaseUser?.photoURL || user?.photoUrl || null,
          role: 'OWNER' as GroupRole,
          joined_at: Timestamp.now(),
          total_games: 0,
          level: user?.level || 1,
        });

        // Escrever na subcoleção users/{uid}/groups (igual ao Android)
        const userGroupRef = doc(db, 'users', uid, 'groups', groupRef.id);
        batch.set(userGroupRef, {
          group_id: groupRef.id,
          group_name: groupData.name,
          group_photo: null,
          role: 'OWNER',
          member_count: 1,
          joined_at: Timestamp.now(),
        });

        await batch.commit();
        setLoading(false);
        return groupRef.id;
      } catch (err) {
        logger.error('Error creating group:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    [firebaseUser, user]
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

    const cashboxRef = collection(db, 'groups', groupId, 'cashbox');

    const unsubscribe = onSnapshot(
      query(cashboxRef, orderBy('date', 'desc')),
      (snapshot) => {
        let totalBalance = 0;
        const transactionsData = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel(raw);
          if (raw.type === 'INCOME') {
            totalBalance += raw.amount;
          } else {
            totalBalance -= raw.amount;
          }
          return {
            id: d.id,
            ...converted,
            date: (raw.date)?.toDate?.(),
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
          } as CashboxTransaction;
        });
        setTransactions(transactionsData);
        setBalance(totalBalance);
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching cashbox:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  return { transactions, balance, loading, error };
}

export function useInvitePlayers() {
  const { user, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInviteCode = useCallback(
    async (groupId: string, groupName: string) => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) throw new Error('User not authenticated');
      setLoading(true);
      setError(null);

      try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const displayName = firebaseUser?.displayName || user?.name || 'Organizador';

        await addDoc(collection(db, 'invites'), {
          code,
          group_id: groupId,
          group_name: groupName,
          inviter_id: uid,
          inviter_name: displayName,
          created_at: Timestamp.now(),
          expires_at: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          used: false,
        });

        setLoading(false);
        return code;
      } catch (err) {
        logger.error('Error generating invite:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    [firebaseUser, user]
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
          joined_at: Timestamp.now(),
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
          member_count: (inviteData.member_count || inviteData.memberCount || 0) + 1,
          joined_at: Timestamp.now(),
        });

        batch.update(groupRef, {
          member_count: (inviteData.member_count || inviteData.memberCount || 0) + 1,
          updated_at: Timestamp.now(),
        });

        batch.update(inviteDoc.ref, {
          used: true,
          used_by: uid,
        });

        await batch.commit();
        setLoading(false);
        return groupId;
      } catch (err) {
        logger.error('Error joining group:', err);
        setError((err as Error).message);
        setLoading(false);
        throw err;
      }
    },
    [firebaseUser, user]
  );

  return { generateInviteCode, joinByInviteCode, loading, error };
}
