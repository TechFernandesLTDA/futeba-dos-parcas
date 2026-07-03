import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {logger, setGlobalOptions} from "firebase-functions/v2";
import {
  onDocumentUpdated,
  onDocumentDeleted,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {
  FIRESTORE_BATCH_SAFE_LIMIT,
  FUNCTION_REGION,
  MAX_XP_PER_GAME,
  MIN_XP_PER_GAME,
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
  clampStat,
} from "./constants";
import {
  getAllBadgesToAward,
} from "./badges/badge-helper";
import {isGameShape} from "./validation/guards";
import {
  buildGameValidationFromFirestore,
} from "./game-validation/aggregate";
import {
  isScoreConsistentFromEventStream,
} from "./games/live-events";

// Padroniza região default de TODAS as functions v2 que não especificam
// region explicitamente. Antes, 15 functions ficavam em us-central1
// (default do Firebase) enquanto Firestore está em southamerica-east1,
// gerando latência extra e split confuso entre módulos.
// FIX #2152: maxInstances global de 10 evita "bill shock" — sem teto, um
// pico/loop de gatilhos pode escalar para centenas de instâncias e estourar
// a fatura. 10 cobre o tráfego atual com folga.
setGlobalOptions({
  region: FUNCTION_REGION,
  maxInstances: 10,
  // FIX #2611: defaults removidos do firebase.json (runtimeOptions nao e chave
  // valida no schema do firebase.json para CF v2). Funcoes sem opcoes explicitas
  // (startNewSeason, archiveSeason, seedOfficialGroups) rodavam com 256MiB/60s.
  memory: "512MiB",
  timeoutSeconds: 120,
});

// ==========================================
// IMPORTS DOS MÓDULOS EXTRAÍDOS
// ==========================================

// Modelos e interfaces
import type {
  Game,
  GamificationSettings,
  UserStatistics,
  XpLog,
} from "./models";

// XP Pipeline (níveis, milestones, settings)
import {
  DEFAULT_SETTINGS,
  XP_WORST_PLAYER_PENALTY,
  getLevelForXp,
  checkMilestones,
} from "./xp/pipeline";

// Game helpers (conversores, resultados, fetch)
import {
  toGameConfirmation,
  toTeam,
  toLiveScore,
  getGameDate,
  getWeekKey,
  determineGameResults,
  getOpponentScore,
  fetchAllStreaks,
  updateRankingDeltas,
  updateSeasonParticipation,
} from "./game/helpers";
import {db} from "./_db";

// ==========================================
// RE-EXPORTS (manter API pública intacta)
// ==========================================

// Re-exportar modelos
export {
  type Game,
  type GameConfirmation,
  type GamificationSettings,
  type XpLog,
  type Team,
  type LiveGameScore,
  type UserStatistics,
} from "./models";

// Re-exportar XP pipeline
export {
  DEFAULT_SETTINGS,
  XP_WORST_PLAYER_PENALTY,
  LEVELS,
  getLevelForXp,
  MILESTONES,
  checkMilestones,
  type MilestoneDef,
} from "./xp/pipeline";

// Re-exportar game helpers
export {
  toGameConfirmation,
  toTeam,
  toLiveScore,
  getGameDate,
  getWeekKey,
  determineGameResults,
  getOpponentScore,
  fetchAllUsers,
  fetchAllStats,
  fetchAllStreaks,
  updateRankingDeltas,
  updateSeasonParticipation,
} from "./game/helpers";

// PERF_001: Lazy imports para otimizar cold start
let leagueCalcImported = false;

interface LeagueCalculationsModule {
  calculateLeagueRating: (recentGames: Array<{
    xp_earned?: number;
    won?: boolean;
    goal_diff?: number;
    was_mvp?: boolean;
  }>) => number;
  calculateLeaguePromotion: (
    currentState: {
      division: string;
      promotionProgress: number;
      relegationProgress: number;
      protectionGames: number;
    },
    newRating: number
  ) => {
    division: string;
    promotionProgress: number;
    relegationProgress: number;
    protectionGames: number;
  };
  PROMOTION_GAMES_REQUIRED: number;
  RELEGATION_GAMES_REQUIRED: number;
}

let leagueCalcs: LeagueCalculationsModule | null = null;

/**
 * Lazy load do módulo de cálculos de liga.
 * @return {Promise<LeagueCalculationsModule>} Módulo de liga.
 */
async function getLeagueCalculations(): Promise<LeagueCalculationsModule> {
  if (!leagueCalcImported) {
    leagueCalcs = await import("./league.js");
    leagueCalcImported = true;
  }
  return leagueCalcs!;
}

let notificationImported = false;

interface NotificationModule {
  sendStreakNotificationIfMilestone: (
    userId: string,
    currentStreak: number,
    previousStreak?: number
  ) => Promise<boolean>;
}

let notificationModule: NotificationModule | null = null;

/**
 * Lazy load do módulo de notificações.
 * @return {Promise<NotificationModule>} Módulo de notificações.
 */
async function getNotifications(): Promise<NotificationModule> {
  if (!notificationImported) {
    notificationModule = await import("./notifications.js");
    notificationImported = true;
  }
  return notificationModule!;
}

admin.initializeApp();

// Limites Anti-Cheat importados de ./constants

// ==========================================
// CLOUD FUNCTION: onGameStatusUpdate
// ==========================================
//
// PERF_001 - APP CHECK STRATEGY:
// ==========================================
// onDocumentUpdated triggers NÃO suportam
// enforceAppCheck diretamente.
// A segurança é garantida por:
//
// 1. Firestore Security Rules - Validam que
//    apenas owner/admin podem atualizar status
// 2. App Check no Cliente (FutebaApplication.kt)
//    - Valida app legítimo
// 3. Server-side validation abaixo -
//    Valida owner_id, previne fraud
//
// Para callable functions (onCall),
// App Check é enforçado diretamente.
// Ver: auth/custom-claims.ts para exemplo
// ==========================================

// SECFIX #495: memory + timeout explicit pra workload pesado (XP +
// league rating + notificações pra todos os confirmados, até ~100 users)
export const onGameStatusUpdate = onDocumentUpdated(
  {
    document: "games/{gameId}",
    // FIX #2199: region já vem de setGlobalOptions (redundante aqui).
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async (event) => {
    if (!event.data) return;

    const gameId = event.params.gameId;

    // FIX #2284: valida o shape cru do Firestore antes do cast. Trigger:
    // loga e faz early-return em vez de seguir com dados malformados.
    const beforeRaw = event.data.before.data();
    const afterRaw = event.data.after.data();
    if (!isGameShape(beforeRaw) || !isGameShape(afterRaw)) {
      logger.error(
        `[GUARD] onGameStatusUpdate: Game ${gameId} malformado`,
        {hasBefore: !!beforeRaw, hasAfter: !!afterRaw}
      );
      return;
    }
    const before: Game = beforeRaw;
    const after: Game = afterRaw;

    // ==========================================
    // SECURITY VALIDATION (PERF_001 Enhanced)
    // ==========================================

    // 1. Validate owner_id exists
    if (!after.owner_id) {
      logger.error(
        `[SECURITY] Game ${gameId}: ` +
        "Missing owner_id. Blocking processing."
      );
      return;
    }

    // 2. Validate owner_id was NOT changed
    // (prevent unauthorized ownership transfer)
    if (
      before.owner_id &&
      before.owner_id !== after.owner_id
    ) {
      logger.warn(
        `[SECURITY] Game ${gameId}: owner changed ` +
        `from ${before.owner_id} ` +
        `to ${after.owner_id} ` +
        "- aborting XP processing to prevent fraud"
      );
      return;
    }

    // 3. Validate owner exists in users collection
    const ownerDoc = await db()
      .collection("users")
      .doc(after.owner_id)
      .get();
    if (!ownerDoc.exists) {
      logger.error(
        `[SECURITY] Game ${gameId}: ` +
        `owner_id ${after.owner_id} ` +
        "not found in users. Blocking processing."
      );
      return;
    }

    // 4. Log status change for audit trail
    if (before.status !== after.status) {
      logger.info(
        `[AUDIT] Game ${gameId}: ` +
        `Status changed ${before.status} ` +
        `-> ${after.status} ` +
        `by owner ${after.owner_id}`
      );
    }

    const releasedForProcessing =
      before.status === "FINISHED" &&
      after.status === "FINISHED" &&
      before.xp_reward_status ===
        "HELD_FOR_REVIEW" &&
      after.xp_reward_status === "ELIGIBLE" &&
      after.xp_reward_review_decision ===
        "APPROVED";

    // Check Trigger Conditions:
    // Status changed to FINISHED or admin released
    // a held game back into processing.
    if (
      (
        before.status !== "FINISHED" &&
        after.status === "FINISHED"
      ) ||
      releasedForProcessing
    ) {
      const gameRef = event.data.after.ref;
      const lockResult = await db().runTransaction(
        async (tx) => {
          const freshSnap = await tx.get(gameRef);
          const fresh = freshSnap.data() as
            Game | undefined;
          if (!fresh) {
            return {
              shouldProcess: false,
              reason: "missing" as const,
            };
          }
          if (fresh.xp_processed) {
            return {
              shouldProcess: false,
              reason: "processed" as const,
            };
          }
          if (fresh.xp_processing) {
            // FIX #728: Lock TTL fallback. If the Cloud Function
            // crashed/timed-out after acquiring the lock, xp_processing
            // would stay true forever, permanently blocking XP for this
            // game. Check xp_processing_at timestamp: if older than
            // 4 minutes, treat as stale and take over the lock.
            // FIX #1040: reduzido de 10min para 4min — timeout da função
            // é 180s (3min); 4min dá margem sem bloquear partidas em crash.
            const LOCK_TTL_MS = 4 * 60 * 1000;
            const lockAge =
              Date.now() - (
                fresh.xp_processing_at?.toMillis ?
                  fresh.xp_processing_at.toMillis() :
                  0
              );
            if (lockAge < LOCK_TTL_MS) {
              return {
                shouldProcess: false,
                reason: "processing" as const,
              };
            }
            logger.warn(
              "[LOCK_TTL] Stale xp_processing lock " +
              `detected for game ${event.params.gameId} ` +
              `(age: ${Math.round(lockAge / 1000)}s). ` +
              "Taking over."
            );
          }
          tx.update(gameRef, {
            xp_processing: true,
            xp_processing_at: FieldValue.serverTimestamp(),
          });
          return {
            shouldProcess: true,
            reason: "locked" as const,
          };
        }
      );

      if (!lockResult.shouldProcess) {
        logger.info(
          `Game ${gameId} skipped ` +
          `(${lockResult.reason}).`
        );
        return;
      }

      logger.info(
        `Processing Game ${gameId} for XP...`
      );

      try {
        // 1. Fetch Dependencies
        const [
          confirmationsSnap,
          teamsSnap,
          liveScoreDoc,
          settingsSnap,
          seasonSnap,
          gameSnap,
          gameEventsSnap,
        ] = await Promise.all([
          db().collection("confirmations")
            .where("game_id", "==", gameId)
            .where("status", "==", "CONFIRMED")
            .get(),
          db().collection("teams")
            .where("game_id", "==", gameId)
            .get(),
          db().collection("live_scores")
            .doc(gameId)
            .get(),
          db().collection("app_settings")
            .doc("gamification")
            .get(),
          db().collection("seasons")
            .where("is_active", "==", true)
            .limit(1)
            .get(),
          db().collection("games")
            .doc(gameId)
            .get(),
          db().collection("game_events")
            .where("game_id", "==", gameId)
            .limit(500)
            .get(),
        ]);

        const confirmations = confirmationsSnap.docs
          .map((d) => toGameConfirmation(d.data()));

        // ======================================
        // VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
        // ======================================
        // Verificar integridade do documento do
        // jogo antes de processar XP.
        // Previne processamento com dados
        // incompletos ou corrompidos.
        const gameData = gameSnap.data() as
          Game | undefined;
        if (!gameData) {
          logger.error(
            `[VALIDATION] Game ${gameId}: ` +
            "Documento do jogo não encontrado. " +
            "Abortando XP."
          );
          await event.data.after.ref.update({
            xp_processed: true,
            xp_processing: false,
            xp_processing_error:
              "Game document not found " +
              "during XP processing",
          });
          return;
        }

        // Validar campos obrigatórios do jogo
        if (
          !gameData.owner_id ||
          typeof gameData.owner_id !== "string"
        ) {
          logger.error(
            `[VALIDATION] Game ${gameId}: ` +
            "owner_id ausente ou inválido."
          );
          await event.data.after.ref.update({
            xp_processed: true,
            xp_processing: false,
            xp_processing_error:
              "Missing or invalid owner_id",
          });
          return;
        }

        if (gameData.status !== "FINISHED") {
          logger.error(
            `[VALIDATION] Game ${gameId}: ` +
            "Status inesperado " +
            `'${gameData.status}' ` +
            "(esperado FINISHED)."
          );
          await event.data.after.ref.update({
            xp_processing: false,
            xp_processing_error:
              "Unexpected status: " +
              `${gameData.status}`,
          });
          return;
        }

        const manualRewardApproval =
          gameData.xp_reward_review_decision ===
          "APPROVED";
        const liveScoreData =
          liveScoreDoc.exists ?
            liveScoreDoc.data() :
            undefined;
        const scoreEventConsistent =
          liveScoreData &&
          typeof liveScoreData.team1_id === "string" &&
          typeof liveScoreData.team2_id === "string" ?
            isScoreConsistentFromEventStream(
              gameEventsSnap.docs,
              liveScoreData.team1_id,
              liveScoreData.team2_id,
              typeof liveScoreData.team1_score ===
                "number" ?
                liveScoreData.team1_score :
                gameData.team1_score ?? 0,
              typeof liveScoreData.team2_score ===
                "number" ?
                liveScoreData.team2_score :
                gameData.team2_score ?? 0,
            ) :
            undefined;

        try {
          const validationResult =
            buildGameValidationFromFirestore({
              confirmations: confirmationsSnap.docs
                .map((doc) => doc.data()),
              eventCount: gameEventsSnap.size,
              scoreEventConsistent,
              mode: "SOFT_GATE",
            });
          await event.data.after.ref.update({
            ...validationResult,
            xp_reward_status:
              validationResult.validation_status ===
                "REVIEW_REQUIRED" &&
              !manualRewardApproval ?
                "HELD_FOR_REVIEW" :
                "ELIGIBLE",
            validation_updated_at:
              FieldValue.serverTimestamp(),
          });
          logger.info(
            "[GAME_VALIDATION_GATE] " +
            `Game ${gameId}: score ` +
            `${validationResult.validation_score}, ` +
            `status ${validationResult.validation_status}`,
            {
              reasons:
                validationResult.validation_reasons,
              version:
                validationResult.validation_version,
            },
          );

          if (
            validationResult.validation_status ===
              "REVIEW_REQUIRED" &&
            !manualRewardApproval
          ) {
            await event.data.after.ref.update({
              xp_processing: false,
              xp_reward_status: "HELD_FOR_REVIEW",
              xp_reward_held_at:
                FieldValue.serverTimestamp(),
              xp_reward_hold_reasons:
                validationResult.validation_reasons,
              xp_processing_error:
                "XP held by validation gate",
            });
            logger.warn(
              "[GAME_VALIDATION_GATE] XP held for " +
              `game ${gameId}`,
              {
                score:
                  validationResult.validation_score,
                reasons:
                  validationResult.validation_reasons,
              },
            );
            return;
          }

          if (
            validationResult.validation_status ===
              "REVIEW_REQUIRED" &&
            manualRewardApproval
          ) {
            logger.warn(
              "[GAME_VALIDATION_GATE] Processing " +
              `manual override for game ${gameId}`,
              {
                score:
                  validationResult.validation_score,
                reasons:
                  validationResult.validation_reasons,
                reviewedBy:
                  gameData.xp_reward_reviewed_by,
              },
            );
          }
        } catch (validationError) {
          logger.warn(
            "[GAME_VALIDATION_GATE] Falha ao calcular " +
            `score do jogo ${gameId}`,
            {
              error: validationError instanceof Error ?
                validationError.message :
                String(validationError),
            },
          );
        }

        // Validar que confirmações possuem
        // userId válido
        const invalidConfirmations =
          confirmations.filter(
            (c) =>
              !c.userId ||
              typeof c.userId !== "string" ||
              c.userId.trim() === ""
          );
        if (invalidConfirmations.length > 0) {
          logger.error(
            `[VALIDATION] Game ${gameId}: ` +
            `${invalidConfirmations.length} ` +
            "confirmações com userId inválido. " +
            "Removendo da lista de processamento."
          );
        }
        // Filtrar apenas confirmações válidas
        const validConfirmations =
          confirmations.filter(
            (c) =>
              c.userId &&
              typeof c.userId === "string" &&
              c.userId.trim() !== ""
          );

        // SECFIX #430 / FIX #2797: excluir jogadores com overlap temporal.
        // O trigger onConfirmationCreated (temporal-overlap.ts) marca
        // suspicious_overlap=true quando o jogador tem outra confirmação no
        // mesmo horário. Esses jogadores NÃO recebem XP, estatísticas nem
        // participação na season. Não contam para MIN_PLAYERS (FIX #1572).
        const overlapExcluded = validConfirmations.filter(
          (c) => c.suspiciousOverlap === true
        );
        if (overlapExcluded.length > 0) {
          for (const c of overlapExcluded) {
            logger.warn(
              "[ANTI-CHEAT][OVERLAP] Jogador excluído do processamento " +
              `de XP por suspicious_overlap: userId=${c.userId}, ` +
              `gameId=${gameId}`
            );
          }
          // Remover os flagados da lista de processamento
          validConfirmations.splice(
            0,
            validConfirmations.length,
            ...validConfirmations.filter(
              (c) => c.suspiciousOverlap !== true
            )
          );
        }

        // VALIDAÇÕES ANTI-CHEAT (SERVER-SIDE) — clamp and warn, don't throw
        // FIX #2525: mutamos conf.goals/assists/saves aqui (piso 0 + teto MAX)
        // para que TODOS os sinks downstream (statistics, xp_logs, ranking_deltas,
        // season_participation, by_gender) usem o valor capeado, garantindo
        // paridade com o XP já calculado com Math.min(conf.goals, MAX_GOALS_PER_GAME).
        for (const conf of validConfirmations) {
          if (conf.goals < 0 || conf.goals > MAX_GOALS_PER_GAME) {
            logger.warn(
              "[ANTI-CHEAT] User " +
              `${conf.userId}: goals=${conf.goals} ` +
              `above cap ${MAX_GOALS_PER_GAME} ` +
              "— clamping to cap"
            );
          }
          // Aplica piso 0 + teto MAX antes de qualquer persistência
          conf.goals = clampStat(conf.goals, MAX_GOALS_PER_GAME);

          if (conf.assists < 0 || conf.assists > MAX_ASSISTS_PER_GAME) {
            logger.warn(
              "[ANTI-CHEAT] User " +
              `${conf.userId}: assists=${conf.assists} ` +
              `above cap ${MAX_ASSISTS_PER_GAME} ` +
              "— clamping to cap"
            );
          }
          conf.assists = clampStat(conf.assists, MAX_ASSISTS_PER_GAME);

          if (conf.saves < 0 || conf.saves > MAX_SAVES_PER_GAME) {
            logger.warn(
              "[ANTI-CHEAT] User " +
              `${conf.userId}: saves=${conf.saves} ` +
              `above cap ${MAX_SAVES_PER_GAME} ` +
              "— clamping to cap"
            );
          }
          conf.saves = clampStat(conf.saves, MAX_SAVES_PER_GAME);
        }

        const teams = teamsSnap.docs.map(
          (d) => toTeam(d.id, d.data())
        );
        const liveScore = liveScoreDoc.exists ?
          toLiveScore(liveScoreDoc.data()) :
          null;
        const activeSeason = !seasonSnap.empty ?
          seasonSnap.docs[0].id :
          null;
        const gameDoc = gameSnap.data() as
          Game | undefined;

        let settings = DEFAULT_SETTINGS;
        if (settingsSnap.exists) {
          settings = {
            ...DEFAULT_SETTINGS,
            ...settingsSnap.data(),
          } as GamificationSettings;
        }

        // Mínimo de 6 jogadores (3v3) para
        // processar XP - sincronizado com Android
        // FIX #1572: usar validConfirmations (já filtrado por userId válido)
        // em vez de confirmations bruto — invalidConfirmations com userId vazio
        // não seriam processados mas inflavam a contagem, permitindo processar
        // jogos com menos de 6 jogadores reais válidos.
        const MIN_PLAYERS = 6;
        if (validConfirmations.length < MIN_PLAYERS) {
          logger.info(
            "Not enough players " +
            `(${validConfirmations.length}` +
            `/${MIN_PLAYERS}). ` +
            "Marking processed."
          );
          await event.data.after.ref.update({
            xp_processed: true,
            xp_processing: false,
            xp_processed_at: FieldValue.serverTimestamp(),
          });
          return;
        }

        // 2. Determine Results
        const teamResults =
          determineGameResults(teams, liveScore);

        // 2.5 IDEMPOTENCY GUARD: Check per-player via
        // deterministic doc path (fixes #2548, follow-up to #2524).
        //
        // On retry after partial batch failure, some players may
        // have XP already committed from batches that succeeded
        // in a previous invocation. We check each player's xp_log
        // doc by its deterministic ID (game_{id}_user_{uid}) — a
        // direct doc read is strongly consistent and avoids any
        // query-level inconsistency.
        const xpLogReads = validConfirmations.map((c) =>
          db()
            .collection("xp_logs")
            .doc(`game_${gameId}_user_${c.userId}`)
            .get()
        );
        const xpLogSnaps = await Promise.all(xpLogReads);
        const alreadyProcessedUserIds =
          new Set<string>();
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

        // 3. Pre-fetch player streaks in parallel.
        // XP, level, stats and milestones are read again inside
        // the per-player transaction so concurrent games for the
        // same user serialize on fresh state (#2905).
        const userIds = validConfirmations
          .map((c) => c.userId);

        const streaksMap =
          await fetchAllStreaks(userIds);

        const now = FieldValue.serverTimestamp();

        // Date keys for Rankings (BRT timezone)
        const d = getGameDate(gameDoc);
        // yyyy-MM
        const monthKey =
          d.toLocaleDateString("en-CA", {
            timeZone: "America/Sao_Paulo",
          }).substring(0, 7);
        const weekKey = getWeekKey(d);

        // Coletar promises de notificações de
        // streak para await posterior
        const streakNotificationPromises:
          Promise<void>[] = [];

        for (const conf of validConfirmations) {
          const uid = conf.userId;

          // Skip if already processed (idempotency
          // guard for partial-batch retry, #644)
          if (alreadyProcessedUserIds.has(uid)) {
            continue;
          }

          const team = teams.find(
            (t) => t.playerIds.includes(uid)
          );
          const result = team ?
            (teamResults[team.id] || "DRAW") :
            "DRAW";

          // Clamp anti-cheat values para TODAS as escritas downstream
          // (stats, ranking, season, xp_log) — antes só o cálculo de XP
          // usava caps, permitindo stats/ranking ilimitados (#2525)
          const cappedGoals = Math.max(0,
            Math.min(conf.goals, MAX_GOALS_PER_GAME));
          const cappedAssists = Math.max(0,
            Math.min(conf.assists, MAX_ASSISTS_PER_GAME));
          const cappedSaves = Math.max(0,
            Math.min(conf.saves, MAX_SAVES_PER_GAME));

          // Propagar caps para funções downstream
          // (updateRankingDeltas, updateSeasonParticipation,
          // badge checks) sem alterar assinaturas
          conf.goals = cappedGoals;
          conf.assists = cappedAssists;
          conf.saves = cappedSaves;

          const streak =
            streaksMap.get(uid) || 0;

          // SECURITY FIX (CVE-2): Validate MVP
          // was actually confirmed by checking
          // confirmations list
          const isMvpAndConfirmed =
            after.mvp_id === uid &&
            confirmations.some(
              (c) =>
                c.userId === uid &&
                c.status === "CONFIRMED"
            );

          // Log fraud attempts
          // (MVP claimed without confirmation)
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

          // Check if player was voted as
          // "Bola Murcha" (worst player)
          // SECURITY FIX (auditoria 2026-05-30 #1): revalida contra
          // after.worst_player_id (campo do game doc, owner-gated nas
          // rules) — espelha a revalidacao de MVP (CVE-2). Antes lia
          // conf.is_worst_player DIRETO, permitindo que QUALQUER jogador
          // confirmado marcasse a confirmation de um TERCEIRO como Bola
          // Murcha (griefing: -10 XP + worstPlayerCount++) sem voto real.
          const isWorstAndConfirmed =
            after.worst_player_id === uid &&
            confirmations.some(
              (c) =>
                c.userId === uid &&
                c.status === "CONFIRMED"
            );

          // Log fraud attempts (worst flag set sem voto agregado)
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

          // Calc XP (COM TETOS ANTI-CHEAT)
          let xp = settings.xp_presence;
          xp += cappedGoals * settings.xp_per_goal;
          xp += cappedAssists * settings.xp_per_assist;
          xp += cappedSaves * settings.xp_per_save;

          // Result XP
          if (result === "WIN") {
            xp += settings.xp_win;
          } else if (result === "DRAW") {
            xp += settings.xp_draw;
          }

          // MVP XP (now validated)
          if (isMvp) xp += settings.xp_mvp;

          // Clean Sheet XP (bonus para goleiros
          // que não sofrem gols)
          let cleanSheetXp = 0;
          if (conf.position === "GOALKEEPER") {
            const opponentScoreForXp =
              getOpponentScore(
                team, liveScore, teams
              );
            if (opponentScoreForXp === 0) {
              cleanSheetXp =
                settings.xp_clean_sheet;
              logger.info(
                "[CLEAN_SHEET] " +
                `Goalkeeper ${uid} ` +
                `gets +${cleanSheetXp} ` +
                "XP bonus"
              );
            }
          }
          xp += cleanSheetXp;

          // Streak XP (escalonado: 3->5->7->10)
          let streakXp = 0;
          if (streak >= 10) {
            streakXp = settings.xp_streak_10;
          } else if (streak >= 7) {
            streakXp = settings.xp_streak_7;
          } else if (streak >= 5) {
            // NOVO: Bonus intermediário
            streakXp = settings.xp_streak_5;
          } else if (streak >= 3) {
            streakXp = settings.xp_streak_3;
          }
          xp += streakXp;

          // Enviar notificação de streak se
          // atingiu milestone (3, 7, 10 ou 30)
          // PERF_001: Lazy load notifications
          // module para otimizar cold start
          // As promises são coletadas e
          // aguardadas após o loop para não
          // perder notificações
          streakNotificationPromises.push(
            (async () => {
              try {
                const notifModule =
                  await getNotifications();
                await notifModule
                  .sendStreakNotificationIfMilestone(
                    uid, streak
                  );
              } catch (err) {
                logger.error(
                  "[STREAK] Error sending " +
                  "notification for " +
                  `user ${uid}:`,
                  err
                );
              }
            })()
          );

          // "Bola Murcha" Penalty (worst player)
          // synced with XPCalculator.kt
          let penaltyXp = 0;
          if (isWorstPlayer) {
            penaltyXp = XP_WORST_PLAYER_PENALTY;
            logger.info(
              `[PENALTY] User ${uid} is ` +
              "\"Bola Murcha\" in game " +
              `${gameId}. Applying ` +
              `${penaltyXp} XP penalty.`
            );
          }
          xp += penaltyXp;

          const baseXp = xp;
          const transactionResult = await db().runTransaction(
            async (tx) => {
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

              const [
                logSnap,
                userSnap,
                statsSnap,
              ] = await Promise.all([
                tx.get(logRef),
                tx.get(userRef),
                tx.get(statsRef),
              ]);

              if (logSnap.exists) {
                return {
                  alreadyProcessed: true,
                  xp: 0,
                };
              }

              if (!userSnap.exists) {
                throw new Error(
                  `Usuário ${uid} não encontrado`
                );
              }

              const userEntry =
                userSnap.data() || {};
              const currentXp =
                (userEntry
                  .experience_points as number) || 0;
              const achievedMilestones = Array.isArray(
                userEntry.milestones_achieved
              ) ?
                userEntry
                  .milestones_achieved as string[] :
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

              const newMvpStreak = isMvp ?
                (stats.currentMvpStreak || 0) + 1 :
                0;

              const newStats: UserStatistics = {
                ...stats,
                totalGames:
                  (stats.totalGames || 0) + 1,
                totalGoals:
                  (stats.totalGoals || 0) +
                  cappedGoals,
                totalAssists:
                  (stats.totalAssists || 0) +
                  cappedAssists,
                totalSaves:
                  (stats.totalSaves || 0) +
                  cappedSaves,
                totalYellowCards:
                  (stats.totalYellowCards || 0) +
                  conf.yellowCards,
                totalRedCards:
                  (stats.totalRedCards || 0) +
                  conf.redCards,
                gamesWon:
                  (stats.gamesWon || 0) +
                  (result === "WIN" ? 1 : 0),
                gamesLost:
                  (stats.gamesLost || 0) +
                  (result === "LOSS" ? 1 : 0),
                gamesDraw:
                  (stats.gamesDraw || 0) +
                  (result === "DRAW" ? 1 : 0),
                bestPlayerCount:
                  (stats.bestPlayerCount || 0) +
                  (isMvp ? 1 : 0),
                worstPlayerCount:
                  (stats.worstPlayerCount || 0) +
                  (isWorstPlayer ? 1 : 0),
                currentMvpStreak: newMvpStreak,
                bestMvpStreak: Math.max(
                  stats.bestMvpStreak || 0,
                  newMvpStreak
                ),
              };

              const {
                newMilestones,
                xp: milesXp,
              } = checkMilestones(
                newStats,
                achievedMilestones
              );

              const playerXp = Math.max(
                MIN_XP_PER_GAME,
                Math.min(
                  baseXp + milesXp,
                  MAX_XP_PER_GAME
                )
              );
              const finalXp = currentXp + playerXp;
              const currentLevel =
                getLevelForXp(currentXp);
              const newLevel =
                getLevelForXp(finalXp);

              const userUpdate: Record<
                string, unknown
              > = {
                experience_points:
                  FieldValue.increment(playerXp),
                level: newLevel,
                updated_at: now,
              };
              if (newMilestones.length > 0) {
                userUpdate.milestones_achieved =
                  FieldValue.arrayUnion(
                    ...newMilestones
                  );
              }
              tx.update(userRef, userUpdate);

              tx.set(
                statsRef,
                {
                  totalGames: FieldValue.increment(1),
                  totalGoals:
                    FieldValue.increment(cappedGoals),
                  totalAssists:
                    FieldValue.increment(cappedAssists),
                  totalSaves:
                    FieldValue.increment(cappedSaves),
                  totalYellowCards:
                    FieldValue.increment(conf.yellowCards),
                  totalRedCards:
                    FieldValue.increment(conf.redCards),
                  gamesWon:
                    FieldValue.increment(
                      result === "WIN" ? 1 : 0
                    ),
                  gamesLost:
                    FieldValue.increment(
                      result === "LOSS" ? 1 : 0
                    ),
                  gamesDraw:
                    FieldValue.increment(
                      result === "DRAW" ? 1 : 0
                    ),
                  bestPlayerCount:
                    FieldValue.increment(isMvp ? 1 : 0),
                  worstPlayerCount:
                    FieldValue.increment(
                      isWorstPlayer ? 1 : 0
                    ),
                  currentMvpStreak: newMvpStreak,
                  bestMvpStreak:
                    newStats.bestMvpStreak,
                  updated_at: now,
                },
                {merge: true}
              );

              tx.update(
                confirmationRef,
                {xp_earned: playerXp}
              );

              const log: XpLog = {
                user_id: uid,
                game_id: gameId,
                transaction_id:
                  `game_${gameId}_user_${uid}`,
                source: "game_finished",
                source_collection: "games",
                source_event_id: gameId,
                source_confirmation_id:
                  `${gameId}_${uid}`,
                xp_earned: playerXp,
                xp_before: currentXp,
                xp_after: finalXp,
                level_before: currentLevel,
                level_after: newLevel,
                xp_participation:
                  settings.xp_presence,
                xp_goals:
                  cappedGoals *
                  settings.xp_per_goal,
                xp_assists:
                  cappedAssists *
                  settings.xp_per_assist,
                xp_saves:
                  cappedSaves *
                  settings.xp_per_save,
                xp_result: result === "WIN" ?
                  settings.xp_win :
                  (result === "DRAW" ?
                    settings.xp_draw : 0),
                xp_mvp: isMvp ?
                  settings.xp_mvp : 0,
                xp_clean_sheet: cleanSheetXp,
                xp_milestones: milesXp,
                xp_streak: streakXp,
                xp_penalty: penaltyXp,
                goals: cappedGoals,
                assists: cappedAssists,
                saves: cappedSaves,
                was_mvp: isMvp,
                was_clean_sheet: cleanSheetXp > 0,
                was_worst_player: isWorstPlayer,
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
                milestones_unlocked: newMilestones,
                created_at: now,
              };
              tx.set(logRef, log);

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
                    totalGames:
                      newStats.totalGames,
                    gamesWon:
                      newStats.gamesWon,
                    currentMvpStreak:
                      newStats.currentMvpStreak,
                  },
                  streak,
                  newMvpStreak,
                  newLevel,
                  currentLevel,
                  result:
                    result as
                      "WIN" | "DRAW" | "LOSS",
                  opponentScore:
                    opScore >= 0 ?
                      opScore : undefined,
                });

              for (const badge of badgesToAward) {
                const docId = `${uid}_${badge}`;
                const badgeRef = db()
                  .collection("user_badges")
                  .doc(docId);
                tx.set(badgeRef, {
                  user_id: uid,
                  badge_id: badge,
                  last_earned_at: FieldValue
                    .serverTimestamp(),
                  count: FieldValue.increment(1),
                }, {merge: true});
              }

              return {
                alreadyProcessed: false,
                xp: playerXp,
              };
            }
          );

          if (transactionResult.alreadyProcessed) {
            logger.info(
              "[XP_IDEMPOTENCY] Player " +
              `${uid} already processed for ` +
              `game ${gameId} inside transaction`
            );
          }
        }

        // Todas as transações por jogador confirmaram com sucesso.
        // Somente agora marcamos o jogo como processado. Se esta escrita
        // falhar, o trigger re-executa; os jogadores já commitados serão
        // pulados pelo xp_log determinístico.
        await event.data.after.ref.update({
          xp_processed: true,
          xp_processing: false,
          xp_processed_at: now,
          xp_reward_status: "PROCESSED",
        });

        logger.info(
          `Game ${gameId} processing ` +
          "complete " +
          "(player transactions committed)."
        );

        // Aguardar notificações de streak
        // APÓS persistir XP (evita envio
        // antes do XP persistir)
        if (
          streakNotificationPromises.length > 0
        ) {
          await Promise.all(
            streakNotificationPromises
          );
          logger.info(
            "[STREAK] " +
            `${streakNotificationPromises
              .length} ` +
            "streak notification(s) processed"
          );
        }

        // Após XP processado com sucesso,
        // consolidar geração de atividade
        try {
          const {
            generateGameFinishedActivityDirect,
          } = await import("./activities.js");
          await generateGameFinishedActivityDirect(
            gameId, after, db()
          );
        } catch (e) {
          logger.error(
            "[CONSOLIDATED] Erro ao gerar " +
            `atividade para game ${gameId}:`,
            e
          );
        }

        // MVP notification é gerenciada pelo
        // trigger separado (requer detecção
        // de mudança de mvp_id)
      } catch (error) {
        logger.error(
          `Game ${gameId} processing failed.`,
          error
        );
        await event.data.after.ref.update({
          xp_processing: false,
          xp_processing_error: "Internal processing error. Reference: game_" + gameId,
        });
        // Re-throw para permitir retry
        throw error;
      }
    }
  }
);

