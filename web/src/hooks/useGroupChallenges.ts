import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  query as fsQuery,
  where,
  orderBy as fsOrderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
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
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "FINISHED";
  proposedDate?: string;
  gameId?: string;
  createdAt: Date;
}

export function useGroupChallenges(groupId?: string) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  return useQuery({
    queryKey: ["group-challenges", groupId],
    queryFn: async () => {
      if (!groupId || !uid) return [];
      const ref = collection(db, "group-challenges");
      const q = fsQuery(
        ref,
        where("challenged_group_id", "==", groupId),
        fsOrderBy("created_at", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = snakeToCamel(d.data());
        return {
          id: d.id,
          challengerGroupId: data.challengerGroupId,
          challengerGroupName: data.challengerGroupName,
          challengedGroupId: data.challengedGroupId,
          challengedGroupName: data.challengedGroupName,
          status: data.status,
          proposedDate: data.proposedDate,
          gameId: data.gameId,
          createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.(),
        } as GroupChallenge;
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!groupId,
  });
}

export function useChallengeGroup() {
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challengerGroupId,
      challengerGroupName,
      challengedGroupId,
      challengedGroupName,
      proposedDate,
    }: {
      challengerGroupId: string;
      challengerGroupName: string;
      challengedGroupId: string;
      challengedGroupName: string;
      proposedDate: string;
    }) => {
      if (!challengerGroupId || !challengedGroupId) {
        showError('Grupo não especificado.');
        throw new Error('Grupo não especificado.');
      }
      if (!challengerGroupName?.trim() || !challengedGroupName?.trim()) {
        showError('O nome do grupo é obrigatório.');
        throw new Error('O nome do grupo é obrigatório.');
      }

      try {
        await addDoc(collection(db, "group-challenges"), {
          challenger_group_id: challengerGroupId,
          challenger_group_name: challengerGroupName,
          challenged_group_id: challengedGroupId,
          challenged_group_name: challengedGroupName,
          status: "PENDING",
          proposed_date: proposedDate,
          created_at: serverTimestamp(),
        });
      } catch (error) {
        showError(getFirestoreErrorMessage(error));
        throw error;
      }
    },
    onSuccess: () => {
      showSuccess("Desafio enviado!");
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => {
      showError(getFirestoreErrorMessage(err));
    },
  });
}

export function useRespondChallenge() {
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challengeId,
      status,
    }: {
      challengeId: string;
      status: "ACCEPTED" | "DECLINED";
    }) => {
      if (!challengeId) {
        showError('Desafio não encontrado.');
        throw new Error('Desafio não encontrado.');
      }

      try {
        await updateDoc(doc(db, "group-challenges", challengeId), {
          status,
          responded_at: serverTimestamp(),
        });
      } catch (error) {
        showError(getFirestoreErrorMessage(error));
        throw error;
      }
    },
    onSuccess: (_, { status }) => {
      showSuccess(status === "ACCEPTED" ? "Desafio aceito!" : "Desafio recusado.");
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => {
      showError(getFirestoreErrorMessage(err));
    },
  });
}
