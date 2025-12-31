import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getWeek, getYear, format } from "date-fns";

admin.initializeApp();
const db = admin.firestore();

// ==========================================
// MODELS & INTERFACES
// ==========================================

interface Game {
    id: string;
    xp_processed: boolean;
    status: string; // "FINISHED"
    mvp_id?: string;
}

interface GameConfirmation {
    userId: string;
    status: string; // "CONFIRMED"
    position: string;
    goals: number;
    assists: number;
    saves: number;
    yellowCards: number;
    redCards: number;
    game_id: string;
}

interface Team {
    id: string;
    playerIds: string[];
    score: number;
}

interface LiveGameScore {
    gameId: string;
    team1Id: string;
    team2Id: string;
    team1Score: number;
    team2Score: number;
}

interface UserStatistics {
    totalGames: number;
    totalGoals: number;
    totalAssists: number;
    totalSaves: number;
    totalYellowCards: number;
    totalRedCards: number;
    gamesWon: number;
    gamesLost: number;
    gamesDraw: number;
    bestPlayerCount: number;
}

interface XpLog {
    user_id: string;
    game_id: string;
    xp_earned: number;
    xp_before: number;
    xp_after: number;
    level_before: number;
    level_after: number;
    xp_participation: number;
    xp_goals: number;
    xp_assists: number;
    xp_saves: number;
    xp_result: number;
    xp_mvp: number;
    xp_milestones: number;
    xp_streak: number;
    goals: number;
    assists: number;
    saves: number;
    was_mvp: boolean;
    game_result: string;
    milestones_unlocked: string[];
    created_at: admin.firestore.FieldValue;
}

interface GamificationSettings {
    xp_presence: number;
    xp_per_goal: number;
    xp_per_assist: number;
    xp_per_save: number;
    xp_win: number;
    xp_draw: number;
    xp_mvp: number;
    xp_streak_3: number;
    xp_streak_7: number;
    xp_streak_10: number;
}

// ==========================================
// CONSTANTS & LOGIC (Port from Kotlin)
// ==========================================

const DEFAULT_SETTINGS: GamificationSettings = {
    xp_presence: 10,
    xp_per_goal: 10,
    xp_per_assist: 7,
    xp_per_save: 5,
    xp_win: 20,
    xp_draw: 10,
    xp_mvp: 30,
    xp_streak_3: 20,
    xp_streak_7: 50,
    xp_streak_10: 100
};

// LevelTable Logic
const LEVELS = [
    { level: 0, xpRequired: 0 },
    { level: 1, xpRequired: 100 },
    { level: 2, xpRequired: 350 },
    { level: 3, xpRequired: 850 },
    { level: 4, xpRequired: 1850 },
    { level: 5, xpRequired: 3850 },
    { level: 6, xpRequired: 7350 },
    { level: 7, xpRequired: 12850 },
    { level: 8, xpRequired: 20850 },
    { level: 9, xpRequired: 32850 },
    { level: 10, xpRequired: 52850 }
];

function getLevelForXp(xp: number): number {
    const sorted = [...LEVELS].reverse();
    const found = sorted.find(l => xp >= l.xpRequired);
    return found ? found.level : 0;
}

// Milestone Logic (Simplified for TS)
type MilestoneDef = {
    name: string;
    xpReward: number;
    threshold: number;
    field: keyof UserStatistics;
};

const MILESTONES: MilestoneDef[] = [
    // Games
    { name: "GAMES_10", xpReward: 50, threshold: 10, field: "totalGames" },
    { name: "GAMES_25", xpReward: 100, threshold: 25, field: "totalGames" },
    { name: "GAMES_50", xpReward: 200, threshold: 50, field: "totalGames" },
    // Goals
    { name: "GOALS_10", xpReward: 50, threshold: 10, field: "totalGoals" },
    { name: "GOALS_25", xpReward: 100, threshold: 25, field: "totalGoals" },
    { name: "GOALS_50", xpReward: 200, threshold: 50, field: "totalGoals" },
    // Assists
    { name: "ASSISTS_10", xpReward: 50, threshold: 10, field: "totalAssists" },
    { name: "ASSISTS_25", xpReward: 100, threshold: 25, field: "totalAssists" },
    // Wins
    { name: "WINS_10", xpReward: 75, threshold: 10, field: "gamesWon" },
    { name: "WINS_25", xpReward: 150, threshold: 25, field: "gamesWon" }
    // ... add others as needed or full list
];

