
import type {
  GameConfirmation,
  GamificationSettings,
} from "../models";
import {DEFAULT_SETTINGS} from "./pipeline";

const BRT_TIMEZONE = "America/Sao_Paulo";
const FIRST_GAME_OF_MONTH_TIER = 1;

type FirestoreTimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
};

type GameEventDocLike = {
  id?: string;
  data: () => FirebaseFirestore.DocumentData;
};

type WaitlistEntryLike = {
  userId: string;
  status: string | null;
};

const VALID_EVENT_TYPES = new Set([
  "GOAL",
  "SAVE",
  "YELLOW_CARD",
  "RED_CARD",
]);
const VALID_WAITLIST_PROMOTION_STATUSES = new Set([
  "NOTIFIED",
  "PROMOTED",
]);

export type EventBonusContext = {
  confirmation: GameConfirmation;
  gameStartedAt: Date;
  gameDateKey: string;
  monthKey: string;
  userDoc: Record<string, unknown>;
  eventStats: DerivedEventStats;
  waitlistEntriesByUser: Map<string, WaitlistEntryLike>;
};

export type DerivedEventStats = {
  topScorers: Set<string>;
  firstGoalScorerId: string | null;
  hatTrickScorers: Set<string>;
  goalkeeperGoalScorers: Set<string>;
  fairPlayEligible: Set<string>;
  recorderEventCounts: Map<string, number>;
};

export type MonthlyProgressState = {
  currentMonth: string;
  previousMonth: string | null;
  streakBefore: number;
  streakAfter: number;
  reachedTier: number | null;
  isFirstGameOfMonth: boolean;
};

export type ComebackResult = {
  xp: number;
  type: "COMEBACK_14D" | "COMEBACK_30D" | null;
};

export type PerGameBonusBreakdown = {
  topScorer: number;
  hatTrick: number;
  firstGoal: number;
  goalkeeperGoal: number;
  fairPlay: number;
  eventRecorder: number;
  earlyConfirmation: number;
  onTimeCheckin: number;
  lastMinuteSaver: number;
  waitlistPromoted: number;
  comeback: number;
  firstGameOfMonth: number;
  monthlyStreak: number;
  recordedEventsCount: number;
  comebackType: "COMEBACK_14D" | "COMEBACK_30D" | null;
  monthlyStreakAfter: number;
  monthlyStreakTier: number | null;
};

export type XpLogBreakdownFields = {
  xp_participation: number;
  xp_goals: number;
  xp_assists: number;
  xp_saves: number;
  xp_result: number;
  xp_mvp: number;
  xp_clean_sheet: number;
  xp_milestones: number;
  xp_streak: number;
  xp_penalty: number;
  xp_top_scorer: number;
  xp_hat_trick: number;
  xp_first_goal: number;
  xp_goalkeeper_goal: number;
  xp_fair_play: number;
  xp_recorder: number;
  xp_early_confirmation: number;
  xp_on_time_checkin: number;
  xp_last_minute_saver: number;
  xp_waitlist_promoted: number;
  xp_comeback: number;
  xp_first_game_month: number;
  xp_monthly_streak: number;
};

const XP_LOG_RECONCILE_ORDER: Array<keyof XpLogBreakdownFields> = [
  "xp_monthly_streak",
  "xp_first_game_month",
  "xp_comeback",
  "xp_waitlist_promoted",
  "xp_last_minute_saver",
  "xp_on_time_checkin",
  "xp_early_confirmation",
  "xp_recorder",
  "xp_fair_play",
  "xp_goalkeeper_goal",
  "xp_first_goal",
  "xp_hat_trick",
  "xp_top_scorer",
  "xp_milestones",
  "xp_streak",
  "xp_clean_sheet",
  "xp_mvp",
  "xp_result",
  "xp_saves",
  "xp_assists",
  "xp_goals",
  "xp_participation",
];

export function toDate(
  value: unknown,
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    const date = (value as FirestoreTimestampLike).toDate?.();
    return date instanceof Date && !Number.isNaN(date.getTime()) ?
      date :
      null;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as FirestoreTimestampLike).toMillis === "function"
  ) {
    const millis = (value as FirestoreTimestampLike).toMillis?.();
    if (typeof millis === "number" && Number.isFinite(millis)) {
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function brtDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: BRT_TIMEZONE,
  });
}

