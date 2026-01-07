import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import {
    calculateLeaguePromotion,
    calculateLeagueRating as leagueRatingCalc,
    PROMOTION_GAMES_REQUIRED,
    RELEGATION_GAMES_REQUIRED
} from "./league";

admin.initializeApp();
const db = admin.firestore();

// ==========================================
// MODELS & INTERFACES
// ==========================================

interface Game {
    id: string;
    xp_processed?: boolean;
    xp_processing?: boolean;
    status: string; // "FINISHED"
    mvp_id?: string;
    owner_id: string;
    date?: string;
    dateTime?: admin.firestore.Timestamp;
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

// LevelTable Logic (Synced with Kotlin LevelTable.kt)
const LEVELS = [
    { level: 0, name: "Novato", xpRequired: 0 },
    { level: 1, name: "Iniciante", xpRequired: 100 },
    { level: 2, name: "Amador", xpRequired: 350 },
    { level: 3, name: "Regular", xpRequired: 850 },
    { level: 4, name: "Experiente", xpRequired: 1850 },
    { level: 5, name: "Habilidoso", xpRequired: 3850 },
    { level: 6, name: "Profissional", xpRequired: 7350 },
    { level: 7, name: "Expert", xpRequired: 12850 },
    { level: 8, name: "Mestre", xpRequired: 20850 },
    { level: 9, name: "Lenda", xpRequired: 32850 },
    { level: 10, name: "Imortal", xpRequired: 52850 }
];

function getLevelForXp(xp: number): number {
    const sorted = [...LEVELS].reverse();
    const found = sorted.find(l => xp >= l.xpRequired);
    return found ? found.level : 0;
}

// Milestone Logic (Synced with Kotlin Gamification.kt)
type MilestoneDef = {
    name: string;
    xpReward: number;
    threshold: number;
    field: keyof UserStatistics;
};

const MILESTONES: MilestoneDef[] = [
    // Jogos
    { name: "GAMES_10", xpReward: 50, threshold: 10, field: "totalGames" },
    { name: "GAMES_25", xpReward: 100, threshold: 25, field: "totalGames" },
    { name: "GAMES_50", xpReward: 200, threshold: 50, field: "totalGames" },
    { name: "GAMES_100", xpReward: 500, threshold: 100, field: "totalGames" },
    { name: "GAMES_250", xpReward: 1000, threshold: 250, field: "totalGames" },
    { name: "GAMES_500", xpReward: 2500, threshold: 500, field: "totalGames" },

    // Gols
    { name: "GOALS_10", xpReward: 50, threshold: 10, field: "totalGoals" },
    { name: "GOALS_25", xpReward: 100, threshold: 25, field: "totalGoals" },
    { name: "GOALS_50", xpReward: 200, threshold: 50, field: "totalGoals" },
    { name: "GOALS_100", xpReward: 500, threshold: 100, field: "totalGoals" },
    { name: "GOALS_250", xpReward: 1000, threshold: 250, field: "totalGoals" },

    // Assistencias
    { name: "ASSISTS_10", xpReward: 50, threshold: 10, field: "totalAssists" },
    { name: "ASSISTS_25", xpReward: 100, threshold: 25, field: "totalAssists" },
    { name: "ASSISTS_50", xpReward: 200, threshold: 50, field: "totalAssists" },
    { name: "ASSISTS_100", xpReward: 500, threshold: 100, field: "totalAssists" },

    // Defesas
    { name: "SAVES_25", xpReward: 50, threshold: 25, field: "totalSaves" },
    { name: "SAVES_50", xpReward: 100, threshold: 50, field: "totalSaves" },
    { name: "SAVES_100", xpReward: 200, threshold: 100, field: "totalSaves" },
    { name: "SAVES_250", xpReward: 500, threshold: 250, field: "totalSaves" },

    // MVPs
    { name: "MVP_5", xpReward: 100, threshold: 5, field: "bestPlayerCount" },
    { name: "MVP_10", xpReward: 300, threshold: 10, field: "bestPlayerCount" },
    { name: "MVP_25", xpReward: 750, threshold: 25, field: "bestPlayerCount" },
    { name: "MVP_50", xpReward: 1500, threshold: 50, field: "bestPlayerCount" },

    // Vitorias
    { name: "WINS_10", xpReward: 75, threshold: 10, field: "gamesWon" },
    { name: "WINS_25", xpReward: 150, threshold: 25, field: "gamesWon" },
    { name: "WINS_50", xpReward: 300, threshold: 50, field: "gamesWon" },
    { name: "WINS_100", xpReward: 750, threshold: 100, field: "gamesWon" }
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

    // ==========================================
    // SECURITY VALIDATION
    // ==========================================

    // 1. Validate owner_id exists
    if (!after.owner_id) {
        console.error(`[SECURITY] Game ${gameId}: Missing owner_id. Blocking processing.`);
        return;
    }

    // 2. Validate owner exists in users collection
    const ownerDoc = await db.collection("users").doc(after.owner_id).get();
    if (!ownerDoc.exists) {
        console.error(`[SECURITY] Game ${gameId}: owner_id ${after.owner_id} not found in users. Blocking processing.`);
        return;
    }

    // 3. Log status change for audit trail
    if (before.status !== after.status) {
        console.log(`[AUDIT] Game ${gameId}: Status changed ${before.status} -> ${after.status} by owner ${after.owner_id}`);
    }

    // Check Trigger Conditions: Status changed to FINISHED and xp not yet processed
    if (before.status !== "FINISHED" && after.status === "FINISHED") {
        const gameRef = event.data.after.ref;
        const lockResult = await db.runTransaction(async (tx) => {
            const freshSnap = await tx.get(gameRef);
            const fresh = freshSnap.data() as Game | undefined;
            if (!fresh) {
                return { shouldProcess: false, reason: "missing" as const };
            }
            if (fresh.xp_processed) {
                return { shouldProcess: false, reason: "processed" as const };
            }
            if (fresh.xp_processing) {
                return { shouldProcess: false, reason: "processing" as const };
            }
            tx.update(gameRef, {
                xp_processing: true,
                xp_processing_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { shouldProcess: true, reason: "locked" as const };
        });

        if (!lockResult.shouldProcess) {
            console.log(`Game ${gameId} skipped (${lockResult.reason}).`);
            return;
        }

        console.log(`Processing Game ${gameId} for XP...`);

        try {
            // 1. Fetch Dependencies
            const [confirmationsSnap, teamsSnap, liveScoreDoc, settingsSnap, seasonSnap, gameSnap] = await Promise.all([
                db.collection("confirmations")
                    .where("game_id", "==", gameId)
                    .where("status", "==", "CONFIRMED")
                    .get(),
                db.collection("teams").where("game_id", "==", gameId).get(),
                db.collection("live_scores").doc(gameId).get(),
                db.collection("app_settings").doc("gamification").get(),
                db.collection("seasons").where("is_active", "==", true).limit(1).get(),
                db.collection("games").doc(gameId).get()
            ]);

            const confirmations = confirmationsSnap.docs.map(d => toGameConfirmation(d.data()));
            const teams = teamsSnap.docs.map(d => toTeam(d.id, d.data()));
            const liveScore = liveScoreDoc.exists ? toLiveScore(liveScoreDoc.data()) : null;
            const activeSeason = !seasonSnap.empty ? seasonSnap.docs[0].id : null;
            const gameDoc = gameSnap.data() as Game | undefined;

            let settings = DEFAULT_SETTINGS;
            if (settingsSnap.exists) {
                settings = { ...DEFAULT_SETTINGS, ...settingsSnap.data() } as GamificationSettings;
            }

            if (confirmations.length < 4) {
                console.log("Not enough players. Marking processed.");
                await event.data.after.ref.update({
                    xp_processed: true,
                    xp_processing: false,
                    xp_processed_at: admin.firestore.FieldValue.serverTimestamp()
                });
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

            // Date keys for Rankings
            const d = getGameDate(gameDoc);
            const monthKey = d.toISOString().substring(0, 7); // yyyy-MM
            const weekKey = getWeekKey(d);

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
                    totalYellowCards: 0, totalRedCards: 0,
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
                const newStats: UserStatistics = {
                    ...stats,
                    totalGames: (stats.totalGames || 0) + 1,
                    totalGoals: (stats.totalGoals || 0) + conf.goals,
                    totalAssists: (stats.totalAssists || 0) + conf.assists,
                    totalSaves: (stats.totalSaves || 0) + conf.saves,
                    totalYellowCards: (stats.totalYellowCards || 0) + conf.yellowCards,
                    totalRedCards: (stats.totalRedCards || 0) + conf.redCards,
                    gamesWon: (stats.gamesWon || 0) + (result === "WIN" ? 1 : 0),
                    gamesLost: (stats.gamesLost || 0) + (result === "LOSS" ? 1 : 0),
                    gamesDraw: (stats.gamesDraw || 0) + (result === "DRAW" ? 1 : 0),
                    bestPlayerCount: (stats.bestPlayerCount || 0) + (isMvp ? 1 : 0)
                };

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
                    updated_at: now
                };
                if (newMilestones.length > 0) {
                    userUpdate.milestones_achieved = admin.firestore.FieldValue.arrayUnion(...newMilestones);
                }
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

                // 5. Update Ranking Deltas
                updateRankingDeltas(batch, uid, conf, result, xp, isMvp, weekKey, monthKey);

                // 6. Update Season (if active)
                // 6. Update Season (if active)
                if (activeSeason) {
                    updateSeasonParticipation(batch, uid, activeSeason, result, conf, isMvp);
                }

                // 7. Award Badges (Cloud Integrity)
                // Award Badges

                const awardFullBadge = (badgeId: string) => {
                    const docId = `${uid}_${badgeId}`;
                    const badgeRef = db.collection("user_badges").doc(docId);

                    batch.set(badgeRef, {
                        user_id: uid,
                        badge_id: badgeId,
                        unlocked_at: admin.firestore.FieldValue.serverTimestamp(),
                        last_earned_at: admin.firestore.FieldValue.serverTimestamp(),
                        count: admin.firestore.FieldValue.increment(1)
                    }, { merge: true });
                };

                // STREAK BADGES
                if (streak >= 30) awardFullBadge("STREAK_30");
                else if (streak >= 7) awardFullBadge("STREAK_7");

                // HAT_TRICK
                if (conf.goals >= 3) awardFullBadge("HAT_TRICK");

                // PAREDAO (Clean Sheet for Goalkeeper)
                if (conf.position === "GOALKEEPER") {
                    let opponentScore = -1;
                    if (liveScore) {
                        if (team && team.id === liveScore.team1Id) opponentScore = liveScore.team2Score;
                        else if (team && team.id === liveScore.team2Id) opponentScore = liveScore.team1Score;
                    } else {
                        // Fallback to team scores if live score missing (legacy)
                        // Find opponent team
                        if (teams.length >= 2 && team) {
                            const opponent = teams.find(t => t.id !== team.id);
                            if (opponent) opponentScore = opponent.score;
                        }
                    }

                    if (opponentScore === 0) {
                        awardFullBadge("PAREDAO");
                    }
                }
            }

            // Mark Game Processed
            batch.update(event.data.after.ref, {
                xp_processed: true,
                xp_processing: false,
                xp_processed_at: now
            });

            await batch.commit();
            console.log(`Game ${gameId} processing complete.`);
        } catch (error) {
            console.error(`Game ${gameId} processing failed.`, error);
            await event.data.after.ref.update({
                xp_processing: false,
                xp_processing_error: String(error)
            });
        }
    }
});

function getWeekKey(d: Date): string {
    const year = d.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

function toGameConfirmation(raw: admin.firestore.DocumentData): GameConfirmation {
    return {
        userId: raw.user_id ?? raw.userId ?? "",
        status: raw.status ?? "CONFIRMED",
        position: raw.position ?? "",
        goals: Number(raw.goals ?? 0),
        assists: Number(raw.assists ?? 0),
        saves: Number(raw.saves ?? 0),
        yellowCards: Number(raw.yellow_cards ?? raw.yellowCards ?? 0),
        redCards: Number(raw.red_cards ?? raw.redCards ?? 0),
        game_id: raw.game_id ?? raw.gameId ?? ""
    };
}

function toTeam(id: string, raw: admin.firestore.DocumentData): Team {
    return {
        id: raw.id ?? id,
        playerIds: (raw.player_ids ?? raw.playerIds ?? []) as string[],
        score: Number(raw.score ?? 0)
    };
}

function toLiveScore(raw?: admin.firestore.DocumentData | null): LiveGameScore | null {
    if (!raw) return null;
    return {
        gameId: raw.game_id ?? raw.gameId ?? "",
        team1Id: raw.team1_id ?? raw.team1Id ?? "",
        team2Id: raw.team2_id ?? raw.team2Id ?? "",
        team1Score: Number(raw.team1_score ?? raw.team1Score ?? 0),
        team2Score: Number(raw.team2_score ?? raw.team2Score ?? 0)
    };
}

function getGameDate(game?: Game): Date {
    if (!game) return new Date();
    if (game.dateTime && typeof game.dateTime.toDate === "function") {
        return game.dateTime.toDate();
    }
    if (game.date) {
        const parsed = new Date(game.date);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

function updateRankingDeltas(
    batch: admin.firestore.WriteBatch,
    uid: string,
    conf: GameConfirmation,
    result: string,
    xp: number,
    isMvp: boolean,
    weekKey: string,
    monthKey: string
) {
    const fields = {
        goals_added: admin.firestore.FieldValue.increment(conf.goals),
        assists_added: admin.firestore.FieldValue.increment(conf.assists),
        saves_added: admin.firestore.FieldValue.increment(conf.saves),
        xp_added: admin.firestore.FieldValue.increment(xp),
        games_added: admin.firestore.FieldValue.increment(1),
        wins_added: admin.firestore.FieldValue.increment(result === "WIN" ? 1 : 0),
        mvp_added: admin.firestore.FieldValue.increment(isMvp ? 1 : 0),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const weekId = `week_${weekKey}_${uid}`;
    batch.set(db.collection("ranking_deltas").doc(weekId), {
        user_id: uid,
        period: "week",
        period_key: weekKey,
        ...fields
    }, { merge: true });

    const monthId = `month_${monthKey}_${uid}`;
    batch.set(db.collection("ranking_deltas").doc(monthId), {
        user_id: uid,
        period: "month",
        period_key: monthKey,
        ...fields
    }, { merge: true });
}

function updateSeasonParticipation(
    batch: admin.firestore.WriteBatch,
    uid: string,
    seasonId: string,
    result: string,
    conf: GameConfirmation,
    isMvp: boolean
) {
    const partId = `${seasonId}_${uid}`;
    const pointsToAdd = result === "WIN" ? 3 : (result === "DRAW" ? 1 : 0);

    batch.set(db.collection("season_participation").doc(partId), {
        user_id: uid,
        season_id: seasonId,
        points: admin.firestore.FieldValue.increment(pointsToAdd),
        games_played: admin.firestore.FieldValue.increment(1),
        wins: admin.firestore.FieldValue.increment(result === "WIN" ? 1 : 0),
        draws: admin.firestore.FieldValue.increment(result === "DRAW" ? 1 : 0),
        losses: admin.firestore.FieldValue.increment(result === "LOSS" ? 1 : 0),
        goals_scored: admin.firestore.FieldValue.increment(conf.goals),
        assists: admin.firestore.FieldValue.increment(conf.assists),
        mvp_count: admin.firestore.FieldValue.increment(isMvp ? 1 : 0),
        last_calculated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// ==========================================
// RECALCULAR LEAGUE RATING E DIVISÃO
// ==========================================

export const recalculateLeagueRating = onDocumentUpdated(
    "season_participation/{partId}",
    async (event) => {
        if (!event.data) return;

        const partId = event.params.partId;
        const before = event.data.before.data();
        const after = event.data.after.data();
        const userId = after.user_id;

        // ==========================================
        // SECURITY VALIDATION
        // ==========================================

        // 1. Validate user_id exists
        if (!userId) {
            console.error(`[SECURITY] Participation ${partId}: Missing user_id. Blocking processing.`);
            return;
        }

        // 2. Validate user exists in users collection
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            console.error(`[SECURITY] Participation ${partId}: user_id ${userId} not found. Blocking processing.`);
            return;
        }

        // 3. Log for audit trail
        console.log(`[AUDIT] Participation ${partId}: Processing for user ${userId}`);

        // CRITICAL: Evitar loop infinito - só recalcular se games_played mudou
        // Se league_rating/division/recent_games mudaram, significa que NÓS atualizamos
        const gamesPlayedBefore = before?.games_played || 0;
        const gamesPlayedAfter = after?.games_played || 0;

        if (gamesPlayedBefore === gamesPlayedAfter) {
            // Nenhum novo jogo foi adicionado, provavelmente foi nossa própria atualização
            console.log(`Skipping recalculation for ${partId} - no new games (${gamesPlayedAfter} games)`);
            return;
        }

        console.log(`Recalculating rating for ${partId}: ${gamesPlayedBefore} -> ${gamesPlayedAfter} games`);

        try {
            // Buscar últimos 10 xp_logs deste usuário
            const xpLogsSnap = await db.collection("xp_logs")
                .where("user_id", "==", userId)
                .orderBy("created_at", "desc")
                .limit(10)
                .get();

            const recentGames = xpLogsSnap.docs.map(doc => {
                const log = doc.data();
                const won = log.game_result === "WIN";
                const drew = log.game_result === "DRAW";

                return {
                    game_id: log.game_id,
                    xp_earned: log.xp_earned || 0,
                    won: won,
                    drew: drew,
                    goal_diff: log.goals - (won ? 0 : drew ? 0 : 1), // Heurística simples
                    was_mvp: log.was_mvp || false,
                    played_at: log.created_at
                };
            });

            // Calcular League Rating usando a nova função importada
            const leagueRating = leagueRatingCalc(recentGames);

            // Buscar estado atual de promoção/rebaixamento
            const currentDivision = after.division || "BRONZE";
            const currentPromotionProgress = after.promotion_progress || 0;
            const currentRelegationProgress = after.relegation_progress || 0;
            const currentProtectionGames = after.protection_games || 0;

            // Calcular novo estado com lógica de promoção/rebaixamento
            const newLeagueState = calculateLeaguePromotion(
                {
                    division: currentDivision,
                    promotionProgress: currentPromotionProgress,
                    relegationProgress: currentRelegationProgress,
                    protectionGames: currentProtectionGames
                },
                leagueRating
            );

            // Atualizar documento (não triggera loop pois games_played não muda)
            await db.collection("season_participation").doc(partId).update({
                league_rating: leagueRating,
                division: newLeagueState.division,
                promotion_progress: newLeagueState.promotionProgress,
                relegation_progress: newLeagueState.relegationProgress,
                protection_games: newLeagueState.protectionGames,
                recent_games: recentGames
            });

            console.log(`[LEAGUE] Rating: ${leagueRating.toFixed(1)} | Div: ${newLeagueState.division} | Promo: ${newLeagueState.promotionProgress}/${PROMOTION_GAMES_REQUIRED} | Releg: ${newLeagueState.relegationProgress}/${RELEGATION_GAMES_REQUIRED} | Protect: ${newLeagueState.protectionGames}`);
        } catch (e) {
            console.error(`Erro ao recalcular rating para ${partId}:`, e);
        }
    }
);

// Funções calculateLeagueRating e getDivisionForRating movidas para league.ts
// Ver também: calculateLeaguePromotion para lógica de promoção/rebaixamento

export * from "./activities";
export * from "./season";
export * from "./seeding";
