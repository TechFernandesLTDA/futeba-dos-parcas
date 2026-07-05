export type UserRole = 'PLAYER' | 'FIELD_OWNER' | 'ADMIN';

export type PreferredPosition = 'GOLEIRO' | 'ZAGUEIRO' | 'LATERAL' | 'VOLANTE' | 'MEIA' | 'ATACANTE';

// Gênero do perfil do usuário — alinhado com o enum Android User.Gender
export type UserGender = 'MALE' | 'FEMALE' | 'OTHER' | 'NOT_INFORMED';

// Import FieldType from game.ts to avoid duplication
import { FieldType } from './game';

export interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  photoUrl?: string;
  role: UserRole;
  level: number;
  experiencePoints: number;

  // Ratings manuais (0.0 - 5.0)
  strikerRating: number;
  midRating: number;
  defenderRating: number;
  gkRating: number;
  strikerRatingSet?: boolean;
  midRatingSet?: boolean;
  defenderRatingSet?: boolean;
  gkRatingSet?: boolean;

  // Ratings automáticos calculados server-side (0.0 - 5.0)
  autoStrikerRating: number;
  autoMidRating: number;
  autoDefenderRating: number;
  autoGkRating: number;
  autoRatingSamples: number;
  autoRatingUpdatedAt?: Date;

  // Reputacao leve pos-jogo calculada server-side (1.0 - 5.0)
  reputationOverallAvg?: number;
  reputationPunctualityAvg?: number;
  reputationRespectAvg?: number;
  reputationCommitmentAvg?: number;
  reputationReviewsCount?: number;
  reputationUpdatedAt?: Date;

  // Preferences
  preferredPosition?: PreferredPosition;
  preferredFieldTypes: FieldType[];
  favoriteTeam?: string;
  
  // Stats
  totalGames: number;
  totalGoals: number;
  totalAssists: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  totalSaves: number;
  mvpCount: number;
  yellowCards: number;
  redCards: number;
  
  isSearchable: boolean;
  isVerified: boolean;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: 'REAL' | 'DEMO' | 'TEST' | 'UNKNOWN';
  seedId?: string;
  demoDataReason?: string;
  realDataProtected?: boolean;
  lookingForGameToday?: boolean;
  lookingForGameTodayUntil?: Date;
  lookingForGameTodayUpdatedAt?: Date;
  lastGameDate?: Date;

  // Invite
  inviteCode?: string;
  invitedBy?: string;
  invitedByCode?: string;
  inviteAcceptedAt?: Date;
  inviteCount: number;

  // Social graph
  followersCount?: number;
  followingCount?: number;

  // Streak
  currentStreak: number;
  bestStreak: number;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserStats {
  userId: string;
  totalGames: number;
  totalGoals: number;
  totalAssists: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  totalSaves: number;
  mvpCount: number;
  bestGkCount: number;
  currentStreak: number;
  bestStreak: number;
  yellowCards: number;
  redCards: number;
  avgGoalsPerGame: number;
  avgAssistsPerGame: number;
  winRate: number;
  level: number;
  experiencePoints: number;
}

export interface UserBadge {
  badgeId: string;
  unlockedAt: Date;
  count: number;
}

export type PlayerRatingRole = 'STRIKER' | 'MID' | 'DEFENDER' | 'GOALKEEPER';

export function getAutoRatingConfidence(autoRatingSamples: number): number {
  if (autoRatingSamples <= 0) return 0.0;
  return Math.min(autoRatingSamples / 20.0, 1.0);
}

const POSITION_CONFIDENCE_FULL_RATING = 2.5;

export function getAutoRatingConfidenceForRole(user: User, role: PlayerRatingRole): number {
  const autoRating = getAutoRating(user, role);
  if (user.autoRatingSamples <= 0 || autoRating <= 0) return 0.0;

  const sampleConfidence = getAutoRatingConfidence(user.autoRatingSamples);
  if (role === 'DEFENDER') return sampleConfidence;

  const roleRelevance = Math.min(Math.max(autoRating / POSITION_CONFIDENCE_FULL_RATING, 0), 1);
  return sampleConfidence * roleRelevance;
}

export interface RatingHistoryEntry {
  id: string;
  position: 'STRIKER' | 'MID' | 'DEFENDER' | 'GOALKEEPER';
  rating: number;
  samples: number;
  calculatedAt: Date;
}

export function getManualRating(user: Pick<User, 'strikerRating' | 'midRating' | 'defenderRating' | 'gkRating'>, role: PlayerRatingRole): number {
  switch (role) {
    case 'STRIKER': return user.strikerRating ?? 0;
    case 'MID': return user.midRating ?? 0;
    case 'DEFENDER': return user.defenderRating ?? 0;
    case 'GOALKEEPER': return user.gkRating ?? 0;
  }
}

export function getAutoRating(user: Pick<User, 'autoStrikerRating' | 'autoMidRating' | 'autoDefenderRating' | 'autoGkRating'>, role: PlayerRatingRole): number {
  switch (role) {
    case 'STRIKER': return user.autoStrikerRating ?? 0;
    case 'MID': return user.autoMidRating ?? 0;
    case 'DEFENDER': return user.autoDefenderRating ?? 0;
    case 'GOALKEEPER': return user.autoGkRating ?? 0;
  }
}

export function getEffectiveRating(user: User, role: PlayerRatingRole): number {
  const manual = getManualRating(user, role);
  const auto = getAutoRating(user, role);
  const manualSet = role === 'STRIKER'
    ? user.strikerRatingSet || manual > 0
    : role === 'MID'
      ? user.midRatingSet || manual > 0
      : role === 'DEFENDER'
        ? user.defenderRatingSet || manual > 0
        : user.gkRatingSet || manual > 0;
  if (manualSet && manual <= 0) return 0;
  if (auto <= 0) return manual;
  if (!manualSet) return auto;
  const confidence = getAutoRatingConfidenceForRole(user, role);
  return Math.min(Math.max(manual * (1 - confidence) + auto * confidence, 0), 5);
}

export function getOverallRating(user: User): number {
  const ratings = ([
    'STRIKER', 'MID', 'DEFENDER', 'GOALKEEPER',
  ] as PlayerRatingRole[])
    .map((role) => getEffectiveRating(user, role))
    .filter((r) => r > 0);
  if (ratings.length === 0) return 0;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

import { type Theme } from '@mui/material/styles';
import { getGamificationColors } from '../utils/gamificationColors';
import { getLevelName as getLevelNameFromTable } from './gamification';

/** Retorna o título do nível usando LevelTable (fonte única de verdade) */
export function getLevelTitle(level: number): string {
  return getLevelNameFromTable(level);
}

/**
 * Retorna a cor do nível baseada na fase — theme-aware (#2163/#2271).
 * Usa a paleta de gamificação correta para o modo (light vs dark/OLED) para
 * garantir contraste WCAG; tons brand fixos como gold/silver/bronze passam a
 * usar a variante dark mais brilhante quando o tema é escuro.
 */
export function getLevelColor(level: number, theme: Theme): string {
  const colors = getGamificationColors(theme);
  if (level >= 19) return colors.gold;
  if (level >= 16) return theme.palette.error.main;
  if (level >= 13) return colors.mvp;
  if (level >= 11) return theme.palette.info.main;
  if (level >= 9) return colors.level;
  if (level >= 6) return theme.palette.success.main;
  if (level >= 3) return colors.silver;
  return colors.bronze;
}
