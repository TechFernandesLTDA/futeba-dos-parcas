/* eslint-disable require-jsdoc, new-cap */
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {checkRateLimit} from "../middleware/rate-limiter";
import {requireProfileComplete} from "../middleware/require-profile-complete";

const SUPPORTED_EVENT_TYPES = [
  "GOAL",
  "SAVE",
  "YELLOW_CARD",
  "RED_CARD",
] as const;

type SupportedEventType =
  typeof SUPPORTED_EVENT_TYPES[number];

interface SubmitLiveGameEventRequest {
  gameId: string;
  requestId?: string | null;
  eventType: SupportedEventType;
  playerId: string;
  playerName: string;
  teamId: string;
  minute?: number | null;
  assistedById?: string | null;
  assistedByName?: string | null;
}

function validateOptionalRequestId(value: unknown): string | null {
  if (value == null) return null;
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(value)
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.INVALID_VALUE("requestId"),
    );
  }
  return value;
}

interface DeleteLiveGameEventRequest {
  gameId: string;
  eventId: string;
}

interface EventDelta {
  goals?: number;
  assists?: number;
  saves?: number;
  yellow_cards?: number;
  red_cards?: number;
}

function validateId(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > 128 ||
    value.includes("/")
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.FIELD_REQUIRED(field),
    );
  }
  return value.trim();
}

function validatePlayerName(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > 80
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.FIELD_LENGTH_RANGE("playerName", 1, 80),
    );
  }
  return value.trim();
}

function validateOptionalPlayerName(
  value: unknown,
): string | null {
  if (value == null) return null;
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > 80
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.FIELD_LENGTH_RANGE(
        "assistedByName",
        1,
        80,
      ),
    );
  }
  return value.trim();
}

function validateMinute(
  value: unknown,
): number | null {
  if (value == null) return null;
  const minute = Number(value);
  if (
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 300
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.INVALID_VALUE("minute"),
    );
  }
  return minute;
}

function validateEventType(
  value: unknown,
): SupportedEventType {
  if (
    typeof value !== "string" ||
    !SUPPORTED_EVENT_TYPES.includes(
      value as SupportedEventType,
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.ALLOWED_VALUES(
        "eventType",
        SUPPORTED_EVENT_TYPES,
      ),
    );
  }
  return value as SupportedEventType;
}

