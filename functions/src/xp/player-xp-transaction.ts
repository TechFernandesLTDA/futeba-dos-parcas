import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {
  getAllBadgesToAward,
} from "../badges/badge-helper";
import {
  buildMilestoneBadgeDoc,
  buildUserBadgeAggregateDoc,
} from "../badges/user-badge-docs";
import {
  MAX_XP_PER_GAME,
  MIN_XP_PER_GAME,
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
} from "../constants";
import {db} from "../_db";
import {
  getOpponentScore,
  updateRankingDeltas,
  updateSeasonParticipation,
} from "../game/helpers";
import type {
  Game,
  GameConfirmation,
  GamificationSettings,
  LiveGameScore,
  Team,
  UserStatistics,
  XpLog,
} from "../models";
import {
  buildWaitlistMap,
  calculatePerGameBonusBreakdown,
  reconcileXpLogBreakdown,
  type DerivedEventStats,
} from "./bonus-rules";
import {
  XP_WORST_PLAYER_PENALTY,
  checkMilestones,
  fitMilestonesWithinGameXpCap,
  getLevelForXp,
} from "./pipeline";
import {
  calculateNextParticipationStreak,
  calculateStreakXp,
  hasNewerParticipationStreakMarker,
} from "./streaks";

export interface XpIdempotencyState {
  alreadyProcessedUserIds: Set<string>;
  mvpVotingAlreadyPaid: boolean;
  worstVotingAlreadyPaid: boolean;
}

export interface PlayerXpTransactionResult {
  alreadyProcessed: boolean;
  xp: number;
  streak: number;
  previousStreak: number;
  comebackXp: number;
}

/**
 * Lê o estado de idempotência por jogador (`xp_logs/game_{gameId}_user_{uid}`)
 * e os marcadores de dedup bidirecional de votação (`mvp_...`, `bola_murcha_...`).
 *
 * @param {string} gameId ID do jogo.
 * @param {Game} after Documento do jogo após transição.
 * @param {GameConfirmation[]} validConfirmations Confirmações elegíveis.
 * @return {Promise<XpIdempotencyState>} Conjunto de UIDs já processados e flags.
 */
export async function fetchXpIdempotencyState(
  gameId: string,
  after: Game,
  validConfirmations: GameConfirmation[]
): Promise<XpIdempotencyState> {
  const xpLogReads = validConfirmations.map((c) =>
    db()
      .collection("xp_logs")
      .doc(`game_${gameId}_user_${c.userId}`)
      .get()
  );
  const xpLogSnaps = await Promise.all(xpLogReads);
  const alreadyProcessedUserIds = new Set<string>();
  xpLogSnaps.forEach((snap, idx) => {
    if (snap.exists) {
      const uid = validConfirmations[idx]?.userId;
      if (uid) alreadyProcessedUserIds.add(uid);
    }
  });
  if (alreadyProcessedUserIds.size > 0) {
    logger.info(
      "[XP_IDEMPOTENCY] Skipping " +
      `${alreadyProcessedUserIds.size} ` +
      "already-processed user(s) for " +
      `game ${gameId}`
    );
  }

  const mvpVotingUid =
    typeof after.mvp_id === "string" &&
    after.mvp_id.length > 0 ?
      after.mvp_id : null;
  const worstVotingUid =
    typeof after.worst_player_id === "string" &&
    after.worst_player_id.length > 0 ?
      after.worst_player_id : null;
  const [mvpVotingLogSnap, worstVotingLogSnap] = await Promise.all([
    mvpVotingUid ?
      db()
        .collection("xp_logs")
        .doc(`mvp_${gameId}_${mvpVotingUid}`)
        .get() :
      Promise.resolve(
        {exists: false} as FirebaseFirestore.DocumentSnapshot
      ),
    worstVotingUid ?
      db()
        .collection("xp_logs")
        .doc(`bola_murcha_${gameId}_${worstVotingUid}`)
        .get() :
      Promise.resolve(
        {exists: false} as FirebaseFirestore.DocumentSnapshot
      ),
  ]);
  const mvpVotingAlreadyPaid =
    mvpVotingUid !== null && mvpVotingLogSnap.exists;
  const worstVotingAlreadyPaid =
    worstVotingUid !== null && worstVotingLogSnap.exists;
  if (mvpVotingAlreadyPaid || worstVotingAlreadyPaid) {
    logger.info(
      "[XP_IDEMPOTENCY] Voting XP already " +
      "paid for game " +
      `${gameId} ` +
      `(mvp=${mvpVotingAlreadyPaid}, ` +
      `worst=${worstVotingAlreadyPaid}) ` +
      "- skipping in main pipeline " +
      "(issue #3940 bidirectional dedup)"
    );
  }

  return {
    alreadyProcessedUserIds,
    mvpVotingAlreadyPaid,
    worstVotingAlreadyPaid,
  };
}

