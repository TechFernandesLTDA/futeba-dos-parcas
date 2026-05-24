import * as admin from "firebase-admin";
import {
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {FUNCTION_REGION, FIRESTORE_BATCH_SAFE_LIMIT} from "./constants";
import {db} from "./_db";

const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

export const onGameFinishedGroupLeague = onDocumentUpdated(
  {
    document: "games/{gameId}",
    region: FUNCTION_REGION,
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();
    const gameId = event.params.gameId;

    if (before.status === "FINISHED" || after.status !== "FINISHED") {
      return;
    }

    const groupId = after.group_id;
    if (!groupId) {
      return;
    }

    console.log(
      `[GROUP_LEAGUE] Processing game ${gameId} for group ${groupId}`
    );

    try {
      const [activeSeasonSnap, confirmationsSnap, teamsSnap] =
        await Promise.all([
          db()
            .collection("groups")
            .doc(groupId)
            .collection("league_seasons")
            .where("is_active", "==", true)
            .limit(1)
            .get(),
          db()
            .collection("confirmations")
            .where("game_id", "==", gameId)
            .where("status", "==", "CONFIRMED")
            .get(),
          db()
            .collection("teams")
            .where("game_id", "==", gameId)
            .get(),
        ]);

      if (activeSeasonSnap.empty) {
        console.log(
          `[GROUP_LEAGUE] No active season for group ${groupId}, skipping`
        );
        return;
      }

      const seasonDoc = activeSeasonSnap.docs[0];
      const seasonId = seasonDoc.id;

      const confirmations = confirmationsSnap.docs.map((d) => ({
        id: d.id,
        userId: (d.data().user_id as string) || "",
        goals: (d.data().goals as number) || 0,
        assists: (d.data().assists as number) || 0,
        isMvp: (d.data().is_mvp as boolean) || false,
      }));

      const teams = teamsSnap.docs.map((d) => ({
        id: d.id,
        gameId: (d.data().game_id as string) || "",
        name: (d.data().name as string) || "Time",
        playerIds: (d.data().player_ids as string[]) || [],
        score: (d.data().score as number) || 0,
      }));

      if (teams.length < 2 || confirmations.length === 0) {
        console.log(
          `[GROUP_LEAGUE] Insufficient data: ${teams.length} teams, ${confirmations.length} confirmations`
        );
        return;
      }

      const team1 = teams[0];
      const team2 = teams[1];
      const team1Score = after.team1_score ?? team1.score;
      const team2Score = after.team2_score ?? team2.score;
      const draw = team1Score === team2Score;
      const team1Won = !draw && team1Score > team2Score;

      const batch = db().batch();
      const standingsRef = db()
        .collection("groups")
        .doc(groupId)
        .collection("league_standings");

      let batchOps = 0;

      for (const conf of confirmations) {
        if (!conf.userId) continue;

        const playerTeam = teams.find((t) =>
          t.playerIds.includes(conf.userId)
        );
        if (!playerTeam) continue;

        let result: "WIN" | "DRAW" | "LOSS" = "DRAW";
        if (!draw) {
          const playerOnTeam1 = playerTeam.id === team1.id;
          result = (playerOnTeam1 && team1Won) || (!playerOnTeam1 && !team1Won) ?
            "WIN" :
            "LOSS";
        }

        const myTeamScore =
          playerTeam.id === team1.id ? team1Score : team2Score;
        const opponentScore =
          playerTeam.id === team1.id ? team2Score : team1Score;

        const pointsEarned =
          result === "WIN" ?
            POINTS_WIN :
            result === "DRAW" ?
              POINTS_DRAW :
              POINTS_LOSS;

        const standingDocId = `${seasonId}_${conf.userId}`;
        const standingRef = standingsRef.doc(standingDocId);

        batch.set(
          standingRef,
          {
            user_id: conf.userId,
            season_id: seasonId,
            group_id: groupId,
            points: admin.firestore.FieldValue.increment(pointsEarned),
            games_played: admin.firestore.FieldValue.increment(1),
            wins: admin.firestore.FieldValue.increment(
              result === "WIN" ? 1 : 0
            ),
            draws: admin.firestore.FieldValue.increment(
              result === "DRAW" ? 1 : 0
            ),
            losses: admin.firestore.FieldValue.increment(
              result === "LOSS" ? 1 : 0
            ),
            goals_scored: admin.firestore.FieldValue.increment(conf.goals),
            goals_conceded: admin.firestore.FieldValue.increment(opponentScore),
            goal_difference: admin.firestore.FieldValue.increment(
              myTeamScore - opponentScore
            ),
            mvp_count: admin.firestore.FieldValue.increment(
              conf.isMvp ? 1 : 0
            ),
            updated_at:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
        batchOps++;

        if (batchOps >= FIRESTORE_BATCH_SAFE_LIMIT) {
          await batch.commit();
          console.log(
            `[GROUP_LEAGUE] Committed batch of ${batchOps} ops`
          );
          batchOps = 0;
        }
      }

      if (batchOps > 0) {
        await batch.commit();
        console.log(
          `[GROUP_LEAGUE] Committed final batch of ${batchOps} ops`
        );
      }

      const matchRef = db()
        .collection("groups")
        .doc(groupId)
        .collection("league_matches")
        .doc(gameId);

      const playerResults = confirmations
        .filter((c) => {
          const t = teams.find((t) => t.playerIds.includes(c.userId));
          return !!t;
        })
        .map((c) => {
          const playerTeam = teams.find((t) =>
            t.playerIds.includes(c.userId)
          )!;
          const isTeam1 = playerTeam.id === team1.id;
          const res: "WIN" | "DRAW" | "LOSS" = draw ?
            "DRAW" :
            (isTeam1 && team1Won) || (!isTeam1 && !team1Won) ?
              "WIN" :
              "LOSS";
          return {
            user_id: c.userId,
            team_id: playerTeam.id,
            goals: c.goals,
            assists: c.assists,
            is_mvp: c.isMvp,
            result: res,
          };
        });

      await matchRef.set({
        game_id: gameId,
        season_id: seasonId,
        group_id: groupId,
        team1_name: after.team1_name || team1.name,
        team2_name: after.team2_name || team2.name,
        team1_score: team1Score,
        team2_score: team2Score,
        date: after.date || "",
        player_results: playerResults,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `[GROUP_LEAGUE] Game ${gameId} processed for group ${groupId} season ${seasonId}`
      );
    } catch (error) {
      console.error(
        `[GROUP_LEAGUE] Error processing game ${gameId}:`,
        error
      );
      throw error;
    }
  }
);
