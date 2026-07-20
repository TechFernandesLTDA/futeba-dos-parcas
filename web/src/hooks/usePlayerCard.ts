import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { getEffectiveLevel, getExperiencePoints } from '../utils/xpAccounting';
import { PreferredPosition } from '../types/user';
import { normalizePlayerStats } from '../utils/playerStats';

export interface PlayerCardData {
  id: string;
  name: string;
  nickname?: string;
  photoUrl?: string;
  level: number;
  experiencePoints: number;
  preferredPosition?: PreferredPosition;
  totalGames: number;
  totalGoals: number;
  totalAssists: number;
  totalSaves: number;
  mvpCount: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  currentStreak: number;
  bestStreak: number;
  overallRating: number;
  strikerRating: number;
  midRating: number;
  defenderRating: number;
  gkRating: number;
  autoStrikerRating: number;
  autoMidRating: number;
  autoDefenderRating: number;
  autoGkRating: number;
  autoRatingSamples: number;
  favoriteTeam?: string;
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
}

// #2276: interface tipada do doc users (camelCase pós-snakeToCamel).
interface RawUserDoc {
  experiencePoints?: number;
  strikerRating?: number;
  midRating?: number;
  defenderRating?: number;
  gkRating?: number;
  autoStrikerRating?: number;
  autoMidRating?: number;
  autoDefenderRating?: number;
  autoGkRating?: number;
  autoRatingSamples?: number;
  name?: string;
  nickname?: string;
  photoUrl?: string;
  preferredPosition?: PreferredPosition;
  totalGames?: number;
  totalGoals?: number;
  totalAssists?: number;
  totalSaves?: number;
  mvpCount?: number;
  totalWins?: number;
  totalDraws?: number;
  totalLosses?: number;
  currentStreak?: number;
  bestStreak?: number;
  favoriteTeam?: string;
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
}

async function fetchPlayerCardData(userId: string): Promise<PlayerCardData> {
  const [userDoc, statsDoc, streakSnap] = await Promise.all([
    getDoc(doc(db, 'users', userId)),
    getDoc(doc(db, 'statistics', userId)),
    getDocs(query(collection(db, 'user_streaks'), where('user_id', '==', userId), limit(1))),
  ]);

  if (!userDoc.exists()) {
    throw new Error('Jogador não encontrado');
  }

  const raw = userDoc.data();
  const data = snakeToCamel<RawUserDoc>(raw);
  const statsRaw = statsDoc.exists() ? statsDoc.data() : undefined;
  const streakRaw = streakSnap.docs[0]?.data();
  const playerStats = normalizePlayerStats(
    { ...(statsRaw ?? {}), ...(streakRaw ?? {}) },
    raw,
    userId,
  );

  const xpData = { ...raw, ...data };
  const totalXp = getExperiencePoints(xpData);
  const level = getEffectiveLevel(xpData, totalXp);

  const strikerRating = data.strikerRating ?? raw.striker_rating ?? 0;
  const midRating = data.midRating ?? raw.mid_rating ?? 0;
  const defenderRating = data.defenderRating ?? raw.defender_rating ?? 0;
  const gkRating = data.gkRating ?? raw.gk_rating ?? 0;
  const autoStrikerRating = data.autoStrikerRating ?? raw.auto_striker_rating ?? 0;
  const autoMidRating = data.autoMidRating ?? raw.auto_mid_rating ?? 0;
  const autoDefenderRating = data.autoDefenderRating ?? raw.auto_defender_rating ?? 0;
  const autoGkRating = data.autoGkRating ?? raw.auto_gk_rating ?? 0;
  const autoRatingSamples = data.autoRatingSamples ?? raw.auto_rating_samples ?? 0;

  const ratings = [strikerRating, midRating, defenderRating, gkRating, autoStrikerRating, autoMidRating, autoDefenderRating, autoGkRating].filter((r) => r > 0);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const overallRating = Math.round((avgRating / 5) * 99);

  return {
    id: userId,
    name: data.name || 'Jogador',
    nickname: data.nickname || raw.nickname || undefined,
    photoUrl: data.photoUrl || raw.photo_url || undefined,
    level,
    experiencePoints: totalXp,
    preferredPosition: data.preferredPosition ?? raw.preferred_position ?? undefined,
    totalGames: playerStats.totalGames,
    totalGoals: playerStats.totalGoals,
    totalAssists: playerStats.totalAssists,
    totalSaves: playerStats.totalSaves,
    mvpCount: playerStats.mvpCount,
    totalWins: playerStats.totalWins,
    totalDraws: playerStats.totalDraws,
    totalLosses: playerStats.totalLosses,
    currentStreak: playerStats.currentStreak,
    bestStreak: playerStats.bestStreak,
    overallRating,
    strikerRating,
    midRating,
    defenderRating,
    gkRating,
    autoStrikerRating,
    autoMidRating,
    autoDefenderRating,
    autoGkRating,
    autoRatingSamples,
    favoriteTeam: data.favoriteTeam ?? raw.favorite_team ?? undefined,
    xpTopScorer: data.xpTopScorer ?? raw.xp_top_scorer ?? 0,
    xpHatTrick: data.xpHatTrick ?? raw.xp_hat_trick ?? 0,
    xpFirstGoal: data.xpFirstGoal ?? raw.xp_first_goal ?? 0,
    xpGoalkeeperGoal: data.xpGoalkeeperGoal ?? raw.xp_goalkeeper_goal ?? 0,
    xpFairPlay: data.xpFairPlay ?? raw.xp_fair_play ?? 0,
    xpComeback: data.xpComeback ?? raw.xp_comeback ?? 0,
    xpFirstGameMonth: data.xpFirstGameMonth ?? raw.xp_first_game_month ?? 0,
    xpMonthlyStreak: data.xpMonthlyStreak ?? raw.xp_monthly_streak ?? 0,
    xpRecorder: data.xpRecorder ?? raw.xp_recorder ?? 0,
    xpEarlyConfirmation: data.xpEarlyConfirmation ?? raw.xp_early_confirmation ?? 0,
    xpOnTimeCheckin: data.xpOnTimeCheckin ?? raw.xp_on_time_checkin ?? 0,
    xpLastMinuteSaver: data.xpLastMinuteSaver ?? raw.xp_last_minute_saver ?? 0,
    xpWaitlistPromoted: data.xpWaitlistPromoted ?? raw.xp_waitlist_promoted ?? 0,
  };
}

export function usePlayerCard(userId: string | null) {
  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['playerCard', userId],
    queryFn: () => fetchPlayerCardData(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  return { playerCard: data ?? null, loading, error, refetch };
}
