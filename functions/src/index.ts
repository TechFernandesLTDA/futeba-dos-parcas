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
} from "./constants";
import {db} from "./_db";
import {hardDeleteGroupCascade} from "./groups/group-cascade";
import {handleGameStatusUpdate} from "./xp/on-game-status-update";

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

// Re-exportar streaks e datas BRT
export {
  brtDateKey,
  parseDateKeyAsUtc,
  getFiniteNumber,
  calculateNextParticipationStreak,
  hasNewerParticipationStreakMarker,
  calculateStreakXp,
} from "./xp/streaks";

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

admin.initializeApp();

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
// 3. Server-side validation em xp/game-validation-gate.ts
//    - Valida owner_id, previne fraud
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
  handleGameStatusUpdate
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
