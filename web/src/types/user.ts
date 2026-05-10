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

import { getLevelName as getLevelNameFromTable } from './gamification';

/** Retorna o título do nível usando LevelTable (fonte única de verdade) */
export function getLevelTitle(level: number): string {
  return getLevelNameFromTable(level);
}

/** Retorna a cor do nível baseada na fase */
export function getLevelColor(level: number): string {
  if (level >= 19) return '#FFD700'; // Gold - Maradona/Pelé
  if (level >= 16) return '#E91E63'; // Pink - Ronaldo/Messi/CR7
  if (level >= 13) return '#9C27B0'; // Purple - Cruyff/Beckham/Ronaldinho
  if (level >= 11) return '#2196F3'; // Blue - Garrincha/Zico
  if (level >= 9) return '#00BCD4';  // Cyan - Lenda/Imortal
  if (level >= 6) return '#4CAF50';  // Green - Profissional/Expert/Mestre
  if (level >= 3) return '#8BC34A';  // Light Green - Regular/Experiente/Habilidoso
  return '#78909C';                  // Grey Blue - Novato/Iniciante/Amador
}
