import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {randomUUID} from "node:crypto";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";
import {resolveConfirmationPayment} from "./join-public-game";

type JoinPosition = "GOALKEEPER" | "FIELD";

interface ConfirmPlayerAsManagerRequest {
  gameId: string;
  userId: string;
  position?: JoinPosition;
}

export const CONFIRM_PLAYER_AS_MANAGER_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  keyPrefix: "confirm_player_as_manager",
};

/**
 * Valida e normaliza o payload do callable.
 *
 * @param {unknown} data payload cru
 * @return {ConfirmPlayerAsManagerRequest} payload normalizado
 */
function parseRequest(data: unknown): ConfirmPlayerAsManagerRequest {
  if (
    !isRecord(data) ||
    typeof data.gameId !== "string" ||
    data.gameId.trim().length === 0 ||
    data.gameId.trim().length > 128 ||
    data.gameId.includes("/")
  ) {
    throw new HttpsError("invalid-argument", "gameId obrigatório.");
  }
  if (
    typeof data.userId !== "string" ||
    data.userId.trim().length === 0 ||
    data.userId.trim().length > 128 ||
    data.userId.includes("/")
  ) {
    throw new HttpsError("invalid-argument", "userId obrigatório.");
  }
  if (
    data.position !== undefined &&
    data.position !== "GOALKEEPER" &&
    data.position !== "FIELD"
  ) {
    throw new HttpsError("invalid-argument", "position inválida.");
  }
  return {
    gameId: data.gameId.trim(),
    userId: data.userId.trim(),
    position: data.position as JoinPosition | undefined,
  };
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
 * Verifica se o caller pode gerenciar o jogo (dono, co-organizador ou admin).
 *
 * @param {Record<string, unknown>} game Doc do jogo.
 * @param {string} uid UID do caller.
 * @param {boolean} isAdmin Se o caller e admin global.
 * @return {boolean} Permissao de gestor.
 */
function isGameManager(
  game: Record<string, unknown>,
  uid: string,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (game.owner_id === uid) return true;
  const coOrganizers = Array.isArray(game.co_organizers) ?
    game.co_organizers : [];
  return coOrganizers.includes(uid);
}

/**
 * confirmPlayerAsManager — permite que dono ou co-organizador eleve uma
 * confirmacao PENDING (summon) para CONFIRMED, respeitando capacidade do jogo.
 *
 * O callable roda com Admin SDK (bypass das firestore.rules de cliente) e e a
 * unica forma valida de um gestor confirmar outro jogador. Registra audit log.
 */
export const confirmPlayerAsManager = onCall<ConfirmPlayerAsManagerRequest>(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório.");
    }
    const managerUid = request.auth.uid;
    const isAdmin = request.auth.token.role === "ADMIN";
    const payload = parseRequest(request.data);

    const rateLimit = await checkRateLimit(
      managerUid,
      CONFIRM_PLAYER_AS_MANAGER_RATE_LIMIT
    );
    if (!rateLimit.allowed) {
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

    if (payload.userId === managerUid && !isAdmin) {
      throw new HttpsError(
        "invalid-argument",
        "Use a confirmação normal para si mesmo."
      );
    }

    const gameRef = db().doc(`games/${payload.gameId}`);
    const confirmationId = `${payload.gameId}_${payload.userId}`;
    const confirmationRef = db().doc(`confirmations/${confirmationId}`);

    try {
      const result = await db().runTransaction(async (tx) => {
        const [gameSnap, confSnap, capacitySnap] = await Promise.all([
          tx.get(gameRef),
          tx.get(confirmationRef),
          tx.get(
            db()
              .collection("confirmations")
              .where("game_id", "==", payload.gameId)
              .where("status", "==", "CONFIRMED")
          ),
        ]);

        if (!gameSnap.exists) {
          throw new HttpsError("not-found", "Jogo não encontrado.");
        }
        const game = gameSnap.data() ?? {};

        if (!isGameManager(game, managerUid, isAdmin)) {
          throw new HttpsError(
            "permission-denied",
            "Apenas o dono ou co-organizadores podem confirmar jogadores."
          );
        }

        const status = game.status;
        if (status !== "SCHEDULED" && status !== "CONFIRMED") {
          throw new HttpsError(
            "failed-precondition",
            "Este jogo não aceita confirmações."
          );
        }

        if (!confSnap.exists) {
          throw new HttpsError(
            "not-found",
            "Confirmacao do jogador nao encontrada. Convite o jogador primeiro."
          );
        }
        const existing = confSnap.data() ?? {};
        const existingStatus = String(existing.status ?? "");

        if (existingStatus === "CONFIRMED") {
          return {alreadyConfirmed: true, confirmationId};
        }
        if (existingStatus !== "PENDING" && existingStatus !== "WAITLIST") {
          throw new HttpsError(
            "failed-precondition",
            "Este jogador não está aguardando confirmação."
          );
        }

        const targetPosition: JoinPosition = payload.position ?
          payload.position : normalizePosition(existing.position);

        const otherConfirmed = capacitySnap.docs.filter(
          (doc) => doc.id !== confirmationId
        );
        const maxPlayers = configuredLimit(
          game.max_players ?? game.maxPlayers
        );
        if (
          maxPlayers !== null &&
          otherConfirmed.length + 1 > maxPlayers
        ) {
          throw new HttpsError(
            "resource-exhausted",
            "Este jogo já está lotado."
          );
        }
        const maxGoalkeepers = configuredLimit(
          game.max_goalkeepers ?? game.maxGoalkeepers
        );
        const otherGoalkeepers = otherConfirmed.filter(
          (doc) => normalizePosition(doc.data().position) === "GOALKEEPER"
        ).length;
        const nextGoalkeepers =
          otherGoalkeepers + (targetPosition === "GOALKEEPER" ? 1 : 0);
        if (maxGoalkeepers !== null && nextGoalkeepers > maxGoalkeepers) {
          throw new HttpsError(
            "resource-exhausted",
            "As vagas de goleiro já foram preenchidas."
          );
        }

        const payment = resolveConfirmationPayment(game);
        const serverTs = FieldValue.serverTimestamp();
        const updateData: Record<string, unknown> = {
          status: "CONFIRMED",
          position: targetPosition,
          confirmed_at: serverTs,
          updated_at: serverTs,
          confirmed_by_manager: managerUid,
        };
        if (typeof existing.expected_payment !== "number") {
          updateData.expected_payment = payment.amount;
          updateData.expected_payment_cents = payment.cents;
        }

        tx.update(confirmationRef, updateData);

        const nextPlayersCount = otherConfirmed.length + 1;
        tx.update(gameRef, {
          players_count: nextPlayersCount,
          goalkeepers_count: nextGoalkeepers,
          updated_at: serverTs,
        });

        return {alreadyConfirmed: false, confirmationId};
      });

      const auditSuffix = randomUUID().slice(0, 8);
      const auditId =
        `confirm_player_as_manager_${payload.gameId}_${payload.userId}_${managerUid}_${auditSuffix}`;
      await db().collection("audit_logs").doc(auditId).set({
        type: "CONFIRM_PLAYER_AS_MANAGER",
        game_id: payload.gameId,
        target_user_id: payload.userId,
        manager_uid: managerUid,
        is_admin: isAdmin,
        already_confirmed: result.alreadyConfirmed,
        created_at: FieldValue.serverTimestamp(),
      });

      return {success: true, ...result};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("confirmPlayerAsManager failed", {
        error,
        gameId: payload.gameId,
        targetUserId: payload.userId,
        managerUid,
      });
      throw new HttpsError(
        "internal",
        "Não foi possível confirmar o jogador."
      );
    }
  }
);
