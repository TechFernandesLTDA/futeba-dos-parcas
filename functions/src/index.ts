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
import {
  buildMilestoneBadgeDoc,
  buildUserBadgeAggregateDoc,
} from "./badges/user-badge-docs";
import {isGameShape} from "./validation/guards";
import {
  buildGameValidationFromFirestore,
} from "./game-validation/aggregate";
import {
  isScoreConsistentFromEventStream,
  readScoresMap,
} from "./games/live-events";

const GAME_CONFIRMATIONS_QUERY_LIMIT = 200;
const GAME_TEAMS_QUERY_LIMIT = 100;

// FIX #4150: janela de dias que mantém a sequência de participações.
// BUSINESS_RULES define streak por jogos CONSECUTIVOS — pelada semanal
// (lacuna de 7 dias) tem que MANTER. Antes o corte era gapDays <= 1, o
// que zerava toda sequência semanal (7/7 user_streaks em prod com
// longest_streak = 1). 8 = 7 + 1 de tolerância (mesma janela do
// SmartReminderHelper; decisão registrada em specs/DECISIONS.md).
const STREAK_KEEP_GAP_DAYS = 8;

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
  XP_WORST_PLAYER_PENALTY,
  getLevelForXp,
  checkMilestones,
  fitMilestonesWithinGameXpCap,
} from "./xp/pipeline";
import {
  buildDerivedEventStats,
  buildWaitlistMap,
  calculatePerGameBonusBreakdown,
  normalizeGamificationSettings,
  reconcileXpLogBreakdown,
} from "./xp/bonus-rules";

// Game helpers (conversores, resultados, fetch)
import {
  toGameConfirmation,
  toTeam,
  toLiveScore,
  getGameDate,
  getWeekKey,
  determineGameResults,
  getOpponentScore,
  isParticipationEligible,
  updateRankingDeltas,
  updateSeasonParticipation,
} from "./game/helpers";
import {db} from "./_db";
import {hardDeleteGroupCascade} from "./groups/group-cascade";
import {
  NotificationType,
  sendAndSaveNotification,
} from "./notifications/helpers";

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
  getMilestoneXp,
  fitMilestonesWithinGameXpCap,
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

/**
 * Formata a data do jogo na chave yyyy-MM-dd em America/Sao_Paulo.
 * @param {Date} date Data do jogo.
 * @return {string} Chave local BRT.
 */
export function brtDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Converte uma chave yyyy-MM-dd em Date UTC seguro para diff em dias.
 * @param {unknown} dateKey Valor bruto do campo de data.
 * @return {Date | null} Data normalizada ou null.
 */
