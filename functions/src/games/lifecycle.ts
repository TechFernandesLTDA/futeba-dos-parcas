import {logger} from "firebase-functions";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {FieldValue} from "firebase-admin/firestore";
import {randomUUID} from "node:crypto";
import {FUNCTION_REGION} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {db} from "../_db";
import {checkRateLimit} from "../middleware/rate-limiter";
import {requireProfileComplete} from "../middleware/require-profile-complete";
import {
  isScoreConsistentFromEventStream,
  readScoresMap,
} from "./live-events";

interface GameLifecycleRequest {
  gameId: string;
}

interface TeamSnapshot {
  id: string;
  name: string;
}

/**
 * Valida e normaliza o ID do jogo recebido pelo callable.
 *
 * @param {unknown} gameId Valor bruto enviado pelo cliente.
 * @return {string} ID validado.
 */
function validateGameId(gameId: unknown): string {
  if (
    typeof gameId !== "string" ||
    gameId.trim().length === 0 ||
    gameId.length > 128 ||
    gameId.includes("/")
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.GAME_ID_REQUIRED
    );
  }
  return gameId;
}

/**
 * Verifica se o caller pode gerenciar o ciclo do jogo.
 *
 * @param {FirebaseFirestore.DocumentData} game Dados do jogo.
 * @param {string} uid UID autenticado.
 * @param {boolean} isAdmin Indica custom claim ADMIN.
 * @return {boolean} true quando o caller pode gerenciar.
 */
function isGameManager(
  game: FirebaseFirestore.DocumentData,
  uid: string,
  isAdmin: boolean
): boolean {
  const coOrganizers =
    Array.isArray(game.co_organizers) ?
      game.co_organizers :
      [];
  return (
    isAdmin ||
    game.owner_id === uid ||
    coOrganizers.includes(uid)
  );
}

/**
 * Normaliza os times lidos dentro da transaction de início.
 *
 * @param {FirebaseFirestore.QuerySnapshot} teamsSnap Snapshot atual dos times.
 * @return {TeamSnapshot[]} Times encontrados.
 */
function normalizeTeams(
  teamsSnap: FirebaseFirestore.QuerySnapshot
): TeamSnapshot[] {
  return teamsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name:
        typeof data.name === "string" && data.name.trim() ?
          data.name :
          doc.id,
    };
  });
}

/**
 * Agrega eventos oficiais por jogador antes de finalizar o jogo.
 *
 * @param {FirebaseFirestore.QueryDocumentSnapshot[]} docs Eventos do jogo.
 * @return {Map<string, object>} Estatísticas por jogador.
 */
function aggregateEvents(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): Map<string, {goals: number; assists: number; saves: number}> {
  const aggregated =
    new Map<string, {goals: number; assists: number; saves: number}>();

  for (const eventDoc of docs) {
    const raw = eventDoc.data();
    const playerId =
      (raw.player_id ?? raw.playerId) as string | undefined;
    if (!playerId) continue;

    const type = (raw.type ?? raw.event_type ?? raw.eventType) as
      string | undefined;
    const current =
      aggregated.get(playerId) ??
      {goals: 0, assists: 0, saves: 0};

    if (type === "GOAL") current.goals += 1;
    else if (type === "ASSIST") current.assists += 1;
    else if (type === "SAVE") current.saves += 1;

    aggregated.set(playerId, current);

    // O writer canônico registra a assistência no próprio evento GOAL.
    // Sem esta projeção, finalizar o jogo podia zerar a assistência de um
    // jogador que também tivesse qualquer outro evento na partida.
    const assistedById =
      typeof raw.assisted_by_id === "string" ?
        raw.assisted_by_id :
        typeof raw.assistedById === "string" ?
          raw.assistedById :
          "";
    if (type === "GOAL" && assistedById && assistedById !== playerId) {
      const assisted = aggregated.get(assistedById) ??
        {goals: 0, assists: 0, saves: 0};
      assisted.assists += 1;
      aggregated.set(assistedById, assisted);
    }
  }

  return aggregated;
}

/**
 * Aplica rate limit aos callables de lifecycle.
 *
 * @param {string} uid UID autenticado.
 * @param {string} keyPrefix Prefixo do bucket de rate limit.
 */
async function enforceLifecycleRateLimit(
  uid: string,
  keyPrefix: string
): Promise<void> {
  const {allowed, remaining, resetAt} = await checkRateLimit(uid, {
    maxRequests: 10,
    windowMs: 60 * 1000,
    keyPrefix,
  });

  if (!allowed) {
    const resetInSeconds = Math.ceil(
      (resetAt.getTime() - Date.now()) / 1000
    );
    throw new HttpsError(
      "resource-exhausted",
      // eslint-disable-next-line new-cap
      ERROR_MSGS.RATE_LIMIT_RETRY(resetInSeconds),
      {
        retryAfter: resetInSeconds,
        limit: 10,
        remaining,
      }
    );
  }
}