function isGameManager(
  game: FirebaseFirestore.DocumentData,
  uid: string,
  isAdmin: boolean,
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

async function enforceRateLimit(
  uid: string,
  keyPrefix: string,
): Promise<void> {
  const {allowed, remaining, resetAt} =
    await checkRateLimit(uid, {
      maxRequests: 20,
      windowMs: 60 * 1000,
      keyPrefix,
    });

  if (!allowed) {
    const resetInSeconds = Math.ceil(
      (resetAt.getTime() - Date.now()) / 1000,
    );
    throw new HttpsError(
      "resource-exhausted",
      ERROR_MSGS.RATE_LIMIT_RETRY(resetInSeconds),
      {
        retryAfter: resetInSeconds,
        limit: 20,
        remaining,
      },
    );
  }
}

function confirmedPayload(
  snap: FirebaseFirestore.DocumentSnapshot,
): FirebaseFirestore.DocumentData {
  const data = snap.data() ?? {};
  if (data.status !== "CONFIRMED") {
    throw new HttpsError(
      "failed-precondition",
      "Jogador precisa estar confirmado no jogo.",
    );
  }
  return data;
}

function readCounter(
  data: FirebaseFirestore.DocumentData | undefined,
  field: string,
): number {
  const value = data?.[field];
  return typeof value === "number" &&
      Number.isFinite(value) ?
    value :
    0;
}

function applyDelta(
  tx: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  currentData: FirebaseFirestore.DocumentData | undefined,
  delta: EventDelta,
  base?: Record<string, unknown>,
): void {
  const next: Record<string, number> = {};

  for (const [field, change] of Object.entries(delta)) {
    if (!change) continue;
    // Reversoes nunca devem recriar confirmations/live_player_stats
    // parciais quando o documento relacionado ja foi removido.
    if (!currentData && change < 0) continue;
    next[field] = Math.max(
      0,
      readCounter(currentData, field) + change,
    );
  }

  if (Object.keys(next).length === 0) {
    return;
  }

  if (currentData) {
    tx.update(ref, next);
    return;
  }

  tx.set(ref, {
    ...(base ?? {}),
    ...next,
  }, {merge: true});
}

function isSameIdempotentEvent(
  existing: FirebaseFirestore.DocumentData,
  payload: SubmitLiveGameEventRequest,
  uid: string,
): boolean {
  const existingType = existing.event_type ?? existing.type;
  const existingMinute =
    typeof existing.minute === "number" &&
    Number.isFinite(existing.minute) ?
      existing.minute :
      null;
  const existingAssistedById =
    typeof existing.assisted_by_id === "string" ?
      existing.assisted_by_id :
      null;
  const payloadMinute = payload.minute ?? null;
  const minutesMatch =
    payloadMinute == null ?
      (existingMinute == null || existingMinute === 0) :
      existingMinute === payloadMinute;

  return existing.game_id === payload.gameId &&
    existing.request_id === payload.requestId &&
    existing.created_by === uid &&
    existingType === payload.eventType &&
    existing.player_id === payload.playerId &&
    existing.team_id === payload.teamId &&
    minutesMatch &&
    existingAssistedById === (payload.assistedById ?? null);
}

function validateSubmitPayload(
  data: unknown,
): SubmitLiveGameEventRequest {
  const payload =
    (data ?? {}) as Partial<SubmitLiveGameEventRequest>;
  const eventType = validateEventType(payload.eventType);
  const playerId = validateId(payload.playerId, "playerId");
  const assistedById =
    payload.assistedById == null ?
      null :
      validateId(payload.assistedById, "assistedById");
  const assistedByName =
    validateOptionalPlayerName(payload.assistedByName);

  if (
    eventType !== "GOAL" &&
    (assistedById || assistedByName)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Assistência só pode ser informada em eventos GOAL.",
    );
  }
  if (assistedById && assistedById === playerId) {
    throw new HttpsError(
      "invalid-argument",
      "O autor do gol não pode assistir a si próprio.",
    );
  }

  return {
    gameId: validateId(payload.gameId, "gameId"),
    requestId: validateOptionalRequestId(payload.requestId),
    eventType,
    playerId,
    playerName: validatePlayerName(payload.playerName),
    teamId: validateId(payload.teamId, "teamId"),
    minute: validateMinute(payload.minute),
    assistedById,
    assistedByName,
  };
}

function validateDeletePayload(
  data: unknown,
): DeleteLiveGameEventRequest {
  const payload =
    (data ?? {}) as Partial<DeleteLiveGameEventRequest>;
  return {
    gameId: validateId(payload.gameId, "gameId"),
    eventId: validateId(payload.eventId, "eventId"),
  };
}

