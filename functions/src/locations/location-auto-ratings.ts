import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {calculateAutoRatingsFromStats} from "../ratings/auto-ratings";
import {db} from "../_db";
import {
  AutoRatingsForUser,
  CalculateAutoRatingsRequest,
  RecalculateAllAutoRatingsRequest,
} from "./location-types-helpers";

/**
 * Atualiza ratings automaticos e historico a partir de statistics/{userId}.
 * @param {string} userId ID do usuario.
 * @param {FirebaseFirestore.DocumentData} stats Documento statistics.
 * @return {Promise<{ratings: AutoRatingsForUser, sampleSize: number}>}
 */
async function updateAutoRatingsFromStats(
  userId: string,
  stats: FirebaseFirestore.DocumentData
): Promise<{ratings: AutoRatingsForUser; sampleSize: number}> {
  const calculated = calculateAutoRatingsFromStats(stats);
  const autoRatings: AutoRatingsForUser = {
    auto_striker_rating: calculated.striker,
    auto_mid_rating: calculated.mid,
    auto_defender_rating: calculated.defender,
    auto_gk_rating: calculated.gk,
    auto_rating_samples: calculated.sampleSize,
    auto_rating_updated_at: FieldValue.serverTimestamp(),
  };

  await db()
    .collection("users")
    .doc(userId)
    .update(
      autoRatings as unknown as
        FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
    );

  const historyEntries = [
    {position: "STRIKER", rating: calculated.striker},
    {position: "MID", rating: calculated.mid},
    {position: "DEFENDER", rating: calculated.defender},
    {position: "GOALKEEPER", rating: calculated.gk},
  ].filter((entry) => entry.rating > 0);

  if (historyEntries.length > 0) {
    const historyRef = db()
      .collection("users")
      .doc(userId)
      .collection("rating_history");
    const batch = db().batch();
    for (const entry of historyEntries) {
      batch.set(historyRef.doc(), {
        ...entry,
        samples: calculated.sampleSize,
        calculatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await checkAndAwardRatingBadges(userId, {
    auto_striker_rating: calculated.striker,
    auto_mid_rating: calculated.mid,
    auto_defender_rating: calculated.defender,
    auto_gk_rating: calculated.gk,
  });
  return {ratings: autoRatings, sampleSize: calculated.sampleSize};
}

export const calculateAutoRatings = secureCallable<CalculateAutoRatingsRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 10, windowMs: 60000, keyPrefix: "autoRate"},
    enableAuditLog: true,
  },
  async (request) => {
    const {userId} = request.data;
    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userId required");
    }

    const userDoc = await db().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", `User ${userId} not found`);
    }

    // FIX #2657: query real aggregation stats (statistics/{userId})
    // instead of non-existent games.confirmed_players / games.ratings_map.
    const statsDoc = await db().collection("statistics").doc(userId).get();
    if (!statsDoc.exists) {
      logger.info(`[AUTO_RATINGS] No statistics doc for user ${userId}`);
      return {success: true};
    }

    const stats = statsDoc.data();
    if (!stats || (stats.total_games ?? stats.totalGames ?? 0) < 1) {
      return {success: true};
    }

    const result = await updateAutoRatingsFromStats(userId, stats);

    logger.info(
      `[AUTO_RATINGS] Calculated for user ${userId} ` +
      `samples=${result.sampleSize}`
    );

    return {success: true};
  }
);

/**
 * Verifica e concede badges baseados em ratings automáticos.
 * Badges concedidos: ELITE_* (4.5+), FIVE_STAR_* (5.0).
 * @param {string} userId - ID do usuário
 * @param {Object} ratings - Objeto com ratings por posição
 * @return {Promise<void>}
 */
async function checkAndAwardRatingBadges(
  userId: string,
  ratings: {[key: string]: number}
): Promise<void> {
  const userRef = db().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  const userData = userSnap.data()!;
  const currentBadges: string[] = userData.badges || [];
  const newBadges: string[] = [];

  const badgeDefinitions = [
    {id: "ELITE_STRIKER", field: "auto_striker_rating", threshold: 4.5},
    {id: "ELITE_MID", field: "auto_mid_rating", threshold: 4.5},
    {id: "ELITE_DEFENDER", field: "auto_defender_rating", threshold: 4.5},
    {id: "ELITE_GOALKEEPER", field: "auto_gk_rating", threshold: 4.5},
    {id: "FIVE_STAR_STRIKER", field: "auto_striker_rating", threshold: 5.0},
    {id: "FIVE_STAR_MID", field: "auto_mid_rating", threshold: 5.0},
    {id: "FIVE_STAR_DEFENDER", field: "auto_defender_rating", threshold: 5.0},
    {id: "FIVE_STAR_GOALKEEPER", field: "auto_gk_rating", threshold: 5.0},
  ];

  badgeDefinitions.forEach((badge) => {
    const rating = ratings[badge.field];
    if (rating && rating >= badge.threshold && !currentBadges.includes(badge.id)) {
      newBadges.push(badge.id);
    }
  });

  if (newBadges.length > 0) {
    await userRef.update({
      badges: FieldValue.arrayUnion(...newBadges),
    });
  }
}

export const recalculateAllAutoRatings = secureCallable<RecalculateAllAutoRatingsRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 1, windowMs: 300000, keyPrefix: "recalcAllRatings"},
    enableAuditLog: true,
  },
  async (request) => {
    const batchSize = Math.max(1, Math.min(Number(request.data?.batchSize) || 50, 500));

    const statsSnap = await db()
      .collection("statistics")
      .limit(batchSize)
      .get();

    let processedCount = 0;
    for (const statsDoc of statsSnap.docs) {
      const userId = statsDoc.id;
      try {
        const stats = statsDoc.data();
        if (!stats || (stats.total_games ?? stats.totalGames ?? 0) < 1) continue;

        await updateAutoRatingsFromStats(userId, stats);
        processedCount++;
      } catch (err) {
        logger.warn(`Failed to recalculate ratings for user ${userId}: ${err}`);
      }
    }

    logger.info(`Recalculated auto-ratings for ${processedCount} users`);
    return {success: true, processedCount};
  }
);
