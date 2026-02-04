import * as admin from "firebase-admin";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";

// Initialize app if not already initialized (might be shared but standard pattern is usually safe)
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

export const generateActivityOnGameFinish = onDocumentUpdated("games/{gameId}", async (event) => {
  if (!event.data) return;

  const before = event.data.before.data();
  const after = event.data.after.data();
  const gameId = event.params.gameId;

  // Trigger only when status changes to FINISHED
  if (before.status !== "FINISHED" && after.status === "FINISHED") {
    // Idempotency check: check if we already marked this game as activity generated
    // Alternatively, check if activity exists.
    // We will store a flag on the game document to avoid duplicates
    if (after.activity_generated) {
      console.log(`Activity for game ${gameId} already generated.`);
      return;
    }

    console.log(`Generating activity for Game ${gameId}...`);

    try {
      // Fetch additional details for the activity
      const liveScoreDoc = await db.collection("live_scores").doc(gameId).get();
      let description = "Jogo finalizado! Confira os resultados e estatísticas.";

      // Fetch User details for the activity author (Game Owner)
      const userDoc = await db.collection("users").doc(after.owner_id).get();
      const userData = userDoc.data();
      const userName = userData ? userData.name : "Alguém";
      const userPhoto = userData ? userData.photoUrl : null;

      if (liveScoreDoc.exists) {
        const score = liveScoreDoc.data();
        if (score) {
          description = `Placar Final: Time A ${score.team1Score} x ${score.team2Score} Time B`;
        }
      }

      // Determine visibility based on game visibility
      // Map GAME VISIBILITY to ACTIVITY VISIBILITY
      // PUBLIC_OPEN / PUBLIC_CLOSED -> PUBLIC
      // PRIVATE -> FRIENDS_ONLY (or just PRIVATE/FRIENDS)
      let visibility = "PUBLIC";
      if (after.visibility === "GROUP_ONLY" || after.visibility === "PRIVATE") {
        visibility = "FRIENDS";
      } else if (after.is_public === false) {
        visibility = "FRIENDS";
      }

      const activity = {
        type: "GAME_FINISHED",
        title: after.name || "Futebol dos Parças",
        description: description,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        reference_id: gameId,
        reference_type: "GAME",
        user_id: after.owner_id,
        user_name: userName,
        user_photo: userPhoto,
        visibility: visibility,
        metadata: {
          location: after.locationName || "",
          game_id: gameId,
        },
      };

      const batch = db.batch();
      const activityRef = db.collection("activities").doc();

      batch.set(activityRef, activity);
      batch.update(event.data.after.ref, {activity_generated: true});

      await batch.commit();
      console.log(`Activity generated handling for ${gameId} complete.`);
    } catch (error) {
      console.error("Error generating activity for game:", error);
    }
  }
});
