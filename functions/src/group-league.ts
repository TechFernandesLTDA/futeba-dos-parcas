import * as admin from "firebase-admin";
import {
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {FUNCTION_REGION} from "./constants";
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

    const matchRef = db()
      .collection("groups")
      .doc(groupId)
      .collection("league_matches")
      .doc(gameId);

    try {
      const matchSnap = await matchRef.get();
      if (matchSnap.exists) {
        console.log(
          `[GROUP_LEAGUE] Game ${gameId} already processed for group ${groupId}, skipping (idempotency guard)`
        );
        return;
      }

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

      const team1Name = after.team1_name;
      const team2Name = after.team2_name;

      const team1 = team1Name ?
        teams.find((t) => t.name === team1Name) || teams[0] :
        teams[0];
      const team2 = team2Name ?
        teams.find((t) => t.name === team2Name) || teams[1] :
        teams[1];

      const team1Score = after.team1_score ?? team1.score;
      const team2Score = after.team2_score ?? team2.score;
      const draw = team1Score === team2Score;
      const team1Won = !draw && team1Score > team2Score;

      const standingsRef = db()
        .collection("groups")
        .doc(groupId)
        .collection("league_standings");

      const playerResults: Array<{
        user_id: string;
        team_id: string;
        goals: number;
        assists: number;
        is_mvp: boolean;
        result: "WIN" | "DRAW" | "LOSS";
      }> = [];
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
        playerResults.push({
          user_id: conf.userId,
          team_id: playerTeam.id,
          goals: conf.goals,
          assists: conf.assists,
          is_mvp: conf.isMvp,
          result,
        });
      }

      await db().runTransaction(async (tx) => {
        const matchSnap = await tx.get(matchRef);
        if (matchSnap.exists) {
          console.log(
            `[GROUP_LEAGUE] Game ${gameId} already processed, skipping (atomic idempotency guard)`
          );
          return;
        }

        for (const pr of playerResults) {
          const pointsEarned =
            pr.result === "WIN" ?
              POINTS_WIN :
              pr.result === "DRAW" ?
                POINTS_DRAW :
                POINTS_LOSS;
          const myTeamScore =
            pr.team_id === team1.id ? team1Score : team2Score;
          const opponentScore =
            pr.team_id === team1.id ? team2Score : team1Score;

          const standingDocId = `${seasonId}_${pr.user_id}`;
          tx.set(
            standingsRef.doc(standingDocId),
            {
              user_id: pr.user_id,
              season_id: seasonId,
              group_id: groupId,
              points:
                admin.firestore.FieldValue.increment(pointsEarned),
              games_played:
                admin.firestore.FieldValue.increment(1),
              wins:
                admin.firestore.FieldValue.increment(
                  pr.result === "WIN" ? 1 : 0
                ),
              draws:
                admin.firestore.FieldValue.increment(
                  pr.result === "DRAW" ? 1 : 0
                ),
              losses:
                admin.firestore.FieldValue.increment(
                  pr.result === "LOSS" ? 1 : 0
                ),
              goals_scored:
                admin.firestore.FieldValue.increment(pr.goals),
              goals_conceded:
                admin.firestore.FieldValue.increment(opponentScore),
              goal_difference:
                admin.firestore.FieldValue.increment(
                  myTeamScore - opponentScore
                ),
              mvp_count:
                admin.firestore.FieldValue.increment(
                  pr.is_mvp ? 1 : 0
                ),
              updated_at:
                admin.firestore.FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
        }

        tx.set(matchRef, {
          game_id: gameId,
          season_id: seasonId,
          group_id: groupId,
          team1_name: team1Name || team1.name,
          team2_name: team2Name || team2.name,
          team1_score: team1Score,
          team2_score: team2Score,
          date: after.date || "",
          player_results: playerResults,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
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