export function parseDateKeyAsUtc(dateKey?: unknown): Date | null {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Lê o primeiro campo numérico finito de um documento.
 * @param {admin.firestore.DocumentData | undefined} data Documento bruto.
 * @param {string[]} keys Aliases aceitos.
 * @param {number} fallback Valor padrão.
 * @return {number} Número encontrado ou fallback.
 */
export function getFiniteNumber(
  data: admin.firestore.DocumentData | undefined,
  keys: string[],
  fallback = 0
): number {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

/**
 * Calcula o streak após processar o jogo atual.
 * @param {admin.firestore.DocumentData | undefined} raw Doc de streak.
 * @param {string} gameDateKey Data do jogo em yyyy-MM-dd.
 * @return {object} Streak anterior, atual, recorde e início.
 */
export function calculateNextParticipationStreak(
  raw: admin.firestore.DocumentData | undefined,
  gameDateKey: string
) {
  const previousCurrent = getFiniteNumber(
    raw,
    ["current_streak", "currentStreak"]
  );
  const previousLongest = getFiniteNumber(
    raw,
    ["longest_streak", "longestStreak"]
  );
  const lastGameDate =
    typeof raw?.last_game_date === "string" ?
      raw.last_game_date :
      typeof raw?.lastGameDate === "string" ?
        raw.lastGameDate :
        undefined;
  const lastDate = parseDateKeyAsUtc(lastGameDate);
  const currentDate = parseDateKeyAsUtc(gameDateKey);
  const gapDays = lastDate && currentDate ?
    Math.round(
      (currentDate.getTime() - lastDate.getTime()) / 86400000
    ) :
    null;
  const keepsStreak =
    previousCurrent > 0 &&
    (gapDays === null || (gapDays >= 0 && gapDays <= STREAK_KEEP_GAP_DAYS));
  // FIX #4150: mesmo dia NÃO soma (paridade com o gêmeo KMP
  // GamificationRepositoryImpl: diffInDays == 0 não incrementa) — duas
  // peladas no sábado não contam como 2 jogos seguidos.
  const sameDayAttendance = gapDays === 0;
  const currentStreak = keepsStreak ?
    (sameDayAttendance ? previousCurrent : previousCurrent + 1) :
    1;
  const previousStartedAt =
    typeof raw?.streak_started_at === "string" ?
      raw.streak_started_at :
      typeof raw?.streakStartedAt === "string" ?
        raw.streakStartedAt :
        undefined;
  if (
    lastGameDate &&
    currentDate &&
    lastDate &&
    lastDate.getTime() > currentDate.getTime()
  ) {
    return {
      previousStreak: previousCurrent,
      currentStreak: previousCurrent,
      longestStreak: Math.max(previousLongest, previousCurrent),
      streakStartedAt: previousStartedAt || lastGameDate,
    };
  }

  return {
    previousStreak: previousCurrent,
    currentStreak,
    longestStreak: Math.max(previousLongest, currentStreak),
    streakStartedAt: keepsStreak ?
      (previousStartedAt || gameDateKey) :
      gameDateKey,
  };
}

/**
 * Detecta se o doc de streak já aponta para jogo mais recente.
 * @param {admin.firestore.DocumentData | undefined} raw Doc de streak.
 * @param {string} gameDateKey Data do jogo em yyyy-MM-dd.
 * @return {boolean} true quando o marcador atual é mais novo.
 */
export function hasNewerParticipationStreakMarker(
  raw: admin.firestore.DocumentData | undefined,
  gameDateKey: string
): boolean {
  const lastGameDate =
    typeof raw?.last_game_date === "string" ?
      raw.last_game_date :
      typeof raw?.lastGameDate === "string" ?
        raw.lastGameDate :
        undefined;
  const lastDate = parseDateKeyAsUtc(lastGameDate);
  const currentDate = parseDateKeyAsUtc(gameDateKey);
  return !!(
    lastDate &&
    currentDate &&
    lastDate.getTime() > currentDate.getTime()
  );
}

/**
 * Calcula o bônus de XP pelo streak atual.
 * @param {number} streak Streak de participação atualizado.
 * @param {GamificationSettings} settings Configuração de XP.
 * @return {number} XP de streak aplicável.
 */
export function calculateStreakXp(
  streak: number,
  settings: GamificationSettings
): number {
  if (streak >= 10) return settings.xp_streak_10;
  if (streak >= 7) return settings.xp_streak_7;
  if (streak >= 5) return settings.xp_streak_5;
  if (streak >= 3) return settings.xp_streak_3;
  return 0;
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
        const gameDocRef = db().collection("games")
          .doc(gameId) as FirebaseFirestore.DocumentReference & {
            collection?: (
              name: string
            ) => FirebaseFirestore.CollectionReference;
          };
        const waitlistPromise =
          typeof gameDocRef.collection === "function" ?
            gameDocRef.collection("waitlist")
              .limit(500)
              .get() :
            Promise.resolve({
              docs: [],
            } as unknown as FirebaseFirestore.QuerySnapshot);

        const [
          confirmationsSnap,
          teamsSnap,
          liveScoreDoc,
          settingsSnap,
          seasonSnap,
          gameSnap,
          gameEventsSnap,
          waitlistSnap,
        ] = await Promise.all([
          db().collection("confirmations")
            .where("game_id", "==", gameId)
            .where("status", "==", "CONFIRMED")
            .limit(GAME_CONFIRMATIONS_QUERY_LIMIT)
            .get(),
          db().collection("teams")
            .where("game_id", "==", gameId)
            .limit(GAME_TEAMS_QUERY_LIMIT)
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
          waitlistPromise,
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
        // #3942: consistência sobre o mapa canônico de placares (2-4 times),
        // com fallback legado para live_scores ainda não migrados.
        const scoresMap = readScoresMap(liveScoreData);
        const scoreEventConsistent =
          liveScoreData && scoresMap.size > 0 ?
            isScoreConsistentFromEventStream(
              gameEventsSnap.docs,
              scoresMap,
            ) :
            undefined;

        try {
          const validationResult =
            buildGameValidationFromFirestore({
              game: gameData,
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

        const presenceExcluded = validConfirmations.filter(
          (c) => !isParticipationEligible(c)
        );
        if (presenceExcluded.length > 0) {
          for (const c of presenceExcluded) {
            logger.warn(
              "[XP_ELIGIBILITY][PRESENCE] Jogador confirmado sem presença " +
              `real foi excluído do processamento de XP: userId=${c.userId}, ` +
              `gameId=${gameId}`
            );
          }
          validConfirmations.splice(
            0,
            validConfirmations.length,
            ...validConfirmations.filter(isParticipationEligible)
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
        const activeSeason = seasonSnap && !seasonSnap.empty ?
          seasonSnap.docs[0].id :
          null;
        const gameDoc = gameSnap.data() as
          Game | undefined;

        const settings = normalizeGamificationSettings(
          settingsSnap.exists ? settingsSnap.data() : undefined,
        );
        const eventStats = buildDerivedEventStats(
          gameEventsSnap?.docs ?? [],
          settings,
          validConfirmations,
        );
        const waitlistEntriesByUser = buildWaitlistMap(
          waitlistSnap?.docs ?? [],
        );

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

        // #3940: DEDUP BIDIRECIONAL (defesa em profundidade).
        // O caminho de votação (concludeMvpVoting → applyVotingXpDelta)
        // credita MVP/Bola Murcha em docs próprios (mvp_${gameId}_${uid} e
        // bola_murcha_${gameId}_${uid}). O guard existente acima só consulta
        // o log principal (game_${gameId}_user_${uid}), então o sentido
        // "votação pagou antes do pipeline" não é coberto. Quando o jogo esteve
        // HELD_FOR_REVIEW, a ordem dos eventos se inverte e esse caminho fica
        // exposto. Lemos os 2 docs de votação (apenas quando mvp_id /
        // worst_player_id existem — leitura barata por doc id determinístico)
        // e, se já existirem, o pipeline NÃO soma o XP de MVP/penalidade de
        // novo. Idempotente e consistente com o padrão de leitura acima.
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
              {exists: false} as
                FirebaseFirestore.DocumentSnapshot
            ),
          worstVotingUid ?
            db()
              .collection("xp_logs")
              .doc(
                `bola_murcha_${gameId}_${worstVotingUid}`
              )
              .get() :
            Promise.resolve(
              {exists: false} as
                FirebaseFirestore.DocumentSnapshot
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

        const now = FieldValue.serverTimestamp();

        // Date keys for Rankings (BRT timezone)
        const d = getGameDate(gameDoc);
        const gameDateKey = brtDateKey(d);
        // yyyy-MM
        const monthKey = gameDateKey.substring(0, 7);
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

          // SECURITY FIX (CVE-2): Validate MVP
          // was actually confirmed by checking
          // confirmations list
          const isMvpAndConfirmed =
            after.mvp_id === uid &&
            validConfirmations.some((c) => c.userId === uid);

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
            validConfirmations.some((c) => c.userId === uid);

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

          // MVP XP (now validated).
          // #3940: skip se o caminho de votação já pagou o MVP
          // (dedup bidirecional — ver bloco de leitura acima).
          if (isMvp && !mvpVotingAlreadyPaid) {
            xp += settings.xp_mvp;
          }

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

          // "Bola Murcha" Penalty (worst player)
          // synced with XPCalculator.kt.
          // #3940: skip se o caminho de votação já aplicou a penalidade
          // (dedup bidirecional — ver bloco de leitura acima).
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
          xp += penaltyXp;

          const baseXpWithoutStreak = xp;
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

              const userEntry =
                userSnap.data() || {};
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
              const streakDoc =
                streakSnap.docs[0];
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
                    gameStartedAt: d,
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
                baseXpWithoutStreak + streakXp +
                extraBonusXp;
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
                recordedEventsGames:
                  (stats.recordedEventsGames || 0) +
                  (bonusBreakdown.eventRecorder > 0 ? 1 : 0),
                // #3587/#3588/#3596: estes campos dependem do resultado da
                // votação, que ainda não existe na transição para FINISHED.
                // concludeMvpVoting é a única fonte de verdade.
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
              const milesXp =
                cappedMilestones.appliedXp;

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
              if (shouldAdvanceGameDateMarker) {
                userUpdate.last_played_game_date =
                  gameDateKey;
              }
              if (shouldAdvanceMonthMarker) {
                userUpdate.last_played_month_key =
                  monthKey;
                userUpdate.monthly_streak =
                  bonusBreakdown.monthlyStreakAfter;
              }
              if (
                shouldAdvanceMonthMarker &&
                bonusBreakdown.comeback > 0
              ) {
                userUpdate.last_comeback_month_key =
                  monthKey;
              }
              if (
                cappedMilestones.appliedMilestones.length > 0
              ) {
                userUpdate.milestones_achieved =
                  FieldValue.arrayUnion(
                    ...cappedMilestones
                      .appliedMilestones
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
                  recordedEventsGames:
                    FieldValue.increment(
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
                    current_streak:
                      streakState.currentStreak,
                    longest_streak:
                      streakState.longestStreak,
                    last_game_date: gameDateKey,
                    streak_started_at:
                      streakState.streakStartedAt,
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
                    xp_mvp: (isMvp && !mvpVotingAlreadyPaid) ?
                      settings.xp_mvp : 0,
                    xp_clean_sheet: cleanSheetXp,
                    xp_milestones: milesXp,
                    xp_streak: streakXp,
                    xp_penalty: penaltyXp,
                    xp_top_scorer:
                      bonusBreakdown.topScorer,
                    xp_hat_trick:
                      bonusBreakdown.hatTrick,
                    xp_first_goal:
                      bonusBreakdown.firstGoal,
                    xp_goalkeeper_goal:
                      bonusBreakdown.goalkeeperGoal,
                    xp_fair_play:
                      bonusBreakdown.fairPlay,
                    xp_recorder:
                      bonusBreakdown.eventRecorder,
                    xp_early_confirmation:
                      bonusBreakdown.earlyConfirmation,
                    xp_on_time_checkin:
                      bonusBreakdown.onTimeCheckin,
                    xp_last_minute_saver:
                      bonusBreakdown.lastMinuteSaver,
                    xp_waitlist_promoted:
                      bonusBreakdown.waitlistPromoted,
                    xp_comeback:
                      bonusBreakdown.comeback,
                    xp_first_game_month:
                      bonusBreakdown.firstGameOfMonth,
                    xp_monthly_streak:
                      bonusBreakdown.monthlyStreak,
                  },
                  playerXp,
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
                ...reconciledLogBreakdown,
                goals: cappedGoals,
                assists: cappedAssists,
                saves: cappedSaves,
                was_mvp: isMvp,
                was_clean_sheet: cleanSheetXp > 0,
                was_worst_player: isWorstPlayer,
                was_top_scorer:
                  bonusBreakdown.topScorer > 0,
                was_hat_trick:
                  bonusBreakdown.hatTrick > 0,
                was_first_goal:
                  bonusBreakdown.firstGoal > 0,
                was_goalkeeper_goal:
                  bonusBreakdown.goalkeeperGoal > 0,
                was_fair_play:
                  bonusBreakdown.fairPlay > 0,
                recorded_events_count:
                  bonusBreakdown.recordedEventsCount,
                comeback_type:
                  bonusBreakdown.comebackType,
                monthly_streak:
                  bonusBreakdown.monthlyStreakAfter,
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
                    totalGames:
                      newStats.totalGames,
                    gamesWon:
                      newStats.gamesWon,
                    recordedEventsGames:
                      newStats.recordedEventsGames || 0,
                    currentMvpStreak:
                      newStats.currentMvpStreak,
                  },
                  streak: streakState.currentStreak,
                  // Badges dependentes do resultado da votação são
                  // concedidas por concludeMvpVoting, após a apuração.
                  newMvpStreak: 0,
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
                streak: streakState.currentStreak,
                previousStreak:
                  streakState.previousStreak,
                comebackXp:
                  bonusBreakdown.comeback,
              };
            }
          );

          if (transactionResult.alreadyProcessed) {
            logger.info(
              "[XP_IDEMPOTENCY] Player " +
              `${uid} already processed for ` +
              `game ${gameId} inside transaction`
            );
          } else {
            streakNotificationPromises.push(
              (async () => {
                try {
                  if (transactionResult.comebackXp > 0) {
                    await sendAndSaveNotification(uid, {
                      userId: uid,
                      title: "Tá de volta! 🔙",
                      body:
                        `Você voltou pra pelada e ganhou +${transactionResult.comebackXp} XP.`,
                      type: NotificationType.ACHIEVEMENT,
                      action: "achievements",
                    }, `xp_comeback_${gameId}_${uid}`);
                  }
                  const notifModule =
                    await getNotifications();
                  await notifModule
                    .sendStreakNotificationIfMilestone(
                      uid,
                      transactionResult.streak,
                      transactionResult.previousStreak
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
          // #3940: o XP de votação (MVP/Bola Murcha) foi pago neste pipeline
          // run (quando mvp_id/worst_player_id já existiam). Limpa o flag de
          // adiamento setado por concludeMvpVoting durante o hold anti-fraude.
          voting_xp_pending: false,
          // FIX #4053: persiste a temporada ativa no jogo quando ele vira
          // FINISHED. applyVotingXpDelta lê games.season_id (ramo hoje
          // inalcançável) para creditar o XP de MVP/Bola Murcha na temporada
          // DO JOGO, não na ativa na hora do voto (virada de mês).
          ...(activeSeason ? {season_id: activeSeason} : {}),
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
          // PERF: projection — só os campos usados no cálculo de rating
          // (reduz bytes lidos dos xp_logs, que carregam breakdown extenso).
          .select(
            "game_id",
            "game_result",
            "xp_earned",
            "my_team_score",
            "opponent_score",
            "was_mvp",
            "created_at"
          )
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
 * @param {string} label - Nome da coleção para log
 * @return {Promise<admin.firestore.DocumentReference[]>} Referências coletadas
 */
async function collectAllMatching(
  baseQuery: admin.firestore.Query,
  label: string
): Promise<admin.firestore.DocumentReference[]> {
  const refs: admin.firestore.DocumentReference[] = [];
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
      refs.push(doc.ref);
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

  return refs;
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
      // documentos a deletar.
      // PERF: as 8 varreduras são independentes — paralelizamos para reduzir
      // a latência do cascade delete (antes eram 7 scans sequenciais paginados).
      const liveScoreRef = db()
        .collection("live_scores")
        .doc(gameId);

      const [
        confirmationsRefs,
        teamsRefs,
        eventsRefs,
        mvpVotesRefs,
        xpLogsRefs,
        photosRefs,
        videosRefs,
        liveScoreDoc,
      ] = await Promise.all([
        collectAllMatching(
          db()
            .collection("confirmations")
            .where("game_id", "==", gameId),
          "confirmations"
        ),
        collectAllMatching(
          db()
            .collection("teams")
            .where("game_id", "==", gameId),
          "teams"
        ),
        collectAllMatching(
          db()
            .collection("game_events")
            .where("game_id", "==", gameId),
          "game_events"
        ),
        collectAllMatching(
          db()
            .collection("mvp_votes")
            .where("game_id", "==", gameId),
          "mvp_votes"
        ),
        collectAllMatching(
          db()
            .collection("xp_logs")
            .where("game_id", "==", gameId),
          "xp_logs"
        ),
        collectAllMatching(
          db()
            .collection("game_photos")
            .where("game_id", "==", gameId),
          "game_photos"
        ),
        collectAllMatching(
          db()
            .collection("game_videos")
            .where("game_id", "==", gameId),
          "game_videos"
        ),
        liveScoreRef.get(),
      ]);

      const allRefs: admin.firestore
        .DocumentReference[] = [
          ...confirmationsRefs,
          ...teamsRefs,
          ...eventsRefs,
          ...mvpVotesRefs,
          ...xpLogsRefs,
          ...photosRefs,
          ...videosRefs,
        ];

      // 5. live_scores (document with gameId as ID)
      if (liveScoreDoc.exists) {
        allRefs.push(liveScoreRef);
        logger.info(
          "[CASCADE DELETE] " +
          "Found live_score to delete"
        );
      }

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

      // FIX #4049: remove os objetos do Storage (fotos, vídeos e thumbnails
      // de uma vez, prefixo games/{gameId}/). Sem isso, apagar o jogo deixava
      // bytes órfãos servidos por URL de token para sempre.
      try {
        const bucket = admin.storage().bucket();
        await bucket.deleteFiles({prefix: `games/${gameId}/`});
        logger.info(
          "[CASCADE DELETE] Storage objects removed under " +
          `games/${gameId}/`
        );
      } catch (storageError) {
        logger.error(
          "[CASCADE DELETE] Error deleting storage objects for game " +
          `${gameId}:`,
          storageError
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
// FIX #4100: corpo da cascata extraído para groups/group-cascade.ts —
// leituras paginadas por cursor (450/página) + commit incremental por
// batch, cobrindo também wall_posts, group_polls e group_poll_votes.
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

    try {
      await hardDeleteGroupCascade(groupId);
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
const CONFIRMATION_COUNTER_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

      // #3501: o callable canônico atualiza games + confirmation na mesma
      // transaction e troca este token interno. Nesse evento o delta já foi
      // aplicado; pular evita double count. Cancelamentos/deletes feitos pelo
      // cliente preservam o token e continuam sendo reconciliados abaixo.
      const capacitySyncBefore = before?.capacity_sync_token;
      const capacitySyncAfter = after?.capacity_sync_token;
      if (typeof capacitySyncAfter === "string" &&
          capacitySyncAfter.length > 0 &&
          capacitySyncAfter !== capacitySyncBefore) {
        logger.info(
          `[SYNC] Confirmation ${event.params.confirmationId} ` +
          "already synchronized by canonical callable"
        );
        return;
      }

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

      const eventId = event.id;
      if (!eventId) {
        const error = new Error(
          "Confirmation counter event is missing CloudEvent id"
        );
        logger.error("[SYNC] Invalid confirmation counter event", {
          gameId,
          confirmationId: event.params.confirmationId,
          error: error.message,
        });
        throw error;
      }

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

        const gameRef = db().collection("games").doc(gameId);
        const markerRef = gameRef
          .collection("confirmation_counter_events")
          .doc(encodeURIComponent(eventId));
        const outcome = await db().runTransaction(async (transaction) => {
          const [markerSnap, gameSnap] = await Promise.all([
            transaction.get(markerRef),
            transaction.get(gameRef),
          ]);
          if (markerSnap.exists) return "DUPLICATE" as const;
          if (!gameSnap.exists) return "GAME_MISSING" as const;

          transaction.update(gameRef, updateFields);
          transaction.create(markerRef, {
            event_id: eventId,
            confirmation_id: event.params.confirmationId,
            players_delta: delta,
            goalkeepers_delta: gkDelta,
            processed_at: FieldValue.serverTimestamp(),
            expires_at: new Date(
              Date.now() + CONFIRMATION_COUNTER_EVENT_TTL_MS
            ),
          });
          return "APPLIED" as const;
        });

        if (outcome === "DUPLICATE") {
          logger.info("[SYNC] Duplicate confirmation event ignored", {
            eventId,
            gameId,
            confirmationId: event.params.confirmationId,
          });
          return;
        }
        if (outcome === "GAME_MISSING") {
          logger.warn("[SYNC] Game missing for confirmation counter", {
            eventId,
            gameId,
            confirmationId: event.params.confirmationId,
          });
          return;
        }

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

// Issue #3937: geração de código de convite de grupo no servidor (crypto, não
// Math.random no cliente) — doc invites/{code} criado via Admin SDK.
export {generateGroupInviteCode} from "./groups/generate-invite-code";

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
export {sendGamificationNudgesDaily} from "./gamification-nudges";
// FIX #760: keepWarmFunctions removido — escrevia em Firestore mas não aquecia
// containers de outras funções (isolamento por função em CF v2).
// Use minInstances na declaração das funções críticas se necessário.
// Arquivo keep-warm.ts deletado (#2643).
export * from "./monitoring/collect-metrics";
export {collectCallableLatencyMetrics} from "./monitoring/collect-latency-metrics";
export {
  aggregateRealtimeSloMetrics,
  reportRealtimeSloMetric,
} from "./monitoring/realtime-slo";
export * from "./storage/generate-thumbnails";
export * from "./storage/generate-video-thumbnails";
export {
  createGameVideo,
  reconcileStaleProcessingGameVideos,
} from "./storage/game-videos";
export {createGamePhoto} from "./storage/game-photos";

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
export {requestAccountMerge, completeAccountMerge} from "./auth/account-merge";

// FIX #619: cleanup cpf_index + users_private ao deletar conta
// (LGPD Art. 18 VI — direito ao apagamento)
export {onUserDeleted} from "./auth/account-cleanup";

// #4391: exclusão de conta pelo próprio usuário (web, Android, iOS).
// Valida login recente e posse de grupos, exclui o Auth por último e deixa a
// cascata LGPD para o onUserDeleted acima.
export {deleteAccount} from "./auth/delete-account";

// #4482: exportação dos dados do titular (LGPD art. 18, V — portabilidade).
// Enumera as mesmas coleções e formas de campo que o onUserDeleted e o
// account-merge (teste de cobertura em test/auth/export-my-data.test.ts).
export {exportMyData} from "./auth/export-my-data";

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

// #4417: alertas do Crashlytics (regressão, novo crash fatal e pico) viram
// log estruturado, e a política monitoring/crashlytics-alert.json manda e-mail.
export {
  onCrashlyticsRegressionAlert,
  onCrashlyticsNewFatalIssueAlert,
  onCrashlyticsVelocityAlert,
} from "./monitoring/crashlytics-alerts";

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
export * from "./waitlist/join-game-waitlist";

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
// - createCashboxEntry: valida saldo/role e grava entrada sem arredondamento
//   flutuante acumulado no boundary do backend.
// - onCashboxEntryWritten: recomputa cashbox_summary/current do ledger
//   imutavel a cada escrita de entry (summary self-healing, balance sempre
//   consistente com income/expense reais).
export {
  createCashboxEntry,
  voidCashboxEntry,
  reconcileCashboxSummary,
} from "./cashbox/callable";
export {
  configureMonthlyFinance,
  setMonthlyMember,
  rebuildMonthlyCycle,
  setMonthlyGameOverride,
  settleMonthlyCharge,
} from "./cashbox/monthly";
export {onCashboxEntryWritten} from "./cashbox/summary-recompute";

// ==========================================
// RECURRENCE ENGINE
// ==========================================
export {onGameFinishedCreateRecurrence} from "./games/recurrence-engine";
export {autoClosePastGames} from "./games/auto-close-past-games";
export {
  confirmGamePresence,
  joinPublicGame,
} from "./games/join-public-game";
export {confirmPlayerAsManager} from "./games/confirm-player-as-manager";
export {getFieldAvailability} from "./games/field-availability";
// #4408: prévia Open Graph + JSON público do jogo (rewrite do Hosting).
export {publicGamePage} from "./games/public-game-page";

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

// ==========================================
// SOCIAL GRAPH (#3235 / #3240)
// ==========================================
export {toggleFollowUser} from "./social/follow";
export {discoverNearbyPlayers, updateMyLocation} from "./social/nearby-players";
export {
  createDirectChat,
  submitDirectMessage,
  onDirectMessageDeleted,
} from "./social/direct-messages";
export {submitContentReport} from "./social/reports";
export {onGroupWallPostSoftDeletedCleanupMedia} from "./groups/wall-media-cleanup";
export {
  createGroupWallMediaDraft,
  onGroupWallMediaStaged,
  cleanupExpiredGroupWallMediaDrafts,
} from "./groups/wall-media-pipeline";
