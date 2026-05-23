import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {db} from "../_db";

interface DeleteLocationRequest {
  locationId: string;
}

interface CalculateAutoRatingsRequest {
  userId: string;
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
    const {locationId} = request.data;
    if (!locationId || typeof locationId !== "string") {
      throw new HttpsError("invalid-argument", "locationId must be a non-empty string");
    }

    const locRef = db().collection("locations").doc(locationId);
    const locDoc = await locRef.get();
    if (!locDoc.exists) {
      throw new HttpsError("not-found", `Location ${locationId} not found`);
    }

    const subcollections = ["reviews", "fields", "availability", "audit_logs"];
    let deletedCount = 0;

    for (const sub of subcollections) {
      const subRef = locRef.collection(sub);
      const snap = await subRef.get();
      if (snap.empty) continue;

      const batch = db().batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedCount += snap.size;
    }

    await locRef.delete();
    deletedCount += 1;

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
      auto_rating_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true};
  }
);