// ==========================================
// RECALCULAR LEAGUE RATING E DIVISÃO
// ==========================================

// FIX #752: options object (era 2-arg sem region → us-central1 default)
// FIX #2199: region agora vem de setGlobalOptions (linha 30), removida daqui.
// FIX #2613: onDocumentWritten captura CREATE + UPDATE — o primeiro jogo da season
// cria o doc via batch.set({merge:true}) (evento CREATE), e onDocumentUpdated nao
// dispara nesse caso. Jogador com 1 jogo ficava sem league_rating/division.
export const recalculateLeagueRating =
  onDocumentWritten(
    {
      document: "season_participation/{partId}",
      memory: "512MiB",
      timeoutSeconds: 180,
    },
    async (event) => {
      if (!event.data) return;

      const partId = event.params.partId;
      const before =
        event.data.before?.data();
      const after =
        event.data.after?.data();

      if (!after) return;
      const userId = after.user_id;

      // ======================================
      // SECURITY VALIDATION
      // ======================================

      // 1. Validate user_id exists
      if (!userId) {
        logger.error(
          "[SECURITY] Participation " +
          `${partId}: Missing user_id. ` +
          "Blocking processing."
        );
        return;
      }

      // 2. Validate user exists in users
      const userDoc = await db()
        .collection("users")
        .doc(userId)
        .get();
      if (!userDoc.exists) {
        logger.error(
          "[SECURITY] Participation " +
          `${partId}: user_id ${userId} ` +
          "not found. Blocking processing."
        );
        return;
      }

      // 3. Log for audit trail
      logger.info(
        `[AUDIT] Participation ${partId}: ` +
        `Processing for user ${userId}`
      );

      // CRITICAL: Evitar loop infinito - só
      // recalcular se games_played mudou
      // Se league_rating/division/recent_games
      // mudaram, significa que NÓS atualizamos
      const gamesPlayedBefore =
        before?.games_played || 0;
      const gamesPlayedAfter =
        after?.games_played || 0;

      if (
        gamesPlayedBefore === gamesPlayedAfter
      ) {
        // Nenhum novo jogo foi adicionado,
        // provavelmente foi nossa própria
        // atualização
        logger.info(
          "Skipping recalculation for " +
          `${partId} - no new games ` +
          `(${gamesPlayedAfter} games)`
        );
        return;
      }

      logger.info(
        "Recalculating rating for " +
        `${partId}: ${gamesPlayedBefore} ` +
        `-> ${gamesPlayedAfter} games`
      );

      // FIX F-H4: Lock distribuído para evitar
      // race condition cross-instance.
      // Padrão idêntico ao xp_processing lock.
      const partRef = db()
        .collection("season_participation")
        .doc(partId);
      const lockResult =
        await db().runTransaction(
          async (tx) => {
            const freshSnap =
              await tx.get(partRef);
            const fresh = freshSnap.data();
            if (!fresh) {
              return {
                shouldProcess: false,
                reason: "missing" as const,
              };
            }
            if (fresh.league_processing) {
              // FIX #728: Lock TTL fallback (same pattern
              // as xp_processing lock above).
              // FIX #1040: reduzido de 10min para 4min (paridade com xp lock).
              const LOCK_TTL_MS = 4 * 60 * 1000;
              const lockAge =
                Date.now() - (
                  fresh.league_processing_at?.toMillis ?
                    fresh.league_processing_at.toMillis() :
                    0
                );
              if (lockAge < LOCK_TTL_MS) {
                return {
                  shouldProcess: false,
                  reason: "processing" as const,
                };
              }
              logger.warn(
                "[LOCK_TTL] Stale league_processing " +
                `lock detected for ${partId} ` +
                `(age: ${Math.round(lockAge / 1000)}s). ` +
                "Taking over."
              );
            }
            tx.update(partRef, {
              league_processing: true,
              league_processing_at:
                FieldValue.serverTimestamp(),
            });
            return {
              shouldProcess: true,
              reason: "locked" as const,
            };
          }
        );

      if (!lockResult.shouldProcess) {
        // FIX #2624: skip silencioso em lock ativo impedia retry do Eventarc.
        // Agora lanca erro para que o retry aconteca quando o lock liberar.
        if (lockResult.reason === "processing") {
          throw new Error(
            `[LEAGUE] ${partId}: league_processing lock active — retrying`
          );
        }
        logger.info(
          `[LEAGUE] ${partId} skipped ` +
          `(${lockResult.reason})`
        );
        return;
      }

      try {
        // Buscar últimos 10 xp_logs deste usuário — filtra game_status=FINISHED
        // defensivamente: xp_logs de jogos cancelados não devem existir,
        // mas o filtro evita contaminação por dados legados ou migrações (#954)
        const xpLogsSnap = await db()
          .collection("xp_logs")
          .where("user_id", "==", userId)
          .where("game_status", "==", "FINISHED")
          .orderBy("created_at", "desc")
          .limit(10)
          .get();

        const recentGames =
          xpLogsSnap.docs.map((doc) => {
            const log = doc.data();
            const won =
              log.game_result === "WIN";
            const drew =
              log.game_result === "DRAW";

            return {
              game_id: log.game_id,
              xp_earned:
                log.xp_earned || 0,
              won: won,
              drew: drew,
              // FIX #1576/#1538: usar placar real do time em vez
              // de heurística (player goals - fixed offset)
              goal_diff:
                (log.my_team_score ?? 0) -
                (log.opponent_score ?? 0),
              was_mvp:
                log.was_mvp || false,
              played_at: log.created_at,
            };
          });

        // Calcular League Rating usando a
        // nova função importada
        // PERF_001: Lazy load league module
        // para otimizar cold start
        const leagueModule =
          await getLeagueCalculations();
        const leagueRating = leagueModule
          .calculateLeagueRating(recentGames);

        // Buscar estado atual de promoção/
        // rebaixamento
        const currentDivision =
          after.division || "BRONZE";
        const currentPromotionProgress =
          after.promotion_progress || 0;
        const currentRelegationProgress =
          after.relegation_progress || 0;
        const currentProtectionGames =
          after.protection_games || 0;

        // Calcular novo estado com lógica de
        // promoção/rebaixamento
        const newLeagueState = leagueModule
          .calculateLeaguePromotion(
            {
              division: currentDivision,
              promotionProgress:
                currentPromotionProgress,
              relegationProgress:
                currentRelegationProgress,
              protectionGames:
                currentProtectionGames,
            },
            leagueRating
          );

        // #1741: Atomic result write + lock release via transaction.
        // Garante que resultado e liberação do lock são commitados
        // juntos — previne estado parcial se instância crashar entre
        // escrita do resultado e liberação do lock.
        await db().runTransaction(async (tx) => {
          tx.update(partRef, {
            league_rating: leagueRating,
            division:
              newLeagueState.division,
            promotion_progress:
              newLeagueState.promotionProgress,
            relegation_progress:
              newLeagueState
                .relegationProgress,
            protection_games:
              newLeagueState.protectionGames,
            recent_games: recentGames,
            league_processing:
              FieldValue.delete(),
            league_processing_at:
              FieldValue.delete(),
          });
        });

        const promoReq = leagueModule
          .PROMOTION_GAMES_REQUIRED;
        const relegReq = leagueModule
          .RELEGATION_GAMES_REQUIRED;
        logger.info(
          "[LEAGUE] Rating: " +
          `${leagueRating.toFixed(1)} | ` +
          "Div: " +
          `${newLeagueState.division} | ` +
          "Promo: " +
          `${newLeagueState
            .promotionProgress}` +
          `/${promoReq} | ` +
          "Releg: " +
          `${newLeagueState
            .relegationProgress}` +
          `/${relegReq} | ` +
          "Protect: " +
          `${newLeagueState.protectionGames}`
        );
      } catch (e) {
        // FIX #584/M7: era catch sem rethrow → liga permanentemente skip
        // pra esse game, divisão stale sem alert.
        // Agora rethrow → Eventarc retry com backoff. Se erro persiste,
        // alerta via logger.error mas não bloqueia o trigger Firestore.
        logger.error(
          "Erro ao recalcular rating " +
          `para ${partId}:`,
          e
        );
        // Liberar lock em caso de erro para
        // permitir retry limpo
        await partRef.update({
          league_processing:
            FieldValue.delete(),
          league_processing_at:
            FieldValue.delete(),
        }).catch((cleanupErr) => {
          logger.error(
            "[LEAGUE] Falha ao liberar lock " +
            `para ${partId}:`,
            cleanupErr
          );
        });
        throw e;
      }
    }
  );

