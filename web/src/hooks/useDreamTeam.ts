import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {

  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getFirestoreErrorMessage } from "../utils/firebaseErrors";
import { useTranslation } from 'react-i18next';

export interface DreamTeamPlayer {
  userId: string;
  position: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "STRIKER";
}

/**
 * #2251: originalmente expunha o resultado bruto de useQuery.
 * Agora envolve no contrato { dreamTeam, loading, error, refetch }
 * seguindo o padrão dos demais hooks, mantendo `data`/`isLoading`
 * para compatibilidade retroativa com consumidores que usam a
 * API do TanStack Query diretamente.
 */
export function useDreamTeam() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["dream-team", uid],
    queryFn: async () => {
      if (!uid) return null;
      const ref = doc(db, "users", uid, "dream_team", "current");
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return snap.data() as { players: DreamTeamPlayer[]; createdAt: Date };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!uid,
  });

  return { data, isLoading, dreamTeam: data, loading: isLoading, error: queryError?.message ?? null, refetch };
}

/**
 * #2251: originalmente expunha o resultado bruto de useQuery.
 * Agora envolve no contrato { players, loading, error, refetch }
 * seguindo o padrão dos demais hooks, mantendo `data`/`isLoading`
 * para compatibilidade retroativa com consumidores que usam a
 * API do TanStack Query diretamente.
 */
export function usePlayedAgainst() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["played-against", uid],
    queryFn: async () => {
      if (!uid) return [];
      const opponents = new Set<string>();

      const confSnap = await getDocs(
        query(
          collection(db, "confirmations"),
          where("user_id", "==", uid),
          where("was_present", "==", true)
        )
      );

      for (const confDoc of confSnap.docs) {
        const gameId = confDoc.data().game_id;
        if (!gameId) continue;

        const gameConfSnap = await getDocs(
          query(
            collection(db, "confirmations"),
            where("game_id", "==", gameId),
            where("was_present", "==", true)
          )
        );

        gameConfSnap.forEach((d) => {
          const otherUid = d.data().user_id;
          if (otherUid && otherUid !== uid) {
            opponents.add(otherUid);
          }
        });
      }

      const userIds = Array.from(opponents).slice(0, 50);
      const result: Array<{ id: string; name: string; photoUrl?: string; autoStrikerRating: number }> = [];

      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const usersSnap = await getDocs(
          query(collection(db, "users"), where("__name__", "in", chunk))
        );
        usersSnap.forEach((d) => {
          const data = d.data();
          result.push({
            id: d.id,
            name: data.name || "Jogador",
            photoUrl: data.photo_url,
            autoStrikerRating: data.auto_striker_rating || 0,
          });
        });
      }

      return result;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!uid,
  });

  return { data, isLoading, players: data, loading: isLoading, error: queryError?.message ?? null, refetch };
}

export function useSaveDreamTeam() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";

  return useMutation({
    mutationFn: async (players: DreamTeamPlayer[]) => {
      if (!uid) throw new Error("Você precisa estar logado.");
      if (players.length !== 5) throw new Error("Selecione exatamente 5 jogadores.");

      // #2166: sem showError aqui — o onError abaixo já exibe o toast.
      const ref = doc(db, "users", uid, "dream_team", "current");
      const batch = writeBatch(db);
      batch.set(ref, {
        players,
        created_at: serverTimestamp(),
      });
      await batch.commit();
    },
    onSuccess: () => {
      showSuccess(t("feedback.dreamTeam.saveSuccess"));
      queryClient.invalidateQueries({ queryKey: ["dream-team", uid] });
    },
    onError: (err) => {
      showError(getFirestoreErrorMessage(err));
    },
  });
}
