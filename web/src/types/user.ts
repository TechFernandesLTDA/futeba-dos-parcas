export type UserRole = 'PLAYER' | 'FIELD_OWNER' | 'ADMIN';

export type PreferredPosition = 'GOLEIRO' | 'ZAGUEIRO' | 'LATERAL' | 'VOLANTE' | 'MEIA' | 'ATACANTE';

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

  // Ratings automáticos calculados server-side (0.0 - 5.0)
  autoStrikerRating: number;
  autoMidRating: number;
  autoDefenderRating: number;
  autoGkRating: number;
  autoRatingSamples: number;
  autoRatingUpdatedAt?: Date;

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
}

export interface Badge {
  badgeId: string;
  unlockedAt: Date;
  count: number;
}

export type PlayerRatingRole = 'STRIKER' | 'MID' | 'DEFENDER' | 'GOALKEEPER';

export function getAutoRatingConfidence(autoRatingSamples: number): number {
  if (autoRatingSamples <= 0) return 0.0;
  return Math.min(autoRatingSamples / 20.0, 1.0);
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
  if (auto <= 0) return manual;
  if (manual <= 0) return auto;
  const confidence = getAutoRatingConfidence(user.autoRatingSamples);
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
import { gamificationColors } from '../theme';
import { getLevelName as getLevelNameFromTable } from './gamification';

/** Retorna o título do nível usando LevelTable (fonte única de verdade) */
export function getLevelTitle(level: number): string {
  return getLevelNameFromTable(level);
}

/** Retorna a cor do nível baseada na fase — usa tokens do tema (suporta dark mode) */
export function getLevelColor(level: number, theme: Theme): string {
  if (level >= 19) return gamificationColors.gold;
  if (level >= 16) return theme.palette.error.main;
  if (level >= 13) return gamificationColors.mvp;
  if (level >= 11) return theme.palette.info.main;
  if (level >= 9) return gamificationColors.level;
  if (level >= 6) return theme.palette.success.main;
  if (level >= 3) return gamificationColors.silver;
  return gamificationColors.bronze;
}