// Funções calculateLeagueRating e
// getDivisionForRating movidas para league.ts
// Ver também: calculateLeaguePromotion para
// lógica de promoção/rebaixamento

// ==========================================
// DELEÇÃO EM CASCATA DE JOGOS
// ==========================================

// SECFIX #495: memory + timeout pra cascade delete (game_events,
// confirmations, ranking_deltas, etc)
/**
 * Coleta todos os documentos de uma query com paginação,
 * evitando truncamento silencioso do limit(2000).
 *
 * @param {admin.firestore.Query} baseQuery - Base query sem limit
 * @param {admin.firestore.DocumentReference[]} allRefs - Array que
 *   recebe as referências coletadas (mutado in-place)
 * @param {string} label - Nome da coleção para log
 * @return {Promise<void>}
 */
async function collectAllMatching(
  baseQuery: admin.firestore.Query,
  allRefs: admin.firestore.DocumentReference[],
  label: string
): Promise<void> {
  let lastDoc:
    admin.firestore.QueryDocumentSnapshot | undefined;
  let totalFound = 0;

  while (true) {
    let query = baseQuery.limit(450);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.size === 0) break;

    snapshot.docs.forEach((doc) => {
      allRefs.push(doc.ref);
      totalFound++;
    });
    lastDoc =
      snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < 450) break;
  }

  logger.info(
    "[CASCADE DELETE] Found " +
    `${totalFound} ` +
    `${label} to delete`
  );
}

