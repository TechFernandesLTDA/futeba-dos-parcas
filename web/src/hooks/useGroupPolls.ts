import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/firebase';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import { realtimeTelemetry } from '../utils/realtimeTelemetry';

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
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['group-polls', groupId, uid] as const, [groupId, uid]);
  const [listenerLoading, setListenerLoading] = useState(!!groupId && !!uid);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const attemptedSubscriptionRef = useRef<string | null>(null);
  const { data = [] } = useQuery({
    queryKey,
    queryFn: async (): Promise<GroupPoll[]> => [],
    enabled: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!groupId || !uid) {
      queryClient.setQueryData<GroupPoll[]>(queryKey, []);
      setListenerLoading(false);
      setListenerError(null);
      return undefined;
    }

    setListenerLoading(true);
    setListenerError(null);
    const subscriptionKey = `${groupId}:${uid}`;
    const lifecycle = realtimeTelemetry.start(
      'group_polls',
      attemptedSubscriptionRef.current === subscriptionKey ? 'reconnect' : 'bootstrap',
    );
    attemptedSubscriptionRef.current = subscriptionKey;
    let lifecyclePending = true;
    let polls: Array<{ id: string; raw: Record<string, unknown> }> = [];
    let votes: Array<Record<string, unknown>> = [];
    let activeMemberIds = new Set<string>();
    const ready = { polls: false, votes: false, members: false };

    const publish = () => {
      if (!ready.polls || !ready.votes || !ready.members) return;
      const applyMeasurement = realtimeTelemetry.start('group_polls', 'apply');
      try {
        const aggregates = new Map<string, {
          counts: Record<string, number>;
          myVote: string | null;
        }>();
        polls.forEach((poll) => aggregates.set(poll.id, { counts: {}, myVote: null }));

        // One pass for all visible polls: no per-poll vote query (N+1).
        votes.forEach((vote) => {
          const pollId = String(vote.poll_id ?? '');
          const userId = String(vote.user_id ?? '');
          const optionId = vote.option_id;
          const aggregate = aggregates.get(pollId);
          if (!aggregate || !activeMemberIds.has(userId) || typeof optionId !== 'string') return;
          aggregate.counts[optionId] = (aggregate.counts[optionId] ?? 0) + 1;
          if (userId === uid) aggregate.myVote = optionId;
        });

        const next = polls.map((poll) => {
          const raw = poll.raw;
          const parsed = snakeToCamel(raw) as {
            groupId: string;
            question: string;
            options: GroupPollOption[];
            createdBy: string;
            createdByName?: string;
            status: 'ACTIVE' | 'CLOSED';
          };
          const aggregate = aggregates.get(poll.id) ?? { counts: {}, myVote: null };
          return {
            id: poll.id,
            groupId: parsed.groupId,
            question: parsed.question,
            options: parsed.options ?? [],
            createdBy: parsed.createdBy,
            createdByName: parsed.createdByName || 'Jogador',
            status: parsed.status,
            createdAt: toDate(raw.created_at as Date | Timestamp | undefined),
            voteCounts: aggregate.counts,
            myVote: aggregate.myVote,
            totalVotes: Object.values(aggregate.counts).reduce((sum, count) => sum + count, 0),
          } as GroupPoll;
        });
        queryClient.setQueryData<GroupPoll[]>(queryKey, next);
        applyMeasurement.finish();
        if (lifecyclePending) {
          lifecycle.finish();
          lifecyclePending = false;
        }
        setListenerLoading(false);
        setListenerError(null);
      } catch (error) {
        applyMeasurement.error();
        lifecycle.cancel();
        lifecyclePending = false;
        setListenerError(getFirestoreErrorMessage(error));
        setListenerLoading(false);
      }
    };

    const onError = (error: unknown) => {
      if (lifecyclePending) {
        lifecycle.error();
        lifecyclePending = false;
      } else {
        realtimeTelemetry.record('group_polls', 'error');
      }
      setListenerError(getFirestoreErrorMessage(error));
      setListenerLoading(false);
    };
    const unsubscribePolls = onSnapshot(query(
      collection(db, 'group_polls'),
      where('group_id', '==', groupId),
      orderBy('created_at', 'desc'),
      limit(5),
    ), (snapshot) => {
      polls = snapshot.docs.map((pollDoc) => ({ id: pollDoc.id, raw: pollDoc.data() }));
      ready.polls = true;
      publish();
    }, onError);
    const unsubscribeVotes = onSnapshot(query(
      collection(db, 'group_poll_votes'),
      where('group_id', '==', groupId),
    ), (snapshot) => {
      votes = snapshot.docs.map((voteDoc) => voteDoc.data());
      ready.votes = true;
      publish();
    }, onError);
    const unsubscribeMembers = onSnapshot(
      collection(db, 'groups', groupId, 'members'),
      (snapshot) => {
        activeMemberIds = new Set(snapshot.docs
          .filter((memberDoc) => isEligiblePollMemberStatus(memberDoc.data().status))
          .map((memberDoc) => memberDoc.id));
        ready.members = true;
        publish();
      },
      onError,
    );

    return () => {
      lifecycle.cancel();
      unsubscribePolls();
      unsubscribeVotes();
      unsubscribeMembers();
    };
  }, [groupId, queryClient, queryKey, retryKey, uid]);

  const refetch = useCallback(async () => {
    setRetryKey((current) => current + 1);
  }, []);

  return { polls: data, loading: listenerLoading, error: listenerError, refetch };
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
