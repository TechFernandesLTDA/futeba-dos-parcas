import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {calculateAutoRatingsFromStats} from "../ratings/auto-ratings";
import {db} from "../_db";
import {ERROR_MSGS} from "../error-messages";

interface DeleteLocationRequest {
  locationId: string;
}

interface CalculateAutoRatingsRequest {
  userId: string;
}

const DELETE_BATCH_SIZE = 500;
const LOCATION_SUBCOLLECTIONS = [
  "reviews",
  "fields",
  "availability",
  "audit_logs",
];

/**
 * Deletes every document in a location subcollection using paged batches.
 *
 * @param {string} locationId Location document id.
 * @param {string} subcollection Child collection name.
 * @return {Promise<number>} Number of deleted documents.
 */
export async function deleteLocationSubcollection(
  locationId: string,
  subcollection: string
): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snap = await db()
      .collection("locations")
      .doc(locationId)
      .collection(subcollection)
      .limit(DELETE_BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    deletedCount += snap.size;
    if (snap.size < DELETE_BATCH_SIZE) break;
  }

  return deletedCount;
}

export const deleteLocation = secureCallable<DeleteLocationRequest>(
  {
    appCheck: !process.env.FUNCTIONS_EMULATOR,
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {maxRequests: 5, windowMs: 60000, keyPrefix: "deleteLoc"},
    enableAuditLog: true,
    auditLogContext: async (req) => ({
      function: "deleteLocation",
      locationId: req.data?.locationId,
    }),
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
    }
    const {locationId} = request.data;
    if (!locationId || typeof locationId !== "string") {
      throw new HttpsError("invalid-argument", "locationId must be a non-empty string");
    }

    const locRef = db().collection("locations").doc(locationId);
    const locDoc = await locRef.get();
    if (!locDoc.exists) {
      throw new HttpsError("not-found", `Location ${locationId} not found`);
    }

    const locData = locDoc.data() || {};
    let deletedCount = 0;

    for (const sub of LOCATION_SUBCOLLECTIONS) {
      deletedCount += await deleteLocationSubcollection(locationId, sub);
    }

    await locRef.delete();
    deletedCount += 1;

    await db().collection("audit_logs").add({
      type: "LOCATION_DELETE",
      target_location_id: locationId,
      actor_user_id: request.auth.uid,
      location_name: locData.name || null,
      deleted_docs_count: deletedCount,
      subcollections: LOCATION_SUBCOLLECTIONS,
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`Location ${locationId} deleted (cascade: ${deletedCount} docs)`);
    return {success: true, deletedCount};
  }
);

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

    const ratings = calculateAutoRatingsFromStats(stats);

    await db().collection("users").doc(userId).update({
      auto_striker_rating: ratings.striker,
      auto_mid_rating: ratings.mid,
      auto_defender_rating: ratings.defender,
      auto_gk_rating: ratings.gk,
      auto_rating_samples: ratings.sampleSize,
      auto_rating_updated_at: FieldValue.serverTimestamp(),
    });

    await checkAndAwardRatingBadges(userId, {
      auto_striker_rating: ratings.striker,
      auto_mid_rating: ratings.mid,
      auto_defender_rating: ratings.defender,
      auto_gk_rating: ratings.gk,
    });

    logger.info(`[AUTO_RATINGS] Calculated for user ${userId} — samples=${ratings.sampleSize}` +
      ` striker=${ratings.striker.toFixed(2)} mid=${ratings.mid.toFixed(2)}` +
      ` defender=${ratings.defender.toFixed(2)} gk=${ratings.gk.toFixed(2)}`);

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
async function checkAndAwardRatingBadges(userId: string, ratings: {[key: string]: number}): Promise<void> {
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

interface RecalculateAllAutoRatingsRequest {
  batchSize?: number;
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

    const usersSnap = await db()
      .collection("users")
      .where("auto_rating_samples", ">", 0)
      .limit(batchSize)
      .get();

    let processedCount = 0;
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      try {
        // FIX #2657: read real aggregation stats instead of
        // non-existent games.confirmed_players / games.ratings_map.
        const statsDoc = await db().collection("statistics").doc(userId).get();
        if (!statsDoc.exists) continue;

        const stats = statsDoc.data();
        if (!stats || (stats.total_games ?? stats.totalGames ?? 0) < 1) continue;

        const ratings = calculateAutoRatingsFromStats(stats);

        await db().collection("users").doc(userId).update({
          auto_striker_rating: ratings.striker,
          auto_mid_rating: ratings.mid,
          auto_defender_rating: ratings.defender,
          auto_gk_rating: ratings.gk,
          auto_rating_samples: ratings.sampleSize,
          auto_rating_updated_at: FieldValue.serverTimestamp(),
        });

        await checkAndAwardRatingBadges(userId, {
          auto_striker_rating: ratings.striker,
          auto_mid_rating: ratings.mid,
          auto_defender_rating: ratings.defender,
          auto_gk_rating: ratings.gk,
        });
        processedCount++;
      } catch (err) {
        logger.warn(`Failed to recalculate ratings for user ${userId}: ${err}`);
      }
    }

    logger.info(`Recalculated auto-ratings for ${processedCount} users`);
    return {success: true, processedCount};
  }
);
