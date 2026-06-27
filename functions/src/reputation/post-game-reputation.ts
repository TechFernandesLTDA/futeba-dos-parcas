import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {checkRateLimit} from "../middleware/rate-limiter";
import {requireProfileComplete} from "../middleware/require-profile-complete";

const MIN_SCORE = 1;
const MAX_SCORE = 5;
const COMMENT_MAX_LENGTH = 160;

interface SubmitPostGameReputationRequest {
  gameId: string;
  targetUserId: string;
  punctuality: number;
  respect: number;
  commitment: number;
  comment?: string | null;
}

interface ReputationReview {
  punctuality: number;
  respect: number;
  commitment: number;
  overall: number;
}

/**
 * Valida IDs vindos do cliente antes de montar paths Firestore.
 *
 * @param {unknown} value Valor recebido.
 * @param {string} field Nome do campo para mensagem de erro.
 * @return {string} ID validado.
 */
function assertId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      `${field} deve ter entre 1 e 128 caracteres.`
    );
  }
  if (value.includes("/")) {
    throw new HttpsError("invalid-argument", ERROR_MSGS.ID_INVALID_CHARS);
  }
  return value;
}

/**
 * Valida criterio de reputacao no range 1..5.
 *
 * @param {unknown} value Valor recebido.
 * @param {string} field Nome do criterio.
 * @return {number} Score validado.
 */
