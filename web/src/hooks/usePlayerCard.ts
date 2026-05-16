import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { getLevelForXp } from '../types/gamification';
import { PreferredPosition } from '../types/user';

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
  // Rating calculado a partir das notas de posição
  overallRating: number;
  favoriteTeam?: string;
}

// Busca dados completos do usuário para o Player Card
async function fetchPlayerCardData(userId: string): Promise<PlayerCardData> {
  const userDoc = await getDoc(doc(db, 'users', userId));

  if (!userDoc.exists()) {
    throw new Error('Jogador não encontrado');
  }

  const raw = userDoc.data();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = snakeToCamel(raw) as Record<string, any>;

  const totalXp = data.experiencePoints ?? raw.experience_points ?? 0;
  const level = data.level ?? getLevelForXp(totalXp);

  // Calcula rating geral com base nas notas de posição (0-10 → 0-99)
  const strikerRating = data.strikerRating ?? raw.striker_rating ?? 5;
  const midRating = data.midRating ?? raw.mid_rating ?? 5;
  const defenderRating = data.defenderRating ?? raw.defender_rating ?? 5;
  const gkRating = data.gkRating ?? raw.gk_rating ?? 5;
  const avgRating = (strikerRating + midRating + defenderRating + gkRating) / 4;
  const overallRating = Math.round(avgRating * 9.9);

  return {
    id: userId,
    name: data.name || 'Jogador',
    nickname: data.nickname || raw.nickname || undefined,
    photoUrl: data.photoUrl || raw.photo_url || undefined,
    level,
    experiencePoints: totalXp,
    preferredPosition: data.preferredPosition ?? raw.preferred_position ?? undefined,
    totalGames: data.totalGames ?? raw.total_games ?? 0,
    totalGoals: data.totalGoals ?? raw.total_goals ?? 0,
    totalAssists: data.totalAssists ?? raw.total_assists ?? 0,
    totalSaves: data.totalSaves ?? raw.total_saves ?? 0,
    mvpCount: data.mvpCount ?? raw.mvp_count ?? 0,
    totalWins: data.totalWins ?? raw.total_wins ?? 0,
    totalDraws: data.totalDraws ?? raw.total_draws ?? 0,
    totalLosses: data.totalLosses ?? raw.total_losses ?? 0,
    currentStreak: data.currentStreak ?? raw.current_streak ?? 0,
    bestStreak: data.bestStreak ?? raw.best_streak ?? 0,
    overallRating,
    favoriteTeam: data.favoriteTeam ?? raw.favorite_team ?? undefined,
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
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false, // dados estáticos do jogador — não buscar ao focar janela
  });

  const error = queryError ? (queryError as Error).message : null;

  return { playerCard: data ?? null, loading, error, refetch };
}