export function brtMonthKey(date: Date): string {
  return brtDateKey(date).slice(0, 7);
}

function parseDateKeyAsUtc(dateKey?: string | null): Date | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function monthDiff(
  previousMonth: string | null,
  currentMonth: string,
): number | null {
  if (
    !previousMonth ||
    !/^\d{4}-\d{2}$/.test(previousMonth) ||
    !/^\d{4}-\d{2}$/.test(currentMonth)
  ) {
    return null;
  }
  const [prevYear, prevMonthNumber] =
    previousMonth.split("-").map(Number);
  const [currYear, currMonthNumber] =
    currentMonth.split("-").map(Number);
  return (currYear * 12 + currMonthNumber) -
    (prevYear * 12 + prevMonthNumber);
}

function dayDiffFromDateKeys(
  previousDateKey: string | null,
  currentDateKey: string,
): number | null {
  const prev = parseDateKeyAsUtc(previousDateKey);
  const current = parseDateKeyAsUtc(currentDateKey);
  if (!prev || !current) return null;
  return Math.round(
    (current.getTime() - prev.getTime()) / 86400000,
  );
}

function normalizeActionMap(
  raw: unknown,
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(raw as Record<string, unknown>)
    .reduce<Record<string, number>>((acc, [key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function readString(
  source: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(
  source: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function readBoolean(
  source: Record<string, unknown>,
  ...keys: string[]
): boolean {
  return keys.some((key) => source[key] === true);
}

export function normalizeGamificationSettings(
  raw: FirebaseFirestore.DocumentData | undefined,
): GamificationSettings {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
  } as GamificationSettings;
  const actionOverrides = normalizeActionMap(raw?.xpActions);
  const performanceOverrides =
    normalizeActionMap(raw?.performanceBonuses);
  const behaviorOverrides =
    normalizeActionMap(raw?.behaviorBonuses);
  const retentionOverrides =
    normalizeActionMap(raw?.retentionBonuses);

  return {
    ...settings,
    xp_per_goal:
      actionOverrides.GOAL ?? settings.xp_per_goal,
    xp_per_assist:
      actionOverrides.ASSIST ?? settings.xp_per_assist,
    xp_per_save:
      actionOverrides.SAVE ?? settings.xp_per_save,
    xp_presence:
      actionOverrides.PARTICIPATION ?? settings.xp_presence,
    xp_clean_sheet:
      actionOverrides.CLEAN_SHEET ?? settings.xp_clean_sheet,
    xp_win:
      actionOverrides.WIN ?? settings.xp_win,
    xp_draw:
      actionOverrides.DRAW ?? settings.xp_draw,
    xp_mvp:
      actionOverrides.MVP ?? settings.xp_mvp,
    xp_top_scorer:
      performanceOverrides.TOP_SCORER ?? settings.xp_top_scorer,
    xp_hat_trick:
      performanceOverrides.HAT_TRICK ?? settings.xp_hat_trick,
    xp_first_goal:
      performanceOverrides.FIRST_GOAL ?? settings.xp_first_goal,
    xp_goalkeeper_goal:
      performanceOverrides.GOALKEEPER_GOAL ??
      settings.xp_goalkeeper_goal,
    xp_fair_play:
      performanceOverrides.FAIR_PLAY ?? settings.xp_fair_play,
    xp_event_recorder_per_event:
      performanceOverrides.EVENT_RECORDER_PER_EVENT ??
      settings.xp_event_recorder_per_event,
    xp_event_recorder_min_events:
      performanceOverrides.EVENT_RECORDER_MIN_EVENTS ??
      settings.xp_event_recorder_min_events,
    xp_event_recorder_max_xp:
      performanceOverrides.EVENT_RECORDER_MAX_XP ??
      settings.xp_event_recorder_max_xp,
    xp_early_confirmation:
      behaviorOverrides.EARLY_CONFIRMATION ??
      settings.xp_early_confirmation,
    xp_on_time_checkin:
      behaviorOverrides.ON_TIME_CHECKIN ??
      settings.xp_on_time_checkin,
    xp_last_minute_saver:
      behaviorOverrides.LAST_MINUTE_SAVER ??
      settings.xp_last_minute_saver,
    xp_waitlist_promoted:
      behaviorOverrides.WAITLIST_PROMOTED ??
      settings.xp_waitlist_promoted,
    xp_comeback_14d:
      retentionOverrides.COMEBACK_14D ??
      settings.xp_comeback_14d,
    xp_comeback_30d:
      retentionOverrides.COMEBACK_30D ??
      settings.xp_comeback_30d,
    comeback_14d_threshold_days:
      retentionOverrides.COMEBACK_14D_THRESHOLD_DAYS ??
      settings.comeback_14d_threshold_days,
    comeback_30d_threshold_days:
      retentionOverrides.COMEBACK_30D_THRESHOLD_DAYS ??
      settings.comeback_30d_threshold_days,
    comeback_max_per_month:
      retentionOverrides.COMEBACK_MAX_PER_MONTH ??
      settings.comeback_max_per_month,
    xp_first_game_of_month:
      retentionOverrides.FIRST_GAME_OF_MONTH ??
      settings.xp_first_game_of_month,
    xp_monthly_streak_3:
      retentionOverrides.MONTHLY_STREAK_3 ??
      settings.xp_monthly_streak_3,
    xp_monthly_streak_6:
      retentionOverrides.MONTHLY_STREAK_6 ??
      settings.xp_monthly_streak_6,
    xp_monthly_streak_12:
      retentionOverrides.MONTHLY_STREAK_12 ??
      settings.xp_monthly_streak_12,
    xpActions: actionOverrides,
    performanceBonuses: performanceOverrides,
    behaviorBonuses: behaviorOverrides,
    retentionBonuses: retentionOverrides,
  };
}

function resolveEventOrder(
  raw: Record<string, unknown>,
  docId: string | undefined,
  index: number,
  playerId: string,
): string {
  const minute = readNumber(raw, "minute");
  const createdAt = toDate(raw.created_at ?? raw.createdAt);
  const minuteKey =
    minute != null ?
      minute.toString().padStart(6, "0") :
      "999999";
  const createdAtKey =
    createdAt ?
      createdAt.getTime().toString().padStart(16, "0") :
      "9999999999999999";
  return [
    minuteKey,
    createdAtKey,
    docId ?? "",
    playerId,
    index.toString().padStart(6, "0"),
  ].join("|");
}

function hasExplicitZeroFairPlayEvidence(
  confirmation: GameConfirmation,
): boolean {
  return confirmation.hasExplicitYellowCards === true &&
    confirmation.hasExplicitRedCards === true &&
    confirmation.yellowCards === 0 &&
    confirmation.redCards === 0;
}

function hasNewerTemporalMarker(
  userDoc: Record<string, unknown>,
  currentDateKey: string,
  currentMonth: string,
): boolean {
  const lastPlayedDateKey = readString(
    userDoc,
    "last_played_game_date",
    "lastPlayedGameDate",
    "last_game_date",
    "lastGameDate",
  );
  const lastPlayedMonthKey = readString(
    userDoc,
    "last_played_month_key",
    "lastPlayedMonthKey",
    "lastPlayedMonth",
  );
  return (
    (lastPlayedDateKey != null &&
      lastPlayedDateKey > currentDateKey) ||
    (lastPlayedMonthKey != null &&
      lastPlayedMonthKey > currentMonth)
  );
}

function hasValidWaitlistPromotionStatus(
  entry: WaitlistEntryLike | undefined,
): boolean {
  if (!entry) return true;
  return entry.status != null &&
    VALID_WAITLIST_PROMOTION_STATUSES.has(entry.status);
}

export function buildDerivedEventStats(
  gameEvents: GameEventDocLike[],
  settings: GamificationSettings,
  validConfirmations: GameConfirmation[],
): DerivedEventStats {
  const validConfirmationsByUser = new Map(
    validConfirmations.map((confirmation) => [
      confirmation.userId,
      confirmation,
    ]),
  );
  const recorderEventCounts = new Map<string, number>();
  const goalkeeperGoalScorers = new Set<string>();
  const fairPlayEligible = new Set(
    validConfirmations
      .filter(hasExplicitZeroFairPlayEvidence)
      .map((confirmation) => confirmation.userId),
  );
  const topScorers = new Set<string>();
  const hatTrickScorers = new Set<string>();
  let bestGoals = 0;
  let firstGoalScorerId: string | null = null;
  let firstGoalOrder: string | null = null;

  for (const confirmation of validConfirmations) {
    if (confirmation.goals >= 3) {
      hatTrickScorers.add(confirmation.userId);
    }
    if (confirmation.goals > bestGoals) {
      bestGoals = confirmation.goals;
      topScorers.clear();
      topScorers.add(confirmation.userId);
    } else if (
      confirmation.goals > 0 &&
      confirmation.goals === bestGoals
    ) {
      topScorers.add(confirmation.userId);
    }
  }

  for (const [index, doc] of gameEvents.entries()) {
    const raw = doc.data() ?? {};
    const type = readString(raw, "event_type", "type");
    const playerId = readString(raw, "player_id", "playerId");
    if (
      !type ||
      !VALID_EVENT_TYPES.has(type) ||
      !playerId ||
      !validConfirmationsByUser.has(playerId)
    ) {
      continue;
    }

    const recordedBy = readString(
      raw,
      "recorded_by",
      "recordedBy",
      "created_by",
      "createdBy",
    );
    if (recordedBy) {
      const nextCount =
        (recorderEventCounts.get(recordedBy) ?? 0) + 1;
      recorderEventCounts.set(recordedBy, nextCount);
    }

    if (type === "GOAL") {
      const order = resolveEventOrder(
        raw,
        doc.id,
        index,
        playerId,
      );
      if (
        firstGoalOrder == null ||
        order.localeCompare(firstGoalOrder) < 0
      ) {
        firstGoalOrder = order;
        firstGoalScorerId = playerId;
      }
      const confirmation = validConfirmationsByUser.get(playerId);
      const eventPosition = readString(
        raw,
        "player_position",
        "playerPosition",
      );
      if (
        eventPosition === "GOALKEEPER" ||
        confirmation?.position === "GOALKEEPER"
      ) {
        goalkeeperGoalScorers.add(playerId);
      }
      continue;
    }

    if (type === "YELLOW_CARD" || type === "RED_CARD") {
      fairPlayEligible.delete(playerId);
    }
  }

  return {
    topScorers,
    firstGoalScorerId,
    hatTrickScorers,
    goalkeeperGoalScorers,
    fairPlayEligible,
    recorderEventCounts: new Map(
      [...recorderEventCounts.entries()].filter(([, count]) =>
        count >= settings.xp_event_recorder_min_events,
      ),
    ),
  };
}

export function calculateMonthlyProgress(
  userDoc: Record<string, unknown>,
  currentMonth: string,
): MonthlyProgressState {
  const previousMonth = readString(
    userDoc,
    "last_played_month_key",
    "lastPlayedMonthKey",
    "lastPlayedMonth",
  );
  const streakBefore = Math.max(
    0,
    Math.trunc(
      readNumber(userDoc, "monthly_streak", "monthlyStreak") ?? 0,
    ),
  );
  const diff = monthDiff(previousMonth, currentMonth);
  const isFirstGameOfMonth = previousMonth !== currentMonth;

  let streakAfter = streakBefore;
  if (diff === null) {
    streakAfter = FIRST_GAME_OF_MONTH_TIER;
  } else if (diff === 0) {
    streakAfter = Math.max(streakBefore, FIRST_GAME_OF_MONTH_TIER);
  } else if (diff === 1) {
    streakAfter = Math.max(1, streakBefore) + 1;
  } else {
    streakAfter = FIRST_GAME_OF_MONTH_TIER;
  }

  let reachedTier: number | null = null;
  if (isFirstGameOfMonth) {
    if (streakBefore < 12 && streakAfter >= 12) {
      reachedTier = 12;
    } else if (streakBefore < 6 && streakAfter >= 6) {
      reachedTier = 6;
    } else if (streakBefore < 3 && streakAfter >= 3) {
      reachedTier = 3;
    }
  }

  return {
    currentMonth,
    previousMonth,
    streakBefore,
    streakAfter,
    reachedTier,
    isFirstGameOfMonth,
  };
}

export function calculateComebackBonus(
  userDoc: Record<string, unknown>,
  settings: GamificationSettings,
  currentDateKey: string,
  currentMonth: string,
): ComebackResult {
  const lastPlayedDateKey = readString(
    userDoc,
    "last_played_game_date",
    "lastPlayedGameDate",
    "last_game_date",
    "lastGameDate",
  );
  const lastComebackMonth = readString(
    userDoc,
    "last_comeback_month_key",
    "lastComebackMonthKey",
  );
  const diffDays = dayDiffFromDateKeys(
    lastPlayedDateKey,
    currentDateKey,
  );
  if (
    diffDays == null ||
    diffDays < settings.comeback_14d_threshold_days ||
    lastComebackMonth === currentMonth
  ) {
    return {xp: 0, type: null};
  }
  if (diffDays >= settings.comeback_30d_threshold_days) {
    return {
      xp: settings.xp_comeback_30d,
      type: "COMEBACK_30D",
    };
  }
  return {
    xp: settings.xp_comeback_14d,
    type: "COMEBACK_14D",
  };
}

function calculateMonthlyStreakBonus(
  monthly: MonthlyProgressState,
  settings: GamificationSettings,
): {xp: number; tier: number | null} {
  if (monthly.reachedTier === 12) {
    return {xp: settings.xp_monthly_streak_12, tier: 12};
  }
  if (monthly.reachedTier === 6) {
    return {xp: settings.xp_monthly_streak_6, tier: 6};
  }
  if (monthly.reachedTier === 3) {
    return {xp: settings.xp_monthly_streak_3, tier: 3};
  }
  return {xp: 0, tier: null};
}

export function calculatePerGameBonusBreakdown(
  context: EventBonusContext,
  settings: GamificationSettings,
  recorderBonusEligible: boolean,
): PerGameBonusBreakdown {
  const confirmationData =
    context.confirmation as unknown as Record<string, unknown>;
  const existingMonthlyStreak = Math.max(
    0,
    Math.trunc(
      readNumber(
        context.userDoc,
        "monthly_streak",
        "monthlyStreak",
      ) ?? 0,
    ),
  );
  const temporalMarkersAhead = hasNewerTemporalMarker(
    context.userDoc,
    context.gameDateKey,
    context.monthKey,
  );
  const monthly = temporalMarkersAhead ?
    {
      currentMonth: context.monthKey,
      previousMonth: readString(
        context.userDoc,
        "last_played_month_key",
        "lastPlayedMonthKey",
        "lastPlayedMonth",
      ),
      streakBefore: existingMonthlyStreak,
      streakAfter: existingMonthlyStreak,
      reachedTier: null,
      isFirstGameOfMonth: false,
    } :
    calculateMonthlyProgress(
      context.userDoc,
      context.monthKey,
    );
  const comeback = temporalMarkersAhead ?
    {xp: 0, type: null} :
    calculateComebackBonus(
      context.userDoc,
      settings,
      context.gameDateKey,
      context.monthKey,
    );
  const monthlyStreakBonus = calculateMonthlyStreakBonus(
    monthly,
    settings,
  );
  const confirmedAt = toDate(
    confirmationData.confirmedAt ??
      confirmationData.confirmed_at,
  );
  const checkedInAt = toDate(
    confirmationData.checkedInAt ??
      confirmationData.checked_in_at,
  );
  const waitlistPromotedAt = toDate(
    confirmationData.waitlistPromotedAt ??
      confirmationData.waitlist_promoted_at,
  );
  const startsAtMs = context.gameStartedAt.getTime();
  const recorderEventsCount =
    context.eventStats.recorderEventCounts.get(context.confirmation.userId) ?? 0;
  const eventRecorder = recorderBonusEligible ?
    Math.min(
      settings.xp_event_recorder_max_xp,
      recorderEventsCount * settings.xp_event_recorder_per_event,
    ) :
    0;
  const topScorer =
    context.eventStats.topScorers.has(context.confirmation.userId) ?
      settings.xp_top_scorer :
      0;
  const hatTrick =
    context.eventStats.hatTrickScorers.has(context.confirmation.userId) ?
      settings.xp_hat_trick :
      0;
  const firstGoal =
    context.eventStats.firstGoalScorerId === context.confirmation.userId ?
      settings.xp_first_goal :
      0;
  const goalkeeperGoal =
    context.eventStats.goalkeeperGoalScorers.has(context.confirmation.userId) ?
      settings.xp_goalkeeper_goal :
      0;
  const fairPlay =
    context.eventStats.fairPlayEligible.has(context.confirmation.userId) ?
      settings.xp_fair_play :
      0;
  const earlyConfirmation =
    confirmedAt &&
    confirmedAt.getTime() <= startsAtMs - (48 * 60 * 60 * 1000) ?
      settings.xp_early_confirmation :
      0;
  const onTimeCheckin =
    checkedInAt &&
    checkedInAt.getTime() <= startsAtMs + (10 * 60 * 1000) ?
      settings.xp_on_time_checkin :
      0;
  const lastMinuteSaver = readBoolean(
    confirmationData,
    "lastMinuteSaverEligible",
    "last_minute_saver_eligible",
  ) ?
    settings.xp_last_minute_saver :
    0;
  const waitlistEntry = context.waitlistEntriesByUser.get(
    context.confirmation.userId,
  );
  const waitlistPromoted = readBoolean(
    confirmationData,
    "wasWaitlistPromoted",
    "was_waitlist_promoted",
  ) &&
  waitlistPromotedAt != null &&
  hasValidWaitlistPromotionStatus(waitlistEntry) ?
    settings.xp_waitlist_promoted :
    0;

  return {
    topScorer,
    hatTrick,
    firstGoal,
    goalkeeperGoal,
    fairPlay,
    eventRecorder,
    earlyConfirmation,
    onTimeCheckin,
    lastMinuteSaver,
    waitlistPromoted,
    comeback: comeback.xp,
    firstGameOfMonth:
      monthly.isFirstGameOfMonth ?
        settings.xp_first_game_of_month :
        0,
    monthlyStreak: monthlyStreakBonus.xp,
    recordedEventsCount: recorderEventsCount,
    comebackType: comeback.type,
    monthlyStreakAfter: monthly.streakAfter,
    monthlyStreakTier: monthlyStreakBonus.tier,
  };
}

export function buildWaitlistMap(
  docs: Array<{data: () => FirebaseFirestore.DocumentData}>,
): Map<string, WaitlistEntryLike> {
  const byUser = new Map<string, WaitlistEntryLike>();
  for (const doc of docs) {
    const data = doc.data() ?? {};
    const userId = readString(data, "user_id", "userId");
    if (!userId) continue;
    byUser.set(userId, {
      userId,
      status: readString(data, "status"),
    });
  }
  return byUser;
}

export function reconcileXpLogBreakdown(
  breakdown: XpLogBreakdownFields,
  targetXp: number,
): XpLogBreakdownFields {
  const next = {...breakdown};
  const currentTotal = Object.values(next)
    .reduce((sum, value) => sum + value, 0);
  if (currentTotal === targetXp) {
    return next;
  }

  if (currentTotal < targetXp) {
    next.xp_participation += targetXp - currentTotal;
    return next;
  }

  let overflow = currentTotal - targetXp;
  for (const key of XP_LOG_RECONCILE_ORDER) {
    if (overflow <= 0) break;
    const current = next[key];
    if (current <= 0) continue;
    const reduction = Math.min(current, overflow);
    next[key] = current - reduction;
    overflow -= reduction;
  }

  if (overflow > 0) {
    next.xp_participation = Math.max(
      0,
      next.xp_participation - overflow,
    );
  }

  const reconciledTotal = Object.values(next)
    .reduce((sum, value) => sum + value, 0);
  if (reconciledTotal !== targetXp) {
    next.xp_participation += targetXp - reconciledTotal;
  }
  return next;
}