function buildEventPayload(
  eventId: string,
  request: SubmitLiveGameEventRequest,
  createdBy: string,
  playerPosition: string | null,
  scoreField: "team1_score" | "team2_score" | null,
): Record<string, unknown> {
  return {
    id: eventId,
    game_id: request.gameId,
    event_type: request.eventType,
    type: request.eventType,
    player_id: request.playerId,
    player_name: request.playerName,
    team_id: request.teamId,
    assisted_by_id:
      request.assistedById ?? null,
    assisted_by_name:
      request.assistedByName ?? null,
    ...(request.minute == null ? {} : {minute: request.minute}),
    created_by: createdBy,
    recorded_by: createdBy,
    player_position: playerPosition,
    request_id: request.requestId ?? null,
    score_field: scoreField,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

function resolveScoreField(
  teamId: string,
  team1Id: string,
  team2Id: string,
): "team1_score" | "team2_score" {
  if (teamId === team1Id) return "team1_score";
  if (teamId === team2Id) return "team2_score";

  throw new HttpsError(
    "failed-precondition",
    "Time do evento não bate com o placar ao vivo.",
  );
}

export function isScoreConsistentFromEventStream(
  docs: Array<{
    data: () => FirebaseFirestore.DocumentData;
  }>,
  team1Id: string,
  team2Id: string,
  team1Score: number,
  team2Score: number,
): boolean {
  let derivedTeam1 = 0;
  let derivedTeam2 = 0;

  for (const doc of docs) {
    const raw = doc.data() ?? {};
    const type = raw.event_type ?? raw.type;
    const teamId = raw.team_id ?? raw.teamId;

    if (type !== "GOAL" || typeof teamId !== "string") {
      continue;
    }

    if (teamId === team1Id) {
      derivedTeam1 += 1;
    } else if (teamId === team2Id) {
      derivedTeam2 += 1;
    }
  }

  return (
    derivedTeam1 === team1Score &&
    derivedTeam2 === team2Score
  );
}

export const submitLiveGameEvent = onCall<
  SubmitLiveGameEventRequest
>(
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
      throw new HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED,
      );
    }

    const uid = request.auth.uid;
    const isAdmin = request.auth.token?.role === "ADMIN";
    await enforceRateLimit(uid, "live_game_event_submit");

    const payload = validateSubmitPayload(request.data);
    const gameRef = db().collection("games")
      .doc(payload.gameId);
    const selectedTeamRef = db().collection("teams")
      .doc(payload.teamId);
    const playerConfirmationRef = db()
      .collection("confirmations")
      .doc(`${payload.gameId}_${payload.playerId}`);
    const assistedConfirmationRef =
      payload.assistedById ?
        db()
          .collection("confirmations")
          .doc(
            `${payload.gameId}_${payload.assistedById}`,
          ) :
        null;
    const liveScoreRef = db()
      .collection("live_scores")
      .doc(payload.gameId);
    const playerStatsRef = db()
      .collection("live_player_stats")
      .doc(`${payload.gameId}_${payload.playerId}`);
    const assistedStatsRef =
      payload.assistedById ?
        db()
          .collection("live_player_stats")
          .doc(
            `${payload.gameId}_${payload.assistedById}`,
          ) :
        null;
    const callerConfirmationRef = db()
      .collection("confirmations")
      .doc(`${payload.gameId}_${uid}`);
    const eventRef = payload.requestId ?
      db().collection("game_events")
        .doc(`${payload.gameId}_${payload.requestId}`) :
      db().collection("game_events").doc();
    const result = await db().runTransaction(
      async (tx) => {
        const [
          gameSnap,
          playerConfirmationSnap,
          playerStatsSnap,
          callerConfirmationSnap,
          assistedConfirmationSnap,
          assistedStatsSnap,
          existingEventSnap,
          liveScoreSnap,
          selectedTeamSnap,
        ] = await Promise.all([
          tx.get(gameRef),
          tx.get(playerConfirmationRef),
          tx.get(playerStatsRef),
          tx.get(callerConfirmationRef),
          assistedConfirmationRef ?
            tx.get(assistedConfirmationRef) :
            Promise.resolve(null),
          assistedStatsRef ?
            tx.get(assistedStatsRef) :
            Promise.resolve(null),
          payload.requestId ?
            tx.get(eventRef) :
            Promise.resolve(null),
          tx.get(liveScoreRef),
          tx.get(selectedTeamRef),
        ]);

        if (!gameSnap.exists) {
          throw new HttpsError(
            "not-found",
            ERROR_MSGS.GAME_NOT_FOUND,
          );
        }

        const game = gameSnap.data()!;
        if (
          game.status !== "LIVE" ||
          typeof game.finalization_id === "string"
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Eventos críticos só podem ser registrados em jogos LIVE.",
          );
        }

        // Cap ativo durante o LIVE: finishGameLifecycle rejeita jogos com mais
        // de 500 eventos, o que deixaria a finalização presa sem feedback. Ao
        // rejeitar novos eventos no limite, o gestor precisa deletar eventos
        // antes de continuar, evitando o deadlock.
        const eventCountSnap = await tx.get(
          db().collection("game_events")
            .where("game_id", "==", payload.gameId)
            .limit(501)
        );
        if (eventCountSnap.size >= 500) {
          throw new HttpsError(
            "resource-exhausted",
            "Limite de 500 eventos por jogo atingido. Finalize o jogo ou remova eventos antigos.",
          );
        }

        const callerConfirmed =
          callerConfirmationSnap.exists &&
          callerConfirmationSnap.data()?.status ===
            "CONFIRMED";
        if (
          !isGameManager(game, uid, isAdmin) &&
          !callerConfirmed
        ) {
          throw new HttpsError(
            "permission-denied",
            "Apenas gestor do jogo ou jogador confirmado pode registrar eventos.",
          );
        }

        const liveScoreData = liveScoreSnap.data() ?? {};
        const selectedTeamData = selectedTeamSnap.data() ?? {};
        const selectedTeamGameId =
          selectedTeamData.game_id ?? selectedTeamData.gameId;
        const rawPlayerIds = Array.isArray(selectedTeamData.player_ids) ?
          selectedTeamData.player_ids :
          Array.isArray(selectedTeamData.playerIds) ?
            selectedTeamData.playerIds : [];
        if (
          !selectedTeamSnap.exists ||
          selectedTeamGameId !== payload.gameId
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Time inválido para este jogo.",
          );
        }
        if (!rawPlayerIds.includes(payload.playerId)) {
          throw new HttpsError(
            "failed-precondition",
            "Jogador não pertence ao time informado.",
          );
        }
        if (
          payload.assistedById &&
          !rawPlayerIds.includes(payload.assistedById)
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Assistente não pertence ao mesmo time.",
          );
        }
        const team1Id =
          typeof liveScoreData.team1_id === "string" ?
            liveScoreData.team1_id : "";
        const team2Id =
          typeof liveScoreData.team2_id === "string" ?
            liveScoreData.team2_id : "";
        let team1Score = readCounter(liveScoreData, "team1_score");
        let team2Score = readCounter(liveScoreData, "team2_score");

        if (existingEventSnap?.exists) {
          const existing = existingEventSnap.data() ?? {};
          if (!isSameIdempotentEvent(existing, payload, uid)) {
            throw new HttpsError(
              "already-exists",
              "requestId já utilizado com outro conteúdo.",
            );
          }

          return {
            eventId: eventRef.id,
            duplicate: true,
            team1Score,
            team2Score,
          };
        }

        confirmedPayload(playerConfirmationSnap);
        if (assistedConfirmationSnap) {
          confirmedPayload(assistedConfirmationSnap);
        }

        const scoreField = payload.eventType === "GOAL" ?
          resolveScoreField(payload.teamId, team1Id, team2Id) :
          null;

        tx.set(
          eventRef,
          buildEventPayload(
            eventRef.id,
            payload,
            uid,
            typeof playerConfirmationSnap.data()?.position === "string" ?
              playerConfirmationSnap.data()?.position :
              null,
            scoreField,
          ),
        );

        if (scoreField) {
          if (scoreField === "team1_score") team1Score += 1;
          else team2Score += 1;
          tx.set(liveScoreRef, {
            game_id: payload.gameId,
            owner_id: game.owner_id,
            team1_id: team1Id,
            team2_id: team2Id,
            [scoreField]: scoreField === "team1_score" ?
              team1Score : team2Score,
            updated_at:
              FieldValue.serverTimestamp(),
          }, {merge: true});
        }

        const playerDelta: EventDelta = {
          goals:
            payload.eventType === "GOAL" ? 1 : 0,
          saves:
            payload.eventType === "SAVE" ? 1 : 0,
          yellow_cards:
            payload.eventType === "YELLOW_CARD" ?
              1 :
              0,
          red_cards:
            payload.eventType === "RED_CARD" ? 1 : 0,
        };

        applyDelta(
          tx,
          playerStatsRef,
          playerStatsSnap.data(),
          playerDelta,
          {
            id: `${payload.gameId}_${payload.playerId}`,
            game_id: payload.gameId,
            player_id: payload.playerId,
            player_name: payload.playerName,
            team_id: payload.teamId,
            is_playing: true,
          },
        );

        applyDelta(
          tx,
          playerConfirmationRef,
          playerConfirmationSnap.data(),
          playerDelta,
        );

        if (
          payload.eventType === "GOAL" &&
          payload.assistedById &&
          assistedConfirmationRef &&
          assistedStatsRef
        ) {
          const assistDelta: EventDelta = {
            assists: 1,
          };

          applyDelta(
            tx,
            assistedStatsRef,
            assistedStatsSnap?.data(),
            assistDelta,
            {
              id: `${payload.gameId}_${payload.assistedById}`,
              game_id: payload.gameId,
              player_id: payload.assistedById,
              player_name:
                payload.assistedByName ?? "",
              team_id: payload.teamId,
              is_playing: true,
            },
          );

          applyDelta(
            tx,
            assistedConfirmationRef,
            assistedConfirmationSnap?.data(),
            assistDelta,
          );
        }

        return {
          eventId: eventRef.id,
          duplicate: false,
          team1Score,
          team2Score,
        };
      },
    );

    logger.info(
      "[LIVE_GAME_EVENT_SUBMIT]",
      {
        gameId: payload.gameId,
        eventType: payload.eventType,
        uid,
        playerId: payload.playerId,
        eventId: result.eventId,
      },
    );

    return {
      success: true,
      eventId: result.eventId,
      team1Score: result.team1Score,
      team2Score: result.team2Score,
      duplicate: result.duplicate,
    };
  },
);