export const onGameDeleted = onDocumentDeleted(
  {
    document: "games/{gameId}",
    // FIX #2199: region já vem de setGlobalOptions (redundante aqui).
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const gameId = event.params.gameId;
    logger.info(
      "[CASCADE DELETE] Starting cascade " +
      `deletion for game ${gameId}`
    );

    const BATCH_LIMIT = FIRESTORE_BATCH_SAFE_LIMIT;

    try {
      // FIX #615: usar snapshot pré-deleção (event.data) em vez de
      // re-read pós-trigger. O documento já foi deletado quando o
      // trigger dispara, então re-read sempre retorna exists=false,
      // tornando o cascade delete dead code.
      if (!event.data?.exists) {
        logger.info(
          "[CASCADE DELETE] Game " +
          `${gameId} sem dados pré-deleção, ` +
          "skipping (idempotent)."
        );
        return;
      }
      // Coletar todas as referências de
      // documentos a deletar
      const allRefs: admin.firestore
        .DocumentReference[] = [];

      // 1. Delete confirmations (paginated)
      await collectAllMatching(
        db()
          .collection("confirmations")
          .where("game_id", "==", gameId),
        allRefs,
        "confirmations"
      );

      // 2. Delete teams (paginated)
      await collectAllMatching(
        db()
          .collection("teams")
          .where("game_id", "==", gameId),
        allRefs,
        "teams"
      );

      // 3. Delete game_events (paginated)
      await collectAllMatching(
        db()
          .collection("game_events")
          .where("game_id", "==", gameId),
        allRefs,
        "game_events"
      );

      // 4. Delete mvp_votes (paginated)
      await collectAllMatching(
        db()
          .collection("mvp_votes")
          .where("game_id", "==", gameId),
        allRefs,
        "mvp_votes"
      );

      // 5. Delete live_scores
      // (document with gameId as ID)
      const liveScoreRef = db()
        .collection("live_scores")
        .doc(gameId);
      const liveScoreDoc =
        await liveScoreRef.get();
      if (liveScoreDoc.exists) {
        allRefs.push(liveScoreRef);
        logger.info(
          "[CASCADE DELETE] " +
          "Found live_score to delete"
        );
      }

      // 6. Delete xp_logs related to this game (paginated)
      await collectAllMatching(
        db()
          .collection("xp_logs")
          .where("game_id", "==", gameId),
        allRefs,
        "xp_logs"
      );

      // Commit em chunks de BATCH_LIMIT para
      // não exceder limite de 500 ops
      const totalDeleted = allRefs.length;
      if (totalDeleted > 0) {
        for (
          let i = 0;
          i < allRefs.length;
          i += BATCH_LIMIT
        ) {
          const chunk = allRefs.slice(
            i, i + BATCH_LIMIT
          );
          const batch = db().batch();
          chunk.forEach(
            (ref) => batch.delete(ref)
          );
          await batch.commit();
          const batchNum = Math.floor(
            i / BATCH_LIMIT
          ) + 1;
          logger.info(
            "[CASCADE DELETE] " +
            `Committed batch ${batchNum} ` +
            `(${chunk.length} ops)`
          );
        }
        logger.info(
          "[CASCADE DELETE] Successfully " +
          `deleted ${totalDeleted} related ` +
          `documents for game ${gameId}`
        );
      } else {
        logger.info(
          "[CASCADE DELETE] No related " +
          "documents found for game " +
          `${gameId}`
        );
      }
    } catch (error) {
      logger.error(
        "[CASCADE DELETE] Error during " +
        "cascade deletion for game " +
        `${gameId}:`,
        error
      );
      // Re-throw to trigger retry
      throw error;
    }
  }
);

