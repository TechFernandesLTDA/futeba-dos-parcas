
const admin = require("firebase-admin");

// 1. Initialize Firebase (assume CLI environment or default creds)
// Warning: If running locally without 'firebase emulators', you need GOOGLE_APPLICATION_CREDENTIALS
// or be logged in via 'gcloud auth application-default login'.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// 2. Constants
const START_DATE = new Date("2025-10-01T10:00:00"); // Start of Oct 2025
const END_DATE = new Date("2026-01-04T12:00:00"); // Today (Jan 4, 2026) -> Make sure to include this logic!
const GAME_LOCATION = "Arena Fernandes";
const GAME_NAME = "Pelada dos Parças";

// 3. Helper to generate dates
function getGameDates(start, end) {
  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    // Add current date (which is a Wednesday or Sunday, or we just force it)
    // Let's create games every Sunday (0) and Thursday (4)
    const day = current.getDay();
    if (day === 0 || day === 4) {
      // Clone date
      const gameDate = new Date(current);
      gameDate.setHours(21, 0, 0, 0); // 9 PM
      dates.push(gameDate);
    }
    // Next day
    current.setDate(current.getDate() + 1);
  }
  // Ensure END_DATE (today) is included if it matches pattern or forcing it
  const last = dates[dates.length - 1];
  if (end.toDateString() !== last.toDateString()) {
    // Force add today if it's Sunday (it is)
    if (end.getDay() === 0) {
      const d = new Date(end);
      d.setHours(10, 0, 0, 0); // Morning game
      dates.push(d);
    }
  }
  return dates;
}

// 4. Seeding Logic
async function seedData() {
  console.log("Fetching users...");
  const usersSnap = await db.collection("users").limit(4).get();
  if (usersSnap.empty || usersSnap.size < 4) {
    console.error("Not enough users found (need 4). Found: " + usersSnap.size);
    // Create dummy users if needed? No, user said existing.
    // If < 4, use what we have, but user said "for the 4 existing players".
  }

  const users = usersSnap.docs.map((d) => ({id: d.id, name: d.data().name || "Unknown"}));
  console.log(`Found users: ${users.map((u) => u.name).join(", ")}`);

  const gameDates = getGameDates(START_DATE, END_DATE);
  console.log(`Generating ${gameDates.length} games from ${START_DATE.toISOString()} to ${END_DATE.toISOString()}...`);

  const batchSize = 400; // conservative batch limit
  let batch = db.batch();
  let opCount = 0;

  for (const date of gameDates) {
    const gameRef = db.collection("games").doc();
    const gameId = gameRef.id;

    // Teams
    const team1Users = [users[0], users[1]];
    const team2Users = [users[2], users[3]];

    const team1Id = `team_${gameId}_1`;
    const team2Id = `team_${gameId}_2`;

    // Random Score
    const score1 = Math.floor(Math.random() * 6); // 0-5
    const score2 = Math.floor(Math.random() * 6);

    // Random MVP
    const allUsers = [...team1Users, ...team2Users].filter((u) => !!u); // filter undefined if < 4 users
    const mvp = allUsers[Math.floor(Math.random() * allUsers.length)];

    // 1. Create Game
    batch.set(gameRef, {
      id: gameId,
      name: GAME_NAME,
      location: GAME_LOCATION,
      date: date.toISOString().split("T")[0], // YYYY-MM-DD
      dateTime: admin.firestore.Timestamp.fromDate(date),
      status: "FINISHED",
      owner_id: users[0].id, // First user is owner
      team1Name: "Time A",
      team2Name: "Time B",
      team1Score: score1,
      team2Score: score2,
      team1Id: team1Id,
      team2Id: team2Id,
      mvp_id: mvp.id,
      xp_processed: false, // Let the cloud function (triggers) process XP if we wanted to trigger it!
      // But wait, if I bulk insert 50 games, 50 triggers will fire?
      // Yes. And that is GOOD because it will verify my new Cloud Logic for "onGameStatusUpdate".
      // However, bulk triggers can be noisy.
      // User asked to "fill data", usually implying static data. But my system relies on Cloud Functions for XP.
      // If I set "xp_processed: true", I have to calculate XP manually here.
      // If I set "xp_processed: false" and status "FINISHED", the trigger I just deployed SHOULD fire.
      // *Decision*: Let's set xp_processed: false so the Cloud Function populates the stats, badges, and history.
      // It simulates real usage.
      created_at: admin.firestore.Timestamp.now(),
    });
    opCount++;

    // 2. Create Teams
    const team1Ref = db.collection("teams").doc(team1Id);
    batch.set(team1Ref, {
      id: team1Id,
      game_id: gameId,
      name: "Time A",
      score: score1,
      player_ids: team1Users.map((u) => u.id),
    });
    opCount++;

    const team2Ref = db.collection("teams").doc(team2Id);
    batch.set(team2Ref, {
      id: team2Id,
      game_id: gameId,
      name: "Time B",
      score: score2,
      player_ids: team2Users.map((u) => u.id),
    });
    opCount++;

    // 3. Create Confirmations (Needed for XP calculation in Cloud Function)
    // Cloud function reads 'confirmations' collection to calc XP.
    for (const u of allUsers) {
      const confRef = db.collection("confirmations").doc(`${gameId}_${u.id}`);
      const isGoalkeeper = (Math.random() > 0.8); // 20% chance

      // Random stats
      const goals = (Math.random() > 0.7) ? Math.floor(Math.random() * 3) : 0;
      const assists = (Math.random() > 0.8) ? 1 : 0;
      const saves = isGoalkeeper ? Math.floor(Math.random() * 10) : 0;

      batch.set(confRef, {
        game_id: gameId,
        user_id: u.id,
        status: "CONFIRMED",
        goals: goals,
        assists: assists,
        saves: saves,
        position: isGoalkeeper ? "GOALKEEPER" : "AHEAD", // "LINHA" or "AHEAD"? Checking Enum... usually assumes string.
        yellow_cards: 0,
        red_cards: 0,
        created_at: admin.firestore.Timestamp.fromDate(date),
      });
      opCount++;
    }

    // 4. Create Live Score (Backend reads this for robust team ID mapping)
    const liveScoreRef = db.collection("live_scores").doc(gameId);
    batch.set(liveScoreRef, {
      gameId: gameId,
      team1Id: team1Id,
      team2Id: team2Id,
      team1Score: score1,
      team2Score: score2,
      events: [], // Empty events for now
    });
    opCount++;

    if (opCount >= batchSize) {
      console.log("Committing batch...");
      await batch.commit();
      batch = db.batch(); // Reset
      opCount = 0;
      // Delay slightly to not overwhelm triggers?
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (opCount > 0) {
    console.log("Committing final batch...");
    await batch.commit();
  }

  console.log("Seeding complete! Cloud Functions should pick up processing shortly.");
}

seedData().catch(console.error);
