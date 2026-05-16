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
  
  // Ratings
  strikerRating: number;
  midRating: number;
  defenderRating: number;
  gkRating: number;
  
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