// ==========================================
// DELEÇÃO EM CASCATA DE GRUPOS
// (#36 - Validação Firebase)
// ==========================================

// SECFIX #495: memory + timeout pra cascade delete em 9 coleções
// (group_members, games, season_participation, etc) — pode processar
// 200+ jogadores e 50+ jogos
export const onGroupDeleted = onDocumentDeleted(
  {
    document: "groups/{groupId}",
    region: FUNCTION_REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const groupId = event.params.groupId;
    logger.info(
      "[CASCADE DELETE] Starting cascade " +
      `deletion for group ${groupId}`
    );

    const BATCH_LIMIT = FIRESTORE_BATCH_SAFE_LIMIT;

    // Interface para agrupar operações de
    // delete e update separadamente
    interface BatchOp {
      type: "delete" | "update";
      ref: admin.firestore.DocumentReference;
      data?: Record<string, unknown>;
    }

    try {
      const allOps: BatchOp[] = [];

      // 1. Delete all members (subcollection)
      const membersSnap = await db()
        .collection("groups")
        .doc(groupId)
        .collection("members")
        .get();
      membersSnap.docs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );
      logger.info(
        "[CASCADE DELETE] Found " +
        `${membersSnap.size} ` +
        "members to delete"
      );

      // 2. Delete cashbox entries
      const cashboxSnap = await db()
        .collection("groups")
        .doc(groupId)
        .collection("cashbox")
        .get();
      cashboxSnap.docs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );
      logger.info(
        "[CASCADE DELETE] Found " +
        `${cashboxSnap.size} ` +
        "cashbox entries to delete"
      );

      // 3. Delete cashbox_summary
      const summarySnap = await db()
        .collection("groups")
        .doc(groupId)
        .collection("cashbox_summary")
        .get();
      summarySnap.docs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );

      // 3.5 Delete join_requests
      const joinRequestsSnap = await db()
        .collection("groups")
        .doc(groupId)
        .collection("join_requests")
        .get();
      joinRequestsSnap.docs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );
      logger.info(
        "[CASCADE DELETE] Found " +
        `${joinRequestsSnap.size} ` +
        "join_requests to delete"
      );

      // 4. Delete group invites
      const invitesSnap = await db()
        .collection("group_invites")
        .where("group_id", "==", groupId)
        .get();
      invitesSnap.docs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );
      logger.info(
        "[CASCADE DELETE] Found " +
        `${invitesSnap.size} ` +
        "invites to delete"
      );

      // 5. Delete schedules
      const schedulesSnap = await db()
        .collection("schedules")
        .where("group_id", "==", groupId)
        .get();
      schedulesSnap.docs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );
      logger.info(
        "[CASCADE DELETE] Found " +
        `${schedulesSnap.size} ` +
        "schedules to delete"
      );

      // 6. Delete user group references (users/{uid}/groups/{groupId})
      // FIX #2605: collectionGroup("groups").where(documentId(), "==", groupId)
      // falhava com "odd number of segments" — documentId() em collection-group
      // exige path completo de documento, nao ID de 1 segmento.
      // Substituido por iteracao nos membros conhecidos (ja lidos no passo 1)
      // deletando users/{uid}/groups/{groupId} por path direto.
      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        const uid = memberData.user_id;
        if (uid) {
          const userGroupRef = db()
            .collection("users")
            .doc(uid)
            .collection("groups")
            .doc(groupId);
          allOps.push({
            type: "delete", ref: userGroupRef,
          });
        }
      }
      logger.info(
        "[CASCADE DELETE] Found " +
        `${membersSnap.size} ` +
        "user group references to delete"
      );

      // 7. Mark games from this group as
      // orphaned (don't delete - preserve
      // history)
      const gamesSnap = await db()
        .collection("games")
        .where("group_id", "==", groupId)
        .get();
      gamesSnap.docs.forEach(
        (doc) => allOps.push({
          type: "update",
          ref: doc.ref,
          data: {
            group_id: null,
            group_deleted: true,
            group_deleted_at:
              FieldValue
                .serverTimestamp(),
          },
        })
      );
      logger.info(
        "[CASCADE DELETE] Marked " +
        `${gamesSnap.size} ` +
        "games as orphaned"
      );

      // Commit em chunks de BATCH_LIMIT para
      // não exceder limite de 500 ops
      const totalOps = allOps.length;
      if (totalOps > 0) {
        for (
          let i = 0;
          i < allOps.length;
          i += BATCH_LIMIT
        ) {
          const chunk = allOps.slice(
            i, i + BATCH_LIMIT
          );
          const batch = db().batch();
          chunk.forEach((op) => {
            if (op.type === "delete") {
              batch.delete(op.ref);
            } else if (
              op.type === "update" &&
              op.data
            ) {
              batch.update(
                op.ref, op.data
              );
            }
          });
          await batch.commit();
          const batchNum = Math.floor(
            i / BATCH_LIMIT
          ) + 1;
          logger.info(
            "[CASCADE DELETE] " +
            `Committed batch ${batchNum} ` +
            `(${chunk.length} ops)`
          );
        }
        logger.info(
          "[CASCADE DELETE] Successfully " +
          `processed ${totalOps} ` +
          "operations for group " +
          `${groupId}`
        );
      } else {
        logger.info(
          "[CASCADE DELETE] No related " +
          "documents found for group " +
          `${groupId}`
        );
      }
    } catch (error) {
      logger.error(
        "[CASCADE DELETE] Error during " +
        "cascade deletion for group " +
        `${groupId}:`,
        error
      );
      // Re-throw to trigger retry
      throw error;
    }
  }
);

