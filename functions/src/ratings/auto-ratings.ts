import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";

const MAX_GOALS_PER_GAME = 1.5;
const MAX_ASSISTS_PER_GAME = 1.2;
const MAX_SAVES_PER_GAME = 4.0;

interface AutoRatings {
  striker: number;
  mid: number;
  defender: number;
  gk: number;
  sampleSize: number;
}

interface AutoRatingsWritePayload {
  auto_striker_rating: number;
  auto_mid_rating: number;
  auto_defender_rating: number;
  auto_gk_rating: number;
  auto_rating_samples: number;
  auto_rating_updated_at: FirebaseFirestore.FieldValue;
}

interface AutoRatingsWriteResult {
  mode: "user" | "fallback";
  path: string;
}

const AUTO_RATING_FALLBACK_COLLECTION =
  "auto_rating_fallbacks";

/**
 * Reads a numeric stat from camelCase or snake_case fields.
 *
 * @param {FirebaseFirestore.DocumentData} data Source statistics document.
 * @param {string} camelKey CamelCase field name.
 * @param {string} snakeKey Snake_case field name.
 * @return {number} Numeric value or zero when absent/invalid.
 */
function num(
  data: FirebaseFirestore.DocumentData,
  camelKey: string,
  snakeKey: string
): number {
  const value = data[camelKey] ?? data[snakeKey] ?? 0;
  return typeof value === "number" ? value : 0;
}

/**
 * Converts a per-game average to a 0-5 rating.
 *
 * @param {number} value Per-game stat average.
 * @param {number} max Average that maps to rating 5.0.
 * @return {number} Clamped rating in the 0-5 scale.
 */
function scale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max((value / max) * 5.0, 0), 5.0);
}

/**
 * Normaliza os campos persistidos junto do user doc/fallback doc.
 *
 * @param {AutoRatings} ratings Ratings calculados.
 * @return {AutoRatingsWritePayload} Payload de escrita.
 */
function buildAutoRatingsWritePayload(
  ratings: AutoRatings
): AutoRatingsWritePayload {
  return {
    auto_striker_rating: ratings.striker,
    auto_mid_rating: ratings.mid,
    auto_defender_rating: ratings.defender,
    auto_gk_rating: ratings.gk,
    auto_rating_samples: ratings.sampleSize,
    auto_rating_updated_at: FieldValue.serverTimestamp(),
  };
}

/**
 * Detecta falhas de update por documento inexistente.
 *
 * @param {unknown} error Erro retornado pelo Admin SDK.
 * @return {boolean} true quando o user doc nao existe.
 */
function isMissingDocumentError(
  error: unknown
): boolean {
  const typedError =
    error as Record<string, unknown>;
  const message =
    typeof typedError.message === "string" ?
      typedError.message :
      "";

  return typedError.code === 5 ||
    typedError.status === "NOT_FOUND" ||
    message.includes("No document to update") ||
    message.includes("NOT_FOUND") ||
    message.includes("not-found");
}

/**
 * Persiste auto-ratings no user doc e, se o user estiver ausente,
 * grava um fallback operacional para nao perder o calculo.
 *
 * @param {string} userId UID do usuario.
 * @param {AutoRatings} ratings Ratings calculados.
 * @return {Promise<AutoRatingsWriteResult>} Destino usado.
 */
async function persistAutoRatings(
  userId: string,
  ratings: AutoRatings
): Promise<AutoRatingsWriteResult> {
  const payload =
    buildAutoRatingsWritePayload(ratings);
  const userRef = db()
    .collection("users")
    .doc(userId);

  try {
    await userRef.update(
      payload as unknown as
        FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
    );
    return {
      mode: "user",
      path: `users/${userId}`,
    };
  } catch (error: unknown) {
    if (!isMissingDocumentError(error)) {
      throw error;
    }

    const fallbackPath =
      `${AUTO_RATING_FALLBACK_COLLECTION}/${userId}`;
    await db()
      .collection(
        AUTO_RATING_FALLBACK_COLLECTION
      )
      .doc(userId)
      .set({
        user_id: userId,
        source_document:
          `statistics/${userId}`,
        status: "PENDING_USER_RECONCILIATION",
        fallback_reason:
          "missing_user_document",
        ...payload,
        fallback_written_at:
          FieldValue.serverTimestamp(),
      }, {merge: true});

    logger.warn(
      "Auto-ratings fallback persisted for orphan statistics",
      {
        userId,
        sampleSize: ratings.sampleSize,
        fallbackPath,
      }
    );

    return {
      mode: "fallback",
      path: fallbackPath,
    };
  }
}

/**
 * Calculates automatic positional ratings from aggregated user statistics.
 *
 * @param {FirebaseFirestore.DocumentData} data Aggregated statistics document.
 * @return {AutoRatings} Calculated ratings and sample size.
 */
export function calculateAutoRatingsFromStats(
  data: FirebaseFirestore.DocumentData
): AutoRatings {
  const totalGames = num(data, "totalGames", "total_games");
  const totalGoals = num(data, "totalGoals", "total_goals");
  const totalAssists = num(data, "totalAssists", "total_assists");
  const totalSaves = num(data, "totalSaves", "total_saves");
  const wins = num(data, "gamesWon", "total_wins") ||
    num(data, "totalWins", "total_wins");
  const yellowCards = num(data, "totalYellowCards", "yellow_cards");
  const redCards = num(data, "totalRedCards", "red_cards");

  const avgGoals = totalGames > 0 ? totalGoals / totalGames : 0;
  const avgAssists = totalGames > 0 ? totalAssists / totalGames : 0;
  const avgSaves = totalGames > 0 ? totalSaves / totalGames : 0;
  const winRate = totalGames > 0 ? wins / totalGames : 0;
  const weightedCards = yellowCards + redCards * 3;
  const avgCards = totalGames > 0 ? weightedCards / totalGames : 0;

  const discipline = Math.min(Math.max(1.0 - avgCards / 2.0, 0), 1);
  const defenderScore = winRate * 0.6 + discipline * 0.4;

  return {
    striker: scale(avgGoals, MAX_GOALS_PER_GAME),
    mid: scale(avgAssists, MAX_ASSISTS_PER_GAME),
    defender: Math.min(Math.max(defenderScore * 5.0, 0), 5.0),
    gk: scale(avgSaves, MAX_SAVES_PER_GAME),
    sampleSize: totalGames,
  };
}

export const onStatisticsWrittenForAutoRatings = onDocumentWritten(
  {
    document: "statistics/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const data = after.data();
    if (!data) return;

    const userId = event.params.userId;
    const ratings = calculateAutoRatingsFromStats(data);
    if (ratings.sampleSize < 1) return;

    const writeResult =
      await persistAutoRatings(
        userId,
        ratings
      );

    logger.info("Auto-ratings updated from statistics", {
      userId,
      sampleSize: ratings.sampleSize,
      writeMode: writeResult.mode,
      writePath: writeResult.path,
    });
  }
);
