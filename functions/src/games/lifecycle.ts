import {logger} from "firebase-functions";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {db} from "../_db";
import {checkRateLimit} from "../middleware/rate-limiter";
import {requireProfileComplete} from "../middleware/require-profile-complete";

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
 * Busca os times do jogo para inicializar o placar ao vivo.
 *
 * @param {string} gameId ID do jogo.
 * @return {Promise<TeamSnapshot[]>} Times encontrados.
 */
async function fetchTeams(
  gameId: string
): Promise<TeamSnapshot[]> {
  const teamsSnap = await db()
    .collection("teams")
    .where("game_id", "==", gameId)
    .get();

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
    const teams = await fetchTeams(gameId);

    const result = await db().runTransaction(async (tx) => {
      const gameRef = db().collection("games").doc(gameId);
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

      if (game.status !== "CONFIRMED") {
        throw new HttpsError(
          "failed-precondition",
          "Jogo precisa estar CONFIRMED para iniciar."
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

      const liveScoreRef =
        db().collection("live_scores").doc(gameId);
      tx.set(liveScoreRef, {
        game_id: gameId,
        owner_id: game.owner_id,
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

    const [eventsSnap, liveScoreSnap] = await Promise.all([
      db().collection("game_events")
        .where("game_id", "==", gameId)
        .limit(500)
        .get(),
      db().collection("live_scores").doc(gameId).get(),
    ]);
    const aggregated = aggregateEvents(eventsSnap.docs);
    const liveScore = liveScoreSnap.exists ?
      liveScoreSnap.data() :
      undefined;
    const team1Score =
      typeof liveScore?.team1_score === "number" ?
        liveScore.team1_score :
        0;
    const team2Score =
      typeof liveScore?.team2_score === "number" ?
        liveScore.team2_score :
        0;

    const result = await db().runTransaction(async (tx) => {
      const gameRef = db().collection("games").doc(gameId);
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

      if (game.status !== "LIVE") {
        throw new HttpsError(
          "failed-precondition",
          "Jogo precisa estar LIVE para finalizar."
        );
      }

      for (const [playerId, stats] of aggregated.entries()) {
        tx.set(
          db().collection("confirmations").doc(`${gameId}_${playerId}`),
          stats,
          {merge: true}
        );
      }

      tx.update(gameRef, {
        status: "FINISHED",
        team1_score: team1Score,
        team2_score: team2Score,
        updated_at: FieldValue.serverTimestamp(),
        finished_at: FieldValue.serverTimestamp(),
        lifecycle_updated_by: uid,
        lifecycle_update_source: "callable",
      });

      if (liveScoreSnap.exists) {
        tx.update(db().collection("live_scores").doc(gameId), {
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

    logger.info("[GAME_LIFECYCLE_FINISH]", {
      gameId,
      uid,
      aggregatedPlayers: result.aggregatedPlayers,
    });
    return {success: true, ...result};
  }
);
