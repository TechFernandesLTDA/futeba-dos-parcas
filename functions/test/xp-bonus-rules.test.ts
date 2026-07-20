import {
  brtDateKey,
  buildDerivedEventStats,
  calculateComebackBonus,
  calculateMonthlyProgress,
  calculatePerGameBonusBreakdown,
  normalizeGamificationSettings,
  reconcileXpLogBreakdown,
} from "../src/xp/bonus-rules";

describe("xp bonus rules", () => {
  const settings = normalizeGamificationSettings(undefined);

  it("normalizes nested gamification settings overrides safely", () => {
    const normalized = normalizeGamificationSettings({
      xpActions: {GOAL: 99},
      performanceBonuses: {TOP_SCORER: 21},
      retentionBonuses: {FIRST_GAME_OF_MONTH: 22},
    } as never);

    expect(normalized.xp_per_goal).toBe(99);
    expect(normalized.xp_top_scorer).toBe(21);
    expect(normalized.xp_first_game_of_month).toBe(22);
    expect(normalized.xp_per_assist).toBe(settings.xp_per_assist);
  });

  it("derives scorer bonuses from valid confirmations and only counts valid events", () => {
    const eventStats = buildDerivedEventStats([
      {
        id: "goal-late",
        data: () => ({
          event_type: "GOAL",
          player_id: "p2",
          minute: 5,
          recorded_by: "rec-1",
          player_position: "FIELD",
        }),
      },
      {
        id: "goal-early-z",
        data: () => ({
          event_type: "GOAL",
          player_id: "p1",
          minute: 5,
          recorded_by: "rec-1",
          player_position: "GOALKEEPER",
        }),
      },
      {
        id: "card-on-p2",
        data: () => ({
          event_type: "YELLOW_CARD",
          player_id: "p2",
          minute: 20,
          recorded_by: "rec-2",
        }),
      },
      {
        data: () => ({
          event_type: "SAVE",
          player_id: "p3",
          minute: 21,
          recorded_by: "rec-1",
        }),
      },
      {
        data: () => ({
          event_type: "OFFSIDE",
          player_id: "p1",
          minute: 22,
          recorded_by: "rec-1",
        }),
      },
      {
        data: () => ({
          event_type: "GOAL",
          player_id: "ghost",
          minute: 1,
          recorded_by: "rec-ghost",
        }),
      },
    ], settings, [
      {
        userId: "p1",
        status: "CONFIRMED",
        position: "GOALKEEPER",
        goals: 3,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
      {
        userId: "p2",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 1,
        assists: 0,
        saves: 0,
        yellowCards: 1,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
      {
        userId: "p3",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 0,
        assists: 0,
        saves: 1,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
    ]);

    expect(eventStats.topScorers.has("p1")).toBe(true);
    expect(eventStats.topScorers.has("p2")).toBe(false);
    expect(eventStats.firstGoalScorerId).toBe("p1");
    expect(eventStats.hatTrickScorers.has("p1")).toBe(true);
    expect(eventStats.goalkeeperGoalScorers.has("p1")).toBe(true);
    expect(eventStats.fairPlayEligible.has("p1")).toBe(true);
    expect(eventStats.fairPlayEligible.has("p2")).toBe(false);
    expect(eventStats.fairPlayEligible.has("p3")).toBe(true);
    expect(eventStats.recorderEventCounts.get("rec-1")).toBe(3);
    expect(eventStats.recorderEventCounts.has("rec-ghost")).toBe(false);
  });

  it("does not treat missing minute as minute zero for first-goal ordering", () => {
    const eventStats = buildDerivedEventStats([
      {
        id: "goal-without-minute",
        data: () => ({
          event_type: "GOAL",
          player_id: "p1",
        }),
      },
      {
        id: "goal-minute-5",
        data: () => ({
          event_type: "GOAL",
          player_id: "p2",
          minute: 5,
        }),
      },
    ], settings, [
      {
        userId: "p1",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 1,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
      {
        userId: "p2",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 1,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
    ]);

    expect(eventStats.firstGoalScorerId).toBe("p2");
  });

  it("uses deterministic created_at and docId fallback when minute is absent", () => {
    const eventStats = buildDerivedEventStats([
      {
        id: "goal-b",
        data: () => ({
          event_type: "GOAL",
          player_id: "p1",
          created_at: "2026-07-19T21:10:00.000Z",
        }),
      },
      {
        id: "goal-a",
        data: () => ({
          event_type: "GOAL",
          player_id: "p2",
          created_at: "2026-07-19T21:05:00.000Z",
        }),
      },
    ], settings, [
      {
        userId: "p1",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 1,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
      {
        userId: "p2",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 1,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
    ]);

    expect(eventStats.firstGoalScorerId).toBe("p2");
  });

  it("fails closed for Fair Play when card fields were not explicitly present", () => {
    const eventStats = buildDerivedEventStats([], settings, [
      {
        userId: "safe-zero",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 0,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
      },
      {
        userId: "legacy-missing",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 0,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: false,
        hasExplicitRedCards: false,
        game_id: "game-1",
      },
    ]);

    expect(eventStats.fairPlayEligible.has("safe-zero")).toBe(true);
    expect(eventStats.fairPlayEligible.has("legacy-missing")).toBe(false);
  });

  it("uses America/Sao_Paulo month boundaries for monthly streak progression", () => {
    const monthly = calculateMonthlyProgress({
      last_played_month_key: "2026-06",
      monthly_streak: 2,
    }, "2026-07");

    expect(monthly.isFirstGameOfMonth).toBe(true);
    expect(monthly.streakAfter).toBe(3);
    expect(monthly.reachedTier).toBe(3);
  });

  it("awards comeback only once per month and respects thresholds", () => {
    expect(calculateComebackBonus({
      last_played_game_date: "2026-07-06",
    }, settings, "2026-07-19", "2026-07")).toEqual({
      xp: 0,
      type: null,
    });

    expect(calculateComebackBonus({
      last_played_game_date: "2026-06-18",
    }, settings, "2026-07-19", "2026-07")).toEqual({
      xp: settings.xp_comeback_30d,
      type: "COMEBACK_30D",
    });

    expect(calculateComebackBonus({
      last_played_game_date: "2026-06-18",
      last_comeback_month_key: "2026-07",
    }, settings, "2026-07-19", "2026-07")).toEqual({
      xp: 0,
      type: null,
    });
  });

  it("calculates per-player bonus breakdown with first game of month and recorder cap", () => {
    const gameStartedAt = new Date("2026-07-19T23:00:00.000Z");
    const breakdown = calculatePerGameBonusBreakdown({
      confirmation: {
        userId: "player-1",
        status: "CONFIRMED",
        position: "GOALKEEPER",
        goals: 3,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-1",
        wasWaitlistPromoted: true,
        waitlistPromotedAt: {
          toDate: () => new Date("2026-07-19T18:00:00.000Z"),
        },
      },
      gameStartedAt,
      gameDateKey: brtDateKey(gameStartedAt),
      monthKey: "2026-07",
      userDoc: {
        last_played_game_date: "2026-06-01",
        last_played_month_key: "2026-06",
        monthly_streak: 2,
      },
      eventStats: {
        topScorers: new Set(["player-1"]),
        firstGoalScorerId: "player-1",
        hatTrickScorers: new Set(["player-1"]),
        goalkeeperGoalScorers: new Set(["player-1"]),
        fairPlayEligible: new Set(["player-1"]),
        recorderEventCounts: new Map([["player-1", 12]]),
      },
      waitlistEntriesByUser: new Map([[
        "player-1",
        {userId: "player-1", status: "NOTIFIED"},
      ]]),
    }, settings, true);

    expect(breakdown.topScorer).toBe(settings.xp_top_scorer);
    expect(breakdown.hatTrick).toBe(settings.xp_hat_trick);
    expect(breakdown.firstGoal).toBe(settings.xp_first_goal);
    expect(breakdown.goalkeeperGoal).toBe(settings.xp_goalkeeper_goal);
    expect(breakdown.fairPlay).toBe(settings.xp_fair_play);
    expect(breakdown.eventRecorder).toBe(settings.xp_event_recorder_max_xp);
    expect(breakdown.waitlistPromoted).toBe(settings.xp_waitlist_promoted);
    expect(breakdown.firstGameOfMonth).toBe(settings.xp_first_game_of_month);
    expect(breakdown.monthlyStreak).toBe(settings.xp_monthly_streak_3);
    expect(breakdown.comeback).toBe(settings.xp_comeback_30d);
  });

  it("requires server-authored waitlist markers and suppresses temporal bonuses for older games", () => {
    const gameStartedAt = new Date("2026-07-19T23:00:00.000Z");
    const breakdown = calculatePerGameBonusBreakdown({
      confirmation: {
        userId: "player-2",
        status: "CONFIRMED",
        position: "FIELD",
        goals: 0,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        hasExplicitYellowCards: true,
        hasExplicitRedCards: true,
        game_id: "game-2",
        wasWaitlistPromoted: true,
        waitlistPromotedAt: {
          toDate: () => new Date("2026-07-19T20:00:00.000Z"),
        },
        lastMinuteSaverEligible: true,
      },
      gameStartedAt,
      gameDateKey: "2026-07-01",
      monthKey: "2026-07",
      userDoc: {
        last_played_game_date: "2026-07-19",
        last_played_month_key: "2026-08",
        monthly_streak: 4,
      },
      eventStats: {
        topScorers: new Set<string>(),
        firstGoalScorerId: null,
        hatTrickScorers: new Set<string>(),
        goalkeeperGoalScorers: new Set<string>(),
        fairPlayEligible: new Set(["player-2"]),
        recorderEventCounts: new Map<string, number>(),
      },
      waitlistEntriesByUser: new Map([[
        "player-2",
        {userId: "player-2", status: "WAITING"},
      ]]),
    }, settings, true);

    expect(breakdown.lastMinuteSaver).toBe(settings.xp_last_minute_saver);
    expect(breakdown.waitlistPromoted).toBe(0);
    expect(breakdown.firstGameOfMonth).toBe(0);
    expect(breakdown.monthlyStreak).toBe(0);
    expect(breakdown.monthlyStreakAfter).toBe(4);
    expect(breakdown.comeback).toBe(0);
  });

  it("reconciles persisted breakdown exactly with capped xp total", () => {
    const reconciled = reconcileXpLogBreakdown({
      xp_participation: settings.xp_presence,
      xp_goals: 300,
      xp_assists: 60,
      xp_saves: 20,
      xp_result: 30,
      xp_mvp: 30,
      xp_clean_sheet: 20,
      xp_milestones: 50,
      xp_streak: 30,
      xp_penalty: 0,
      xp_top_scorer: 20,
      xp_hat_trick: 15,
      xp_first_goal: 10,
      xp_goalkeeper_goal: 12,
      xp_fair_play: 8,
      xp_recorder: 25,
      xp_early_confirmation: 5,
      xp_on_time_checkin: 5,
      xp_last_minute_saver: 10,
      xp_waitlist_promoted: 10,
      xp_comeback: 20,
      xp_first_game_month: 15,
      xp_monthly_streak: 25,
    }, 500);

    expect(Object.values(reconciled).reduce((sum, value) => sum + value, 0))
      .toBe(500);
    expect(reconciled.xp_monthly_streak).toBe(0);
    expect(reconciled.xp_first_game_month).toBe(0);
    expect(reconciled.xp_recorder).toBe(0);
    expect(reconciled.xp_goals).toBeGreaterThan(0);
  });

  it("fills the minimum-xp floor into participation when total is below target", () => {
    const reconciled = reconcileXpLogBreakdown({
      xp_participation: 5,
      xp_goals: 0,
      xp_assists: 0,
      xp_saves: 0,
      xp_result: 0,
      xp_mvp: 0,
      xp_clean_sheet: 0,
      xp_milestones: 0,
      xp_streak: 0,
      xp_penalty: -5,
      xp_top_scorer: 0,
      xp_hat_trick: 0,
      xp_first_goal: 0,
      xp_goalkeeper_goal: 0,
      xp_fair_play: 0,
      xp_recorder: 0,
      xp_early_confirmation: 0,
      xp_on_time_checkin: 0,
      xp_last_minute_saver: 0,
      xp_waitlist_promoted: 0,
      xp_comeback: 0,
      xp_first_game_month: 0,
      xp_monthly_streak: 0,
    }, 10);

    expect(Object.values(reconciled).reduce((sum, value) => sum + value, 0))
      .toBe(10);
    expect(reconciled.xp_participation).toBe(15);
  });
});