// ==========================================
// SYNC DE CONTADORES
// (#38, #40 - Validação Firebase)
// ==========================================

// FIX F-C2: Substituído recontagem full + Set in-memory (não
// funciona cross-instance em Cloud Functions v2) por
// FieldValue.increment atômico — seguro em múltiplas instâncias.
// Sync de players_count quando confirmações mudam.
//
// FIX #616: onDocumentWritten captura CREATE/UPDATE/DELETE.
// Antes: onDocumentUpdated → players_count não atualizava em first
// confirmation (status já vem CONFIRMED na criação) nem em delete
// (admin remove player). Self-correcting via subsequent updates,
// mas inconsistência observável.
// FIX #752: options object com region explícita (era 2-arg sem region → us-central1 default)
export const onConfirmationWrite =
  onDocumentWritten(
    {
      document: "confirmations/{confirmationId}",
      region: FUNCTION_REGION,
    },
    async (event) => {
      if (!event.data) return;

      // FIX #616: before pode não existir (CREATE), after pode não
      // existir (DELETE) — usar optional chaining em ambos os lados.
      const before =
        event.data.before?.data?.();
      const after =
        event.data.after?.data?.();
      const gameId =
        after?.game_id || before?.game_id;

      if (!gameId) return;

      // Status mudou (confirmou ou cancelou)
      const statusBefore = before?.status;
      const statusAfter = after?.status;

      // FIX #2616: early-return so se status E posicao nao mudaram.
      // Antes, o terceiro branch (troca de posicao) era dead code pq
      // statusBefore === statusAfter retornava antes de checar position.
      const positionBefore = before?.position;
      const positionAfter = after?.position;

      if (statusBefore === statusAfter &&
          positionBefore === positionAfter) return;

      // Calcular delta atômico baseado na
      // transição de status
      const wasConfirmed =
        statusBefore === "CONFIRMED";
      const isConfirmed =
        statusAfter === "CONFIRMED";

      let delta = 0;
      let gkDelta = 0;
      if (!wasConfirmed && isConfirmed) {
        delta = 1;
        if (after?.position === "GOALKEEPER") {
          gkDelta = 1;
        }
      } else if (wasConfirmed && !isConfirmed) {
        delta = -1;
        if (before?.position === "GOALKEEPER") {
          gkDelta = -1;
        }
      } else if (wasConfirmed && isConfirmed &&
        positionBefore !== positionAfter) {
        // Troca de posição FIELD ↔ GOALKEEPER
        if (after?.position === "GOALKEEPER") {
          gkDelta = 1;
        } else {
          gkDelta = -1;
        }
      }

      if (delta === 0 && gkDelta === 0) return;

      try {
        logger.info(
          "[SYNC] Confirmation status " +
          `changed: ${statusBefore} -> ` +
          `${statusAfter} for game ${gameId} ` +
          `(delta=${delta}, gkDelta=${gkDelta})`
        );

        const updateFields: Record<string, unknown> = {
          players_count:
            FieldValue.increment(delta),
          updated_at: FieldValue.serverTimestamp(),
        };
        if (gkDelta !== 0) {
          updateFields.goalkeepers_count =
            FieldValue.increment(gkDelta);
        }

        // Increment atômico — seguro
        // cross-instance, sem race condition
        await db().collection("games")
          .doc(gameId)
          .update(updateFields);

        logger.info(
          `[SYNC] Game ${gameId}: ` +
          `players_count ${delta > 0 ? "+" : ""}${delta}` +
          (gkDelta !== 0 ? `, goalkeepers_count ${gkDelta > 0 ? "+" : ""}${gkDelta}` : "")
        );
      } catch (error) {
        logger.error(
          "[SYNC] Error syncing counts " +
          `for game ${gameId}:`,
          error
        );
        // Re-throw para permitir retry
        throw error;
      }
    }
  );

