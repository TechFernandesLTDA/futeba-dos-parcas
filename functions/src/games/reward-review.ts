import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";
import {checkRateLimit, RATE_LIMITS} from "../middleware/rate-limiter";

type RewardReviewAction = "APPROVE" | "REJECT";

interface ReviewHeldRewardsRequest {
  gameId: string;
  action: RewardReviewAction;
  reason: string;
}

/**
 * Valida o payload da revisão administrativa de recompensas retidas.
 * @param {unknown} data Payload recebido pela callable.
 * @return {ReviewHeldRewardsRequest} Payload normalizado e validado.
 */
function validateRequest(
  data: unknown
): ReviewHeldRewardsRequest {
  const payload =
    (data ?? {}) as Partial<ReviewHeldRewardsRequest>;

  if (
    typeof payload.gameId !== "string" ||
    payload.gameId.trim().length === 0 ||
    payload.gameId.length > 128 ||
    payload.gameId.includes("/")
  ) {
    throw new HttpsError(
      "invalid-argument",
      ERROR_MSGS.GAME_ID_REQUIRED
    );
  }

  if (
    payload.action !== "APPROVE" &&
    payload.action !== "REJECT"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Ação inválida para revisão de recompensas"
    );
  }

  if (
    typeof payload.reason !== "string" ||
    payload.reason.trim().length < 10 ||
    payload.reason.trim().length > 500
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Motivo da revisão deve ter entre 10 e 500 caracteres"
    );
  }

  return {
    gameId: payload.gameId.trim(),
    action: payload.action,
    reason: payload.reason.trim(),
  };
}

export const reviewHeldGameRewards = onCall<
  ReviewHeldRewardsRequest
>(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        ERROR_MSGS.UNAUTHENTICATED
      );
    }

    const uid = request.auth.uid;
    const isAdmin = request.auth.token?.role === "ADMIN";
    if (!isAdmin) {
      throw new HttpsError(
        "permission-denied",
        ERROR_MSGS.ADMIN_ONLY
      );
    }

    const rate = await checkRateLimit(
      uid,
      {
        ...RATE_LIMITS.BATCH_OPERATION,
        keyPrefix: "reward_review_admin",
      }
    );
    if (!rate.allowed) {
      const resetInSeconds = Math.ceil(
        (rate.resetAt.getTime() - Date.now()) / 1000
      );
      const retryMessage =
        "Muitas tentativas. Tente novamente em " +
        `${resetInSeconds} segundos.`;
      // eslint-disable-next-line new-cap
      throw new HttpsError(
        "resource-exhausted",
        retryMessage
      );
    }

    const {gameId, action, reason} =
      validateRequest(request.data);

    const gameRef = db().collection("games").doc(gameId);
    const result = await db().runTransaction(
      async (tx) => {
        const snap = await tx.get(gameRef);
        if (!snap.exists) {
          throw new HttpsError(
            "not-found",
            "Jogo não encontrado"
          );
        }

        const game = snap.data() ?? {};
        if (game.status !== "FINISHED") {
          throw new HttpsError(
            "failed-precondition",
            "A revisão só pode ocorrer em jogos finalizados"
          );
        }

        if (game.xp_reward_status !== "HELD_FOR_REVIEW") {
          throw new HttpsError(
            "failed-precondition",
            "O jogo não está com recompensas retidas para revisão"
          );
        }

        const nextStatus =
          action === "APPROVE" ?
            "ELIGIBLE" :
            "REJECTED_BY_ADMIN";
        const decision =
          action === "APPROVE" ?
            "APPROVED" :
            "REJECTED";

        tx.update(gameRef, {
          xp_reward_status: nextStatus,
          xp_reward_review_decision: decision,
          xp_reward_reviewed_at:
            FieldValue.serverTimestamp(),
          xp_reward_reviewed_by: uid,
          xp_reward_review_reason: reason,
          xp_reward_review_previous_status:
            "HELD_FOR_REVIEW",
          xp_reward_review_new_status: nextStatus,
          xp_processing: false,
          xp_processing_error:
            action === "APPROVE" ?
              null :
              "XP rejected by admin review",
        });

        return {
          previousStatus: "HELD_FOR_REVIEW",
          nextStatus,
        };
      }
    );

    logger.info(
      "[GAME_REWARD_REVIEW] Revisão admin registrada",
      {
        gameId,
        adminUid: uid,
        action,
        nextStatus: result.nextStatus,
      }
    );

    return {
      success: true,
      gameId,
      action,
      previousStatus: result.previousStatus,
      newStatus: result.nextStatus,
    };
  }
);
