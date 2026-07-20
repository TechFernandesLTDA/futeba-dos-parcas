import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {randomUUID} from "node:crypto";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";

type JoinPosition = "GOALKEEPER" | "FIELD";

export const JOIN_PUBLIC_GAME_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  keyPrefix: "join_public_game",
};

interface ConfirmGamePresenceRequest {
  gameId: string;
  position: JoinPosition;
  isCasualPlayer: boolean;
}

interface ConfirmGamePresenceResult {
  alreadyConfirmed: boolean;
  confirmationId: string;
  position: JoinPosition;
  expectedPayment: number;
  expectedPaymentCents: number;
}

export const CONFIRM_GAME_PRESENCE_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  keyPrefix: "confirm_game_presence",
};

const VERIFICATION_GRACE_END_MS = Date.UTC(2026, 7, 3);

/**
 * Valida que um valor é uma string não vazia.
 *
 * @param {unknown} value valor cru
 * @return {boolean} true se string útil
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Converte payload de callable para o shape usado internamente.
 *
 * @param {unknown} data payload cru
 * @return {JoinPublicGameRequest} payload normalizado
 */
function parseConfirmGamePresenceRequest(
  data: unknown
): ConfirmGamePresenceRequest {
  if (
    !isRecord(data) ||
    !isNonEmptyString(data.gameId) ||
    data.gameId.trim().length > 128 ||
    data.gameId.includes("/")
  ) {
    throw new HttpsError("invalid-argument", "gameId obrigatório.");
  }

  if (data.position !== "GOALKEEPER" && data.position !== "FIELD") {
    throw new HttpsError("invalid-argument", "Posição inválida.");
  }
  if (
    data.isCasualPlayer !== undefined &&
    typeof data.isCasualPlayer !== "boolean"
  ) {
    throw new HttpsError("invalid-argument", "isCasualPlayer inválido.");
  }

  return {
    gameId: data.gameId.trim(),
    position: data.position,
    isCasualPlayer: data.isCasualPlayer === true,
  };
}

/**
 * Exige a claim de verificação depois da janela de compatibilidade.
 * @param {Record<string, unknown>} token Custom claims do caller.
 */
function assertVerifiedForConfirmation(
  token: Record<string, unknown>
): void {
  if (token.verified !== true && Date.now() >= VERIFICATION_GRACE_END_MS) {
    throw new HttpsError(
      "permission-denied",
      "Verificação necessária para confirmar presença."
    );
  }
}

/**
 * Aplica rate limit por usuario antes da entrada em jogo publico.
 *
 * @param {string} uid Usuario autenticado.
 * @param {object} rateLimitConfig Limite aplicavel ao callable.
 */
async function assertConfirmationRateLimit(
  uid: string,
  rateLimitConfig: typeof JOIN_PUBLIC_GAME_RATE_LIMIT
): Promise<void> {
  const rateLimit = await checkRateLimit(uid, rateLimitConfig);
  if (rateLimit.allowed) return;

  const retryAfter = Math.max(
    1,
    Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
  );
  throw new HttpsError(
    "resource-exhausted",
    `Muitas tentativas. Tente novamente em ${retryAfter} segundos.`,
    {retryAfter}
  );
}

/**
 * Converte numero Firestore em inteiro nao negativo configurado.
 * Retorna null quando o limite nao existe no documento legado.
 *
 * @param {unknown} value Valor cru.
 * @return {number | null} Limite configurado.
 */
function configuredLimit(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ?
    Math.floor(value) :
    null;
}

/**
 * Normaliza posicoes legadas LINE/FIELD para o contrato do callable.
 *
 * @param {unknown} value Posicao crua.
 * @return {JoinPosition} Posicao normalizada.
 */
function normalizePosition(value: unknown): JoinPosition {
  return value === "GOALKEEPER" ? "GOALKEEPER" : "FIELD";
}

/**
 * Calcula valor individual em centavos usando a mesma regra da Web.
 *
 * @param {Record<string, unknown>} game Dados do jogo.
 * @return {{amount: number, cents: number}} Valor normalizado.
 */
export function resolveConfirmationPayment(
  game: Record<string, unknown>
): {amount: number; cents: number} {
  const totalCost = Number(game.total_cost ?? game.totalCost ?? 0);
  const dailyPrice = Number(game.daily_price ?? game.dailyPrice ?? 0);
  const maxPlayers = configuredLimit(game.max_players ?? game.maxPlayers);
  const manualOverride =
    game.price_manual_override === true || game.priceManualOverride === true;

  let amount = 0;
  if (Number.isFinite(totalCost) && totalCost > 0 &&
      maxPlayers !== null && maxPlayers > 0 && !manualOverride) {
    amount = totalCost / maxPlayers;
  } else if (Number.isFinite(dailyPrice) && dailyPrice > 0) {
    amount = dailyPrice;
  }

  const cents = Math.round(amount * 100);
  return {amount: cents / 100, cents};
}

