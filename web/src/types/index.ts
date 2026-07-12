export * from './user';
export * from './game';
export * from './group';
export * from './team';

// Re-export gamification sem conflito com UserBadge de user.ts
export {
  type LeagueDivision,
  type BadgeType,
  type BadgeRarity,
  type CardRarity,
  type ChallengeType,
  type Season,
  type SeasonParticipation,
  type SeasonFinalStanding,
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
  type FieldType,
  type LocationReview,
  type LocationWithFields,
  DEFAULT_LOCATION_TIME_ZONE,
  LOCATION_TIME_ZONE_OPTIONS,
  FIELD_TYPE_CONFIG,
  AMENITY_LABELS,
  canManageLocation,
  getFullAddress,
  isLocationOpenAt,
  isOpenNow,
  isValidLocationTimeZone,
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
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  groupId?: string;
  actionType?: string;
  action?: string;
  readAt?: Date;
}

export type NotificationType =
  | 'GAME_INVITE'
  | 'GAME_SUMMON'
  | 'GAME_CONFIRMED'
  | 'GAME_REMINDER'
  | 'GAME_CANCELLED'
  | 'GAME_UPDATED'
  | 'GAME_VACANCY'
  | 'GROUP_INVITE'
  | 'GROUP_INVITE_ACCEPTED'
  | 'GROUP_INVITE_DECLINED'
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'ACHIEVEMENT'
  | 'BADGE_UNLOCKED'
  | 'LEVEL_UP'
  | 'MVP_RECEIVED'
  | 'MVP_VOTE'
  | 'STREAK_BROKEN'
  | 'SYSTEM';
