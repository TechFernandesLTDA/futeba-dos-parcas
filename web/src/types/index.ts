export * from './user';
export * from './game';
export * from './group';

// Re-export gamification sem conflito com Badge de user.ts
export {
  type LeagueDivision,
  type BadgeType,
  type BadgeRarity,
  type CardRarity,
  type ChallengeType,
  type Season,
  type SeasonParticipation,
  type SeasonFinalStanding,
  type UserBadge,
  type UserStreak,
  type WeeklyChallenge,
  type UserChallengeProgress,
  type PlayerCard,
  type HeadToHead,
  type Milestone,
  type RankingPlayer,
  type BadgeDefinition,
  DIVISION_CONFIG,
  BADGE_DEFINITIONS,
  BADGE_RARITY_CONFIG,
  CARD_RARITY_CONFIG,
  XP_VALUES,
  getDivisionFromPoints,
  getXPForNextLevel,
} from './gamification';

// Re-export location sem conflito com FieldType de game.ts
export {
  type Location,
  type Field,
  type LocationReview,
  type LocationWithFields,
  FIELD_TYPE_CONFIG,
  AMENITY_LABELS,
  canManageLocation,
  getFullAddress,
  isOpenNow,
} from './location';

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
