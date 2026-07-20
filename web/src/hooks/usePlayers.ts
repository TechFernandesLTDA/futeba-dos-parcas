import { useState, useEffect, useCallback } from 'react';
import { collection, doc, documentId, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { normalizePlayerStats } from '../utils/playerStats';
import { getEffectiveLevel, getExperiencePoints } from '../utils/xpAccounting';
import { getUsersByIds } from '../utils/userBatch';

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
  followersCount: number;
  followingCount: number;
  lookingForGameToday?: boolean;
  lookingForGameTodayUntil?: Date | { toDate: () => Date };
  xpTopScorer?: number;
  xpHatTrick?: number;
  xpFirstGoal?: number;
  xpGoalkeeperGoal?: number;
  xpFairPlay?: number;
  xpComeback?: number;
  xpFirstGameMonth?: number;
  xpMonthlyStreak?: number;
  xpRecorder?: number;
  xpEarlyConfirmation?: number;
  xpOnTimeCheckin?: number;
  xpLastMinuteSaver?: number;
  xpWaitlistPromoted?: number;
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

          const publicUsers = await getUsersByIds(memberIds);
          if (cancelled) return;
          const [statsResults, streakResults] = await Promise.all([
            Promise.allSettled(
              chunks.map((chunk) =>
                getDocs(query(collection(db, 'statistics'), where(documentId(), 'in', chunk)))
              )
            ),
            Promise.allSettled(
              chunks.map((chunk) =>
                getDocs(query(collection(db, 'user_streaks'), where('user_id', 'in', chunk)))
              )
            ),
          ]);

          if (cancelled) return;

          const statsByUserId = new Map<string, Record<string, unknown>>();
          statsResults.forEach((result) => {
            if (result.status === 'rejected') {
              logger.error('Falha ao ler estatísticas de jogadores:', result.reason);
              return;
            }
            result.value.docs.forEach((statsDoc) => statsByUserId.set(statsDoc.id, statsDoc.data()));
          });

          const streakByUserId = new Map<string, Record<string, unknown>>();
          streakResults.forEach((result) => {
            if (result.status === 'rejected') {
              logger.error('Falha ao ler streaks de jogadores:', result.reason);
              return;
            }
            result.value.docs.forEach((streakDoc) => {
              const streakData = streakDoc.data();
              const streakUserId = (streakData.user_id ?? streakData.userId) as string | undefined;
              if (streakUserId) streakByUserId.set(streakUserId, streakData);
            });
          });

          const playersData = Array.from(publicUsers.entries()).map(([userId, data]) => {
            const raw = data;
            const xp = getExperiencePoints({ ...raw, ...data });
            const stats = normalizePlayerStats(
              {
                ...(statsByUserId.get(userId) ?? {}),
                ...(streakByUserId.get(userId) ?? {}),
              },
              raw,
              userId,
            );
            return {
              id: userId,
              name: (data.name as string) || 'Jogador',
              email: (data.email as string) || '',
              photoUrl: (data.photoUrl as string) || raw.photo_url || '',
              favoriteTeam: (data.favoriteTeam as string) ?? raw.favorite_team ?? undefined,
              level: getEffectiveLevel({ ...raw, ...data }, xp),
              xp,
              division: (data.division as string) || 'BRONZE',
              gamesPlayed: stats.totalGames,
              wins: stats.totalWins,
              goals: stats.totalGoals,
              assists: stats.totalAssists,
              mvpCount: stats.mvpCount,
              streak: stats.currentStreak,
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
              followersCount: (data.followersCount as number) ?? (raw.followers_count as number) ?? 0,
              followingCount: (data.followingCount as number) ?? (raw.following_count as number) ?? 0,
              lookingForGameToday: data.lookingForGameToday === true,
              lookingForGameTodayUntil: (data.lookingForGameTodayUntil as Date | { toDate: () => Date } | undefined),
              xpTopScorer: (data.xpTopScorer as number) ?? (raw.xp_top_scorer as number) ?? 0,
              xpHatTrick: (data.xpHatTrick as number) ?? (raw.xp_hat_trick as number) ?? 0,
              xpFirstGoal: (data.xpFirstGoal as number) ?? (raw.xp_first_goal as number) ?? 0,
              xpGoalkeeperGoal: (data.xpGoalkeeperGoal as number) ?? (raw.xp_goalkeeper_goal as number) ?? 0,
              xpFairPlay: (data.xpFairPlay as number) ?? (raw.xp_fair_play as number) ?? 0,
              xpComeback: (data.xpComeback as number) ?? (raw.xp_comeback as number) ?? 0,
              xpFirstGameMonth: (data.xpFirstGameMonth as number) ?? (raw.xp_first_game_month as number) ?? 0,
              xpMonthlyStreak: (data.xpMonthlyStreak as number) ?? (raw.xp_monthly_streak as number) ?? 0,
              xpRecorder: (data.xpRecorder as number) ?? (raw.xp_recorder as number) ?? 0,
              xpEarlyConfirmation: (data.xpEarlyConfirmation as number) ?? (raw.xp_early_confirmation as number) ?? 0,
              xpOnTimeCheckin: (data.xpOnTimeCheckin as number) ?? (raw.xp_on_time_checkin as number) ?? 0,
              xpLastMinuteSaver: (data.xpLastMinuteSaver as number) ?? (raw.xp_last_minute_saver as number) ?? 0,
              xpWaitlistPromoted: (data.xpWaitlistPromoted as number) ?? (raw.xp_waitlist_promoted as number) ?? 0,
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
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(undefined);
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => {
    setRefetchKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setResolvedUserId(userId);
    setPlayer(null);
    setError(null);

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchPlayer = async () => {
      try {
        const [userDoc, statsDoc, streakSnap] = await Promise.all([
          getDoc(doc(db, 'users', userId)),
          getDoc(doc(db, 'statistics', userId)),
          getDocs(query(collection(db, 'user_streaks'), where('user_id', '==', userId), limit(1))),
        ]);
        if (cancelled) return;
        if (userDoc.exists()) {
          const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, unknown>;
          const xp = getExperiencePoints({ ...raw, ...data });
          const stats = normalizePlayerStats(
            {
              ...(statsDoc.exists() ? statsDoc.data() : {}),
              ...(streakSnap.docs[0]?.data() ?? {}),
            },
            raw,
            userId,
          );
          if (!cancelled) {
            setPlayer({
              id: userId,
              name: (data.name as string) || 'Jogador',
              email: (data.email as string) || '',
              photoUrl: (data.photoUrl as string) || raw.photo_url || '',
              favoriteTeam: (data.favoriteTeam as string) ?? raw.favorite_team ?? undefined,
              level: getEffectiveLevel({ ...raw, ...data }, xp),
              xp,
              division: (data.division as string) || 'BRONZE',
              gamesPlayed: stats.totalGames,
              wins: stats.totalWins,
              goals: stats.totalGoals,
              assists: stats.totalAssists,
              mvpCount: stats.mvpCount,
              streak: stats.currentStreak,
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
              followersCount: (data.followersCount as number) ?? (raw.followers_count as number) ?? 0,
              followingCount: (data.followingCount as number) ?? (raw.following_count as number) ?? 0,
              lookingForGameToday: data.lookingForGameToday === true,
              lookingForGameTodayUntil: (data.lookingForGameTodayUntil as Date | { toDate: () => Date } | undefined),
              xpTopScorer: (data.xpTopScorer as number) ?? (raw.xp_top_scorer as number) ?? 0,
              xpHatTrick: (data.xpHatTrick as number) ?? (raw.xp_hat_trick as number) ?? 0,
              xpFirstGoal: (data.xpFirstGoal as number) ?? (raw.xp_first_goal as number) ?? 0,
              xpGoalkeeperGoal: (data.xpGoalkeeperGoal as number) ?? (raw.xp_goalkeeper_goal as number) ?? 0,
              xpFairPlay: (data.xpFairPlay as number) ?? (raw.xp_fair_play as number) ?? 0,
              xpComeback: (data.xpComeback as number) ?? (raw.xp_comeback as number) ?? 0,
              xpFirstGameMonth: (data.xpFirstGameMonth as number) ?? (raw.xp_first_game_month as number) ?? 0,
              xpMonthlyStreak: (data.xpMonthlyStreak as number) ?? (raw.xp_monthly_streak as number) ?? 0,
              xpRecorder: (data.xpRecorder as number) ?? (raw.xp_recorder as number) ?? 0,
              xpEarlyConfirmation: (data.xpEarlyConfirmation as number) ?? (raw.xp_early_confirmation as number) ?? 0,
              xpOnTimeCheckin: (data.xpOnTimeCheckin as number) ?? (raw.xp_on_time_checkin as number) ?? 0,
              xpLastMinuteSaver: (data.xpLastMinuteSaver as number) ?? (raw.xp_last_minute_saver as number) ?? 0,
              xpWaitlistPromoted: (data.xpWaitlistPromoted as number) ?? (raw.xp_waitlist_promoted as number) ?? 0,
              createdAt: raw.created_at?.toDate?.() || (data.createdAt as Date | undefined),
            });
          }
        } else {
          setPlayer(null);
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

    void fetchPlayer();
    return () => { cancelled = true; };
  }, [refetchKey, userId]);

  const isCurrentRequest = resolvedUserId === userId;
  return {
    player: isCurrentRequest ? player : null,
    loading: userId ? !isCurrentRequest || loading : false,
    error: isCurrentRequest ? error : null,
    refetch,
  };
};
