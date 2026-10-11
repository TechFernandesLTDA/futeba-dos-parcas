import xpConstants from '../../../shared/xp-constants.json';
import { BADGE_DEFINITIONS, LEVEL_TABLE } from '../types/gamification';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const WEB_XP_ACTION_VALUES = {
  PARTICIPATION: xpConstants.xpActions.PARTICIPATION,
  GOAL: xpConstants.xpActions.GOAL,
  ASSIST: xpConstants.xpActions.ASSIST,
  SAVE: xpConstants.xpActions.SAVE,
  CLEAN_SHEET: xpConstants.xpActions.CLEAN_SHEET,
  WIN: xpConstants.xpActions.WIN,
  DRAW: xpConstants.xpActions.DRAW,
  MVP: xpConstants.xpActions.MVP,
  WORST_PLAYER: xpConstants.xpActions.WORST_PLAYER,
  STREAK_3: xpConstants.streakBonuses.STREAK_3,
  STREAK_5: xpConstants.streakBonuses.STREAK_5,
  STREAK_7: xpConstants.streakBonuses.STREAK_7,
  STREAK_10: xpConstants.streakBonuses.STREAK_10,
  TOP_SCORER: xpConstants.performanceBonuses.TOP_SCORER,
  COMEBACK_14D: xpConstants.retentionBonuses.COMEBACK_14D,
  COMEBACK_30D: xpConstants.retentionBonuses.COMEBACK_30D,
  FIRST_GAME_OF_MONTH: xpConstants.retentionBonuses.FIRST_GAME_OF_MONTH,
  HAT_TRICK: xpConstants.performanceBonuses.HAT_TRICK,
  FIRST_GOAL: xpConstants.performanceBonuses.FIRST_GOAL,
  EVENT_RECORDER: xpConstants.performanceBonuses.EVENT_RECORDER_PER_EVENT,
  EARLY_CONFIRMATION: xpConstants.behaviorBonuses.EARLY_CONFIRMATION,
  ON_TIME_CHECKIN: xpConstants.behaviorBonuses.ON_TIME_CHECKIN,
  LAST_MINUTE_SAVER: xpConstants.behaviorBonuses.LAST_MINUTE_SAVER,
  WAITLIST_PROMOTED: xpConstants.behaviorBonuses.WAITLIST_PROMOTED,
  MONTHLY_STREAK_3: xpConstants.retentionBonuses.MONTHLY_STREAK_3,
  GOALKEEPER_GOAL: xpConstants.performanceBonuses.GOALKEEPER_GOAL,
  FAIR_PLAY: xpConstants.performanceBonuses.FAIR_PLAY,
  BOLA_MURCHA: xpConstants.xpActions.WORST_PLAYER,
} as const;

