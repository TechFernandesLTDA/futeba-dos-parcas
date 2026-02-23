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
  
  // Streak
  currentStreak: number;
  bestStreak: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
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

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Iniciante',
  5: 'Amador',
  10: 'Experiente',
  20: 'Veterano',
  30: 'Expert',
  40: 'Mestre',
  50: 'Lenda',
};

export function getLevelTitle(level: number): string {
  const thresholds = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const threshold of thresholds) {
    if (level >= threshold) return LEVEL_TITLES[threshold];
  }
  return 'Iniciante';
}

export function getLevelColor(level: number): string {
  if (level >= 50) return '#FFD700'; // Gold
  if (level >= 40) return '#9C27B0'; // Purple
  if (level >= 30) return '#2196F3'; // Blue
  if (level >= 20) return '#00BCD4'; // Cyan
  if (level >= 10) return '#4CAF50'; // Green
  if (level >= 5) return '#8BC34A'; // Light Green
  return '#00C853'; // Primary Green
}