/**
 * Converte datas Firestore/JS/ISO para milissegundos.
 *
 * @param {unknown} value valor de data
 * @return {number | null} timestamp em ms, se válido
 */
function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (isRecord(value) && typeof value.toMillis === "function") {
    return (value.toMillis as () => number)();
  }
  if (isRecord(value) && typeof value.toDate === "function") {
    return (value.toDate as () => Date)().getTime();
  }
  return null;
}

/**
 * Nome público seguro vindo do token Auth.
 *
 * @param {unknown} token token Auth callable
 * @return {string} nome para confirmação
 */
function publicNameFromToken(token: unknown): string {
  if (!isRecord(token)) return "Jogador";
  const name = token.name;
  return isNonEmptyString(name) ? name : "Jogador";
}

/**
 * Foto pública segura vinda do token Auth.
 *
 * @param {unknown} token token Auth callable
 * @return {string | null} URL da foto
 */
function publicPhotoFromToken(token: unknown): string | null {
  if (!isRecord(token)) return null;
  const picture = token.picture;
  return isNonEmptyString(picture) ? picture : null;
}

/**
 * Resolve quais status consomem capacidade para entrada publica.
 *
 * Jogos publicos recorrentes podem nascer com convites PENDING para todo o
 * grupo. Nessa configuracao, PENDING e convite, nao ocupacao confirmada.
 *
 * @param {Record<string, unknown>} game Dados do jogo.
 * @return {string[]} Status que contam contra max_players.
 */
export function getPublicCapacityStatuses(
  game: Record<string, unknown>
): string[] {
  const visibility = game.visibility;
  const isLegacyPublic = game.is_public === true && !visibility;
  const isPublic =
    visibility === "PUBLIC_OPEN" || isLegacyPublic;
  const recurrence = game.recurrence;
  const isRecurring =
    typeof recurrence === "string" && recurrence !== "none";

  return isPublic && isRecurring ?
    ["CONFIRMED"] :
    ["CONFIRMED", "PENDING"];
}

/**
 * Reconhece somente os contratos públicos suportados pelo produto.
 * @param {Record<string, unknown>} game Documento atual do jogo.
 * @return {boolean} Se o jogo aceita participantes externos ao grupo.
 */
function isGenuinelyPublic(game: Record<string, unknown>): boolean {
  return game.visibility === "PUBLIC_OPEN" ||
    (game.is_public === true && !game.visibility);
}

/**
 * Garante que um valor pode ser usado como segmento de documento.
 * @param {unknown} value Valor bruto.
 * @return {boolean} Se e um ID simples.
 */
function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= 128 && !value.includes("/");
}

/**
 * Reserva capacidade e confirma presenca na mesma transaction. A escrita em
 * games serializa tentativas concorrentes no mesmo jogo; a query e reexecutada
 * depois de conflitos, evitando phantom overbooking entre confirmation IDs.
 *
 * @param {object} input Contexto validado da confirmacao.
 * @return {Promise<ConfirmGamePresenceResult>} Confirmacao persistida.
 */