function checkMilestones(stats: UserStatistics, achieved: string[]): { newMilestones: string[], xp: number } {
    const newM: string[] = [];
    let xp = 0;
    
    for (const m of MILESTONES) {
        if (achieved.includes(m.name)) continue;
        if (stats[m.field] >= m.threshold) {
            newM.push(m.name);
            xp += m.xpReward;
        }
    }
    return { newMilestones: newM, xp };
}

// ==========================================
// CLOUD FUNCTION
// ==========================================

export const onGameStatusUpdate = onDocumentUpdated("games/{gameId}", async (event) => {
    if (!event.data) return;
    
    const before = event.data.before.data() as Game;
    const after = event.data.after.data() as Game;
    const gameId = event.params.gameId;

    // Check Trigger Conditions
    if (before.status !== "FINISHED" && after.status === "FINISHED") {
        if (after.xp_processed) {
            console.log(`Game ${gameId} already processed.`);
            return;
        }

        console.log(`Processing Game ${gameId} for XP...`);
        
        // 1. Fetch Dependencies
        const [confirmationsSnap, teamsSnap, liveScoreDoc, settingsSnap] = await Promise.all([
            db.collection("confirmations")
                .where("game_id", "==", gameId)
                .where("status", "==", "CONFIRMED")
                .get(),
            db.collection("teams").where("game_id", "==", gameId).get(),
            db.collection("live_scores").doc(gameId).get(),
            db.collection("app_settings").doc("gamification").get()
        ]);

        const confirmations = confirmationsSnap.docs.map(d => d.data() as GameConfirmation);
        const teams = teamsSnap.docs.map(d => d.data() as Team);
        const liveScore = liveScoreDoc.exists ? (liveScoreDoc.data() as LiveGameScore) : null;
        
        let settings = DEFAULT_SETTINGS;
        if (settingsSnap.exists) {
            settings = { ...DEFAULT_SETTINGS, ...settingsSnap.data() } as GamificationSettings;
        }

        if (confirmations.length < 6) {
            console.log("Not enough players. Marking processed.");
            await event.data.after.ref.update({ xp_processed: true });
            return;
        }

        // 2. Determine Results
        let teamResults: Record<string, "WIN" | "LOSS" | "DRAW"> = {};
        if (teams.length >= 2) {
             const t1 = teams.find(t => t.id === (liveScore ? liveScore.team1Id : teams[0].id));
             const t2 = teams.find(t => t.id === (liveScore ? liveScore.team2Id : teams[1].id));

             let s1 = t1 ? t1.score : 0;
             let s2 = t2 ? t2.score : 0;
             if (liveScore) {
                 s1 = liveScore.team1Score;
                 s2 = liveScore.team2Score;
             }

             if (t1 && t2) {
                 if (s1 > s2) {
                     teamResults[t1.id] = "WIN";
                     teamResults[t2.id] = "LOSS";
                 } else if (s2 > s1) {
                     teamResults[t1.id] = "LOSS";
                     teamResults[t2.id] = "WIN";
                 } else {
                     teamResults[t1.id] = "DRAW";
                     teamResults[t2.id] = "DRAW";
                 }
             }
        }

        // 3. Process Each Player
        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();

        for (const conf of confirmations) {
            const uid = conf.userId;
            const team = teams.find(t => t.playerIds.includes(uid));
            const result = team ? (teamResults[team.id] || "DRAW") : "DRAW";
            
            // Fetch User Data & Stats (Parallel)
            const [userDoc, statsDoc, streakDoc] = await Promise.all([
                db.collection("users").doc(uid).get(),
                db.collection("statistics").doc(uid).get(),
                db.collection("user_streaks").where("user_id", "==", uid).limit(1).get()
            ]);

            const userEntry = userDoc.data() || {};
            const currentXp = userEntry.experience_points || 0;
            const achievedMilestones = (userEntry.milestones_achieved || []) as string[];
            
            const stats = (statsDoc.exists ? statsDoc.data() : {
                totalGames: 0, totalGoals: 0, totalAssists: 0, totalSaves: 0,
                gamesWon: 0, gamesLost: 0, gamesDraw: 0, bestPlayerCount: 0
            }) as UserStatistics;

            const streak = !streakDoc.empty ? (streakDoc.docs[0].data().currentStreak || 0) : 0;
            const isMvp = after.mvp_id === uid;

            // Calc XP
            let xp = settings.xp_presence;
            xp += conf.goals * settings.xp_per_goal;
            xp += conf.assists * settings.xp_per_assist;
            xp += conf.saves * settings.xp_per_save;
            
            // Result XP
            if (result === "WIN") xp += settings.xp_win;
            else if (result === "DRAW") xp += settings.xp_draw;

            // MVP XP
            if (isMvp) xp += settings.xp_mvp;

            // Streak XP
            let streakXp = 0;
            if (streak >= 10) streakXp = settings.xp_streak_10;
            else if (streak >= 7) streakXp = settings.xp_streak_7;
            else if (streak >= 3) streakXp = settings.xp_streak_3;
            xp += streakXp;

            // Update Stats locally for Milestone Check
            const newStats = { ...stats };
            newStats.totalGames++;
            newStats.totalGoals += conf.goals;
            newStats.totalAssists += conf.assists;
            newStats.totalSaves += conf.saves;
            if (result === "WIN") newStats.gamesWon++;
            else if (result === "LOSS") newStats.gamesLost++;
            else newStats.gamesDraw++;
            if (isMvp) newStats.bestPlayerCount++;

            // Milestones
            const { newMilestones, xp: milesXp } = checkMilestones(newStats, achievedMilestones);
            xp += milesXp;

            // Final XP & Level
            const finalXp = currentXp + xp;
            const currentLevel = getLevelForXp(currentXp);
            const newLevel = getLevelForXp(finalXp);

            // Writes
            // 1. Update User
            const userUpdate: any = {
                experience_points: finalXp,
                level: newLevel,
                milestones_achieved: admin.firestore.FieldValue.arrayUnion(...newMilestones)
            };
            batch.update(db.collection("users").doc(uid), userUpdate);

            // 2. Update Stats
            batch.set(db.collection("statistics").doc(uid), newStats, { merge: true });

            // 3. Update Confirmation
            batch.update(db.collection("confirmations").doc(`${gameId}_${uid}`), { xp_earned: xp });

            // 4. Create Log
            const logRef = db.collection("xp_logs").doc();
            const log: XpLog = {
                user_id: uid,
                game_id: gameId,
                xp_earned: xp,
                xp_before: currentXp,
                xp_after: finalXp,
                level_before: currentLevel,
                level_after: newLevel,
                xp_participation: settings.xp_presence,
                xp_goals: conf.goals * settings.xp_per_goal,
                xp_assists: conf.assists * settings.xp_per_assist,
                xp_saves: conf.saves * settings.xp_per_save,
                xp_result: result === "WIN" ? settings.xp_win : (result === "DRAW" ? settings.xp_draw : 0),
                xp_mvp: isMvp ? settings.xp_mvp : 0,
                xp_milestones: milesXp,
                xp_streak: streakXp,
                goals: conf.goals,
                assists: conf.assists,
                saves: conf.saves,
                was_mvp: isMvp,
                game_result: result,
                milestones_unlocked: newMilestones,
                created_at: now
            };
            batch.set(logRef, log);
        }

        // Mark Game Processed
        batch.update(event.data.after.ref, { xp_processed: true, xp_processed_at: now });

        await batch.commit();
        console.log(`Game ${gameId} processing complete.`);
    }
});
