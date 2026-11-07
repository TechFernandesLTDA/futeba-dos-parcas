 
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
  scoreTeamId: string | null,
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
    // #3942: o time creditado no placar passa a ser identificado por ID
    // (score_team_id), suportando 2-4 times. O campo legado score_field é
    // mantido como null em novos eventos; o caminho de remoção ainda lê
    // score_field para eventos gravados antes desta migração.
    score_team_id: scoreTeamId,
    score_field: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

/**
 * Resolve o ID do time cujo placar deve ser incrementado/decrementado para
 * um evento GOAL. A validação de que o time pertence ao jogo já foi feita
 * pelo snapshot do time (selectedTeamSnap), então aqui apenas retornamos o
 * próprio teamId — suportando 2-4 times em vez dos 2 fixos legados.
 *
 * @param {string} teamId Time do evento (validado contra teams/{gameId}).
 * @return {string} O mesmo teamId, agora elegível para o placar.
 */
function resolveScoreTeamId(teamId: string): string {
  return teamId;
}

/**
 * Lê o mapa canônico de placares `scores: {<teamId>: n}` de um doc de
 * live_scores. Quando o campo `scores` está ausente (docs legados gravados
 * antes de #3942), reconstrói o mapa a partir de team1_id/team2_id e
 * team1_score/team2_score — garantindo migração sem perda de dados e
 * suporte a jogos LIVE já em andamento no momento do deploy.
 *
 * @param {FirebaseFirestore.DocumentData | undefined} data Dados de live_scores.
 * @return {Map<string, number>} Mapa teamId → placar (sempre definido, possivelmente vazio).
 */
export function readScoresMap(
  data?: FirebaseFirestore.DocumentData,
): Map<string, number> {
  const map = new Map<string, number>();
  const rawScores = data?.scores;

  // Caminho canônico: mapa scores presente e não vazio.
  if (
    rawScores &&
    typeof rawScores === "object" &&
    !Array.isArray(rawScores)
  ) {
    for (const [teamId, value] of Object.entries(rawScores)) {
      if (typeof teamId === "string" && teamId.length > 0) {
        const numeric = Number(value);
        map.set(
          teamId,
          Number.isFinite(numeric) && numeric > 0 ?
            Math.floor(numeric) :
            0,
        );
      }
    }
    if (map.size > 0) return map;
  }

  // Fallback legado: reconstitui o mapa a partir de team1/team2.
  const team1Id =
    typeof data?.team1_id === "string" ? data.team1_id : "";
  const team2Id =
    typeof data?.team2_id === "string" ? data.team2_id : "";
  if (team1Id) map.set(team1Id, readCounter(data, "team1_score"));
  if (team2Id) map.set(team2Id, readCounter(data, "team2_score"));
  return map;
}

/**
 * Resolve o time creditado a partir de um evento persistido, suportando
 * eventos novos (score_team_id) e legados (score_field). O fallback final
 * usa o team_id já validado/trimado passado pelo caller.
 *
 * @param {FirebaseFirestore.DocumentData} eventData Dados do game_event.
 * @param {FirebaseFirestore.DocumentData} liveScoreData Dados de live_scores.
 * @param {string} validatedTeamId team_id validado do evento.
 * @return {string | null} teamId creditado, ou null quando não há candidato.
 */
function resolveScoreTeamIdFromEvent(
  eventData: FirebaseFirestore.DocumentData,
  liveScoreData: FirebaseFirestore.DocumentData,
  validatedTeamId: string,
): string | null {
  // Caminho canônico (#3942): teamId explícito no evento.
  const explicit =
    typeof eventData.score_team_id === "string" ?
      eventData.score_team_id :
      "";
  if (explicit) return explicit;

  // Legado: score_field "team1_score"/"team2_score" → team1_id/team2_id.
  const legacyField = eventData.score_field;
  const team1Id =
    typeof liveScoreData.team1_id === "string" ?
      liveScoreData.team1_id :
      "";
  const team2Id =
    typeof liveScoreData.team2_id === "string" ?
      liveScoreData.team2_id :
      "";
  if (legacyField === "team1_score" && team1Id) return team1Id;
  if (legacyField === "team2_score" && team2Id) return team2Id;

  // Fallback final: team_id validado do próprio evento.
  return validatedTeamId || null;
}

/**
 * Constrói o payload de escrita de live_scores combinando o mapa canônico
 * `scores` com os campos legados team1_id/team2_id/team1_score/team2_score
 * (dual-write durante a transição da migração #3942, para que leitores
 * ainda não atualizados continuem funcionando em jogos de 2 times).
 *
 * @param {string} gameId ID do jogo.
 * @param {string} ownerId Dono do jogo.
 * @param {Map<string, number>} scoresMap Mapa canônico teamId → placar.
 * @param {FirebaseFirestore.DocumentData} liveScoreData Snapshot atual.
 * @return {Record<string, unknown>} Payload para tx.set({merge: true}).
 */
