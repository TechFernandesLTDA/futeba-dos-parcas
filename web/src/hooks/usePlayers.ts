import { useState, useEffect } from 'react';
import { collection, doc, documentId, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('usePlayers');

export interface Player {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  favoriteTeam?: string;
  level: number;
  xp: number;
  division: string;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  streak: number;
  strikerRating: number;
  midRating: number;
  defenderRating: number;
  gkRating: number;
  autoStrikerRating: number;
  autoMidRating: number;
  autoDefenderRating: number;
  autoGkRating: number;
  autoRatingSamples: number;
  reputationOverallAvg: number;
  reputationPunctualityAvg: number;
  reputationRespectAvg: number;
  reputationCommitmentAvg: number;
  reputationReviewsCount: number;
  lookingForGameToday?: boolean;
  lookingForGameTodayUntil?: Date | { toDate: () => Date };
  createdAt?: Date;
}

export const usePlayers = (groupId?: string) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!groupId) {
      setLoading(false);
      return;
    }

    const fetchPlayers = async () => {
      try {
        // FIX #584/H2: era `groupDoc.data().members` (array flat) — campo
        // não existe; schema usa subcollection `groups/{id}/members/{uid}`.
        // Por isso a tela Players sempre vinha vazia. Agora lemos da
        // subcollection (consistente com useGroups e CF).
        const membersSnap = await getDocs(
          collection(db, 'groups', groupId, 'members')
        );
        if (cancelled) return;
        if (!membersSnap.empty) {
          const memberIds = membersSnap.docs.map((d) => d.id);

          // Agrupa em chunks de 10 (limite do whereIn do Firestore) para
          // evitar N+1 reads individuais — reduz custo de N para ⌈N/10⌉ reads.
          const chunks: string[][] = [];
          for (let i = 0; i < memberIds.length; i += 10) {
            chunks.push(memberIds.slice(i, i + 10));
          }

          // #1547: Promise.allSettled garante que 1 chunk com falha não derruba
          // a lista inteira — os chunks bem-sucedidos ainda são exibidos.
          const chunkResults = await Promise.allSettled(
            chunks.map((chunk) =>
              getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
            )
          );

          if (cancelled) return;

          const allUserDocs = chunkResults.flatMap((result) => {
            if (result.status === 'rejected') {
              logger.error('Falha ao ler chunk de jogadores:', result.reason);
              return [];
            }
            return result.value.docs;
          });
          const playersData = allUserDocs.map((userDoc) => {
            const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, unknown>;
          return {
            id: userDoc.id,
            name: (data.name as string) || 'Jogador',
            email: (data.email as string) || '',
            photoUrl: (data.photoUrl as string) || raw.photo_url || '',
            favoriteTeam: (data.favoriteTeam as string) ?? raw.favorite_team ?? undefined,
            level: (data.level as number) || 1,
            xp: (data.experiencePoints as number) ?? (data.xp as number) ?? 0,
            division: (data.division as string) || 'BRONZE',
            gamesPlayed: (data.gamesPlayed as number) || (raw.games_played as number) || 0,
            wins: (data.wins as number) || 0,
            goals: (data.goals as number) || 0,
            assists: (data.assists as number) || 0,
            mvpCount: (data.mvpCount as number) || (raw.mvp_count as number) || 0,
            streak: (data.streak as number) || 0,
            strikerRating: (data.strikerRating as number) ?? (raw.striker_rating as number) ?? 0,
            midRating: (data.midRating as number) ?? (raw.mid_rating as number) ?? 0,
            defenderRating: (data.defenderRating as number) ?? (raw.defender_rating as number) ?? 0,
            gkRating: (data.gkRating as number) ?? (raw.gk_rating as number) ?? 0,
            autoStrikerRating: (data.autoStrikerRating as number) ?? (raw.auto_striker_rating as number) ?? 0,
            autoMidRating: (data.autoMidRating as number) ?? (raw.auto_mid_rating as number) ?? 0,
            autoDefenderRating: (data.autoDefenderRating as number) ?? (raw.auto_defender_rating as number) ?? 0,
            autoGkRating: (data.autoGkRating as number) ?? (raw.auto_gk_rating as number) ?? 0,
            autoRatingSamples: (data.autoRatingSamples as number) ?? (raw.auto_rating_samples as number) ?? 0,
            reputationOverallAvg: (data.reputationOverallAvg as number) ?? (raw.reputation_overall_avg as number) ?? 0,
            reputationPunctualityAvg: (data.reputationPunctualityAvg as number) ?? (raw.reputation_punctuality_avg as number) ?? 0,
            reputationRespectAvg: (data.reputationRespectAvg as number) ?? (raw.reputation_respect_avg as number) ?? 0,
            reputationCommitmentAvg: (data.reputationCommitmentAvg as number) ?? (raw.reputation_commitment_avg as number) ?? 0,
            reputationReviewsCount: (data.reputationReviewsCount as number) ?? (raw.reputation_reviews_count as number) ?? 0,
            lookingForGameToday: data.lookingForGameToday === true,
            lookingForGameTodayUntil: (data.lookingForGameTodayUntil as Date | { toDate: () => Date } | undefined),
            createdAt: raw.created_at?.toDate?.() || (data.createdAt as { toDate?: () => Date })?.toDate?.(),
          } as Player;
          });

          if (cancelled) return;
          setPlayers(playersData);
        }
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    fetchPlayers();
    return () => { cancelled = true; };
  }, [groupId]);

  return { players, loading, error };
};