function assertScore(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_SCORE ||
    value > MAX_SCORE
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${field} deve ser um inteiro entre ${MIN_SCORE} e ${MAX_SCORE}.`
    );
  }
  return value;
}

/**
 * Normaliza comentario opcional, sem permitir payload grande.
 *
 * @param {unknown} value Valor recebido.
 * @return {string} Comentario normalizado.
 */
function normalizeComment(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "comment inválido(a).");
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > COMMENT_MAX_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `comment deve ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`
    );
  }
  return normalized;
}

/**
 * Arredonda medias para duas casas.
 *
 * @param {number} value Valor bruto.
 * @return {number} Valor arredondado.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula agregados persistidos no perfil do usuario avaliado.
 *
 * @param {ReputationReview[]} reviews Avaliacoes consideradas.
 * @return {Record<string, unknown>} Campos agregados em snake_case.
 */
function buildAggregate(reviews: ReputationReview[]) {
  const count = reviews.length;
  const totals = reviews.reduce(
    (acc, review) => ({
      punctuality: acc.punctuality + review.punctuality,
      respect: acc.respect + review.respect,
      commitment: acc.commitment + review.commitment,
      overall: acc.overall + review.overall,
    }),
    {punctuality: 0, respect: 0, commitment: 0, overall: 0}
  );

  return {
    reputation_punctuality_avg: count > 0 ? round2(totals.punctuality / count) : 0,
    reputation_respect_avg: count > 0 ? round2(totals.respect / count) : 0,
    reputation_commitment_avg: count > 0 ? round2(totals.commitment / count) : 0,
    reputation_overall_avg: count > 0 ? round2(totals.overall / count) : 0,
    reputation_reviews_count: count,
    reputation_updated_at: FieldValue.serverTimestamp(),
  };
}

export const submitPostGameReputation = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: !process.env.FUNCTIONS_EMULATOR,
    consumeAppCheckToken: true,
  },
  async (request) => {
    requireProfileComplete(request);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }

    const reviewerId = request.auth.uid;
    const data = (request.data ?? {}) as SubmitPostGameReputationRequest;
    const gameId = assertId(data.gameId, "gameId");
    const targetUserId = assertId(data.targetUserId, "targetUserId");
    if (targetUserId === reviewerId) {
      throw new HttpsError(
        "failed-precondition",
        "Não é permitido avaliar a si mesmo."
      );
    }

    const punctuality = assertScore(data.punctuality, "pontualidade");
    const respect = assertScore(data.respect, "respeito");
    const commitment = assertScore(data.commitment, "compromisso");
    const comment = normalizeComment(data.comment);
    const overall = round2((punctuality + respect + commitment) / 3);

    const rateLimit = await checkRateLimit(reviewerId, {
      maxRequests: 20,
      windowMs: 60 * 1000,
      keyPrefix: "post_game_reputation",
    });
    if (!rateLimit.allowed) {
      const resetInSec = Math.ceil(
        (rateLimit.resetAt.getTime() - Date.now()) / 1000
      );
      throw new HttpsError(
        "resource-exhausted",
        `Muitas tentativas. Tente novamente em ${resetInSec} segundos.`,
        {retryAfter: resetInSec}
      );
    }

    const firestore = db();
    const reviewId = `${gameId}_${reviewerId}_${targetUserId}`;
    const result = await firestore.runTransaction(async (tx) => {
      const gameRef = firestore.doc(`games/${gameId}`);
      const reviewerConfirmationRef =
        firestore.doc(`confirmations/${gameId}_${reviewerId}`);
      const targetConfirmationRef =
        firestore.doc(`confirmations/${gameId}_${targetUserId}`);
      const targetUserRef = firestore.doc(`users/${targetUserId}`);
      const reviewRef = firestore.doc(`post_game_reputation/${reviewId}`);
      const targetReviewsQuery = firestore
        .collection("post_game_reputation")
        .where("target_user_id", "==", targetUserId);

      const [
        gameSnap,
        reviewerConfirmationSnap,
        targetConfirmationSnap,
        targetUserSnap,
        existingReviewSnap,
        targetReviewsSnap,
      ] = await Promise.all([
        tx.get(gameRef),
        tx.get(reviewerConfirmationRef),
        tx.get(targetConfirmationRef),
        tx.get(targetUserRef),
        tx.get(reviewRef),
        tx.get(targetReviewsQuery),
      ]);

      if (!gameSnap.exists) {
        throw new HttpsError("not-found", ERROR_MSGS.GAME_NOT_FOUND);
      }
      if (!targetUserSnap.exists) {
        throw new HttpsError("not-found", ERROR_MSGS.USER_NOT_FOUND);
      }

      const game = gameSnap.data() as Record<string, unknown>;
      if (game.status !== "FINISHED") {
        throw new HttpsError(
          "failed-precondition",
          ERROR_MSGS.GAME_NOT_FINALIZED
        );
      }

      const reviewerConfirmation =
        reviewerConfirmationSnap.data() as Record<string, unknown> | undefined;
      const targetConfirmation =
        targetConfirmationSnap.data() as Record<string, unknown> | undefined;
      if (
        !reviewerConfirmationSnap.exists ||
        reviewerConfirmation?.status !== "CONFIRMED"
      ) {
        throw new HttpsError(
          "permission-denied",
          ERROR_MSGS.CONFIRMED_PLAYERS_ONLY
        );
      }
      if (
        !targetConfirmationSnap.exists ||
        targetConfirmation?.status !== "CONFIRMED"
      ) {
        throw new HttpsError(
          "failed-precondition",
          ERROR_MSGS.PLAYER_NOT_IN_GAME
        );
      }

      const nextReview: ReputationReview = {
        punctuality,
        respect,
        commitment,
        overall,
      };
      const reviews = targetReviewsSnap.docs
        .map((doc) => {
          if (doc.id === reviewId) return nextReview;
          const review = doc.data();
          return {
            punctuality: Number(review.punctuality ?? 0),
            respect: Number(review.respect ?? 0),
            commitment: Number(review.commitment ?? 0),
            overall: Number(review.overall ?? 0),
          };
        })
        .filter((review) =>
          review.punctuality >= MIN_SCORE &&
          review.respect >= MIN_SCORE &&
          review.commitment >= MIN_SCORE &&
          review.overall >= MIN_SCORE
        );

      if (!existingReviewSnap.exists) {
        reviews.push(nextReview);
      }

      const aggregate = buildAggregate(reviews);
      tx.set(reviewRef, {
        game_id: gameId,
        group_id: (game.group_id as string | undefined) ?? null,
        reviewer_id: reviewerId,
        reviewer_name: reviewerConfirmation.user_name ?? "",
        reviewer_photo: reviewerConfirmation.user_photo ?? "",
        target_user_id: targetUserId,
        target_user_name: targetConfirmation.user_name ?? "",
        target_user_photo: targetConfirmation.user_photo ?? "",
        punctuality,
        respect,
        commitment,
        overall,
        comment,
        updated_at: FieldValue.serverTimestamp(),
        ...(existingReviewSnap.exists ? {} : {
          created_at: FieldValue.serverTimestamp(),
        }),
      }, {merge: true});
      tx.update(targetUserRef, aggregate);

      return {
        updated: existingReviewSnap.exists,
        reviewsCount: reviews.length,
        overallAvg: aggregate.reputation_overall_avg,
      };
    });

    logger.info("Post-game reputation submitted", {
      gameId,
      reviewerId,
      targetUserId,
      reviewsCount: result.reviewsCount,
      updated: result.updated,
    });

    return {
      success: true,
      updated: result.updated,
      reviewsCount: result.reviewsCount,
      overallAvg: result.overallAvg,
    };
  }
);