function buildLiveScoreWrite(
  gameId: string,
  ownerId: string,
  scoresMap: Map<string, number>,
  liveScoreData: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  const team1Id =
    typeof liveScoreData.team1_id === "string" ?
      liveScoreData.team1_id :
      "";
  const team2Id =
    typeof liveScoreData.team2_id === "string" ?
      liveScoreData.team2_id :
      "";
  const deriveLegacy = (
    teamId: string,
    fallbackField: "team1_score" | "team2_score",
  ): number => {
    if (teamId && scoresMap.has(teamId)) {
      return scoresMap.get(teamId) ?? 0;
    }
    return readCounter(liveScoreData, fallbackField);
  };

  const write: Record<string, unknown> = {
    game_id: gameId,
    owner_id: ownerId,
    scores: Object.fromEntries(scoresMap),
    updated_at: FieldValue.serverTimestamp(),
  };
  // Dual-write legado apenas quando os ids existem no doc (compat reversa).
  if (team1Id) {
    write.team1_id = team1Id;
    write.team1_score = deriveLegacy(team1Id, "team1_score");
  }
  if (team2Id) {
    write.team2_id = team2Id;
    write.team2_score = deriveLegacy(team2Id, "team2_score");
  }
  return write;
}

export function isScoreConsistentFromEventStream(
  docs: Array<{
    data: () => FirebaseFirestore.DocumentData;
  }>,
  scores: Map<string, number>,
): boolean {
  const derived = new Map<string, number>();

  for (const doc of docs) {
    const raw = doc.data() ?? {};
    const type = raw.event_type ?? raw.type;
    const teamId = raw.team_id ?? raw.teamId;

    if (type !== "GOAL" || typeof teamId !== "string") {
      continue;
    }

    derived.set(teamId, (derived.get(teamId) ?? 0) + 1);
  }

  // Times com placar esperado devem bater com a contagem derivada do stream.
  for (const [teamId, expected] of scores) {
    if ((derived.get(teamId) ?? 0) !== expected) {
      return false;
    }
  }
  // Gols para times não presentes no mapa de placar indicam divergência.
  for (const teamId of derived.keys()) {
    if (!scores.has(teamId)) {
      return false;
    }
  }
  return true;
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
        const liveScoreData = liveScoreSnap.data() ?? {};
        // #3942: mapa canônico de placares por teamId (2-4 times), com
        // fallback legado para docs gravados antes da migração.
        const scoresMap = readScoresMap(liveScoreData);
        const team1Id =
          typeof liveScoreData.team1_id === "string" ?
            liveScoreData.team1_id : "";
        const team2Id =
          typeof liveScoreData.team2_id === "string" ?
            liveScoreData.team2_id : "";
        // Deriva team1Score/team2Score do mapa atual (pós-mutação quando
        // chamado após o incremento do GOAL), mantendo compat reversa com
        // os campos legados quando os ids não estão presentes no mapa.
        const deriveLegacyScores = () => ({
          team1Score: team1Id ?
            (scoresMap.get(team1Id) ??
              readCounter(liveScoreData, "team1_score")) :
            readCounter(liveScoreData, "team1_score"),
          team2Score: team2Id ?
            (scoresMap.get(team2Id) ??
              readCounter(liveScoreData, "team2_score")) :
            readCounter(liveScoreData, "team2_score"),
        });

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
            scores: Object.fromEntries(scoresMap),
            ...deriveLegacyScores(),
          };
        }

        confirmedPayload(playerConfirmationSnap);
        if (assistedConfirmationSnap) {
          confirmedPayload(assistedConfirmationSnap);
        }

        const scoreTeamId = payload.eventType === "GOAL" ?
          resolveScoreTeamId(payload.teamId) :
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
            scoreTeamId,
          ),
        );

        if (payload.eventType === "GOAL" && scoreTeamId) {
          scoresMap.set(
            scoreTeamId,
            (scoresMap.get(scoreTeamId) ?? 0) + 1,
          );
          tx.set(
            liveScoreRef,
            buildLiveScoreWrite(
              payload.gameId,
              game.owner_id,
              scoresMap,
              liveScoreData,
            ),
            {merge: true},
          );
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
          scores: Object.fromEntries(scoresMap),
          ...deriveLegacyScores(),
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
      scores: result.scores,
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
        // #3942: resolve o time creditado pelo novo campo score_team_id,
        // com fallback legado (score_field ou team_id) para eventos antigos.
        const scoreTeamId = eventType === "GOAL" ?
          resolveScoreTeamIdFromEvent(eventData, liveScoreData, teamId) :
          null;
        // Mapa canônico (com fallback legado) para decrementar/reler.
        const scoresMap = readScoresMap(liveScoreData);
        const team1Id =
          typeof liveScoreData.team1_id === "string" ?
            liveScoreData.team1_id : "";
        const team2Id =
          typeof liveScoreData.team2_id === "string" ?
            liveScoreData.team2_id : "";

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

        if (scoreTeamId) {
          scoresMap.set(
            scoreTeamId,
            Math.max(0, (scoresMap.get(scoreTeamId) ?? 0) - 1),
          );
          tx.set(
            liveScoreRef,
            buildLiveScoreWrite(
              payload.gameId,
              game.owner_id,
              scoresMap,
              liveScoreData,
            ),
            {merge: true},
          );
        }

        tx.delete(eventRef);

        const team1Score = team1Id ?
          (scoresMap.get(team1Id) ?? readCounter(liveScoreData, "team1_score")) :
          readCounter(liveScoreData, "team1_score");
        const team2Score = team2Id ?
          (scoresMap.get(team2Id) ?? readCounter(liveScoreData, "team2_score")) :
          readCounter(liveScoreData, "team2_score");
        return {
          scores: Object.fromEntries(scoresMap),
          team1Score,
          team2Score,
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
      scores: result.scores,
      team1Score: result.team1Score,
      team2Score: result.team2Score,
    };
  },
);