async function confirmGamePresenceTransactional(input: {
  uid: string;
  authToken: unknown;
  payload: ConfirmGamePresenceRequest;
  requirePublicGame: boolean;
  source: "canonical" | "public_game";
}): Promise<ConfirmGamePresenceResult> {
  const {uid, authToken, payload, requirePublicGame, source} = input;
  const gameRef = db().doc(`games/${payload.gameId}`);
  const confirmationId = `${payload.gameId}_${uid}`;
  const confirmationRef = db().doc(`confirmations/${confirmationId}`);
  // Query by user_id to support both the canonical `{uid}` document and
  // legacy entries created with random IDs by older Web/Android clients.
  const waitlistQuery = db()
    .collection(`games/${payload.gameId}/waitlist`)
    .where("user_id", "==", uid)
    .limit(10);
  const capacitySyncToken = randomUUID();

  return db().runTransaction(async (tx) => {
    const [gameSnap, existingSnap, waitlistSnap] = await Promise.all([
      tx.get(gameRef),
      tx.get(confirmationRef),
      tx.get(waitlistQuery),
    ]);
    if (!gameSnap.exists) {
      throw new HttpsError("not-found", "Jogo não encontrado.");
    }

    const game = gameSnap.data() ?? {};
    const status = game.status;
    if (status !== "SCHEDULED" && status !== "CONFIRMED") {
      throw new HttpsError(
        "failed-precondition",
        "Este jogo não aceita novas confirmações."
      );
    }

    const isPublicGame = isGenuinelyPublic(game);
    if (requirePublicGame) {
      if (!isPublicGame) {
        throw new HttpsError(
          "permission-denied",
          "Este jogo não está aberto ao público."
        );
      }
    }

    const startsAt = toMillis(game.dateTime ?? game.date_time);
    if (!startsAt || startsAt <= Date.now()) {
      throw new HttpsError(
        "failed-precondition",
        "Este jogo já começou ou expirou."
      );
    }

    const existing = existingSnap.exists ? existingSnap.data() ?? {} : {};
    const existingStatus = existing.status;
    const existingPosition = normalizePosition(existing.position);

    const rawGroupId = game.group_id ?? game.groupId;
    const groupId = isSafeId(rawGroupId) ? rawGroupId : "";
    let isActiveMember = false;
    if (groupId) {
      const [memberSnap, blockedSnap] = await Promise.all([
        tx.get(db().doc(`groups/${groupId}/members/${uid}`)),
        tx.get(db().doc(`groups/${groupId}/blocked_players/${uid}`)),
      ]);
      if (blockedSnap.exists) {
        throw new HttpsError(
          "permission-denied",
          "Você está bloqueado neste grupo."
        );
      }
      if (memberSnap.exists) {
        const membership = memberSnap.data() ?? {};
        if (membership.user_id !== uid || membership.status !== "ACTIVE") {
          throw new HttpsError(
            "permission-denied",
            "Seu vínculo com este grupo não permite confirmar presença."
          );
        }
        isActiveMember = true;
      }
    }

    const hasInvitation = existingSnap.exists &&
      ["PENDING", "WAITLIST", "CONFIRMED"].includes(String(existingStatus));
    const isOwner = game.owner_id === uid || game.ownerId === uid;
    if (!isActiveMember && !hasInvitation && !isOwner && !isPublicGame) {
      throw new HttpsError(
        "permission-denied",
        "Você precisa pertencer ao grupo ou possuir um convite para confirmar presença."
      );
    }

    const payment = resolveConfirmationPayment(game);
    if (existingStatus === "CONFIRMED" &&
        existingPosition === payload.position) {
      const existingAmount = Number(existing.expected_payment);
      const existingCents = Number(existing.expected_payment_cents);
      return {
        alreadyConfirmed: true,
        confirmationId,
        position: payload.position,
        expectedPayment: Number.isFinite(existingAmount) ?
          existingAmount : payment.amount,
        expectedPaymentCents: Number.isFinite(existingCents) ?
          existingCents : payment.cents,
      };
    }

    const capacityStatuses = requirePublicGame ?
      getPublicCapacityStatuses(game) :
      ["CONFIRMED"];
    const confirmations = db()
      .collection("confirmations")
      .where("game_id", "==", payload.gameId);
    const capacityQuery = capacityStatuses.length === 1 ?
      confirmations.where("status", "==", capacityStatuses[0]) :
      confirmations.where("status", "in", capacityStatuses);
    const capacitySnap = await tx.get(capacityQuery);

    const existingOccupiesCapacity =
      capacityStatuses.includes(String(existingStatus));
    const nextOccupied = capacitySnap.size +
      (existingOccupiesCapacity ? 0 : 1);
    const confirmedDocs = capacitySnap.docs.filter(
      (doc) => doc.data().status === "CONFIRMED"
    );
    const wasConfirmed = existingStatus === "CONFIRMED";
    const nextPlayersCount = confirmedDocs.length + (wasConfirmed ? 0 : 1);
    const confirmedGoalkeepers = confirmedDocs.filter(
      (doc) => normalizePosition(doc.data().position) === "GOALKEEPER"
    ).length;
    const nextGoalkeepersCount = confirmedGoalkeepers -
      (wasConfirmed && existingPosition === "GOALKEEPER" ? 1 : 0) +
      (payload.position === "GOALKEEPER" ? 1 : 0);

    const maxPlayers = configuredLimit(game.max_players ?? game.maxPlayers);
    if (maxPlayers !== null && nextOccupied > maxPlayers) {
      throw new HttpsError(
        "resource-exhausted",
        "Este jogo já está lotado."
      );
    }

    const maxGoalkeepers = configuredLimit(
      game.max_goalkeepers ?? game.maxGoalkeepers
    );
    if (maxGoalkeepers !== null &&
        nextGoalkeepersCount > maxGoalkeepers) {
      throw new HttpsError(
        "resource-exhausted",
        "As vagas de goleiro já foram preenchidas."
      );
    }

    const serverTs = FieldValue.serverTimestamp();
    const isLastMinuteWindow =
      startsAt - Date.now() < 24 * 60 * 60 * 1000;
    const gameHasVacancy =
      maxPlayers === null ||
      confirmedDocs.length < maxPlayers;
    const promotedWaitlistDoc = waitlistSnap.docs.find((doc) => {
      const entry = doc.data();
      const status = String(entry.status ?? "");
      const promotionTimestamp =
        entry.promoted_at ?? entry.notified_at;
      return (
        status === "PROMOTED" ||
        status === "NOTIFIED"
      ) && Boolean(promotionTimestamp);
    });
    const promotedWaitlistData =
      promotedWaitlistDoc?.data() ?? {};
    const wasWaitlistPromoted =
      promotedWaitlistDoc !== undefined ||
      existingStatus === "WAITLIST";
    const waitlistPromotedAt =
      promotedWaitlistData.promoted_at ??
      promotedWaitlistData.notified_at ??
      (existingStatus === "WAITLIST" ? serverTs : null);
    const confirmationData: Record<string, unknown> = {
      id: confirmationId,
      game_id: payload.gameId,
      user_id: uid,
      user_name: publicNameFromToken(authToken),
      user_photo: publicPhotoFromToken(authToken),
      position: payload.position,
      status: "CONFIRMED",
      // Contrato explícito de cartões: o pipeline de Fair Play é fail-closed
      // e só concede o bônus quando ambos os campos server-owned existem.
      yellow_cards: 0,
      red_cards: 0,
      is_casual_player: payload.isCasualPlayer,
      is_guest: false,
      confirmed_at: serverTs,
      updated_at: serverTs,
      source,
      capacity_sync_token: capacitySyncToken,
      was_waitlist_promoted: wasWaitlistPromoted,
      waitlist_promoted_at:
        wasWaitlistPromoted ? waitlistPromotedAt : null,
      last_minute_saver_eligible:
        isLastMinuteWindow && gameHasVacancy,
    };
    if (promotedWaitlistDoc &&
        promotedWaitlistData.status !== "PROMOTED") {
      tx.update(promotedWaitlistDoc.ref, {
        status: "PROMOTED",
        promoted_at: serverTs,
      });
    }
    if (!existingSnap.exists) {
      confirmationData.payment_status = "PENDING";
      confirmationData.partial_payment = 0;
      confirmationData.expected_payment = payment.amount;
      confirmationData.expected_payment_cents = payment.cents;
      confirmationData.confirmation_order = capacitySnap.size + 1;
      confirmationData.created_at = serverTs;
    } else {
      if (typeof existing.expected_payment !== "number") {
        confirmationData.expected_payment = payment.amount;
      }
      if (typeof existing.expected_payment_cents !== "number") {
        confirmationData.expected_payment_cents = payment.cents;
      }
    }

    tx.update(gameRef, {
      players_count: nextPlayersCount,
      goalkeepers_count: nextGoalkeepersCount,
      updated_at: serverTs,
    });
    tx.set(confirmationRef, confirmationData, {merge: true});

    return {
      alreadyConfirmed: false,
      confirmationId,
      position: payload.position,
      expectedPayment: typeof existing.expected_payment === "number" ?
        existing.expected_payment : payment.amount,
      expectedPaymentCents:
        typeof existing.expected_payment_cents === "number" ?
          existing.expected_payment_cents : payment.cents,
    };
  });
}