export const startGameLifecycle = onCall<GameLifecycleRequest>(
  {
    region: FUNCTION_REGION,
    memory: "256MiB",
    enforceAppCheck:
      process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    requireProfileComplete(request);
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }

    const uid = request.auth.uid;
    await enforceLifecycleRateLimit(uid, "game_lifecycle_start");

    const gameId = validateGameId(request.data?.gameId);
    const isAdmin = request.auth.token?.role === "ADMIN";
    const teamsQuery = db().collection("teams")
      .where("game_id", "==", gameId);

    const result = await db().runTransaction(async (tx) => {
      const gameRef = db().collection("games").doc(gameId);
      const [gameSnap, teamsSnap] = await Promise.all([
        tx.get(gameRef),
        tx.get(teamsQuery),
      ]);

      if (!gameSnap.exists) {
        throw new HttpsError("not-found", ERROR_MSGS.GAME_NOT_FOUND);
      }

      const game = gameSnap.data()!;
      if (!isGameManager(game, uid, isAdmin)) {
        throw new HttpsError(
          "permission-denied",
          ERROR_MSGS.OWNER_OR_ADMIN_ONLY
        );
      }

      if (game.status !== "CONFIRMED") {
        throw new HttpsError(
          "failed-precondition",
          "Jogo precisa estar CONFIRMED para iniciar."
        );
      }

      const teams = normalizeTeams(teamsSnap);
      if (teams.length < 2) {
        throw new HttpsError(
          "failed-precondition",
          "O jogo precisa ter pelo menos dois times para iniciar."
        );
      }

      const team1 = teams[0];
      const team2 = teams[1];
      const updates: Record<string, unknown> = {
        status: "LIVE",
        team1_score: 0,
        team2_score: 0,
        updated_at: FieldValue.serverTimestamp(),
        live_started_at: FieldValue.serverTimestamp(),
        lifecycle_updated_by: uid,
        lifecycle_update_source: "callable",
      };

      if (team1) updates.team1_name = team1.name;
      if (team2) updates.team2_name = team2.name;

      tx.update(gameRef, updates);

      // #3942: placar ao vivo por teamId (suporta 2-4 times). Mantém os
      // campos legados team1_id/team2_id/team1_score/team2_score em
      // dual-write para compatibilidade de leitores não atualizados.
      const initialScores: Record<string, number> = {};
      for (const team of teams) {
        initialScores[team.id] = 0;
      }
      const liveScoreRef =
        db().collection("live_scores").doc(gameId);
      tx.set(liveScoreRef, {
        game_id: gameId,
        owner_id: game.owner_id,
        scores: initialScores,
        team1_id: team1?.id ?? "team1",
        team1_score: 0,
        team2_id: team2?.id ?? "team2",
        team2_score: 0,
        started_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      return {
        status: "LIVE",
        team1Id: team1?.id ?? "team1",
        team2Id: team2?.id ?? "team2",
      };
    });

    logger.info("[GAME_LIFECYCLE_START]", {gameId, uid});
    return {success: true, ...result};
  }
);

export const finishGameLifecycle = onCall<GameLifecycleRequest>(
  {
    region: FUNCTION_REGION,
    memory: "256MiB",
    enforceAppCheck:
      process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    requireProfileComplete(request);
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }

    const uid = request.auth.uid;
    await enforceLifecycleRateLimit(uid, "game_lifecycle_finish");

    const gameId = validateGameId(request.data?.gameId);
    const isAdmin = request.auth.token?.role === "ADMIN";

    const gameRef = db().collection("games").doc(gameId);
    const liveScoreRef = db().collection("live_scores").doc(gameId);
    const finalizationId = randomUUID();

    // Barreira serializável: qualquer transação de evento que já leu o jogo
    // precisa terminar antes deste update ou será repetida e verá o lock.
    // O status continua LIVE para não expor um enum transitório aos clientes.
    await db().runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) {
        throw new HttpsError("not-found", ERROR_MSGS.GAME_NOT_FOUND);
      }

      const game = gameSnap.data()!;
      if (!isGameManager(game, uid, isAdmin)) {
        throw new HttpsError(
          "permission-denied",
          ERROR_MSGS.OWNER_OR_ADMIN_ONLY
        );
      }
      const lockStartedAt = game.finalization_started_at;
      const lockStartedAtMs =
        lockStartedAt && typeof lockStartedAt.toMillis === "function" ?
          lockStartedAt.toMillis() :
          null;
      const hasActiveFinalization =
        typeof game.finalization_id === "string" &&
        (
          lockStartedAtMs === null ||
          Date.now() - lockStartedAtMs < 5 * 60 * 1000
        );
      if (
        game.status !== "LIVE" ||
        hasActiveFinalization
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Jogo precisa estar LIVE e sem finalização em andamento."
        );
      }

      tx.update(gameRef, {
        finalization_id: finalizationId,
        finalization_started_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        lifecycle_updated_by: uid,
        lifecycle_update_source: "callable",
      });
    });

    let result: {
      status: string;
      team1Score: number;
      team2Score: number;
      aggregatedPlayers: number;
    };

    try {
      const [eventsSnap, liveScoreSnap] = await Promise.all([
        db().collection("game_events")
          .where("game_id", "==", gameId)
          .limit(501)
          .get(),
        liveScoreRef.get(),
      ]);
      if (eventsSnap.size > 500) {
        throw new HttpsError(
          "resource-exhausted",
          "Jogo excedeu o limite seguro de 500 eventos."
        );
      }

      const aggregated = aggregateEvents(eventsSnap.docs);
      const liveScore = liveScoreSnap.exists ?
        liveScoreSnap.data() :
        undefined;
      // #3942: lê o mapa canônico de placares (com fallback legado) e deriva
      // os campos team1/team2 para persistir no doc final de games (cujas
      // rules continuam exigindo team1_score/team2_score).
      const scoresMap = readScoresMap(liveScore);
      const team1Id =
        typeof liveScore?.team1_id === "string" ? liveScore.team1_id : "";
      const team2Id =
        typeof liveScore?.team2_id === "string" ? liveScore.team2_id : "";
      const team1Score = team1Id ?
        (scoresMap.get(team1Id) ??
          (typeof liveScore?.team1_score === "number" ?
            liveScore.team1_score : 0)) :
        (typeof liveScore?.team1_score === "number" ?
          liveScore.team1_score : 0);
      const team2Score = team2Id ?
        (scoresMap.get(team2Id) ??
          (typeof liveScore?.team2_score === "number" ?
            liveScore.team2_score : 0)) :
        (typeof liveScore?.team2_score === "number" ?
          liveScore.team2_score : 0);

      // Auditoria de consistência: compara o placar do live_scores com a
      // contagem de eventos GOAL no stream. Divergência indica possível
      // corrida entre submit e leitura (eventos lidos fora da transação).
      // Não bloqueia a finalização — apenas registra para investigação.
      // Espelha auto-close-past-games.ts.
      if (liveScore && scoresMap.size > 0) {
        const consistent = isScoreConsistentFromEventStream(
          eventsSnap.docs,
          scoresMap,
        );
        if (!consistent) {
          logger.warn("[GAME_LIFECYCLE_SCORE_INCONSISTENT]", {
            gameId,
            team1Score,
            team2Score,
            eventCount: eventsSnap.size,
          });
        }
      }
      const aggregatedEntries = [...aggregated.entries()].map(
        ([playerId, stats]) => ({
          stats,
          ref: db().collection("confirmations")
            .doc(`${gameId}_${playerId}`),
        })
      );

      result = await db().runTransaction(async (tx) => {
        const [gameSnap, ...confirmationSnaps] = await Promise.all([
          tx.get(gameRef),
          ...aggregatedEntries.map(({ref}) => tx.get(ref)),
        ]);
        const game = gameSnap.data();
        if (
          !gameSnap.exists ||
          game?.status !== "LIVE" ||
          game?.finalization_id !== finalizationId
        ) {
          throw new HttpsError(
            "aborted",
            "A finalização perdeu o lock do jogo. Tente novamente."
          );
        }

        for (let index = 0; index < aggregatedEntries.length; index += 1) {
          const confirmationSnap = confirmationSnaps[index];
          if (
            confirmationSnap?.exists &&
            confirmationSnap.data()?.status === "CONFIRMED"
          ) {
            const {ref, stats} = aggregatedEntries[index];
            tx.set(ref, stats, {merge: true});
          }
        }

        tx.update(gameRef, {
          status: "FINISHED",
          voting_status: "OPEN",
          voting_concluded: false,
          voting_submitted_count: 0,
          team1_score: team1Score,
          team2_score: team2Score,
          updated_at: FieldValue.serverTimestamp(),
          finished_at: FieldValue.serverTimestamp(),
          finalization_id: FieldValue.delete(),
          finalization_started_at: FieldValue.delete(),
          lifecycle_updated_by: uid,
          lifecycle_update_source: "callable",
        });

        if (liveScoreSnap.exists) {
          tx.update(liveScoreRef, {
            finished_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
        }

        return {
          status: "FINISHED",
          team1Score,
          team2Score,
          aggregatedPlayers: aggregated.size,
        };
      });
    } catch (error) {
      // Não deixa o jogo preso com lock se a agregação/finalização falhar.
      await db().runTransaction(async (tx) => {
        const gameSnap = await tx.get(gameRef);
        const game = gameSnap.data();
        if (
          gameSnap.exists &&
          game?.status === "LIVE" &&
          game?.finalization_id === finalizationId
        ) {
          tx.update(gameRef, {
            finalization_id: FieldValue.delete(),
            finalization_started_at: FieldValue.delete(),
            updated_at: FieldValue.serverTimestamp(),
          });
        }
      }).catch((rollbackError) => {
        logger.error("[GAME_LIFECYCLE_FINISH_ROLLBACK_FAILED]", {
          gameId,
          uid,
          rollbackError,
        });
      });
      throw error;
    }

    logger.info("[GAME_LIFECYCLE_FINISH]", {
      gameId,
      uid,
      aggregatedPlayers: result.aggregatedPlayers,
    });
    return {success: true, ...result};
  }
);
