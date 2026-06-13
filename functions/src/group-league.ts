import {logger} from "firebase-functions";
import {FieldValue} from "firebase-admin/firestore";
import {
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {FUNCTION_REGION} from "./constants";
import {db} from "./_db";

const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

/**
 * FIX #2494: resultado de um time pelo ranking de placar entre TODOS os times
 * do jogo (modelo "ranking por placar"). Maior placar = WIN, menor = LOSS,
 * intermediários = DRAW; todos empatados = DRAW. Com 2 times reduz exatamente
 * ao modelo clássico (vence quem fez mais gols).
 *
 * @param {number} score - Placar do time.
 * @param {number} maxScore - Maior placar do jogo.
 * @param {number} minScore - Menor placar do jogo.
 * @return {"WIN" | "DRAW" | "LOSS"} Resultado.
 */
export function rankResult(
  score: number,
  maxScore: number,
  minScore: number,
): "WIN" | "DRAW" | "LOSS" {
  if (maxScore === minScore) return "DRAW";
  if (score === maxScore) return "WIN";
  if (score === minScore) return "LOSS";
  return "DRAW";
}

/**
 * FIX #2494: placar "do oponente" = média (arredondada) dos DEMAIS times.
 * Com 2 times = placar do único oponente (idêntico ao comportamento antigo),
 * preservando a consistência de goals_conceded/goal_difference.
 *
 * @param {string} teamId - Time de referência.
 * @param {Array<{id: string, score: number}>} teamScores - Placares de todos.
 * @return {number} Média dos placares dos demais times.
 */
export function opponentAverage(
  teamId: string,
  teamScores: Array<{ id: string; score: number }>,
): number {
  const others = teamScores
    .filter((t) => t.id !== teamId)
    .map((t) => t.score);
  if (others.length === 0) return 0;
  return Math.round(others.reduce((a, b) => a + b, 0) / others.length);
}

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

    logger.info(
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
        logger.info(
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
        logger.info(
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
        logger.info(
          `[GROUP_LEAGUE] Insufficient data: ${teams.length} teams, ${confirmations.length} confirmations`
        );
        return;
      }

      // FIX #2494: pontuação multi-time (N >= 2) — modelo "ranking por placar"
      // (decisão de produto): maior placar = WIN, menor = LOSS, intermediários
      // = DRAW; opponentScore = média dos DEMAIS times (cada time comparado ao
      // campo). Com 2 times reduz EXATAMENTE ao modelo anterior (WIN/DRAW/LOSS
      // + opponentScore = placar do único oponente), mantendo consistência das
      // colunas wins/draws/losses/goal_difference. Substitui o skip-guard de
      // #2480 (que ignorava jogos >2 times) por pontuação real e justa.

      // Resolve o placar de cada time (Map por id).
      const teamScores = new Map<string, number>();
      if (teams.length === 2) {
        // Compat: jogos de 2 times podem trazer team{1,2}_score no doc.
        // Resolução posicional (FIX #2660): usa índices do array teams,
        // não nomes, para evitar colisão quando times têm nome igual.
        teamScores.set(teams[0].id, after.team1_score ?? teams[0].score);
        teamScores.set(teams[1].id, after.team2_score ?? teams[1].score);
      } else {
        for (const t of teams) teamScores.set(t.id, t.score);
      }

      const scoreOf = (id: string): number => teamScores.get(id) ?? 0;
      const allScores = teams.map((t) => scoreOf(t.id));
      const maxScore = Math.max(...allScores);
      const minScore = Math.min(...allScores);

      const resultForTeam = (id: string): "WIN" | "DRAW" | "LOSS" =>
        rankResult(scoreOf(id), maxScore, minScore);

      const opponentAvgFor = (id: string): number =>
        opponentAverage(
          id,
          teams.map((t) => ({id: t.id, score: scoreOf(t.id)}))
        );

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

        const result = resultForTeam(playerTeam.id);
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
          logger.info(
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
          const myTeamScore = scoreOf(pr.team_id);
          const opponentScore = opponentAvgFor(pr.team_id);

          const standingDocId = `${seasonId}_${pr.user_id}`;
          tx.set(
            standingsRef.doc(standingDocId),
            {
              user_id: pr.user_id,
              season_id: seasonId,
              group_id: groupId,
              points:
                FieldValue.increment(pointsEarned),
              games_played:
                FieldValue.increment(1),
              wins:
                FieldValue.increment(
                  pr.result === "WIN" ? 1 : 0
                ),
              draws:
                FieldValue.increment(
                  pr.result === "DRAW" ? 1 : 0
                ),
              losses:
                FieldValue.increment(
                  pr.result === "LOSS" ? 1 : 0
                ),
              goals_scored:
                FieldValue.increment(pr.goals),
              goals_conceded:
                FieldValue.increment(opponentScore),
              goal_difference:
                FieldValue.increment(
                  myTeamScore - opponentScore
                ),
              mvp_count:
                FieldValue.increment(
                  pr.is_mvp ? 1 : 0
                ),
              updated_at:
                FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
        }

        // FIX #2494: registro do match agora suporta N times via `teams`.
        // Mantém team1/team2_* (primeiros 2 times) para compat com leitores
        // antigos do doc de match.
        const teamSummaries = teams.map((t) => ({
          team_id: t.id,
          name: t.name,
          score: scoreOf(t.id),
          result: resultForTeam(t.id),
        }));
        tx.set(matchRef, {
          game_id: gameId,
          season_id: seasonId,
          group_id: groupId,
          teams: teamSummaries,
          num_teams: teams.length,
          team1_name: teamSummaries[0]?.name ?? "",
          team2_name: teamSummaries[1]?.name ?? "",
          team1_score: teamSummaries[0]?.score ?? 0,
          team2_score: teamSummaries[1]?.score ?? 0,
          date: after.date || "",
          player_results: playerResults,
          created_at: FieldValue.serverTimestamp(),
        });
      });

      logger.info(
        `[GROUP_LEAGUE] Game ${gameId} processed for group ${groupId} season ${seasonId}`
      );
    } catch (error) {
      logger.error(
        `[GROUP_LEAGUE] Error processing game ${gameId}:`,
        error
      );
      throw error;
    }
  }
);