export interface XpBreakdownFields {
  xpParticipation?: number;
  xpGoals?: number;
  xpAssists?: number;
  xpSaves?: number;
  xpResult?: number;
  xpMvp?: number;
  xpCleanSheet?: number;
  xpMilestones?: number;
  xpStreak?: number;
  xpPenalty?: number;
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

const ACTION_LABEL_KEYS: Readonly<Record<string, string>> = {
  PARTICIPATION: 'gamification.actions.PARTICIPATION',
  GOAL: 'gamification.actions.GOAL',
  ASSIST: 'gamification.actions.ASSIST',
  SAVE: 'gamification.actions.SAVE',
  CLEAN_SHEET: 'gamification.actions.CLEAN_SHEET',
  WIN: 'gamification.actions.WIN',
  DRAW: 'gamification.actions.DRAW',
  MVP: 'gamification.actions.MVP',
  WORST_PLAYER: 'gamification.actions.WORST_PLAYER',
  TOP_SCORER: 'gamification.actions.TOP_SCORER',
  COMEBACK_14D: 'gamification.actions.COMEBACK_14D',
  COMEBACK_30D: 'gamification.actions.COMEBACK_30D',
  FIRST_GAME_OF_MONTH: 'gamification.actions.FIRST_GAME_OF_MONTH',
  HAT_TRICK: 'gamification.actions.HAT_TRICK',
  FIRST_GOAL: 'gamification.actions.FIRST_GOAL',
  EVENT_RECORDER: 'gamification.actions.EVENT_RECORDER',
  EARLY_CONFIRMATION: 'gamification.actions.EARLY_CONFIRMATION',
  ON_TIME_CHECKIN: 'gamification.actions.ON_TIME_CHECKIN',
  LAST_MINUTE_SAVER: 'gamification.actions.LAST_MINUTE_SAVER',
  WAITLIST_PROMOTED: 'gamification.actions.WAITLIST_PROMOTED',
  MONTHLY_STREAK_3: 'gamification.actions.MONTHLY_STREAK_3',
  GOALKEEPER_GOAL: 'gamification.actions.GOALKEEPER_GOAL',
  FAIR_PLAY: 'gamification.actions.FAIR_PLAY',
  BEST_GK: 'gamification.actions.BEST_GK',
  STREAK_3: 'gamification.actions.STREAK_3',
  STREAK_5: 'gamification.actions.STREAK_5',
  STREAK_7: 'gamification.actions.STREAK_7',
  STREAK_10: 'gamification.actions.STREAK_10',
  ALMOST_LEVEL: 'gamification.actions.ALMOST_LEVEL',
  ALMOST_BADGE: 'gamification.actions.ALMOST_BADGE',
  STREAK_AT_RISK: 'gamification.actions.STREAK_AT_RISK',
  MILESTONE: 'gamification.actions.MILESTONE',
};

const BREAKDOWN_FIELDS: ReadonlyArray<{ field: keyof XpBreakdownFields; action: string }> = [
  { field: 'xpParticipation', action: 'PARTICIPATION' },
  { field: 'xpGoals', action: 'GOAL' },
  { field: 'xpAssists', action: 'ASSIST' },
  { field: 'xpSaves', action: 'SAVE' },
  { field: 'xpResult', action: 'WIN' },
  { field: 'xpMvp', action: 'MVP' },
  { field: 'xpCleanSheet', action: 'CLEAN_SHEET' },
  { field: 'xpMilestones', action: 'MILESTONE' },
  { field: 'xpStreak', action: 'STREAK_3' },
  { field: 'xpPenalty', action: 'WORST_PLAYER' },
  { field: 'xpTopScorer', action: 'TOP_SCORER' },
  { field: 'xpHatTrick', action: 'HAT_TRICK' },
  { field: 'xpFirstGoal', action: 'FIRST_GOAL' },
  { field: 'xpGoalkeeperGoal', action: 'GOALKEEPER_GOAL' },
  { field: 'xpFairPlay', action: 'FAIR_PLAY' },
  { field: 'xpComeback', action: 'COMEBACK_30D' },
  { field: 'xpFirstGameMonth', action: 'FIRST_GAME_OF_MONTH' },
  { field: 'xpMonthlyStreak', action: 'MONTHLY_STREAK_3' },
  { field: 'xpRecorder', action: 'EVENT_RECORDER' },
  { field: 'xpEarlyConfirmation', action: 'EARLY_CONFIRMATION' },
  { field: 'xpOnTimeCheckin', action: 'ON_TIME_CHECKIN' },
  { field: 'xpLastMinuteSaver', action: 'LAST_MINUTE_SAVER' },
  { field: 'xpWaitlistPromoted', action: 'WAITLIST_PROMOTED' },
];

function getFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function getGamificationActionLabel(action: string, t: Translate): string {
  const normalized = action.trim().toUpperCase();
  const key = ACTION_LABEL_KEYS[normalized];
  return key ? t(key) : normalized.replace(/_/g, ' ');
}

export function getXpGuideEntries(t: Translate) {
  return [
    { id: 'participation', value: WEB_XP_ACTION_VALUES.PARTICIPATION },
    { id: 'goal', value: WEB_XP_ACTION_VALUES.GOAL },
    { id: 'assist', value: WEB_XP_ACTION_VALUES.ASSIST },
    { id: 'save', value: WEB_XP_ACTION_VALUES.SAVE },
    { id: 'win', value: WEB_XP_ACTION_VALUES.WIN },
    { id: 'mvp', value: WEB_XP_ACTION_VALUES.MVP },
    { id: 'topScorer', value: WEB_XP_ACTION_VALUES.TOP_SCORER },
    { id: 'hatTrick', value: WEB_XP_ACTION_VALUES.HAT_TRICK },
    { id: 'firstGoal', value: WEB_XP_ACTION_VALUES.FIRST_GOAL },
    { id: 'goalkeeperGoal', value: WEB_XP_ACTION_VALUES.GOALKEEPER_GOAL },
    { id: 'fairPlay', value: WEB_XP_ACTION_VALUES.FAIR_PLAY },
    { id: 'earlyConfirmation', value: WEB_XP_ACTION_VALUES.EARLY_CONFIRMATION },
    { id: 'onTimeCheckin', value: WEB_XP_ACTION_VALUES.ON_TIME_CHECKIN },
    { id: 'lastMinuteSaver', value: WEB_XP_ACTION_VALUES.LAST_MINUTE_SAVER },
    { id: 'waitlistPromoted', value: WEB_XP_ACTION_VALUES.WAITLIST_PROMOTED },
    { id: 'firstGameMonth', value: WEB_XP_ACTION_VALUES.FIRST_GAME_OF_MONTH },
    { id: 'monthlyStreak3', value: WEB_XP_ACTION_VALUES.MONTHLY_STREAK_3 },
  ].map((entry) => ({
    ...entry,
    label: t(`level.xpGuide.${entry.id}.label`),
    description: t(`level.xpGuide.${entry.id}.desc`),
  }));
}

export function summarizeXpLogBreakdown(
  breakdown: XpBreakdownFields,
  t: Translate,
): string[] {
  return BREAKDOWN_FIELDS
    .map(({ field, action }) => {
      const amount = getFiniteNumber(breakdown[field]);
      if (amount === 0) return null;
      const sign = amount > 0 ? '+' : '';
      return `${sign}${amount} ${getGamificationActionLabel(action, t)}`;
    })
    .filter((value): value is string => Boolean(value));
}

export function getNearLevelInsight(currentXp: number) {
  const nextEntry = LEVEL_TABLE.find((entry) => entry.xpRequired > currentXp);
  if (!nextEntry) return null;
  const remainingXp = nextEntry.xpRequired - currentXp;
  if (remainingXp >= 100) return null;
  return {
    remainingXp,
    level: nextEntry.level,
    levelName: nextEntry.name,
  };
}

export function getNearBadgeInsights(
  user: Record<string, unknown> | null | undefined,
  unlockedIds: Set<string>,
) {
  if (!user) return [];

  return BADGE_DEFINITIONS
    .filter((badge) => badge.progressStat && badge.progressThreshold)
    .map((badge) => {
      if (unlockedIds.has(badge.id)) return null;
      const statKey = badge.progressStat!;
      const threshold = badge.progressThreshold!;
      const currentValue = getFiniteNumber(user[statKey]);
      if (currentValue >= threshold) return null;
      const progress = currentValue / threshold;
      if (progress < 0.8) return null;
      return {
        badgeId: badge.id,
        currentValue,
        remaining: threshold - currentValue,
        threshold,
        progress,
        badge,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => left.remaining - right.remaining)
    .slice(0, 2);
}
