import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy as fsOrderBy,
  query as fsQuery,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getFirestoreErrorMessage } from "../utils/firebaseErrors";
import { snakeToCamel } from "../utils/firestoreHelpers";

export interface GroupChallenge {
  id: string;
  challengerGroupId: string;
  challengerGroupName: string;
  challengedGroupId: string;
  challengedGroupName: string;
  createdBy: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "FINISHED";
  goal: string;
  targetCount: number;
  currentProgress: number;
  deadline: string;
  proposedDate?: string;
  gameId?: string;
  respondedBy?: string;
  completedAt?: Date;
  createdAt: Date;
}

function challengeErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (!code && err instanceof Error && err.message) return err.message;
  return getFirestoreErrorMessage(err);
}

function parseChallenge(id: string, raw: Record<string, unknown>): GroupChallenge {
  const data = snakeToCamel(raw);
  return {
    id,
    challengerGroupId: String(data.challengerGroupId ?? ""),
    challengerGroupName: String(data.challengerGroupName ?? ""),
    challengedGroupId: String(data.challengedGroupId ?? ""),
    challengedGroupName: String(data.challengedGroupName ?? ""),
    createdBy: String(data.createdBy ?? ""),
    status: (data.status ?? "PENDING") as GroupChallenge["status"],
    goal: String(data.goal ?? ""),
    targetCount: Number(data.targetCount ?? 1),
    currentProgress: Number(data.currentProgress ?? 0),
    deadline: String(data.deadline ?? ""),
    proposedDate: data.proposedDate ? String(data.proposedDate) : undefined,
    gameId: data.gameId ? String(data.gameId) : undefined,
    respondedBy: data.respondedBy ? String(data.respondedBy) : undefined,
    completedAt: ((raw.completed_at || raw.completedAt) as { toDate?: () => Date })?.toDate?.(),
    createdAt: ((raw.created_at || raw.createdAt) as { toDate?: () => Date })?.toDate?.() ?? new Date(0),
  };
}

function clampProgress(value: number, target: number): number {
  const normalizedTarget = Number.isFinite(target) && target > 0 ? Math.floor(target) : 1;
  const normalizedValue = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(normalizedValue, 0), normalizedTarget);
}

export function useGroupChallenges(groupId?: string) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["group-challenges", groupId],
    queryFn: async () => {
      if (!groupId || !uid) return [];
      const ref = collection(db, "group-challenges");
      const [incomingSnap, outgoingSnap] = await Promise.all([
        getDocs(fsQuery(ref, where("challenged_group_id", "==", groupId), fsOrderBy("created_at", "desc"))),
        getDocs(fsQuery(ref, where("challenger_group_id", "==", groupId), fsOrderBy("created_at", "desc"))),
      ]);
      const byId = new Map<string, GroupChallenge>();
      [...incomingSnap.docs, ...outgoingSnap.docs].forEach((d) => byId.set(d.id, parseChallenge(d.id, d.data())));
      return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!groupId && !!uid,
  });

  return { data, isLoading, challenges: data, loading: isLoading, error: queryError?.message ?? null, refetch };
}

export function useChallengeGroup() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  return useMutation({
    mutationFn: async ({
      challengerGroupId,
      challengerGroupName,
      challengedGroupId,
      challengedGroupName,
      proposedDate,
      goal,
      targetCount,
      deadline,
    }: {
      challengerGroupId: string;
      challengerGroupName: string;
      challengedGroupId: string;
      challengedGroupName: string;
      proposedDate?: string;
      goal: string;
      targetCount: number;
      deadline: string;
    }) => {
      if (!uid) throw new Error(t("feedback.officialGroups.loginRequired"));
      if (!challengerGroupId || !challengedGroupId) throw new Error("Grupo não especificado.");
      if (challengerGroupId === challengedGroupId) throw new Error(t("challenges.validationSameGroup"));
      if (!challengerGroupName?.trim() || !challengedGroupName?.trim()) throw new Error("O nome do grupo é obrigatório.");
      const normalizedGoal = goal.trim();
      const normalizedTarget = Math.floor(Number(targetCount));
      if (!normalizedGoal) throw new Error(t("challenges.validationGoal"));
      if (!Number.isFinite(normalizedTarget) || normalizedTarget < 1) throw new Error(t("challenges.validationTarget"));
      if (!deadline) throw new Error(t("challenges.validationDeadline"));

      await addDoc(collection(db, "group-challenges"), {
        challenger_group_id: challengerGroupId,
        challenger_group_name: challengerGroupName,
        challenged_group_id: challengedGroupId,
        challenged_group_name: challengedGroupName,
        created_by: uid,
        status: "PENDING",
        goal: normalizedGoal,
        target_count: normalizedTarget,
        current_progress: 0,
        deadline,
        proposed_date: proposedDate || "",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    },
    onSuccess: () => {
      showSuccess(t("feedback.challenges.sendSuccess"));
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => showError(challengeErrorMessage(err)),
  });
}

export function useRespondChallenge() {
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  return useMutation({
    mutationFn: async ({ challengeId, status }: { challengeId: string; status: "ACCEPTED" | "DECLINED" }) => {
      if (!challengeId) throw new Error("Desafio não encontrado.");
      if (!uid) throw new Error("Faça login para responder ao desafio.");
      await updateDoc(doc(db, "group-challenges", challengeId), {
        status,
        responded_at: serverTimestamp(),
        responded_by: uid,
        updated_at: serverTimestamp(),
      });
    },
    onSuccess: (_, { status }) => {
      showSuccess(status === "ACCEPTED" ? "Desafio aceito!" : "Desafio recusado.");
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => showError(challengeErrorMessage(err)),
  });
}

export function useUpdateChallengeProgress() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  return useMutation({
    mutationFn: async ({ challenge, progress }: { challenge: GroupChallenge; progress: number }) => {
      if (!uid) throw new Error(t("feedback.officialGroups.loginRequired"));
      const nextProgress = clampProgress(progress, challenge.targetCount);
      const completed = nextProgress >= challenge.targetCount;
      const batch = writeBatch(db);
      batch.update(doc(db, "group-challenges", challenge.id), {
        current_progress: nextProgress,
        status: completed ? "FINISHED" : challenge.status,
        updated_at: serverTimestamp(),
        ...(completed ? { completed_at: serverTimestamp(), completed_by: uid } : {}),
      });
      const completionRecipient = uid === challenge.createdBy ? challenge.respondedBy : challenge.createdBy;
      if (completed && completionRecipient && completionRecipient !== uid) {
        batch.set(doc(collection(db, "notifications")), {
          created_by: uid,
          user_id: completionRecipient,
          type: "SYSTEM",
          title: t("challenges.completedNotificationTitle"),
          body: t("challenges.completedNotificationBody", {
            challenger: challenge.challengerGroupName,
            challenged: challenge.challengedGroupName,
          }),
          read: false,
          reference_id: challenge.id,
          reference_type: "group_challenge",
          group_id: challenge.challengedGroupId,
          created_at: serverTimestamp(),
        });
      }
      await batch.commit();
      return { completed };
    },
    onSuccess: ({ completed }) => {
      showSuccess(t(completed ? "challenges.completedSuccess" : "challenges.progressSuccess"));
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => showError(challengeErrorMessage(err)),
  });
}