export const usePlayerDetail = (userId?: string) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPlayer = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;
        if (userDoc.exists()) {
          const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, unknown>;
          if (!cancelled) {
            setPlayer({
              id: userId,
              name: (data.name as string) || 'Jogador',
              email: (data.email as string) || '',
              photoUrl: (data.photoUrl as string) || raw.photo_url || '',
              favoriteTeam: (data.favoriteTeam as string) ?? raw.favorite_team ?? undefined,
              level: (data.level as number) || 1,
              xp: (data.experiencePoints as number) ?? (data.xp as number) ?? 0,
              division: (data.division as string) || 'BRONZE',
              gamesPlayed: (data.gamesPlayed as number) || (raw.games_played as number) || 0,
              wins: (data.wins as number) || 0,
              goals: (data.goals as number) || 0,
              assists: (data.assists as number) || 0,
              mvpCount: (data.mvpCount as number) || (raw.mvp_count as number) || 0,
              streak: (data.streak as number) || 0,
              strikerRating: (data.strikerRating as number) ?? (raw.striker_rating as number) ?? 0,
              midRating: (data.midRating as number) ?? (raw.mid_rating as number) ?? 0,
              defenderRating: (data.defenderRating as number) ?? (raw.defender_rating as number) ?? 0,
              gkRating: (data.gkRating as number) ?? (raw.gk_rating as number) ?? 0,
              autoStrikerRating: (data.autoStrikerRating as number) ?? (raw.auto_striker_rating as number) ?? 0,
              autoMidRating: (data.autoMidRating as number) ?? (raw.auto_mid_rating as number) ?? 0,
              autoDefenderRating: (data.autoDefenderRating as number) ?? (raw.auto_defender_rating as number) ?? 0,
              autoGkRating: (data.autoGkRating as number) ?? (raw.auto_gk_rating as number) ?? 0,
              autoRatingSamples: (data.autoRatingSamples as number) ?? (raw.auto_rating_samples as number) ?? 0,
              reputationOverallAvg: (data.reputationOverallAvg as number) ?? (raw.reputation_overall_avg as number) ?? 0,
              reputationPunctualityAvg: (data.reputationPunctualityAvg as number) ?? (raw.reputation_punctuality_avg as number) ?? 0,
              reputationRespectAvg: (data.reputationRespectAvg as number) ?? (raw.reputation_respect_avg as number) ?? 0,
              reputationCommitmentAvg: (data.reputationCommitmentAvg as number) ?? (raw.reputation_commitment_avg as number) ?? 0,
              reputationReviewsCount: (data.reputationReviewsCount as number) ?? (raw.reputation_reviews_count as number) ?? 0,
              lookingForGameToday: data.lookingForGameToday === true,
              lookingForGameTodayUntil: (data.lookingForGameTodayUntil as Date | { toDate: () => Date } | undefined),
              createdAt: raw.created_at?.toDate?.() || (data.createdAt as Date | undefined),
            });
          }
        }
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    fetchPlayer();
    return () => { cancelled = true; };
  }, [userId]);

  return { player, loading, error };
};
