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
import { useTranslation } from 'react-i18next';

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

/**
 * #2166: mensagem de erro para as mutações de desafio.
 * Erros de validação (Error plano, sem `code` Firestore) preservam a mensagem
 * específica; erros de infra/Firestore são mapeados para PT-BR amigável.
 */
function challengeErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (!code && err instanceof Error && err.message) {
    return err.message;
  }
  return getFirestoreErrorMessage(err);
}

/**
 * #2251: expõe INTENCIONALMENTE o resultado bruto de useQuery
 * (data/isLoading/error/refetch). Consumidores usam a API do TanStack Query.
 * Não envolver no contrato { data, loading, error }.
 */
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
  const { t } = useTranslation();
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
        throw new Error('Grupo não especificado.');
      }
      if (!challengerGroupName?.trim() || !challengedGroupName?.trim()) {
        throw new Error('O nome do grupo é obrigatório.');
      }

      // #2166: sem showError aqui — o onError abaixo exibe o toast uma única vez.
      await addDoc(collection(db, "group-challenges"), {
        challenger_group_id: challengerGroupId,
        challenger_group_name: challengerGroupName,
        challenged_group_id: challengedGroupId,
        challenged_group_name: challengedGroupName,
        status: "PENDING",
        proposed_date: proposedDate,
        created_at: serverTimestamp(),
      });
    },
    onSuccess: () => {
      showSuccess(t("feedback.challenges.sendSuccess"));
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => {
      showError(challengeErrorMessage(err));
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
        throw new Error('Desafio não encontrado.');
      }

      // #2166: sem showError aqui — o onError abaixo exibe o toast uma única vez.
      await updateDoc(doc(db, "group-challenges", challengeId), {
        status,
        responded_at: serverTimestamp(),
      });
    },
    onSuccess: (_, { status }) => {
      showSuccess(status === "ACCEPTED" ? "Desafio aceito!" : "Desafio recusado.");
      queryClient.invalidateQueries({ queryKey: ["group-challenges"] });
    },
    onError: (err) => {
      showError(challengeErrorMessage(err));
    },
  });
}