export * from "./activities";
export * from "./notifications";
export * from "./reminders";
export * from "./season";
export * from "./user-management";

// Issue #517 Phase 2: request-to-join em grupos publicos
export * from "./groups/join-requests";

// Issue #2517 (regressão #2153): redenção de convite cria membership via
// trigger server-side (admin SDK, bypassa rules) — funciona p/ grupo PRIVADO.
export * from "./groups/invite-redeemed";

// Issue #611 / #626: server-authoritative member_count counter
// (cliente não pode mais escrever member_count direto — bypassa privilege
// escalation e desbloqueia join-via-invite no web)
export * from "./groups/member-counter";

// Infrastructure & Monitoring
export * from "./maintenance/cleanup-old-logs";
export * from "./maintenance/soft-delete";
// FIX #2610: maintainStreaksData nunca foi exportado — job mensal de compactacao
// de streaks (0 4 1 * *) nunca rodou em producao.
export {maintainStreaksData} from "./maintenance/compact-streaks";
// FIX #760: keepWarmFunctions removido — escrevia em Firestore mas não aquecia
// containers de outras funções (isolamento por função em CF v2).
// Use minInstances na declaração das funções críticas se necessário.
// Arquivo keep-warm.ts deletado (#2643).
export * from "./monitoring/collect-metrics";
export {collectCallableLatencyMetrics} from "./monitoring/collect-latency-metrics";
export * from "./storage/generate-thumbnails";

