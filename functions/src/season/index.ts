import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";

const db = admin.firestore();

/**
 * Scheduled job to check for season end and perform closing operations.
 * Runs every day at 03:00 AM.
 */
export const checkSeasonEnd = onSchedule("every day 03:00", async (event) => {
  console.log("Checking for seasons to close...");

  const now = new Date();
  // Find active seasons that have passed their end date
  // Note: Storing dates as strings YYYY-MM-DD in Firestore allows modification
  const todayStr = now.toISOString().split("T")[0];

  const seasonsRef = db.collection("seasons");
  const snapshot = await seasonsRef
    .where("is_active", "==", true)
    .where("end_date", "<", todayStr)
    .get();

  if (snapshot.empty) {
    console.log("No seasons to close.");
    return;
  }

  let batch = db.batch();
  let operationCount = 0;
  const BATCH_LIMIT = 500;

  const commitBatch = async () => {
    if (operationCount > 0) {
      await batch.commit();
      console.log(`Committed batch of ${operationCount} operations.`);
      batch = db.batch();
      operationCount = 0;
    }
  };

  for (const doc of snapshot.docs) {
    const seasonId = doc.id;
    const seasonData = doc.data();
    console.log(`Closing season: ${seasonId} (${seasonData.name})`);

    // 1. Mark Season as Inactive
    batch.update(doc.ref, {
      is_active: false,
      closed_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    operationCount++;
    if (operationCount >= BATCH_LIMIT) await commitBatch();

    // 2. Snapshot Final Standings
    const participationsSnap = await db.collection("season_participation")
      .where("season_id", "==", seasonId)
      .get();

    if (!participationsSnap.empty) {
      for (const partDoc of participationsSnap.docs) {
        const p = partDoc.data();

        // Create Final Standing Record
        const standingRef = db.collection("season_final_standings").doc();
        batch.set(standingRef, {
          season_id: seasonId,
          user_id: p.user_id,
          final_division: p.division,
          final_rating: p.league_rating || 0,
          points: p.points,
          wins: p.wins,
          draws: p.draws,
          losses: p.losses,
          frozen_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        operationCount++;
        if (operationCount >= BATCH_LIMIT) await commitBatch();

        // Optional: Create "History" badge if winner?
      }
    }

    // 3. Create Next Season (Auto-Renewal for Monthly)
    if (seasonId.startsWith("monthly")) {
      try {
        // ... (existing logic for next season calculation)
        const endDate = new Date(seasonData.end_date);
        const nextStartDate = new Date(endDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);

        const nextEndDate = new Date(nextStartDate.getFullYear(), nextStartDate.getMonth() + 1, 0);

        const nextMonthStr = (nextStartDate.getMonth() + 1).toString().padStart(2, "0");
        const nextYearStr = nextStartDate.getFullYear().toString();
        const nextId = `monthly_${nextYearStr}_${nextMonthStr}`;

        const nextName = `Temporada ${getMonthName(nextStartDate.getMonth())} ${nextYearStr}`;

        const nextSeasonRef = seasonsRef.doc(nextId);
        const nextSeasonSnap = await nextSeasonRef.get();

        if (!nextSeasonSnap.exists) {
          batch.set(nextSeasonRef, {
            name: nextName,
            start_date: nextStartDate.toISOString().split("T")[0],
            end_date: nextEndDate.toISOString().split("T")[0],
            is_active: true,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            type: "MONTHLY",
          });
          console.log(`Scheduled creation of next season: ${nextId}`);
          operationCount++;
          if (operationCount >= BATCH_LIMIT) await commitBatch();
        }
      } catch (e) {
        console.error("Error calculating next season", e);
        throw e; // Re-throw para permitir retry do Cloud Functions
      }
    }
  }

  await commitBatch();
  console.log(`Closed ${snapshot.size} seasons.`);
});

function getMonthName(monthIndex: number): string {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return months[monthIndex] || "";
}
