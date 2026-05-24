import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";
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
} from "./constants";
import {
  getAllBadgesToAward,
} from "./badges/badge-helper";

// Padroniza região default de TODAS as functions v2 que não especificam
// region explicitamente. Antes, 15 functions ficavam em us-central1
// (default do Firebase) enquanto Firestore está em southamerica-east1,
// gerando latência extra e split confuso entre módulos.
setGlobalOptions({region: FUNCTION_REGION});

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
  fetchAllUsers,
  fetchAllStats,
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
    region: FUNCTION_REGION,
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data() as Game;
    const after = event.data.after.data() as Game;
    const gameId = event.params.gameId;

    // ==========================================
    // SECURITY VALIDATION (PERF_001 Enhanced)
    // ==========================================

    // 1. Validate owner_id exists
    if (!after.owner_id) {
      console.error(
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
      console.warn(
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
      console.error(
        `[SECURITY] Game ${gameId}: ` +
        `owner_id ${after.owner_id} ` +
        "not found in users. Blocking processing."
      );
      return;
    }

    // 4. Log status change for audit trail
    if (before.status !== after.status) {
      console.log(
        `[AUDIT] Game ${gameId}: ` +
        `Status changed ${before.status} ` +
        `-> ${after.status} ` +
        `by owner ${after.owner_id}`
      );
    }

    // Check Trigger Conditions:
    // Status changed to FINISHED and xp not yet processed
    if (
      before.status !== "FINISHED" &&
      after.status === "FINISHED"
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
                  Date.now()
              );
            if (lockAge < LOCK_TTL_MS) {
              return {
                shouldProcess: false,
                reason: "processing" as const,
              };
            }
            console.warn(
              "[LOCK_TTL] Stale xp_processing lock " +
              `detected for game ${event.params.gameId} ` +
              `(age: ${Math.round(lockAge / 1000)}s). ` +
              "Taking over."
            );
          }
          tx.update(gameRef, {
            xp_processing: true,
            xp_processing_at: admin.firestore
              .FieldValue.serverTimestamp(),
          });
          return {
            shouldProcess: true,
            reason: "locked" as const,
          };
        }
      );

      if (!lockResult.shouldProcess) {
        console.log(
          `Game ${gameId} skipped ` +
          `(${lockResult.reason}).`
        );
        return;
      }

      console.log(
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
          console.error(
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
          console.error(
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
          console.error(
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
          console.error(
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

        // VALIDAÇÕES ANTI-CHEAT (SERVER-SIDE)
        for (const conf of validConfirmations) {
          if (
            conf.goals < 0 ||
            conf.goals > MAX_GOALS_PER_GAME
          ) {
            throw new Error(
              "[ANTI-CHEAT] Invalid goals " +
              `count for user ${conf.userId}: ` +
              `${conf.goals} ` +
              `(max: ${MAX_GOALS_PER_GAME})`
            );
          }
          if (
            conf.assists < 0 ||
            conf.assists > MAX_ASSISTS_PER_GAME
          ) {
            throw new Error(
              "[ANTI-CHEAT] Invalid assists " +
              `count for user ${conf.userId}: ` +
              `${conf.assists} ` +
              `(max: ${MAX_ASSISTS_PER_GAME})`
            );
          }
          if (
            conf.saves < 0 ||
            conf.saves > MAX_SAVES_PER_GAME
          ) {
            throw new Error(
              "[ANTI-CHEAT] Invalid saves " +
              `count for user ${conf.userId}: ` +
              `${conf.saves} ` +
              `(max: ${MAX_SAVES_PER_GAME})`
            );
          }
          console.log(
            `[ANTI-CHEAT] User ${conf.userId}: ` +
            `${conf.goals} goals, ` +
            `${conf.assists} assists, ` +
            `${conf.saves} saves - VALID`
          );
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
          console.log(
            "Not enough players " +
            `(${validConfirmations.length}` +
            `/${MIN_PLAYERS}). ` +
            "Marking processed."
          );
          await event.data.after.ref.update({
            xp_processed: true,
            xp_processing: false,
            xp_processed_at: admin.firestore
              .FieldValue.serverTimestamp(),
          });
          return;
        }

        // 2. Determine Results
        const teamResults =
          determineGameResults(teams, liveScore);

        // 2.5 IDEMPOTENCY GUARD: Check for
        // already-processed users (fixes #644)
        //
        // When Promise.all(batchCommits) partially
        // fails (some batches committed, some not)
        // and the CF retries, users from committed
        // batches would get XP double-credited via
        // FieldValue.increment. Since xp_logs use
        // deterministic IDs (game_{id}_user_{uid}),
        // already-existing xp_log docs serve as
        // idempotency markers to skip on retry.
        const existingXpLogsSnap = await db()
          .collection("xp_logs")
          .where("game_id", "==", gameId)
          .select("user_id")
          .get();
        const alreadyProcessedUserIds =
          new Set<string>();
        existingXpLogsSnap.docs.forEach((doc) => {
          const uid = doc.data().user_id as
            string | undefined;
          if (uid) alreadyProcessedUserIds.add(uid);
        });
        if (alreadyProcessedUserIds.size > 0) {
          console.log(
            "[XP_IDEMPOTENCY] Skipping " +
            `${alreadyProcessedUserIds.size} ` +
            "already-processed user(s) for " +
            `game ${gameId}`
          );
        }

        // 3. Pre-fetch ALL player data in parallel
        // (PERF: reduces 60+ sequential ops to ~3)
        const userIds = confirmations
          .map((c) => c.userId);

        // Fetch all data in PARALLEL - key opt!
        const [
          usersMap,
          statsMap,
          streaksMap,
        ] = await Promise.all([
          fetchAllUsers(userIds),
          fetchAllStats(userIds),
          fetchAllStreaks(userIds),
        ]);

        // 4. Process Each Player
        // (NO Firestore calls in loop -
        // data already loaded)
        const XP_BATCH_LIMIT =
          FIRESTORE_BATCH_SAFE_LIMIT;
        let currentBatch = db().batch();
        let currentBatchOps = 0;
        const batchCommits: Promise<
          admin.firestore.WriteResult[]
        >[] = [];
        const now = admin.firestore
          .FieldValue.serverTimestamp();

        // Helper: Verifica se precisa criar novo
        // batch antes de adicionar ops
        const ensureBatchCapacity = (
          opsNeeded: number
        ) => {
          if (
            currentBatchOps + opsNeeded >
            XP_BATCH_LIMIT
          ) {
            batchCommits.push(
              currentBatch.commit()
            );
            console.log(
              "[XP_BATCH] Comitting batch " +
              `with ${currentBatchOps} ops, ` +
              "starting new batch"
            );
            currentBatch = db().batch();
            currentBatchOps = 0;
          }
        };

        // Date keys for Rankings
        const d = getGameDate(gameDoc);
        // yyyy-MM
        const monthKey =
          d.toISOString().substring(0, 7);
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

          // Get pre-fetched data
          // (NO Firestore calls - sync lookup)
          const userEntry =
            usersMap.get(uid) || {};
          const currentXp =
            userEntry.experience_points || 0;
          const achievedMilestones = (
            userEntry.milestones_achieved || []
          ) as string[];

          const stats = statsMap.get(uid) || {
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
          } as UserStatistics;

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
            console.error(
              `[FRAUD] User ${uid} set as ` +
              "MVP without confirmation " +
              `in game ${gameId}`
            );
          }

          const isMvp = isMvpAndConfirmed;

          // Check if player was voted as
          // "Bola Murcha" (worst player)
          const isWorstPlayer =
            conf.is_worst_player === true;

          // Calc XP (COM TETOS ANTI-CHEAT)
          let xp = settings.xp_presence;
          xp += Math.min(
            conf.goals, MAX_GOALS_PER_GAME
          ) * settings.xp_per_goal;
          xp += Math.min(
            conf.assists, MAX_ASSISTS_PER_GAME
          ) * settings.xp_per_assist;
          xp += Math.min(
            conf.saves, MAX_SAVES_PER_GAME
          ) * settings.xp_per_save;

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
              console.log(
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
                console.error(
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
            console.log(
              `[PENALTY] User ${uid} is ` +
              "\"Bola Murcha\" in game " +
              `${gameId}. Applying ` +
              `${penaltyXp} XP penalty.`
            );
          }
          xp += penaltyXp;

          // Update Stats locally for
          // Milestone Check
          // MVP Streak: incrementa se MVP,
          // reseta se nao
          const newMvpStreak = isMvp ?
            (stats.currentMvpStreak || 0) + 1 :
            0;

          const newStats: UserStatistics = {
            ...stats,
            totalGames:
              (stats.totalGames || 0) + 1,
            totalGoals:
              (stats.totalGoals || 0) +
              conf.goals,
            totalAssists:
              (stats.totalAssists || 0) +
              conf.assists,
            totalSaves:
              (stats.totalSaves || 0) +
              conf.saves,
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
          };

          // Milestones
          const {newMilestones, xp: milesXp} =
            checkMilestones(
              newStats, achievedMilestones
            );
          xp += milesXp;

          // Aplicar teto máximo + piso mínimo de XP por jogo
          // (anti-cheat).
          // FIX #584/H13: era Math.max(0, ...) → clampava Bola Murcha
          // -10 silenciosamente pra 0, gerando log inconsistente
          // (xp_penalty: -10 mas xp_earned: 0). Agora usa
          // MIN_XP_PER_GAME = -100 (de shared/xp-constants.json) →
          // permite penalidades negativas legítimas.
          xp = Math.max(
            MIN_XP_PER_GAME,
            Math.min(xp, MAX_XP_PER_GAME)
          );

          // Final XP & Level
          const finalXp = currentXp + xp;
          const currentLevel =
            getLevelForXp(currentXp);
          const newLevel =
            getLevelForXp(finalXp);

          // Writes
          // Estimar operações:
          // user(1) + stats(1) + confirm(1)
          // + log(1) + ranking(2) + season(0-1)
          // + badges(0-N)
          // Mínimo ~6 ops por jogador,
          // garantir espaço antes de iniciar
          // Reserva conservadora por jogador
          ensureBatchCapacity(10);

          // 1. Update User
          // Usar FieldValue.increment() para evitar lost update
          // em escritas concorrentes (level usa valor absoluto
          // pois o lock de xp_processing garante exclusividade)
          const userUpdate: Record<
            string, unknown
          > = {
            experience_points: admin.firestore
              .FieldValue.increment(xp),
            level: newLevel,
            updated_at: now,
          };
          if (newMilestones.length > 0) {
            userUpdate.milestones_achieved =
              admin.firestore
                .FieldValue
                .arrayUnion(...newMilestones);
          }
          currentBatch.update(
            db().collection("users").doc(uid),
            userUpdate
          );
          currentBatchOps++;

          // 2. Update Stats
          currentBatch.set(
            db().collection("statistics")
              .doc(uid),
            newStats,
            {merge: true}
          );
          currentBatchOps++;

          // 3. Update Confirmation
          currentBatch.update(
            db().collection("confirmations")
              .doc(`${gameId}_${uid}`),
            {xp_earned: xp}
          );
          currentBatchOps++;

          // 4. Create Log
          // FIX #584/M5: era random doc id → CF crash mid-batch + Eventarc
          // retry = double-credit via increment (mesmo player 2x).
          // Agora deterministic id: replay safe (set sobreescreve mesmo doc).
          const logRef =
            db().collection("xp_logs")
              .doc(`game_${gameId}_user_${uid}`);
          const log: XpLog = {
            user_id: uid,
            game_id: gameId,
            xp_earned: xp,
            xp_before: currentXp,
            xp_after: finalXp,
            level_before: currentLevel,
            level_after: newLevel,
            xp_participation:
              settings.xp_presence,
            xp_goals: Math.min(
              conf.goals, MAX_GOALS_PER_GAME
            ) * settings.xp_per_goal,
            xp_assists: Math.min(
              conf.assists, MAX_ASSISTS_PER_GAME
            ) * settings.xp_per_assist,
            xp_saves: Math.min(
              conf.saves, MAX_SAVES_PER_GAME
            ) * settings.xp_per_save,
            xp_result: result === "WIN" ?
              settings.xp_win :
              (result === "DRAW" ?
                settings.xp_draw : 0),
            xp_mvp: isMvp ?
              settings.xp_mvp : 0,
            // NOVO: XP clean sheet
            xp_clean_sheet: cleanSheetXp,
            xp_milestones: milesXp,
            xp_streak: streakXp,
            xp_penalty: penaltyXp,
            goals: conf.goals,
            assists: conf.assists,
            saves: conf.saves,
            was_mvp: isMvp,
            // NOVO: Flag clean sheet
            was_clean_sheet: cleanSheetXp > 0,
            was_worst_player: isWorstPlayer,
            game_result: result,
            // FIX #1576: armazenar placar real do time para goal_diff
            my_team_score: team ?
              (liveScore ?
                (team.id === liveScore.team1Id ?
                  liveScore.team1Score :
                  liveScore.team2Score) :
                team.score) :
              0,
            opponent_score: getOpponentScore(
              team, liveScore, teams
            ),
            // Armazenado para permitir filtro defensivo em recalculateLeagueRating (#954)
            game_status: "FINISHED",
            milestones_unlocked: newMilestones,
            created_at: now,
          };
          currentBatch.set(logRef, log);
          currentBatchOps++;

          // 5. Update Ranking Deltas
          // (2 ops: week + month)
          ensureBatchCapacity(2);
          updateRankingDeltas(
            currentBatch,
            uid,
            conf,
            result,
            xp,
            isMvp,
            weekKey,
            monthKey
          );
          currentBatchOps += 2;

          // 6. Update Season (if active) (1 op)
          if (activeSeason) {
            ensureBatchCapacity(1);
            updateSeasonParticipation(
              currentBatch,
              uid,
              activeSeason,
              result,
              conf,
              isMvp,
              gameData.group_id
            );
            currentBatchOps++;
          }

          // 7. Award Badges (badge-helper.ts)
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

          for (
            const badge of badgesToAward
          ) {
            ensureBatchCapacity(1);
            const docId =
              `${uid}_${badge}`;
            const badgeRef = db()
              .collection("user_badges")
              .doc(docId);

            currentBatch.set(badgeRef, {
              user_id: uid,
              badge_id: badge,
              unlocked_at: admin.firestore
                .FieldValue
                .serverTimestamp(),
              last_earned_at: admin.firestore
                .FieldValue
                .serverTimestamp(),
              count: admin.firestore
                .FieldValue.increment(1),
            }, {merge: true});
            currentBatchOps++;
          }
        }

        // Mark Game Processed
        ensureBatchCapacity(1);
        currentBatch.update(
          event.data.after.ref, {
            xp_processed: true,
            xp_processing: false,
            xp_processed_at: now,
          }
        );
        currentBatchOps++;

        // Commit último batch pendente
        batchCommits.push(
          currentBatch.commit()
        );

        // FIX #793: Promise.allSettled preserva chunks bem-sucedidos
        // mesmo quando 1 chunk falha. Promise.all abortava tudo.
        const commitResults =
          await Promise.allSettled(batchCommits);
        const failedCommits = commitResults.filter(
          (r) => r.status === "rejected"
        );
        if (failedCommits.length > 0) {
          console.error(
            `[XP] ${failedCommits.length}/${batchCommits.length} ` +
            "batch commits falharam para game " + gameId
          );
          // Re-throw com detalhes mas sem perder XP parcialmente processado
          throw new Error(
            `${failedCommits.length} batch(es) XP falharam: ` +
            (failedCommits[0] as PromiseRejectedResult).reason
          );
        }
        console.log(
          `Game ${gameId} processing ` +
          "complete " +
          `(${batchCommits.length} ` +
          "batch(es) committed)."
        );

        // Aguardar notificações de streak
        // APÓS batch commit (evita envio
        // antes do XP persistir)
        if (
          streakNotificationPromises.length > 0
        ) {
          await Promise.all(
            streakNotificationPromises
          );
          console.log(
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
          console.error(
            "[CONSOLIDATED] Erro ao gerar " +
            `atividade para game ${gameId}:`,
            e
          );
        }

        // MVP notification é gerenciada pelo
        // trigger separado (requer detecção
        // de mudança de mvp_id)
      } catch (error) {
        console.error(
          `Game ${gameId} processing failed.`,
          error
        );
        await event.data.after.ref.update({
          xp_processing: false,
          xp_processing_error: String(error),
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

// FIX #752: options object com region explícita (era 2-arg sem region → us-central1 default)
export const recalculateLeagueRating =
  onDocumentUpdated(
    {
      document: "season_participation/{partId}",
      region: FUNCTION_REGION,
      memory: "512MiB",
      timeoutSeconds: 180,
    },
    async (event) => {
      if (!event.data) return;

      const partId = event.params.partId;
      const before =
        event.data.before.data();
      const after =
        event.data.after.data();
      const userId = after.user_id;

      // ======================================
      // SECURITY VALIDATION
      // ======================================

      // 1. Validate user_id exists
      if (!userId) {
        console.error(
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
        console.error(
          "[SECURITY] Participation " +
          `${partId}: user_id ${userId} ` +
          "not found. Blocking processing."
        );
        return;
      }

      // 3. Log for audit trail
      console.log(
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
        console.log(
          "Skipping recalculation for " +
          `${partId} - no new games ` +
          `(${gamesPlayedAfter} games)`
        );
        return;
      }

      console.log(
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
                    Date.now()
                );
              if (lockAge < LOCK_TTL_MS) {
                return {
                  shouldProcess: false,
                  reason: "processing" as const,
                };
              }
              console.warn(
                "[LOCK_TTL] Stale league_processing " +
                `lock detected for ${partId} ` +
                `(age: ${Math.round(lockAge / 1000)}s). ` +
                "Taking over."
              );
            }
            tx.update(partRef, {
              league_processing: true,
              league_processing_at:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });
            return {
              shouldProcess: true,
              reason: "locked" as const,
            };
          }
        );

      if (!lockResult.shouldProcess) {
        console.log(
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
              admin.firestore.FieldValue
                .delete(),
            league_processing_at:
              admin.firestore.FieldValue
                .delete(),
          });
        });

        const promoReq = leagueModule
          .PROMOTION_GAMES_REQUIRED;
        const relegReq = leagueModule
          .RELEGATION_GAMES_REQUIRED;
        console.log(
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
        // alerta via console.error mas não bloqueia o trigger Firestore.
        console.error(
          "Erro ao recalcular rating " +
          `para ${partId}:`,
          e
        );
        // Liberar lock em caso de erro para
        // permitir retry limpo
        await partRef.update({
          league_processing:
            admin.firestore.FieldValue
              .delete(),
          league_processing_at:
            admin.firestore.FieldValue
              .delete(),
        }).catch((cleanupErr) => {
          console.error(
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
export const onGameDeleted = onDocumentDeleted(
  {
    document: "games/{gameId}",
    region: FUNCTION_REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const gameId = event.params.gameId;
    console.log(
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
        console.log(
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

      // 1. Delete confirmations
      const confirmationsSnap = await db()
        .collection("confirmations")
        .where("game_id", "==", gameId)
        .limit(2000)
        .get();
      confirmationsSnap.docs.forEach(
        (doc) => allRefs.push(doc.ref)
      );
      console.log(
        "[CASCADE DELETE] Found " +
        `${confirmationsSnap.size} ` +
        "confirmations to delete"
      );

      // 2. Delete teams
      const teamsSnap = await db()
        .collection("teams")
        .where("game_id", "==", gameId)
        .limit(2000)
        .get();
      teamsSnap.docs.forEach(
        (doc) => allRefs.push(doc.ref)
      );
      console.log(
        "[CASCADE DELETE] Found " +
        `${teamsSnap.size} ` +
        "teams to delete"
      );

      // 3. Delete game_events
      const eventsSnap = await db()
        .collection("game_events")
        .where("game_id", "==", gameId)
        .limit(2000)
        .get();
      eventsSnap.docs.forEach(
        (doc) => allRefs.push(doc.ref)
      );
      console.log(
        "[CASCADE DELETE] Found " +
        `${eventsSnap.size} ` +
        "game_events to delete"
      );

      // 4. Delete mvp_votes
      const votesSnap = await db()
        .collection("mvp_votes")
        .where("game_id", "==", gameId)
        .limit(2000)
        .get();
      votesSnap.docs.forEach(
        (doc) => allRefs.push(doc.ref)
      );
      console.log(
        "[CASCADE DELETE] Found " +
        `${votesSnap.size} ` +
        "mvp_votes to delete"
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
        console.log(
          "[CASCADE DELETE] " +
          "Found live_score to delete"
        );
      }

      // 6. Delete xp_logs related to this game
      const xpLogsSnap = await db()
        .collection("xp_logs")
        .where("game_id", "==", gameId)
        .limit(2000)
        .get();
      xpLogsSnap.docs.forEach(
        (doc) => allRefs.push(doc.ref)
      );
      console.log(
        "[CASCADE DELETE] Found " +
        `${xpLogsSnap.size} ` +
        "xp_logs to delete"
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
          console.log(
            "[CASCADE DELETE] " +
            `Committed batch ${batchNum} ` +
            `(${chunk.length} ops)`
          );
        }
        console.log(
          "[CASCADE DELETE] Successfully " +
          `deleted ${totalDeleted} related ` +
          `documents for game ${gameId}`
        );
      } else {
        console.log(
          "[CASCADE DELETE] No related " +
          "documents found for game " +
          `${gameId}`
        );
      }
    } catch (error) {
      console.error(
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
    console.log(
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
      console.log(
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
      console.log(
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
      console.log(
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
      console.log(
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
      console.log(
        "[CASCADE DELETE] Found " +
        `${schedulesSnap.size} ` +
        "schedules to delete"
      );

      // 6. Update users who had this group (paginated)
      const usersWithGroupDocs: admin.firestore.QueryDocumentSnapshot[] = [];
      let lastUserDoc: admin.firestore.QueryDocumentSnapshot | undefined;

      while (true) {
        let q = db()
          .collectionGroup("groups")
          .where(
            admin.firestore
              .FieldPath.documentId(),
            "==",
            groupId
          )
          .limit(500);
        if (lastUserDoc) q = q.startAfter(lastUserDoc);

        const snap = await q.get();
        if (snap.empty) break;

        usersWithGroupDocs.push(...snap.docs);
        lastUserDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < 500) break;
      }
      usersWithGroupDocs.forEach(
        (doc) => allOps.push({
          type: "delete", ref: doc.ref,
        })
      );
      console.log(
        "[CASCADE DELETE] Found " +
        `${usersWithGroupDocs.length} ` +
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
              admin.firestore
                .FieldValue
                .serverTimestamp(),
          },
        })
      );
      console.log(
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
          console.log(
            "[CASCADE DELETE] " +
            `Committed batch ${batchNum} ` +
            `(${chunk.length} ops)`
          );
        }
        console.log(
          "[CASCADE DELETE] Successfully " +
          `processed ${totalOps} ` +
          "operations for group " +
          `${groupId}`
        );
      } else {
        console.log(
          "[CASCADE DELETE] No related " +
          "documents found for group " +
          `${groupId}`
        );
      }
    } catch (error) {
      console.error(
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

      if (statusBefore === statusAfter) return;

      // Calcular delta atômico baseado na
      // transição de status
      const wasConfirmed =
        statusBefore === "CONFIRMED";
      const isConfirmed =
        statusAfter === "CONFIRMED";

      let delta = 0;
      if (!wasConfirmed && isConfirmed) {
        delta = 1;
      } else if (wasConfirmed && !isConfirmed) {
        delta = -1;
      }

      if (delta === 0) return;

      try {
        console.log(
          "[SYNC] Confirmation status " +
          `changed: ${statusBefore} -> ` +
          `${statusAfter} for game ${gameId} ` +
          `(delta=${delta})`
        );

        // Increment atômico — seguro
        // cross-instance, sem race condition
        await db().collection("games")
          .doc(gameId)
          .update({
            players_count:
              admin.firestore.FieldValue
                .increment(delta),
            updated_at: admin.firestore
              .FieldValue.serverTimestamp(),
          });

        console.log(
          `[SYNC] Game ${gameId}: ` +
          `players_count ${delta > 0 ? "+" : ""}` +
          `${delta}`
        );
      } catch (error) {
        console.error(
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
export * from "./seeding";
export * from "./user-management";

// Issue #517 Phase 2: request-to-join em grupos publicos
export * from "./groups/join-requests";

// Issue #611 / #626: server-authoritative member_count counter
// (cliente não pode mais escrever member_count direto — bypassa privilege
// escalation e desbloqueia join-via-invite no web)
export * from "./groups/member-counter";

// Infrastructure & Monitoring
export * from "./maintenance/cleanup-old-logs";
export * from "./maintenance/soft-delete";
// FIX #760: keepWarmFunctions removido — escrevia em Firestore mas não aquecia
// containers de outras funções (isolamento por função em CF v2).
// Use minInstances na declaração das funções críticas se necessário.
// export * from "./maintenance/keep-warm";
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