export const deleteLiveGameEvent = onCall<
  DeleteLiveGameEventRequest
>(
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
      throw new HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED,
      );
    }

    const uid = request.auth.uid;
    const isAdmin = request.auth.token?.role === "ADMIN";
    await enforceRateLimit(uid, "live_game_event_delete");

    const payload = validateDeletePayload(request.data);
    const gameRef = db().collection("games")
      .doc(payload.gameId);
    const eventRef = db()
      .collection("game_events")
      .doc(payload.eventId);
    const liveScoreRef = db()
      .collection("live_scores")
      .doc(payload.gameId);
    const callerConfirmationRef = db()
      .collection("confirmations")
      .doc(`${payload.gameId}_${uid}`);
    const result = await db().runTransaction(
      async (tx) => {
        const [
          gameSnap,
          eventSnap,
          callerConfirmationSnap,
          liveScoreSnap,
        ] = await Promise.all([
          tx.get(gameRef),
          tx.get(eventRef),
          tx.get(callerConfirmationRef),
          tx.get(liveScoreRef),
        ]);

        if (!gameSnap.exists) {
          throw new HttpsError(
            "not-found",
            ERROR_MSGS.GAME_NOT_FOUND,
          );
        }
        if (!eventSnap.exists) {
          throw new HttpsError(
            "not-found",
            ERROR_MSGS.NOT_FOUND("Evento"),
          );
        }

        const game = gameSnap.data()!;
        if (
          game.status !== "LIVE" ||
          typeof game.finalization_id === "string"
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Só é permitido remover eventos enquanto o jogo está LIVE.",
          );
        }

        const callerConfirmed =
          callerConfirmationSnap.exists &&
          callerConfirmationSnap.data()?.status ===
            "CONFIRMED";
        const eventData = eventSnap.data() ?? {};
        if (
          (eventData.game_id ?? eventData.gameId) !==
          payload.gameId
        ) {
          throw new HttpsError(
            "not-found",
            ERROR_MSGS.NOT_FOUND("Evento"),
          );
        }
        const createdBy =
          typeof eventData.created_by === "string" ?
            eventData.created_by :
            "";
        if (
          !isGameManager(game, uid, isAdmin) &&
          !(callerConfirmed && createdBy === uid)
        ) {
          throw new HttpsError(
            "permission-denied",
            "Você não pode remover este evento.",
          );
        }

        const eventType =
          validateEventType(
            eventData.event_type ?? eventData.type,
          );
        const playerId = validateId(
          eventData.player_id,
          "playerId",
        );
        const teamId = validateId(
          eventData.team_id,
          "teamId",
        );
        const assistedById =
          typeof eventData.assisted_by_id === "string" &&
            eventData.assisted_by_id.trim().length > 0 ?
            eventData.assisted_by_id.trim() :
            null;

        const liveScoreData = liveScoreSnap.data() ?? {};
        const team1Id =
          typeof liveScoreData.team1_id === "string" ?
            liveScoreData.team1_id : "";
        const team2Id =
          typeof liveScoreData.team2_id === "string" ?
            liveScoreData.team2_id : "";

        const storedScoreField = eventData.score_field;
        const scoreField = eventType === "GOAL" ?
          storedScoreField === "team1_score" ||
          storedScoreField === "team2_score" ?
            storedScoreField :
            resolveScoreField(teamId, team1Id, team2Id) :
          null;

        const playerConfirmationRef = db()
          .collection("confirmations")
          .doc(`${payload.gameId}_${playerId}`);
        const playerStatsRef = db()
          .collection("live_player_stats")
          .doc(`${payload.gameId}_${playerId}`);
        const assistedConfirmationRef =
          assistedById ?
            db()
              .collection("confirmations")
              .doc(
                `${payload.gameId}_${assistedById}`,
              ) :
            null;
        const assistedStatsRef =
          assistedById ?
            db()
              .collection("live_player_stats")
              .doc(
                `${payload.gameId}_${assistedById}`,
              ) :
            null;

        const [
          playerConfirmationSnap,
          playerStatsSnap,
          assistedConfirmationSnap,
          assistedStatsSnap,
        ] = await Promise.all([
          tx.get(playerConfirmationRef),
          tx.get(playerStatsRef),
          assistedConfirmationRef ?
            tx.get(assistedConfirmationRef) :
            Promise.resolve(null),
          assistedStatsRef ?
            tx.get(assistedStatsRef) :
            Promise.resolve(null),
        ]);

        const playerDelta: EventDelta = {
          goals:
            eventType === "GOAL" ? -1 : 0,
          saves:
            eventType === "SAVE" ? -1 : 0,
          yellow_cards:
            eventType === "YELLOW_CARD" ? -1 : 0,
          red_cards:
            eventType === "RED_CARD" ? -1 : 0,
        };

        applyDelta(
          tx,
          playerStatsRef,
          playerStatsSnap.data(),
          playerDelta,
        );
        applyDelta(
          tx,
          playerConfirmationRef,
          playerConfirmationSnap.data(),
          playerDelta,
        );

        if (
          eventType === "GOAL" &&
          assistedById &&
          assistedConfirmationRef &&
          assistedStatsRef
        ) {
          const assistDelta: EventDelta = {
            assists: -1,
          };
          applyDelta(
            tx,
            assistedStatsRef,
            assistedStatsSnap?.data(),
            assistDelta,
          );
          applyDelta(
            tx,
            assistedConfirmationRef,
            assistedConfirmationSnap?.data(),
            assistDelta,
          );
        }

        if (scoreField) {
          const nextScore = Math.max(
            0,
            readCounter(liveScoreData, scoreField) - 1,
          );
          tx.set(liveScoreRef, {
            game_id: payload.gameId,
            owner_id: game.owner_id,
            team1_id: team1Id,
            team2_id: team2Id,
            [scoreField]: nextScore,
            updated_at:
              FieldValue.serverTimestamp(),
          }, {merge: true});
        }

        tx.delete(eventRef);

        return {
          team1Score: scoreField === "team1_score" ?
            Math.max(0, readCounter(liveScoreData, "team1_score") - 1) :
            readCounter(liveScoreData, "team1_score"),
          team2Score: scoreField === "team2_score" ?
            Math.max(0, readCounter(liveScoreData, "team2_score") - 1) :
            readCounter(liveScoreData, "team2_score"),
        };
      },
    );

    logger.info(
      "[LIVE_GAME_EVENT_DELETE]",
      {
        gameId: payload.gameId,
        eventId: payload.eventId,
        uid,
      },
    );

    return {
      success: true,
      eventId: payload.eventId,
      team1Score: result.team1Score,
      team2Score: result.team2Score,
    };
  },
);