/**
 * Calcula XP base e executa a transação atômica de XP, estatísticas,
 * streak, rankings, season_participation e badges para um jogador.
 *
 * @param {object} params Contexto de processamento do jogador.
 * @return {Promise<PlayerXpTransactionResult>} Resultado da transação.
 */
export async function processSinglePlayerXp(params: {
  gameId: string;
  conf: GameConfirmation;
  validConfirmations: GameConfirmation[];
  teams: Team[];
  teamResults: Record<string, string>;
  liveScore: LiveGameScore | null;
  after: Game;
  gameData: Game;
  settings: GamificationSettings;
  eventStats: DerivedEventStats;
  waitlistEntriesByUser: ReturnType<typeof buildWaitlistMap>;
  manualRewardApproval: boolean;
  mvpVotingAlreadyPaid: boolean;
  worstVotingAlreadyPaid: boolean;
  activeSeason: string | null;
  gameDate: Date;
  gameDateKey: string;
  monthKey: string;
  weekKey: string;
  now: FirebaseFirestore.FieldValue;
}): Promise<PlayerXpTransactionResult> {
  const {
    gameId,
    conf,
    validConfirmations,
    teams,
    teamResults,
    liveScore,
    after,
    gameData,
    settings,
    eventStats,
    waitlistEntriesByUser,
    manualRewardApproval,
    mvpVotingAlreadyPaid,
    worstVotingAlreadyPaid,
    activeSeason,
    gameDate,
    gameDateKey,
    monthKey,
    weekKey,
    now,
  } = params;

  const uid = conf.userId;
  const team = teams.find(
    (t) => t.playerIds.includes(uid)
  );
  const result = team ?
    (teamResults[team.id] || "DRAW") :
    "DRAW";

  const cappedGoals = Math.max(
    0,
    Math.min(conf.goals, MAX_GOALS_PER_GAME)
  );
  const cappedAssists = Math.max(
    0,
    Math.min(conf.assists, MAX_ASSISTS_PER_GAME)
  );
  const cappedSaves = Math.max(
    0,
    Math.min(conf.saves, MAX_SAVES_PER_GAME)
  );

  conf.goals = cappedGoals;
  conf.assists = cappedAssists;
  conf.saves = cappedSaves;

  const isMvpAndConfirmed =
    after.mvp_id === uid &&
    validConfirmations.some((c) => c.userId === uid);

  if (
    after.mvp_id === uid &&
    !isMvpAndConfirmed
  ) {
    logger.error(
      `[FRAUD] User ${uid} set as ` +
      "MVP without confirmation " +
      `in game ${gameId}`
    );
  }

  const isMvp = isMvpAndConfirmed;

  const isWorstAndConfirmed =
    after.worst_player_id === uid &&
    validConfirmations.some((c) => c.userId === uid);

  if (
    conf.is_worst_player === true &&
    !isWorstAndConfirmed
  ) {
    logger.error(
      `[FRAUD] User ${uid} flagged ` +
      "is_worst_player without being " +
      "voted worst_player_id in game " +
      `${gameId}`
    );
  }

  const isWorstPlayer = isWorstAndConfirmed;

  // D2 + FIX #726: Separamos o cálculo de performance (presença, gols, assistências,
  // defesas, resultado, clean sheet) do bônus de MVP (+50) e da penalidade (-10).
  // O teto de 500 XP (MAX_XP_PER_GAME) limita a performance; o bônus de MVP entra
  // por fora permitindo atingir até 550 XP (espelhando a votação MVP pós-jogo).
  // D4 + FIX #1575: Penalidades respeitam piso em MIN_XP_PER_GAME (-100).
  let performanceXpWithoutStreak = settings.xp_presence;
  performanceXpWithoutStreak += cappedGoals * settings.xp_per_goal;
  performanceXpWithoutStreak += cappedAssists * settings.xp_per_assist;
  performanceXpWithoutStreak += cappedSaves * settings.xp_per_save;

  if (result === "WIN") {
    performanceXpWithoutStreak += settings.xp_win;
  } else if (result === "DRAW") {
    performanceXpWithoutStreak += settings.xp_draw;
  }

  const mvpXp = (isMvp && !mvpVotingAlreadyPaid) ? settings.xp_mvp : 0;

  let cleanSheetXp = 0;
  if (conf.position === "GOALKEEPER") {
    const opponentScoreForXp =
      getOpponentScore(
        team, liveScore, teams
      );
    if (opponentScoreForXp === 0) {
      cleanSheetXp = settings.xp_clean_sheet;
      logger.info(
        "[CLEAN_SHEET] " +
        `Goalkeeper ${uid} ` +
        `gets +${cleanSheetXp} ` +
        "XP bonus"
      );
    }
  }
  performanceXpWithoutStreak += cleanSheetXp;

  let penaltyXp = 0;
  if (isWorstPlayer && !worstVotingAlreadyPaid) {
    penaltyXp = XP_WORST_PLAYER_PENALTY;
    logger.info(
      `[PENALTY] User ${uid} is ` +
      "\"Bola Murcha\" in game " +
      `${gameId}. Applying ` +
      `${penaltyXp} XP penalty.`
    );
  }

  const baseXpWithoutStreak = performanceXpWithoutStreak;

  return db().runTransaction(async (tx) => {
    const userRef = db()
      .collection("users")
      .doc(uid);
    const statsRef = db()
      .collection("statistics")
      .doc(uid);
    const confirmationRef = db()
      .collection("confirmations")
      .doc(`${gameId}_${uid}`);
    const logRef = db()
      .collection("xp_logs")
      .doc(`game_${gameId}_user_${uid}`);
    const streakQuery = db()
      .collection("user_streaks")
      .where("user_id", "==", uid)
      .limit(1);

    const [
      logSnap,
      userSnap,
      statsSnap,
      streakSnap,
    ] = await Promise.all([
      tx.get(logRef),
      tx.get(userRef),
      tx.get(statsRef),
      tx.get(streakQuery),
    ]);

    if (logSnap.exists) {
      return {
        alreadyProcessed: true,
        xp: 0,
        streak: 0,
        previousStreak: 0,
        comebackXp: 0,
      };
    }

    if (!userSnap.exists) {
      throw new Error(
        `Usuário ${uid} não encontrado`
      );
    }

    const userEntry = userSnap.data() || {};
    const previousLastPlayedDateKey =
      typeof userEntry.last_played_game_date === "string" ?
        userEntry.last_played_game_date.trim() :
        null;
    const previousLastPlayedMonthKey =
      typeof userEntry.last_played_month_key === "string" ?
        userEntry.last_played_month_key.trim() :
        null;
    const shouldAdvanceGameDateMarker =
      previousLastPlayedDateKey == null ||
      previousLastPlayedDateKey <= gameDateKey;
    const shouldAdvanceMonthMarker =
      previousLastPlayedMonthKey == null ||
      previousLastPlayedMonthKey <= monthKey;
    const streakDoc = streakSnap.docs[0];
    const streakRef = streakDoc?.ref ||
      db().collection("user_streaks").doc(uid);
    const streakTemporalMarkersAhead =
      hasNewerParticipationStreakMarker(
        streakDoc?.data(),
        gameDateKey
      );
    const streakState =
      calculateNextParticipationStreak(
        streakDoc?.data(),
        gameDateKey
      );
    const streakXp =
      streakTemporalMarkersAhead ?
        0 :
        calculateStreakXp(
          streakState.currentStreak,
          settings
        );
    const bonusBreakdown =
      calculatePerGameBonusBreakdown(
        {
          confirmation: conf,
          gameStartedAt: gameDate,
          gameDateKey,
          monthKey,
          userDoc: userEntry,
          eventStats,
          waitlistEntriesByUser,
        },
        settings,
        !manualRewardApproval
      );
    const extraBonusXp =
      bonusBreakdown.topScorer +
      bonusBreakdown.hatTrick +
      bonusBreakdown.firstGoal +
      bonusBreakdown.goalkeeperGoal +
      bonusBreakdown.fairPlay +
      bonusBreakdown.eventRecorder +
      bonusBreakdown.earlyConfirmation +
      bonusBreakdown.onTimeCheckin +
      bonusBreakdown.lastMinuteSaver +
      bonusBreakdown.waitlistPromoted +
      bonusBreakdown.comeback +
      bonusBreakdown.firstGameOfMonth +
      bonusBreakdown.monthlyStreak;
    const baseXp =
      baseXpWithoutStreak + streakXp + extraBonusXp;
    const currentXp =
      (userEntry.experience_points as number) || 0;
    const achievedMilestones = Array.isArray(
      userEntry.milestones_achieved
    ) ?
      userEntry.milestones_achieved as string[] :
      [];

    const stats = {
      totalGames: 0,
      totalGoals: 0,
      totalAssists: 0,
      totalSaves: 0,
      totalYellowCards: 0,
      totalRedCards: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDraw: 0,
      bestPlayerCount: 0,
      worstPlayerCount: 0,
      currentMvpStreak: 0,
      bestMvpStreak: 0,
      ...(statsSnap.data() || {}),
    } as UserStatistics;

    const newStats: UserStatistics = {
      ...stats,
      totalGames:
        (stats.totalGames || 0) + 1,
      totalGoals:
        (stats.totalGoals || 0) + cappedGoals,
      totalAssists:
        (stats.totalAssists || 0) + cappedAssists,
      totalSaves:
        (stats.totalSaves || 0) + cappedSaves,
      totalYellowCards:
        (stats.totalYellowCards || 0) + conf.yellowCards,
      totalRedCards:
        (stats.totalRedCards || 0) + conf.redCards,
      gamesWon:
        (stats.gamesWon || 0) +
        (result === "WIN" ? 1 : 0),
      gamesLost:
        (stats.gamesLost || 0) +
        (result === "LOSS" ? 1 : 0),
      gamesDraw:
        (stats.gamesDraw || 0) +
        (result === "DRAW" ? 1 : 0),
      recordedEventsGames:
        (stats.recordedEventsGames || 0) +
        (bonusBreakdown.eventRecorder > 0 ? 1 : 0),
      bestPlayerCount: stats.bestPlayerCount || 0,
      worstPlayerCount: stats.worstPlayerCount || 0,
      currentMvpStreak: stats.currentMvpStreak || 0,
      bestMvpStreak: stats.bestMvpStreak || 0,
    };

    const {
      newMilestones,
      xp: rawMilestoneXp,
    } = checkMilestones(
      newStats,
      achievedMilestones
    );
    const cappedMilestones =
      fitMilestonesWithinGameXpCap(
        baseXp,
        newMilestones
      );
    const milesXp = cappedMilestones.appliedXp;

    // D2 + FIX #726: Teto de performance (500). MVP (+50) entra por fora (até 550 total).
    // D4 + FIX #1575: Piso em MIN_XP_PER_GAME (-100).
    const cappedPerformanceXp = Math.max(
      0,
      Math.min(
        baseXp + milesXp,
        MAX_XP_PER_GAME
      )
    );
    const playerXp = Math.max(
      MIN_XP_PER_GAME,
      Math.min(
        cappedPerformanceXp + mvpXp + penaltyXp,
        MAX_XP_PER_GAME + mvpXp
      )
    );

    // FIX #1575 + #2111: clamp do incremento atômico para respeitar MIN_XP_PER_GAME
    // sem absorver silenciosamente penalidades quando user tem XP baixo
    const clampedPlayerXp = (currentXp + playerXp < MIN_XP_PER_GAME) ?
      MIN_XP_PER_GAME - currentXp :
      playerXp;
    const finalXp = currentXp + clampedPlayerXp;
    const currentLevel = getLevelForXp(currentXp);
    const newLevel = getLevelForXp(finalXp);

    const userUpdate: Record<string, unknown> = {
      experience_points: FieldValue.increment(clampedPlayerXp),
      level: newLevel,
      updated_at: now,
    };
    if (shouldAdvanceGameDateMarker) {
      userUpdate.last_played_game_date = gameDateKey;
    }
    if (shouldAdvanceMonthMarker) {
      userUpdate.last_played_month_key = monthKey;
      userUpdate.monthly_streak =
        bonusBreakdown.monthlyStreakAfter;
    }
    if (
      shouldAdvanceMonthMarker &&
      bonusBreakdown.comeback > 0
    ) {
      userUpdate.last_comeback_month_key = monthKey;
    }
    if (
      cappedMilestones.appliedMilestones.length > 0
    ) {
      userUpdate.milestones_achieved =
        FieldValue.arrayUnion(
          ...cappedMilestones.appliedMilestones
        );
    }
    tx.update(userRef, userUpdate);
    for (const milestoneName of
      cappedMilestones.appliedMilestones) {
      const badgeRef = db()
        .collection("user_badges")
        .doc(`${uid}_${milestoneName}`);
      tx.set(
        badgeRef,
        buildUserBadgeAggregateDoc(
          uid,
          buildMilestoneBadgeDoc(
            milestoneName,
            now
          )
        ),
        {merge: true}
      );
    }

    tx.set(
      statsRef,
      {
        totalGames: FieldValue.increment(1),
        totalGoals: FieldValue.increment(cappedGoals),
        totalAssists: FieldValue.increment(cappedAssists),
        totalSaves: FieldValue.increment(cappedSaves),
        totalYellowCards: FieldValue.increment(conf.yellowCards),
        totalRedCards: FieldValue.increment(conf.redCards),
        gamesWon: FieldValue.increment(
          result === "WIN" ? 1 : 0
        ),
        gamesLost: FieldValue.increment(
          result === "LOSS" ? 1 : 0
        ),
        gamesDraw: FieldValue.increment(
          result === "DRAW" ? 1 : 0
        ),
        recordedEventsGames: FieldValue.increment(
          bonusBreakdown.eventRecorder > 0 ? 1 : 0
        ),
        updated_at: now,
      },
      {merge: true}
    );

    if (!streakTemporalMarkersAhead) {
      tx.set(
        streakRef,
        {
          user_id: uid,
          current_streak: streakState.currentStreak,
          longest_streak: streakState.longestStreak,
          last_game_date: gameDateKey,
          streak_started_at: streakState.streakStartedAt,
          updated_at: now,
        },
        {merge: true}
      );
    }

    tx.update(
      confirmationRef,
      {xp_earned: playerXp}
    );

    const reconciledLogBreakdown =
      reconcileXpLogBreakdown(
        {
          xp_participation: settings.xp_presence,
          xp_goals: cappedGoals * settings.xp_per_goal,
          xp_assists: cappedAssists * settings.xp_per_assist,
          xp_saves: cappedSaves * settings.xp_per_save,
          xp_result: result === "WIN" ?
            settings.xp_win :
            (result === "DRAW" ?
              settings.xp_draw : 0),
          xp_mvp: (isMvp && !mvpVotingAlreadyPaid) ?
            settings.xp_mvp : 0,
          xp_clean_sheet: cleanSheetXp,
          xp_milestones: milesXp,
          xp_streak: streakXp,
          xp_penalty: penaltyXp,
          xp_top_scorer: bonusBreakdown.topScorer,
          xp_hat_trick: bonusBreakdown.hatTrick,
          xp_first_goal: bonusBreakdown.firstGoal,
          xp_goalkeeper_goal: bonusBreakdown.goalkeeperGoal,
          xp_fair_play: bonusBreakdown.fairPlay,
          xp_recorder: bonusBreakdown.eventRecorder,
          xp_early_confirmation:
            bonusBreakdown.earlyConfirmation,
          xp_on_time_checkin: bonusBreakdown.onTimeCheckin,
          xp_last_minute_saver:
            bonusBreakdown.lastMinuteSaver,
          xp_waitlist_promoted:
            bonusBreakdown.waitlistPromoted,
          xp_comeback: bonusBreakdown.comeback,
          xp_first_game_month:
            bonusBreakdown.firstGameOfMonth,
          xp_monthly_streak: bonusBreakdown.monthlyStreak,
        },
        playerXp,
      );

    const log: XpLog = {
      user_id: uid,
      game_id: gameId,
      transaction_id: `game_${gameId}_user_${uid}`,
      source: "game_finished",
      source_collection: "games",
      source_event_id: gameId,
      source_confirmation_id: `${gameId}_${uid}`,
      xp_earned: playerXp,
      xp_before: currentXp,
      xp_after: finalXp,
      level_before: currentLevel,
      level_after: newLevel,
      ...reconciledLogBreakdown,
      goals: cappedGoals,
      assists: cappedAssists,
      saves: cappedSaves,
      was_mvp: isMvp,
      was_clean_sheet: cleanSheetXp > 0,
      was_worst_player: isWorstPlayer,
      was_top_scorer: bonusBreakdown.topScorer > 0,
      was_hat_trick: bonusBreakdown.hatTrick > 0,
      was_first_goal: bonusBreakdown.firstGoal > 0,
      was_goalkeeper_goal:
        bonusBreakdown.goalkeeperGoal > 0,
      was_fair_play: bonusBreakdown.fairPlay > 0,
      recorded_events_count:
        bonusBreakdown.recordedEventsCount,
      comeback_type: bonusBreakdown.comebackType,
      monthly_streak: bonusBreakdown.monthlyStreakAfter,
      monthly_streak_tier:
        bonusBreakdown.monthlyStreakTier,
      game_result: result,
      my_team_score: team ?
        (liveScore ?
          (team.id === liveScore.team1Id ?
            liveScore.team1Score :
            team.id === liveScore.team2Id ?
              liveScore.team2Score :
              team.score) :
          team.score) :
        0,
      opponent_score: getOpponentScore(
        team, liveScore, teams
      ),
      game_status: "FINISHED",
      milestones_unlocked:
        cappedMilestones.appliedMilestones,
      created_at: now,
    };
    tx.set(logRef, log);

    if (
      cappedMilestones.overflowMilestones.length > 0 &&
      rawMilestoneXp > milesXp
    ) {
      logger.warn(
        "[XP_CAP] Milestone XP capped for user " +
        `${uid} in game ${gameId}. ` +
        `Applied ${milesXp} of ${rawMilestoneXp}. ` +
        "Overflow milestones: " +
        cappedMilestones.overflowMilestones.join(", ")
      );
    }

    updateRankingDeltas(
      tx,
      uid,
      conf,
      result,
      playerXp,
      isMvp,
      weekKey,
      monthKey
    );

    if (activeSeason) {
      updateSeasonParticipation(
        tx,
        uid,
        activeSeason,
        result,
        conf,
        isMvp,
        gameData.group_id,
        gameData.gender
      );
    }

    const opScore = getOpponentScore(
      team, liveScore, teams
    );
    const badgesToAward =
      getAllBadgesToAward({
        confirmation: {
          goals: conf.goals,
          assists: conf.assists,
          saves: conf.saves,
          position: conf.position,
          isMvp,
          isWorstPlayer,
        },
        newStats: {
          totalGames: newStats.totalGames,
          gamesWon: newStats.gamesWon,
          recordedEventsGames:
            newStats.recordedEventsGames || 0,
          currentMvpStreak: newStats.currentMvpStreak,
        },
        streak: streakState.currentStreak,
        newMvpStreak: 0,
        newLevel,
        currentLevel,
        result: result as "WIN" | "DRAW" | "LOSS",
        opponentScore:
          opScore >= 0 ? opScore : undefined,
      });

    for (const badge of badgesToAward) {
      const docId = `${uid}_${badge}`;
      const badgeRef = db()
        .collection("user_badges")
        .doc(docId);
      tx.set(badgeRef, {
        user_id: uid,
        badge_id: badge,
        last_earned_at: FieldValue.serverTimestamp(),
        count: FieldValue.increment(1),
      }, {merge: true});
    }

    return {
      alreadyProcessed: false,
      xp: playerXp,
      streak: streakState.currentStreak,
      previousStreak: streakState.previousStreak,
      comebackXp: bonusBreakdown.comeback,
    };
  });
}
