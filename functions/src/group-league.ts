import {logger} from "firebase-functions";
import {FieldValue} from "firebase-admin/firestore";
import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {db} from "./_db";
import {
  clampStat,
  FUNCTION_REGION,
  MAX_ASSISTS_PER_GAME,
  MAX_GOALS_PER_GAME,
} from "./constants";

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

type LeagueResult = "WIN" | "DRAW" | "LOSS";

type ProcessedConfirmation = {
  userId: string;
  goals: number;
  assists: number;
  isMvp: boolean;
};

type ProcessedTeam = {
  id: string;
  name: string;
  playerIds: string[];
  score: number;
};

export type GroupLeaguePlayerResult = {
  user_id: string;
  team_id: string;
  goals: number;
  assists: number;
  is_mvp: boolean;
  result: LeagueResult;
};

export type GroupLeagueTeamSummary = {
  team_id: string;
  name: string;
  score: number;
  result: LeagueResult;
};

type StoredGroupLeagueMatch = {
  season_id?: string;
  group_id?: string;
  teams?: GroupLeagueTeamSummary[];
  team1_name?: string;
  team2_name?: string;
  team1_score?: number;
  team2_score?: number;
  date?: string;
  player_results?: GroupLeaguePlayerResult[];
};

type GroupLeagueMatchPayload = {
  groupId: string;
  matchRef: FirebaseFirestore.DocumentReference;
  teamSummaries: GroupLeagueTeamSummary[];
  playerResults: GroupLeaguePlayerResult[];
  date: string;
};

/**
 * FIX #3882: fallback determinístico de season quando não há nenhuma
 * `league_seasons` com is_active==true (ex.: janela de virada de mês ou
 * falha/atraso dos crons). Deriva a chave YYYY-MM da data do jogo — que é
 * o próprio doc id canônico das seasons mensais — em vez de descartar a
 * partida silenciosamente. As standings gravadas com esse season_id são
 * captadas normalmente pelo archive do mês correspondente.
 *
 * @param {string} gameDate Data do jogo (esperado prefixo YYYY-MM-DD).
 * @param {Date} now Instante atual (injetável para testes).
 * @return {string} Chave YYYY-MM da temporada alvo.
 */
export function deriveFallbackSeasonId(
  gameDate: string,
  now: Date = new Date(),
): string {
  if (/^\d{4}-\d{2}/.test(gameDate)) {
    return gameDate.slice(0, 7);
  }
  // Sem data utilizável no jogo: usa o mês corrente em BRT (mesmo fuso
  // dos crons de season).
  return now.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).slice(0, 7);
}

type GroupLeaguePayloadBuildResult = {
  payload: GroupLeagueMatchPayload | null;
  teamCount: number;
  confirmationCount: number;
};

/**
 * Recover real team ids from legacy player results.
 * @param {StoredGroupLeagueMatch} matchData Stored legacy match.
 * @return {[string, string]} Team ids aligned with team1/team2 scores.
 */
function getLegacyTeamIds(matchData: StoredGroupLeagueMatch): [string, string] {
  const playerResults = Array.isArray(matchData.player_results) ?
    matchData.player_results : [];
  const ids = [...new Set(playerResults.map(({team_id: teamId}) => teamId)
    .filter((teamId): teamId is string => Boolean(teamId)))];
  if (ids.length < 2) return [ids[0] || "team1", "team2"];

  const score1 = matchData.team1_score ?? 0;
  const score2 = matchData.team2_score ?? 0;
  const maxScore = Math.max(score1, score2);
  const minScore = Math.min(score1, score2);
  const result1 = rankResult(score1, maxScore, minScore);
  const result2 = rankResult(score2, maxScore, minScore);
  const resultByTeam = new Map(ids.map((teamId) => [
    teamId,
    playerResults.find((result) => result.team_id === teamId)?.result,
  ]));
  const team1Id = ids.find((teamId) => resultByTeam.get(teamId) === result1) || ids[0];
  const team2Id = ids.find((teamId) =>
    teamId !== team1Id && resultByTeam.get(teamId) === result2
  ) || ids.find((teamId) => teamId !== team1Id) || ids[1];
  return [team1Id, team2Id];
}

