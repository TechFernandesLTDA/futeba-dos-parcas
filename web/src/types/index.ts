export * from './user';
export * from './game';
export * from './group';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  referenceId?: string;
  referenceType?: 'game' | 'group' | 'badge' | 'level' | 'invite';
  createdAt: Date;
}

export type NotificationType = 
  | 'GAME_SUMMON'
  | 'GAME_CONFIRMED'
  | 'GAME_REMINDER'
  | 'GAME_CANCELLED'
  | 'GROUP_INVITE'
  | 'ACHIEVEMENT'
  | 'LEVEL_UP'
  | 'MVP_RECEIVED'
  | 'STREAK_BROKEN';

export interface RankingPlayer {
  userId: string;
  userName: string;
  nickname?: string;
  photoUrl?: string;
  level: number;
  experiencePoints: number;
  totalGames: number;
  totalGoals: number;
  totalAssists: number;
  totalWins: number;
  mvpCount: number;
  position: number;
  isCurrentUser?: boolean;
}

export interface Season {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  totalParticipants: number;
  totalGames: number;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  phone?: string;
  primaryFieldType: string;
  fieldCount: number;
  rating: number;
  ratingCount: number;
  priceRange: number;
  amenities: string[];
  isActive: boolean;
}
