import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
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

interface JoinPublicGameRequest {
  gameId: string;
  position: JoinPosition;
  isCasualPlayer: boolean;
}

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
function parseJoinPublicGameRequest(data: unknown): JoinPublicGameRequest {
  if (!isRecord(data) || !isNonEmptyString(data.gameId)) {
    throw new HttpsError("invalid-argument", "gameId obrigatório.");
  }

  const position =
    data.position === "GOALKEEPER" ? "GOALKEEPER" : "FIELD";

  return {
    gameId: data.gameId.trim(),
    position,
    isCasualPlayer: data.isCasualPlayer === true,
  };
}

/**
 * Aplica rate limit por usuario antes da entrada em jogo publico.
 *
 * @param {string} uid Usuario autenticado.
 */
async function assertJoinPublicGameRateLimit(uid: string): Promise<void> {
  const rateLimit = await checkRateLimit(uid, JOIN_PUBLIC_GAME_RATE_LIMIT);
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

    const payload = parseJoinPublicGameRequest(request.data);
    const uid = request.auth.uid;

    await assertJoinPublicGameRateLimit(uid);

    const gameRef = db().doc(`games/${payload.gameId}`);
    const confirmationId = `${payload.gameId}_${uid}`;
    const confirmationRef = db().doc(`confirmations/${confirmationId}`);

    try {
      const result = await db().runTransaction(async (tx) => {
        const gameSnap = await tx.get(gameRef);
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

        const visibility = game.visibility;
        const isLegacyPublic = game.is_public === true && !visibility;
        if (visibility !== "PUBLIC_OPEN" && !isLegacyPublic) {
          throw new HttpsError(
            "permission-denied",
            "Este jogo não está aberto ao público."
          );
        }

        const startsAt = toMillis(game.dateTime ?? game.date_time);
        if (!startsAt || startsAt <= Date.now()) {
          throw new HttpsError(
            "failed-precondition",
            "Este jogo já começou ou expirou."
          );
        }

        const existingSnap = await tx.get(confirmationRef);
        if (existingSnap.exists) {
          const existing = existingSnap.data() ?? {};
          if (
            existing.status === "CONFIRMED" ||
            existing.status === "PENDING"
          ) {
            return {alreadyConfirmed: true};
          }
        }

        const capacityStatuses = getPublicCapacityStatuses(game);
        const confirmedCollection = db()
          .collection("confirmations")
          .where("game_id", "==", payload.gameId);
        const confirmedQuery = capacityStatuses.length === 1 ?
          confirmedCollection.where("status", "==", capacityStatuses[0]) :
          confirmedCollection.where("status", "in", capacityStatuses);
        const confirmedSnap = await tx.get(confirmedQuery);
        const maxPlayers =
          typeof game.max_players === "number" ? game.max_players : 0;
        if (maxPlayers > 0 && confirmedSnap.size >= maxPlayers) {
          throw new HttpsError(
            "resource-exhausted",
            "Este jogo já está lotado."
          );
        }

        const orderQuery = db()
          .collection("confirmations")
          .where("game_id", "==", payload.gameId)
          .where("status", "in", ["CONFIRMED", "PENDING"]);
        const orderSnap = await tx.get(orderQuery);

        const serverTs = FieldValue.serverTimestamp();
        tx.set(confirmationRef, {
          id: confirmationId,
          game_id: payload.gameId,
          user_id: uid,
          user_name: publicNameFromToken(request.auth?.token),
          user_photo: publicPhotoFromToken(request.auth?.token),
          position: payload.position,
          status: "CONFIRMED",
          payment_status: "PENDING",
          is_casual_player: payload.isCasualPlayer,
          is_guest: false,
          confirmation_order: orderSnap.size + 1,
          created_at: serverTs,
          confirmed_at: serverTs,
          updated_at: serverTs,
          source: "public_game",
        }, {merge: true});

        return {alreadyConfirmed: false};
      });

      return {
        success: true,
        alreadyConfirmed: result.alreadyConfirmed,
        confirmationId,
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
