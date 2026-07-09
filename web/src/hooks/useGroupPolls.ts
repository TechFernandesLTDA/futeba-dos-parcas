import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/firebase';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';

export interface GroupPollOption { id: string; text: string }

export interface GroupPoll {
  id: string;
  groupId: string;
  question: string;
  options: GroupPollOption[];
  createdBy: string;
  createdByName: string;
  status: 'ACTIVE' | 'CLOSED';
  createdAt?: Date;
  voteCounts: Record<string, number>;
  myVote?: string | null;
  totalVotes: number;
}

function isEligiblePollMemberStatus(status: unknown): boolean {
  return status === undefined || status === 'ACTIVE';
}

export function useGroupPolls(groupId?: string) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['group-polls', groupId, uid],
    queryFn: async () => {
      if (!groupId || !uid) return [];
      const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
      const activeMemberIds = new Set(
        membersSnap.docs
          .filter((memberDoc) => isEligiblePollMemberStatus(memberDoc.data().status))
          .map((memberDoc) => memberDoc.id),
      );
      const pollsSnap = await getDocs(query(
        collection(db, 'group_polls'),
        where('group_id', '==', groupId),
        orderBy('created_at', 'desc'),
        limit(5),
      ));

      return Promise.all(pollsSnap.docs.map(async (pollDoc) => {
        const raw = pollDoc.data();
        const data = snakeToCamel(raw) as {
          groupId: string;
          question: string;
          options: GroupPollOption[];
          createdBy: string;
          createdByName?: string;
          status: 'ACTIVE' | 'CLOSED';
        };
        const voteSnap = await getDocs(query(collection(db, 'group_poll_votes'), where('poll_id', '==', pollDoc.id)));
        const eligibleVotes = voteSnap.docs.filter((vote) => activeMemberIds.has(String(vote.data().user_id || '')));
        const myVoteDoc = eligibleVotes.find((vote) => vote.data().user_id === uid);
        const voteCounts = eligibleVotes.reduce<Record<string, number>>((acc, vote) => {
          const optionId = vote.data().option_id;
          if (typeof optionId === 'string') acc[optionId] = (acc[optionId] ?? 0) + 1;
          return acc;
        }, {});

        return {
          id: pollDoc.id,
          groupId: data.groupId,
          question: data.question,
          options: data.options ?? [],
          createdBy: data.createdBy,
          createdByName: data.createdByName || 'Jogador',
          status: data.status,
          createdAt: toDate(raw.created_at),
          voteCounts,
          myVote: myVoteDoc?.data().option_id ?? null,
          totalVotes: Object.values(voteCounts).reduce((sum, count) => sum + Number(count || 0), 0),
        } as GroupPoll;
      }));
    },
    enabled: !!groupId && !!uid,
    staleTime: 30 * 1000,
  });

  return { polls: data, loading: isLoading, error: error ? (error as Error).message : null, refetch };
}

export function useCreateGroupPoll(groupId?: string) {
  const { currentUser, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ question, options }: { question: string; options: string[] }) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      const cleanQuestion = question.trim();
      const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
      if (cleanQuestion.length < 3 || cleanQuestion.length > 120) throw new Error('A pergunta deve ter entre 3 e 120 caracteres.');
      if (cleanOptions.length < 2 || cleanOptions.length > 5) throw new Error('Informe entre 2 e 5 opções.');

      await addDoc(collection(db, 'group_polls'), {
        group_id: groupId,
        question: cleanQuestion,
        options: cleanOptions.map((text, index) => ({ id: `option_${index + 1}`, text: text.slice(0, 60) })),
        created_by: currentUser.uid,
        created_by_name: user?.name || currentUser.displayName || 'Jogador',
        status: 'ACTIVE',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    },
    onSuccess: () => {
      showSuccess('Enquete criada.');
      queryClient.invalidateQueries({ queryKey: ['group-polls', groupId] });
    },
    onError: (err) => showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err)),
  });
}

export function useVoteGroupPoll(groupId?: string) {
  const { currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      if (!groupId || !currentUser?.uid) throw new Error('Grupo não encontrado.');
      await setDoc(doc(db, 'group_poll_votes', `${pollId}_${currentUser.uid}`), {
        poll_id: pollId,
        group_id: groupId,
        option_id: optionId,
        user_id: currentUser.uid,
        updated_at: serverTimestamp(),
      });
    },
    onSuccess: () => {
      showSuccess('Voto registrado.');
      queryClient.invalidateQueries({ queryKey: ['group-polls', groupId] });
    },
    onError: (err) => showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err)),
  });
}
