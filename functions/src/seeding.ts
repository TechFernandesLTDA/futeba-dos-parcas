
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

// 2. Constants
const START_DATE = new Date('2025-10-01T10:00:00'); // Start of Oct 2025
const END_DATE = new Date('2026-01-04T12:00:00');   // Today (Jan 4, 2026)
const GAME_LOCATION = "Arena Fernandes";
const GAME_NAME = "Pelada dos Parças";

// 3. Helper to generate dates
function getGameDates(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
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

export const seedDatabase = onRequest(async (request, response) => {
    // Basic protection (optional)
    if (request.query.secret !== "antigravity_seed") {
        response.status(403).send("Unauthorized");
        return;
    }

    try {
        const result = await seedLogic();
        // Check if the result indicates an error condition from seedLogic
        if (result.startsWith("Not enough users found.")) {
            response.status(500).send(result);
        } else {
            response.send(result);
        }
    } catch (e) {
        console.error(e);
        response.status(500).send(`Error: ${e}`);
    }
});

export const seedLogic = async () => {
    const db = admin.firestore();

    console.log("Fetching users...");
    const usersSnap = await db.collection('users').limit(4).get();
    if (usersSnap.empty || usersSnap.size < 4) {
        console.error("Not enough users found (need 4). Found: " + usersSnap.size);
        return `Not enough users found. Found ${usersSnap.size}, need 4.`;
    }

    const users = usersSnap.docs.map(d => ({ id: d.id, name: d.data().name || "Unknown" }));
    console.log(`Found users: ${users.map(u => u.name).join(', ')}`);

    // 0. Cleanup old seeded games
    console.log("Cleaning up old seeded games...");
    const oldGamesSnap = await db.collection('games').where('name', '==', GAME_NAME).get();
    for (const doc of oldGamesSnap.docs) {
        const batch = db.batch();
        const gid = doc.id;
        batch.delete(doc.ref);
        batch.delete(db.collection('live_scores').doc(gid));
        // Delete teams and confirmations would need queries, ignoring for now as they are many, 
        // but let's at least delete the game and live_score.
        await batch.commit();
    }

    const gameDates = getGameDates(START_DATE, END_DATE);
    console.log(`Generating ${gameDates.length} games...`);

    const createdGameIds: string[] = [];
    const gameDetailsMap = new Map<string, { score1: number, score2: number, mvpId: string }>();

    // 1. Create games as SCHEDULED
    let batch = db.batch();
    let opCount = 0;
    let index = 0;
    for (const date of gameDates) {
        const gameId = `seed_game_${index++}`;
        const gameRef = db.collection('games').doc(gameId);
        createdGameIds.push(gameId);

        const team1Users = [users[0], users[1]];
        const team2Users = [users[2], users[3]];
        const team1Id = `team_${gameId}_1`;
        const team2Id = `team_${gameId}_2`;

        // Force some 0 scores for Clean Sheets (PAREDAO)
        // Force some 3+ goals for HAT_TRICK
        let score1 = Math.floor(Math.random() * 5);
        let score2 = Math.floor(Math.random() * 5);
        if (index % 5 === 0) score2 = 0; // Clean sheet for Team 1 every 5 games
        if (index % 7 === 0) score1 = 0; // Clean sheet for Team 2 every 7 games

        const allUsers = [...team1Users, ...team2Users].filter(u => !!u);
        const mvp = allUsers[Math.floor(Math.random() * allUsers.length)];

        gameDetailsMap.set(gameId, { score1, score2, mvpId: mvp.id });

        batch.set(gameRef, {
            id: gameId,
            name: GAME_NAME,
            location: GAME_LOCATION,
            date: date.toISOString().split('T')[0],
            dateTime: admin.firestore.Timestamp.fromDate(date),
            status: "SCHEDULED",
            owner_id: users[0].id,
            team1Name: "A", team2Name: "B",
            team1Score: 0, team2Score: 0,
            team1Id, team2Id,
            xp_processed: false,
            created_at: admin.firestore.Timestamp.now()
        });

        batch.set(db.collection('teams').doc(team1Id), { id: team1Id, game_id: gameId, name: "A", score: score1, playerIds: team1Users.map(u => u.id) });
        batch.set(db.collection('teams').doc(team2Id), { id: team2Id, game_id: gameId, name: "B", score: score2, playerIds: team2Users.map(u => u.id) });

        for (let i = 0; i < allUsers.length; i++) {
            const u = allUsers[i];
            const confRef = db.collection('confirmations').doc(`${gameId}_${u.id}`);
            // Force HAT_TRICK for user 0 every 10 games
            let goals = (index % 10 === 0 && i === 0) ? 4 : (Math.random() > 0.7 ? 1 : 0);
            // Force Goalkeeper for user 1 and 3
            const isGoalkeeper = (i === 1 || i === 3);

            batch.set(confRef, {
                game_id: gameId, user_id: u.id, status: "CONFIRMED",
                goals: goals,
                assists: 1,
                saves: isGoalkeeper ? 5 : 0,
                position: isGoalkeeper ? "GOALKEEPER" : "AHEAD",
                yellow_cards: 0, red_cards: 0,
                created_at: admin.firestore.Timestamp.fromDate(date)
            });
        }

        batch.set(db.collection('live_scores').doc(gameId), {
            gameId, team1Id, team2Id,
            team1Score: score1, team2Score: score2, events: []
        });

        opCount += 10;
        if (opCount >= 400) {
            await batch.commit();
            batch = db.batch(); opCount = 0;
        }
    }
    if (opCount > 0) await batch.commit();

    console.log("Games created as SCHEDULED. Now updating to FINISHED to trigger Cloud Function...");
    // Wait a bit for Firestore to propagate
    await new Promise(r => setTimeout(r, 2000));

    // 2. Update to FINISHED
    batch = db.batch();
    opCount = 0;
    for (const gameId of createdGameIds) {
        const gameRef = db.collection('games').doc(gameId);
        const details = gameDetailsMap.get(gameId);

        if (details) {
            batch.update(gameRef, {
                status: "FINISHED",
                team1Score: details.score1,
                team2Score: details.score2,
                mvp_id: details.mvpId,
                xp_processed: false, // Triggers Cloud Function logic
                updated_at: admin.firestore.Timestamp.now()
            });
            opCount++;
        }


        if (opCount >= 450) {
            await batch.commit();
            batch = db.batch(); opCount = 0;
            await new Promise(r => setTimeout(r, 500)); // Small delay between batches
        }
    }
    if (opCount > 0) await batch.commit();

    return `Success! Seeded ${createdGameIds.length} games and triggered processing.`;
};
