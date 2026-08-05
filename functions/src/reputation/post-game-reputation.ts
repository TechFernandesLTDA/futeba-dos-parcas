import {FieldValue, type Firestore} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import {FUNCTION_REGION, MVP_VOTE_WINDOW_HOURS} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {getGameDate} from "../game/helpers";
import {checkRateLimit} from "../middleware/rate-limiter";
import {requireProfileComplete} from "../middleware/require-profile-complete";

const MIN_SCORE = 1;
const MAX_SCORE = 5;
const COMMENT_MAX_LENGTH = 160;
const POST_GAME_REPUTATION_WINDOW_MS =
  MVP_VOTE_WINDOW_HOURS * 60 * 60 * 1000;
const LEGACY_REVIEWS_QUERY_LIMIT = 1000;

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

interface ReputationTotals {
  punctuality: number;
  respect: number;
  commitment: number;
  overallCenti: number;
}

interface ReputationAggregateState {
  count: number;
  totals: ReputationTotals;
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
 * Converte nota media para centesimos inteiros.
 *
 * @param {number} value Nota em escala 1..5.
 * @return {number} Nota em centesimos.
 */
function toCenti(value: number): number {
  return Math.round(value * 100);
}

/**
 * Le numero finito de um documento Firestore.
 *
 * @param {Record<string, unknown>} data Documento bruto.
 * @param {string} field Campo esperado.
 * @return {number | null} Valor numerico.
 */
function readNumber(
  data: Record<string, unknown>,
  field: string
): number | null {
  const value = data[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Converte snapshot de review existente para scores validos.
 *
 * @param {Record<string, unknown> | undefined} data Dados brutos.
 * @return {ReputationReview | null} Review valida.
 */
function readReview(
  data: Record<string, unknown> | undefined
): ReputationReview | null {
  if (!data) return null;
  const punctuality = readNumber(data, "punctuality");
  const respect = readNumber(data, "respect");
  const commitment = readNumber(data, "commitment");
  const overall = readNumber(data, "overall");
  if (
    punctuality == null ||
    respect == null ||
    commitment == null ||
    overall == null ||
    punctuality < MIN_SCORE ||
    respect < MIN_SCORE ||
    commitment < MIN_SCORE ||
    overall < MIN_SCORE
  ) {
    return null;
  }
  return {punctuality, respect, commitment, overall};
}

/**
 * Indica se o perfil ja tem somas incrementais de reputacao.
 *
 * @param {Record<string, unknown>} data Dados do usuario avaliado.
 * @return {boolean} True quando os campos novos existem.
 */
function hasReputationSums(data: Record<string, unknown>): boolean {
  return readNumber(data, "reputation_punctuality_sum") != null &&
    readNumber(data, "reputation_respect_sum") != null &&
    readNumber(data, "reputation_commitment_sum") != null &&
    readNumber(data, "reputation_overall_sum_centi") != null;
}

/**
 * Decide se um perfil legado precisa de seed historico exato.
 *
 * @param {Record<string, unknown>} data Dados do usuario avaliado.
 * @return {boolean} True quando ha contagem antiga sem somas novas.
 */
function needsLegacySeed(data: Record<string, unknown>): boolean {
  return !hasReputationSums(data) &&
    (readNumber(data, "reputation_reviews_count") ?? 0) > 0;
}

/**
 * Le agregado atual do perfil a partir das somas persistidas.
 *
 * @param {Record<string, unknown>} data Dados do usuario avaliado.
 * @param {ReputationAggregateState | null} legacySeed Somas legadas exatas.
 * @return {ReputationAggregateState} Estado agregado atual.
 */
function readAggregateState(
  data: Record<string, unknown>,
  legacySeed: ReputationAggregateState | null
): ReputationAggregateState {
  if (!hasReputationSums(data)) {
    return legacySeed ?? {
      count: 0,
      totals: {
        punctuality: 0,
        respect: 0,
        commitment: 0,
        overallCenti: 0,
      },
    };
  }

  return {
    count: Math.max(
      0,
      Math.trunc(readNumber(data, "reputation_reviews_count") ?? 0)
    ),
    totals: {
      punctuality: readNumber(data, "reputation_punctuality_sum") ?? 0,
      respect: readNumber(data, "reputation_respect_sum") ?? 0,
      commitment: readNumber(data, "reputation_commitment_sum") ?? 0,
      overallCenti: readNumber(data, "reputation_overall_sum_centi") ?? 0,
    },
  };
}

/**
 * Soma reviews historicas apenas para perfis legados sem somas incrementais.
 * Roda fora da transacao para nao colocar query ilimitada no read-set.
 *
 * @param {Firestore} firestore Firestore admin.
 * @param {string} targetUserId Usuario avaliado.
 * @return {Promise<ReputationAggregateState>} Somas historicas.
 */
async function loadLegacyAggregateSeed(
  firestore: Firestore,
  targetUserId: string
): Promise<ReputationAggregateState> {
  const reviewsSnap = await firestore
    .collection("post_game_reputation")
    .where("target_user_id", "==", targetUserId)
    .limit(LEGACY_REVIEWS_QUERY_LIMIT)
    .get();

  const totals: ReputationTotals = {
    punctuality: 0,
    respect: 0,
    commitment: 0,
    overallCenti: 0,
  };
  let count = 0;

  for (const doc of reviewsSnap.docs) {
    const review = readReview(doc.data());
    if (!review) continue;
    totals.punctuality += review.punctuality;
    totals.respect += review.respect;
    totals.commitment += review.commitment;
    totals.overallCenti += toCenti(review.overall);
    count++;
  }

  return {count, totals};
}

/**
 * Monta campos agregados de reputacao a partir de somas.
 *
 * @param {ReputationAggregateState} state Estado agregado.
 * @return {Record<string, unknown>} Campos do perfil.
 */
function buildAggregateFromState(state: ReputationAggregateState) {
  const count = state.count;
  const totals = state.totals;
  return {
    reputation_punctuality_avg: count > 0 ?
      round2(totals.punctuality / count) :
      0,
    reputation_respect_avg: count > 0 ?
      round2(totals.respect / count) :
      0,
    reputation_commitment_avg: count > 0 ?
      round2(totals.commitment / count) :
      0,
    reputation_overall_avg: count > 0 ?
      round2((totals.overallCenti / 100) / count) :
      0,
    reputation_punctuality_sum: totals.punctuality,
    reputation_respect_sum: totals.respect,
    reputation_commitment_sum: totals.commitment,
    reputation_overall_sum_centi: totals.overallCenti,
    reputation_reviews_count: count,
    reputation_updated_at: FieldValue.serverTimestamp(),
  };
}

/**
 * Calcula o proximo agregado sem consultar todas as reviews do alvo.
 *
 * @param {Record<string, unknown>} targetUser Perfil atual.
 * @param {ReputationReview | null} previousReview Review anterior.
 * @param {ReputationReview} nextReview Nova review.
 * @param {ReputationAggregateState | null} legacySeed Somas legadas.
 * @return {Record<string, unknown>} Campos agregados.
 */
export function buildNextAggregate(
  targetUser: Record<string, unknown>,
  previousReview: ReputationReview | null,
  nextReview: ReputationReview,
  legacySeed: ReputationAggregateState | null = null
) {
  const state = readAggregateState(targetUser, legacySeed);
  const previousCounted = previousReview != null && state.count > 0;
  const totals = {...state.totals};

  if (previousCounted) {
    totals.punctuality -= previousReview.punctuality;
    totals.respect -= previousReview.respect;
    totals.commitment -= previousReview.commitment;
    totals.overallCenti -= toCenti(previousReview.overall);
  }

  totals.punctuality += nextReview.punctuality;
  totals.respect += nextReview.respect;
  totals.commitment += nextReview.commitment;
  totals.overallCenti += toCenti(nextReview.overall);

  return buildAggregateFromState({
    count: previousCounted ? state.count : state.count + 1,
    totals,
  });
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
    const targetUserRef = firestore.doc(`users/${targetUserId}`);
    const targetUserPreflight = await targetUserRef.get();
    const targetUserPreflightData =
      targetUserPreflight.data() as Record<string, unknown> | undefined;
    const legacySeed =
      targetUserPreflight.exists &&
      targetUserPreflightData &&
      needsLegacySeed(targetUserPreflightData) ?
        await loadLegacyAggregateSeed(firestore, targetUserId) :
        null;
    const reviewId = `${gameId}_${reviewerId}_${targetUserId}`;

    const result = await firestore.runTransaction(async (tx) => {
      const gameRef = firestore.doc(`games/${gameId}`);
      const reviewerConfirmationRef =
        firestore.doc(`confirmations/${gameId}_${reviewerId}`);
      const targetConfirmationRef =
        firestore.doc(`confirmations/${gameId}_${targetUserId}`);
      const reviewRef = firestore.doc(`post_game_reputation/${reviewId}`);

      const [
        gameSnap,
        reviewerConfirmationSnap,
        targetConfirmationSnap,
        targetUserSnap,
        existingReviewSnap,
      ] = await Promise.all([
        tx.get(gameRef),
        tx.get(reviewerConfirmationRef),
        tx.get(targetConfirmationRef),
        tx.get(targetUserRef),
        tx.get(reviewRef),
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
      const gameEndedAt = getGameDate(game as never);
      const reputationDeadlineMs =
        gameEndedAt.getTime() +
        POST_GAME_REPUTATION_WINDOW_MS;
      if (Date.now() > reputationDeadlineMs) {
        throw new HttpsError(
          "failed-precondition",
          "A janela para enviar ou editar a reputação deste jogo já encerrou."
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
      const aggregate = buildNextAggregate(
        targetUserSnap.data() as Record<string, unknown>,
        readReview(
          existingReviewSnap.data() as Record<string, unknown> | undefined
        ),
        nextReview,
        legacySeed
      );

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
        reviewsCount: aggregate.reputation_reviews_count,
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