/**
 * Return the standings points awarded for one match result.
 *
 * @param {LeagueResult} result Match result.
 * @return {number} Points for the result.
 */
function getPointsForResult(result: LeagueResult): number {
  if (result === "WIN") return POINTS_WIN;
  if (result === "DRAW") return POINTS_DRAW;
  return POINTS_LOSS;
}

/**
 * Build team summaries with score-derived results for a finished game.
 *
 * @param {ProcessedTeam[]} teams Processed teams.
 * @return {GroupLeagueTeamSummary[]} Team summaries with league results.
 */
export function buildGroupLeagueTeamSummaries(
  teams: ProcessedTeam[],
): GroupLeagueTeamSummary[] {
  const scores = teams.map((team) => team.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  return teams.map((team) => ({
    team_id: team.id,
    name: team.name,
    score: team.score,
    result: rankResult(team.score, maxScore, minScore),
  }));
}

/**
 * Build per-player league deltas from confirmations and team membership.
 *
 * @param {ProcessedConfirmation[]} confirmations Processed confirmations.
 * @param {ProcessedTeam[]} teams Processed teams.
 * @return {GroupLeaguePlayerResult[]} Player results for standings updates.
 */
export function buildGroupLeaguePlayerResults(
  confirmations: ProcessedConfirmation[],
  teams: ProcessedTeam[],
): GroupLeaguePlayerResult[] {
  const teamSummaries = buildGroupLeagueTeamSummaries(teams);
  const teamResults = new Map(
    teamSummaries.map((summary) => [summary.team_id, summary.result]),
  );

  return confirmations.flatMap((conf) => {
    if (!conf.userId) {
      return [];
    }

    const playerTeam = teams.find((team) => team.playerIds.includes(conf.userId));
    if (!playerTeam) {
      return [];
    }

    return [{
      user_id: conf.userId,
      team_id: playerTeam.id,
      goals: conf.goals,
      assists: conf.assists,
      is_mvp: conf.isMvp,
      result: teamResults.get(playerTeam.id) ?? "DRAW",
    }];
  });
}

/**
 * Read stored team summaries, including legacy two-team match documents.
 *
 * @param {StoredGroupLeagueMatch} matchData Stored match data.
 * @return {GroupLeagueTeamSummary[]} Team summaries for the stored match.
 */
export function getStoredTeamSummaries(
  matchData: StoredGroupLeagueMatch,
): GroupLeagueTeamSummary[] {
  if (Array.isArray(matchData.teams) && matchData.teams.length > 0) {
    return matchData.teams;
  }

  const fallback: GroupLeagueTeamSummary[] = [];
  const [team1Id, team2Id] = getLegacyTeamIds(matchData);
  if (matchData.team1_name) {
    fallback.push({
      team_id: team1Id,
      name: matchData.team1_name,
      score: matchData.team1_score ?? 0,
      result: "DRAW",
    });
  }
  if (matchData.team2_name) {
    fallback.push({
      team_id: team2Id,
      name: matchData.team2_name,
      score: matchData.team2_score ?? 0,
      result: "DRAW",
    });
  }
  return fallback;
}

/**
 * Prefer the canonical game score for legacy two-team matches.
 * @param {string} teamId Team document id.
 * @param {number} index Team position when legacy ids are absent.
 * @param {number} teamCount Number of team docs.
 * @param {number} storedScore Score stored on the team doc.
 * @param {Record<string, unknown>} gameData Finished game data.
 * @return {number} Resolved score.
 */
export function resolveFinishedTeamScore(
  teamId: string,
  index: number,
  teamCount: number,
  storedScore: number,
  gameData: Record<string, unknown>,
): number {
  if (teamCount !== 2) return storedScore;
  const team1Id = typeof gameData.team1_id === "string" ? gameData.team1_id : "";
  const team2Id = typeof gameData.team2_id === "string" ? gameData.team2_id : "";
  if (teamId === team1Id || (!team1Id && index === 0)) {
    return typeof gameData.team1_score === "number" ?
      gameData.team1_score : storedScore;
  }
  if (teamId === team2Id || (!team2Id && index === 1)) {
    return typeof gameData.team2_score === "number" ?
      gameData.team2_score : storedScore;
  }
  return storedScore;
}

/**
 * Build the next persisted league-match payload using reads owned by a tx.
 *
 * @param {FirebaseFirestore.Transaction} tx Firestore transaction.
 * @param {string} gameId Finished game id.
 * @param {Record<string, unknown>} gameData Canonical game payload from trigger.
 * @return {Promise<GroupLeaguePayloadBuildResult>} Built payload + read stats.
 */
async function buildNextMatchPayload(
  tx: FirebaseFirestore.Transaction,
  gameId: string,
  gameData: Record<string, unknown>,
): Promise<GroupLeaguePayloadBuildResult> {
  const groupId = typeof gameData.group_id === "string" ? gameData.group_id : "";
  if (!groupId || gameData.status !== "FINISHED") {
    return {
      payload: null,
      teamCount: 0,
      confirmationCount: 0,
    };
  }

  const confirmationsQuery = db()
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .where("status", "==", "CONFIRMED");
  const teamsQuery = db()
    .collection("teams")
    .where("game_id", "==", gameId);

  const [confirmationsSnap, teamsSnap] = await Promise.all([
    tx.get(confirmationsQuery),
    tx.get(teamsQuery),
  ]);

  const confirmations: ProcessedConfirmation[] =
    confirmationsSnap.docs.map((doc) => ({
      userId: (doc.data().user_id as string) || "",
      goals: clampStat(doc.data().goals, MAX_GOALS_PER_GAME),
      assists: clampStat(doc.data().assists, MAX_ASSISTS_PER_GAME),
      isMvp: (doc.data().is_mvp as boolean) || false,
    }));
  const teams: ProcessedTeam[] = teamsSnap.docs.map((doc, index) => {
    const teamData = doc.data();
    const storedScore = typeof teamData.score === "number" ?
      teamData.score : 0;
    return {
      id: doc.id,
      name: (teamData.name as string) || "Time",
      playerIds: (teamData.player_ids as string[]) || [],
      score: resolveFinishedTeamScore(
        doc.id,
        index,
        teamsSnap.docs.length,
        storedScore,
        gameData,
      ),
    };
  });

  if (teams.length < 2 || confirmations.length === 0) {
    return {
      payload: null,
      teamCount: teams.length,
      confirmationCount: confirmations.length,
    };
  }

  const teamSummaries = buildGroupLeagueTeamSummaries(teams);
  const playerResults = buildGroupLeaguePlayerResults(
    confirmations,
    teams,
  );

  if (playerResults.length === 0) {
    return {
      payload: null,
      teamCount: teams.length,
      confirmationCount: confirmations.length,
    };
  }

  return {
    payload: {
      groupId,
      matchRef: db()
        .collection("groups")
        .doc(groupId)
        .collection("league_matches")
        .doc(gameId),
      teamSummaries,
      playerResults,
      date: (gameData.date as string) || "",
    },
    teamCount: teams.length,
    confirmationCount: confirmations.length,
  };
}

/**
 * Apply or revert a single player's contribution to league standings.
 *
 * @param {FirebaseFirestore.Transaction} tx Firestore transaction.
 * @param {FirebaseFirestore.DocumentReference} standingRef Standing document.
 * @param {GroupLeaguePlayerResult} playerResult Player result delta.
 * @param {GroupLeagueTeamSummary[]} teamSummaries Match team summaries.
 * @param {1 | -1} delta Direction to apply.
 * @param {string} seasonId Season id.
 * @param {string} groupId Group id.
 */
function applyStandingDelta(
  tx: FirebaseFirestore.Transaction,
  standingRef: FirebaseFirestore.DocumentReference,
  playerResult: GroupLeaguePlayerResult,
  teamSummaries: GroupLeagueTeamSummary[],
  delta: 1 | -1,
  seasonId: string,
  groupId: string,
): void {
  const pointsEarned = getPointsForResult(playerResult.result) * delta;
  const myTeamScore =
    (teamSummaries.find((team) => team.team_id === playerResult.team_id)?.score ?? 0) * delta;
  const opponentScore =
    opponentAverage(
      playerResult.team_id,
      teamSummaries.map((team) => ({
        id: team.team_id,
        score: team.score,
      })),
    ) * delta;

  tx.set(
    standingRef,
    {
      user_id: playerResult.user_id,
      season_id: seasonId,
      group_id: groupId,
      points: FieldValue.increment(pointsEarned),
      games_played: FieldValue.increment(delta),
      wins: FieldValue.increment(playerResult.result === "WIN" ? delta : 0),
      draws: FieldValue.increment(playerResult.result === "DRAW" ? delta : 0),
      losses: FieldValue.increment(playerResult.result === "LOSS" ? delta : 0),
      goals_scored: FieldValue.increment(playerResult.goals * delta),
      goals_conceded: FieldValue.increment(opponentScore),
      goal_difference: FieldValue.increment(myTeamScore - opponentScore),
      mvp_count: FieldValue.increment(playerResult.is_mvp ? delta : 0),
      updated_at: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

/**
 * Revert the stored deltas for a previously applied league match.
 *
 * @param {FirebaseFirestore.Transaction} tx Firestore transaction.
 * @param {FirebaseFirestore.DocumentReference} matchRef Match document.
 * @param {StoredGroupLeagueMatch} matchData Stored match data.
 */
function revertStoredMatch(
  tx: FirebaseFirestore.Transaction,
  matchRef: FirebaseFirestore.DocumentReference,
  matchData: StoredGroupLeagueMatch,
): void {
  const seasonId = matchData.season_id;
  const groupId = matchData.group_id;
  const playerResults = Array.isArray(matchData.player_results) ? matchData.player_results : [];
  const teamSummaries = getStoredTeamSummaries(matchData);

  if (!seasonId || !groupId || playerResults.length === 0 || teamSummaries.length < 2) {
    tx.delete(matchRef);
    return;
  }

  const standingsRef = db()
    .collection("groups")
    .doc(groupId)
    .collection("league_standings");

  for (const playerResult of playerResults) {
    const standingRef = standingsRef.doc(`${seasonId}_${playerResult.user_id}`);
    applyStandingDelta(
      tx,
      standingRef,
      playerResult,
      teamSummaries,
      -1,
      seasonId,
      groupId,
    );
  }

  tx.delete(matchRef);
}

export const onGameFinishedGroupLeague = onDocumentWritten(
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

    const beforeGroupId = (before?.group_id as string | undefined) || null;
    const afterGroupId = (after?.group_id as string | undefined) || null;
    const candidateGroupIds = [...new Set(
      [beforeGroupId, afterGroupId].filter(
        (groupId): groupId is string => Boolean(groupId),
      ),
    )];
    const candidateMatches = candidateGroupIds.map((groupId) => ({
      groupId,
      matchRef: db()
        .collection("groups")
        .doc(groupId)
        .collection("league_matches")
        .doc(gameId),
    }));

    const shouldApplyAfter =
      after?.status === "FINISHED" &&
      typeof afterGroupId === "string" &&
      afterGroupId.length > 0;

    if (!shouldApplyAfter && candidateMatches.length === 0) {
      return;
    }

    try {
      let skippedTeamCount: number | null = null;
      let skippedConfirmationCount: number | null = null;
      const gameRef = db().collection("games").doc(gameId);

      if (shouldApplyAfter && afterGroupId) {
        logger.info(
          `[GROUP_LEAGUE] Rebuilding standings for game ${gameId} in group ${afterGroupId}`,
        );
      }

      let revertedMatchCount = 0;
      await db().runTransaction(async (tx) => {
        const currentGameSnap = shouldApplyAfter ?
          await tx.get(gameRef) :
          null;
        const currentGameData = currentGameSnap?.exists ?
          currentGameSnap.data() as Record<string, unknown> :
          null;
        const shouldApplyCurrentGame =
          shouldApplyAfter &&
          currentGameData?.status === "FINISHED" &&
          typeof currentGameData.group_id === "string" &&
          currentGameData.group_id.length > 0;

        const matchPayloadResult = shouldApplyCurrentGame && currentGameData ?
          await buildNextMatchPayload(tx, gameId, currentGameData) :
          {payload: null, teamCount: 0, confirmationCount: 0};
        const matchPayload = matchPayloadResult.payload;
        skippedTeamCount = matchPayload ?
          null :
          matchPayloadResult.teamCount;
        skippedConfirmationCount = matchPayload ?
          null :
          matchPayloadResult.confirmationCount;

        const matchSnapshots = candidateMatches.length > 0 ?
          await tx.getAll(
            ...candidateMatches.map(({matchRef}) => matchRef),
          ) :
          [];
        const existingMatches: Array<{
          groupId: string;
          matchRef: FirebaseFirestore.DocumentReference;
          matchData: StoredGroupLeagueMatch;
        }> = [];

        matchSnapshots.forEach((matchSnap, index) => {
          if (matchSnap.exists) {
            existingMatches.push({
              groupId: candidateMatches[index].groupId,
              matchRef: candidateMatches[index].matchRef,
              matchData: matchSnap.data() as StoredGroupLeagueMatch,
            });
          }
        });

        const storedTargetMatch = matchPayload ?
          existingMatches.find(
            ({groupId}) => groupId === matchPayload.groupId,
          ) :
          undefined;
        let targetSeasonId =
          storedTargetMatch?.matchData.season_id || null;

        if (matchPayload && !targetSeasonId) {
          const activeSeasonQuery = db()
            .collection("groups")
            .doc(matchPayload.groupId)
            .collection("league_seasons")
            .where("is_active", "==", true)
            .limit(1);
          const activeSeasonSnap = await tx.get(activeSeasonQuery);
          targetSeasonId = activeSeasonSnap.empty ?
            null :
            activeSeasonSnap.docs[0].id;

          // FIX #3882: sem season ativa (janela de virada de mês ou cron
          // atrasado/falho), NÃO descartar a partida — deriva o season_id
          // determinístico (YYYY-MM) da data do jogo. Antes, o retorno
          // silencioso perdia permanentemente as standings de jogos
          // finalizados entre 23:59 do último dia e 01:00 do dia 1º.
          // Log em WARN (não info) para ser distinguível de operação
          // normal e alertável.
          if (!targetSeasonId) {
            targetSeasonId = deriveFallbackSeasonId(matchPayload.date);
            logger.warn(
              "[GROUP_LEAGUE] No active season for group " +
                `${matchPayload.groupId}; applying game ${gameId} to ` +
                `fallback season ${targetSeasonId} derived from game date ` +
                "(season turnover window or season cron failure — " +
                "see issue #3882)",
            );
          }
        }

        revertedMatchCount = existingMatches.length;
        for (const existingMatch of existingMatches) {
          revertStoredMatch(tx, existingMatch.matchRef, existingMatch.matchData);
        }

        if (!matchPayload || !targetSeasonId) {
          return;
        }

        const standingsRef = db()
          .collection("groups")
          .doc(matchPayload.groupId)
          .collection("league_standings");

        for (const playerResult of matchPayload.playerResults) {
          applyStandingDelta(
            tx,
            standingsRef.doc(`${targetSeasonId}_${playerResult.user_id}`),
            playerResult,
            matchPayload.teamSummaries,
            1,
            targetSeasonId,
            matchPayload.groupId,
          );
        }

        tx.set(matchPayload.matchRef, {
          game_id: gameId,
          season_id: targetSeasonId,
          group_id: matchPayload.groupId,
          teams: matchPayload.teamSummaries,
          num_teams: matchPayload.teamSummaries.length,
          team1_name: matchPayload.teamSummaries[0]?.name ?? "",
          team2_name: matchPayload.teamSummaries[1]?.name ?? "",
          team1_score: matchPayload.teamSummaries[0]?.score ?? 0,
          team2_score: matchPayload.teamSummaries[1]?.score ?? 0,
          date: matchPayload.date,
          player_results: matchPayload.playerResults,
          created_at: FieldValue.serverTimestamp(),
        });
      });

      if (
        shouldApplyAfter &&
        skippedTeamCount !== null &&
        skippedConfirmationCount !== null
      ) {
        logger.info(
          `[GROUP_LEAGUE] Skipping apply for ${gameId}: ` +
            `${skippedTeamCount} teams, ` +
            `${skippedConfirmationCount} confirmations`,
        );
      }

      logger.info(
        `[GROUP_LEAGUE] Game ${gameId} rebuilt with ` +
          `${revertedMatchCount} previous match(es) reverted`,
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