// SPEC: feat-2026-05-08-consolidate-shareable-invites
// Migra groups.invite_code (legacy) -> invites/ (canonical)
export {migrateGroupsInviteCodeToInvites}
  from "./migration/invites-migration";

// ==========================================
// PERF_001: CUSTOM CLAIMS & SECURITY
// ==========================================
// Importar funções de gerenciamento de
// Custom Claims
// Referência:
//   specs/PERF_001_SECURITY_RULES_...md
export * from "./auth/custom-claims";
export * from "./auth/profile-complete-claim";
export * from "./middleware/require-profile-complete";

// ==========================================
// Phone + CPF Verification (Anti-Bot)
// Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
// Issues: #443 (epic), #444 (Fase 1), #449 (Fase 6 Anti-abuse)
// ==========================================
export {
  verifyCpf,
  setUserVerified,
  // #1018: backfill operacional — chame 1x após deploy para migrar usuários existentes
  bulkSetVerifiedForExistingUsers,
} from "./auth/verification";
export {canSendSmsOtp, logVerificationFailure} from "./auth/anti-abuse";
export {requestAccountMerge} from "./auth/account-merge";

// FIX #619: cleanup cpf_index + users_private ao deletar conta
// (LGPD Art. 18 VI — direito ao apagamento)
export {onUserDeleted} from "./auth/account-cleanup";

// SECFIX #433: PII denormalization users -> users_private
// Triggers + callable migration (ADMIN one-shot) + Stage 3 callables
export {
  onUserDocCreated,
  onUserDocUpdated,
  migratePiiToUsersPrivate,
  updateUserPii,
  removePiiFromUsers,
} from "./auth/pii-migration";

// SECFIX #442: location_lat/lng denormalization (LGPD)
// Trigger + callable backfill (ADMIN one-shot)
export {
  onGameWrittenDenormalizeLocation,
  denormalizeGameLocations,
} from "./games/denormalize-location";

// SECFIX #430: detector de confirmacoes em jogos overlapping
export {onConfirmationCreated} from "./voting/temporal-overlap";

// SECFIX #425: rate-limit de game_events por user
export {onGameEventCreated} from "./voting/events-rate-limit";

// SECFIX #426: server-side check-in com validacao GPS + distancia
export {checkInToGame, generateCheckinToken} from "./voting/check-in";

// #3208: lifecycle server-side para iniciar/finalizar jogos
export {
  startGameLifecycle,
  finishGameLifecycle,
} from "./games/lifecycle";
export {reviewHeldGameRewards} from "./games/reward-review";
export {
  submitLiveGameEvent,
  deleteLiveGameEvent,
} from "./games/live-events";

// Issue #2968: reputacao leve pos-jogo com agregacao server-side
export {submitPostGameReputation} from "./reputation/post-game-reputation";

// ==========================================
// P0 OPTIMIZATIONS: XP PARALLEL PROCESSING
// ==========================================
// Implementar P0 #6, #7, #9, #10
// - Processamento paralelo/batch de XP
// - Firestore batch writes (até 500 ops)
// - Idempotência com transaction IDs
// - Rate limiting em callable functions
// Referência:
//   specs/P0_CLOUD_FUNCTIONS_...md
export * from "./xp/parallel-processing";

// ==========================================
// P2 #39: MVP VOTING RACE CONDITION FIX
// ==========================================
// Votação atômica usando Firestore
// transactions
// - submitMvpVote: Submissão de voto com
//   proteção contra duplicatas
// - concludeMvpVoting: Tallying atômico e
//   atualização de resultados
// Referência:
//   specs/P2_39_MVP_VOTING_...md
export * from "./voting/mvp-voting";

// ==========================================
// P2 #29: BATCH FCM NOTIFICATIONS
// ==========================================
// Sistema de notificações em batch para
// reduzir chamadas FCM
// - processNotificationBatch: Scheduler que
//   processa fila a cada minuto
// - enqueueNotificationCallable: Callable
//   para enfileirar notificações
// - cleanupNotificationQueue: Limpeza de
//   fila processada
// Referência:
//   specs/MASTER_OPTIMIZATION_CHECKLIST.md
//   - P2 #29
// Já exportado via "./notifications" para evitar export duplicado.

// ==========================================
// PHASE 3: MONITORING, ALERTING & CACHE
// ==========================================
// - systemHealthCheck: Health check a cada
//   15 min com auto-recovery
// - cleanupDeadLetterQueue: Limpeza semanal
//   de DLQ resolvidas
// - cleanupExpiredRateLimits: Limpeza horária
//   de rate limit buckets
// - cleanupOldAlerts: Limpeza semanal de
//   alertas antigos
// Referência:
//   specs/BACKEND_OPTIMIZATION_SPEC.md
//   - PHASE 3
export * from "./monitoring/alerting";

// ==========================================
// P2 #28: LEADERBOARD CACHE SERVER-SIDE
// ==========================================
// Cache de leaderboard no Firestore com
// TTL de 5 min
// - getLeaderboardCached: Callable com
//   cache hit/miss
// Referência:
//   specs/INFRASTRUCTURE_RECOMMENDATIONS.md
//   - P2 #28
export * from "./cache/leaderboard-cache";

// ==========================================
// LOCATION MANAGEMENT (#1684, #1704)
// ==========================================
// - deleteLocation: Cascade delete com sub-coleções
// - calculateAutoRatings: Auto-ratings server-side
export * from "./locations/location-management";

// ==========================================
// AUTO RATINGS (#1697)
// ==========================================
// - onStatisticsWrittenForAutoRatings: recalcula auto-ratings server-side
//   quando statistics/{userId} muda.
export * from "./ratings/auto-ratings";

// ==========================================
// GROUP LEAGUE (#1783)
// ==========================================
// - onGameFinishedGroupLeague: atualiza standings da liga do grupo
//   quando um jogo com group_id é finalizado.
export {onGameFinishedGroupLeague} from "./group-league";

// ==========================================
// GROWTH FEATURES (#engajamento-2026-05-24)
// ==========================================
// - seedOfficialGroups: callable ADMIN para popular official-groups
// - onUserCreatedGenerateInviteCode: gera invite_code único
// - onUserCreatedProcessInvite: incrementa invite_count do inviter
// - onUserInviteCountChanged: award ambassador badges
// - processWeeklyRanking: scheduled todo domingo 23:59
// - onGameFinishedCheckBadges: verifica badges ao finalizar jogo
export {seedOfficialGroups} from "./growth/seed-official-groups";
export {
  onUserCreatedGenerateInviteCode,
  onUserCreatedProcessInvite,
  generateMyInviteCode,
  validateInviteCode,
} from "./auth/invite-code";
export {onUserInviteCountChanged} from "./badges/ambassador-badge";
export {processWeeklyRanking} from "./growth/weekly-ranking";
export {onGameFinishedCheckBadges} from "./badges/game-badges";
export {startNewSeason, archiveSeason} from "./growth/season-cycle";

// ==========================================
// CASHBOX (auditoria 2026-05-30 #2352)
// ==========================================
// - onCashboxEntryWritten: recomputa cashbox_summary/current do ledger
//   imutavel a cada escrita de entry (summary self-healing, balance sempre
//   consistente com income/expense reais).
export {onCashboxEntryWritten} from "./cashbox/summary-recompute";

// ==========================================
// RECURRENCE ENGINE
// ==========================================
export {onGameFinishedCreateRecurrence} from "./games/recurrence-engine";
export {autoClosePastGames} from "./games/auto-close-past-games";
export {joinPublicGame} from "./games/join-public-game";

// ==========================================
// ADMIN CRM
// ==========================================
export {searchAdminUsers} from "./admin/user-crm";
export {
  requestVenueOwnerOnboarding,
  reviewVenueOwnerOnboarding,
} from "./admin/venue-owner-onboarding";
export {
  upsertVenueAccount,
  linkLocationToVenueAccount,
  unlinkLocationFromVenueAccount,
} from "./admin/venue-accounts";
