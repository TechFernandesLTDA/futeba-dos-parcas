import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
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

    const gamesSnap = await db()
      .collection("games")
      .where("confirmed_players", "array-contains", userId)
      .where("status", "==", "completed")
      .orderBy("date", "desc")
      .limit(50)
      .get();

    if (gamesSnap.empty) {
      return {success: true};
    }

    const ratings = {striker: [] as number[], mid: [] as number[], defender: [] as number[], gk: [] as number[]};

    for (const gameDoc of gamesSnap.docs) {
      const game = gameDoc.data();
      // eslint-disable-next-line camelcase
      const ratings_map = game.ratings_map || {};
      // eslint-disable-next-line camelcase
      const userRating = ratings_map[userId];
      if (!userRating) continue;

      if (userRating.striker > 0) ratings.striker.push(userRating.striker);
      if (userRating.mid > 0) ratings.mid.push(userRating.mid);
      if (userRating.defender > 0) ratings.defender.push(userRating.defender);
      if (userRating.gk > 0) ratings.gk.push(userRating.gk);
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const samples = Math.max(ratings.striker.length, ratings.mid.length, ratings.defender.length, ratings.gk.length);

    await db().collection("users").doc(userId).update({
      auto_striker_rating: avg(ratings.striker),
      auto_mid_rating: avg(ratings.mid),
      auto_defender_rating: avg(ratings.defender),
      auto_gk_rating: avg(ratings.gk),
      auto_rating_samples: samples,
      auto_rating_updated_at: FieldValue.serverTimestamp(),
    });

    const historyEntries = [
      {position: "STRIKER", rating: avg(ratings.striker)},
      {position: "MID", rating: avg(ratings.mid)},
      {position: "DEFENDER", rating: avg(ratings.defender)},
      {position: "GOALKEEPER", rating: avg(ratings.gk)},
    ].filter((e) => e.rating > 0);

    if (historyEntries.length > 0) {
      const historyRef = db().collection("users").doc(userId).collection("rating_history");
      const batch = db().batch();
      historyEntries.forEach((entry) => {
        const docRef = historyRef.doc();
        batch.set(docRef, {
          ...entry,
          samples,
          calculatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    await checkAndAwardRatingBadges(userId, {
      auto_striker_rating: avg(ratings.striker),
      auto_mid_rating: avg(ratings.mid),
      auto_defender_rating: avg(ratings.defender),
      auto_gk_rating: avg(ratings.gk),
    });

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
    const batchSize = request.data?.batchSize || 50;

    const usersSnap = await db()
      .collection("users")
      .where("auto_rating_samples", ">", 0)
      .limit(batchSize)
      .get();

    let processedCount = 0;
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      try {
        const gamesSnap = await db()
          .collection("games")
          .where("confirmed_players", "array-contains", userId)
          .where("status", "==", "completed")
          .orderBy("date", "desc")
          .limit(50)
          .get();

        if (gamesSnap.empty) continue;

        const ratings = {striker: [] as number[], mid: [] as number[], defender: [] as number[], gk: [] as number[]};

        for (const gameDoc of gamesSnap.docs) {
          const game = gameDoc.data();
          // eslint-disable-next-line camelcase
          const ratings_map = game.ratings_map || {};
          // eslint-disable-next-line camelcase
          const userRating = ratings_map[userId];
          if (!userRating) continue;

          if (userRating.striker > 0) ratings.striker.push(userRating.striker);
          if (userRating.mid > 0) ratings.mid.push(userRating.mid);
          if (userRating.defender > 0) ratings.defender.push(userRating.defender);
          if (userRating.gk > 0) ratings.gk.push(userRating.gk);
        }

        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const samples = Math.max(
          ratings.striker.length, ratings.mid.length,
          ratings.defender.length, ratings.gk.length
        );

        const autoRatings = {
          auto_striker_rating: avg(ratings.striker),
          auto_mid_rating: avg(ratings.mid),
          auto_defender_rating: avg(ratings.defender),
          auto_gk_rating: avg(ratings.gk),
          auto_rating_samples: samples,
          auto_rating_updated_at: FieldValue.serverTimestamp(),
        };

        await db().collection("users").doc(userId).update(autoRatings);
        await checkAndAwardRatingBadges(userId, {
          auto_striker_rating: autoRatings.auto_striker_rating,
          auto_mid_rating: autoRatings.auto_mid_rating,
          auto_defender_rating: autoRatings.auto_defender_rating,
          auto_gk_rating: autoRatings.auto_gk_rating,
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