/**
 * Confirma presença em qualquer jogo elegível. Este é o writer canônico usado
 * por Web, Android e KMP; Admin SDK mantém server writes fora das rules cliente.
 */
export const confirmGamePresence = onCall<ConfirmGamePresenceRequest>(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório.");
    }
    assertVerifiedForConfirmation(request.auth.token);

    const payload = parseConfirmGamePresenceRequest(request.data);
    const uid = request.auth.uid;
    await assertConfirmationRateLimit(
      uid,
      CONFIRM_GAME_PRESENCE_RATE_LIMIT
    );

    try {
      const result = await confirmGamePresenceTransactional({
        uid,
        authToken: request.auth.token,
        payload,
        requirePublicGame: false,
        source: "canonical",
      });
      return {success: true, ...result};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("confirmGamePresence failed", {
        error,
        gameId: payload.gameId,
        uid,
      });
      throw new HttpsError(
        "internal",
        "Não foi possível confirmar presença."
      );
    }
  }
);

/**
 * Entrada canônica em jogos públicos. Clientes não devem mutar games.players
 * diretamente; a confirmação é a fonte para presença, pagamento e ranking.
 */
export const joinPublicGame = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório.");
    }
    assertVerifiedForConfirmation(request.auth.token);

    const payload = parseConfirmGamePresenceRequest(request.data);
    const uid = request.auth.uid;

    await assertConfirmationRateLimit(uid, JOIN_PUBLIC_GAME_RATE_LIMIT);

    try {
      const result = await confirmGamePresenceTransactional({
        uid,
        authToken: request.auth.token,
        payload,
        requirePublicGame: true,
        source: "public_game",
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("joinPublicGame failed", {
        error,
        gameId: payload.gameId,
        uid,
      });
      throw new HttpsError("internal", "Não foi possível entrar no jogo.");
    }
  }
);
