import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {sendNotificationToUser, NotificationType} from "../notifications/helpers";
import {db} from "../_db";
import {getLevelForXp} from "../xp/pipeline";
import type {XpLog} from "../models";
import {toLiveScore} from "../game/helpers";
import {resolveFinishedTeamScore} from "../group-league";
import {buildUserBadgeAggregateDoc} from "./user-badge-docs";

interface BadgeTrigger {
  badgeId: string;
  name: string;
  icon: string;
  description: string;
  xpReward: number;
  check: (
    userId: string,
    userDoc?: admin.firestore.DocumentSnapshot,
    confirmationsSnap?: admin.firestore.QuerySnapshot,
    context?: BadgeCheckContext,
  ) => Promise<boolean>;
}

type BadgeCheckContext = {
  currentGameId?: string;
  currentTeams?: BadgeGameTeam[];
};

type BadgeGameTeam = {
  id: string;
  playerIds: string[];
  score: number;
};

const CARRASCO_MAX_HISTORY_GAMES = 60;
const USER_CONFIRMATIONS_QUERY_LIMIT = 1000;
const GAME_CONFIRMATIONS_QUERY_LIMIT = 200;
const GAME_TEAMS_QUERY_LIMIT = 100;
const USER_BADGES_QUERY_LIMIT = 100;

/**
 * Concede um badge com XP e cria xp_log idempotente por badge.
 *
 * @param {string} userId Usuário premiado.
 * @param {BadgeTrigger} trigger Badge elegível.
 * @return {Promise<boolean>} `true` quando o badge foi criado nesta execução.
 */
async function awardBadgeWithXp(
  userId: string,
  trigger: BadgeTrigger
): Promise<boolean> {
  const userRef = db().collection("users").doc(userId);
  const badgeRef = userRef
    .collection("badges")
    .doc(trigger.badgeId);
  const aggregateBadgeRef = db()
    .collection("user_badges")
    .doc(`${userId}_${trigger.badgeId}`);
  const logRef = db()
    .collection("xp_logs")
    .doc(`badge_${trigger.badgeId}_user_${userId}`);

  return db().runTransaction(async (tx) => {
    const [userSnap, badgeSnap, logSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(badgeRef),
      tx.get(logRef),
    ]);

    if (badgeSnap.exists || logSnap.exists) {
      return false;
    }

    if (!userSnap.exists) {
      throw new Error(`Usuário ${userId} não encontrado para badge ${trigger.badgeId}`);
    }

    const userData = userSnap.data() || {};
    const currentXp =
      (userData.experience_points as number) || 0;
    const nextXp = currentXp + trigger.xpReward;
    const currentLevel =
      getLevelForXp(currentXp);
    const nextLevel =
      getLevelForXp(nextXp);

    const badgeData = {
      badge_id: trigger.badgeId,
      name: trigger.name,
      icon: trigger.icon,
      description: trigger.description,
      type: trigger.badgeId,
      xp_reward: trigger.xpReward,
      earned_at: FieldValue.serverTimestamp(),
      earned: true,
    };

    const xpLog: XpLog = {
      user_id: userId,
      game_id: `badge:${trigger.badgeId}`,
      transaction_id:
        `badge_${trigger.badgeId}_user_${userId}`,
      source: "badge_earned",
      source_collection: "users_badges",
      source_event_id: trigger.badgeId,
      xp_earned: trigger.xpReward,
      xp_before: currentXp,
      xp_after: nextXp,
      level_before: currentLevel,
      level_after: nextLevel,
      xp_participation: 0,
      xp_goals: 0,
      xp_assists: 0,
      xp_saves: 0,
      xp_result: 0,
      xp_mvp: 0,
      xp_clean_sheet: 0,
      xp_milestones: trigger.xpReward,
      xp_streak: 0,
      xp_penalty: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      was_mvp: false,
      was_clean_sheet: false,
      was_worst_player: false,
      game_result: "BADGE_REWARD",
      game_status: "BADGE_AWARDED",
      my_team_score: 0,
      opponent_score: 0,
      milestones_unlocked: [trigger.badgeId],
      created_at: FieldValue.serverTimestamp(),
    };

    tx.set(badgeRef, badgeData);
    tx.set(aggregateBadgeRef, buildUserBadgeAggregateDoc(userId, {
      badgeId: trigger.badgeId,
      name: trigger.name,
      icon: trigger.icon,
      description: trigger.description,
      type: trigger.badgeId,
      xpReward: trigger.xpReward,
      earnedAt: badgeData.earned_at,
      lastEarnedAt: badgeData.earned_at,
      earned: true,
      count: 1,
    }), {merge: true});
    tx.update(userRef, {
      experience_points:
        FieldValue.increment(trigger.xpReward),
      level: nextLevel,
      updated_at: FieldValue.serverTimestamp(),
    });
    tx.set(logRef, xpLog);

    return true;
  });
}

/**
 * Verifica se usuario tem streak >= 7 jogos consecutivos
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeStreak7(
  userId: string,
  userDoc?: admin.firestore.DocumentSnapshot
): Promise<boolean> {
  const doc = userDoc || await db().collection("users").doc(userId).get();
  const streak = (doc.data()?.current_streak as number) || 0;
  return streak >= 7;
}

/**
 * Verifica se usuario tem >= 10 vitorias nas estatisticas
 * @param {string} userId - UID do usuario
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeStreak10Vitorias(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const data = statsDoc.data();
  const wins = (data?.gamesWon as number) || (data?.total_wins as number) || 0;
  return wins >= 10;
}

/**
 * Verifica se usuario tem >= 100 jogos no total
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadge100Jogos(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const totalGames = (statsDoc.data()?.totalGames as number) || 0;
  return totalGames >= 100;
}

/**
 * Verifica se usuario tem >= 1 MVP
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeMVP1(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const mvpCount = (statsDoc.data()?.bestPlayerCount as number) || 0;
  return mvpCount >= 1;
}

/**
 * Verifica se usuario tem >= 10 MVPs
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeMVP10(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const mvpCount = (statsDoc.data()?.bestPlayerCount as number) || 0;
  return mvpCount >= 10;
}

/**
 * Verifica se usuario tem >= 10 gols
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeGols10(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const goals = (statsDoc.data()?.totalGoals as number) || 0;
  return goals >= 10;
}

/**
 * Verifica se usuario tem >= 50 assistencias
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeAssistencias50(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const assists = (statsDoc.data()?.totalAssists as number) || 0;
  return assists >= 50;
}

/**
 * Verifica se usuario tem >= 50 vitorias
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [userDoc] - Documento do usuario pre-carregado (opcional)
 * @return {Promise<boolean>} true se atingiu o threshold
 */
async function checkBadgeVitorias50(userId: string): Promise<boolean> {
  const statsDoc = await db().collection("statistics").doc(userId).get();
  if (!statsDoc.exists) return false;
  const data = statsDoc.data();
  const wins = (data?.gamesWon as number) || (data?.total_wins as number) || 0;
  return wins >= 50;
}

/**
 * Verifica se usuario jogou em 3+ campos diferentes
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [_userDoc] - Documento do usuario pre-carregado (nao utilizado)
 * @param {admin.firestore.QuerySnapshot} [confirmationsSnap] - Confirmations pre-carregadas (opcional)
 * @return {Promise<boolean>} true se onipresente
 */
async function checkBadgeOnipresente(
  userId: string,
  _userDoc?: admin.firestore.DocumentSnapshot,
  confirmationsSnap?: admin.firestore.QuerySnapshot
): Promise<boolean> {
  const gamesSnap = confirmationsSnap || await db()
    .collection("confirmations")
    .where("user_id", "==", userId)
    .where("was_present", "==", true)
    .limit(USER_CONFIRMATIONS_QUERY_LIMIT)
    .get();

  const locationIds = new Set<string>();
  gamesSnap.forEach((d) => {
    const locId = d.data().location_id;
    if (locId) locationIds.add(locId);
  });

  return locationIds.size >= 3;
}

/**
 * Verifica se usuario tem 10+ quartas-feiras confirmadas
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [_userDoc] - Documento do usuario pre-carregado (nao utilizado)
 * @param {admin.firestore.QuerySnapshot} [confirmationsSnap] - Confirmations pre-carregadas (opcional)
 * @return {Promise<boolean>} true se rei das quartas
 */
async function checkBadgeReiDasQuartas(
  userId: string,
  _userDoc?: admin.firestore.DocumentSnapshot,
  confirmationsSnap?: admin.firestore.QuerySnapshot
): Promise<boolean> {
  const gamesSnap = confirmationsSnap || await db()
    .collection("confirmations")
    .where("user_id", "==", userId)
    .where("was_present", "==", true)
    .limit(USER_CONFIRMATIONS_QUERY_LIMIT)
    .get();

  let quartaCount = 0;
  for (const doc of gamesSnap.docs) {
    const gameDate = doc.data().game_date || doc.data().date;
    if (!gameDate) continue;
    const date = new Date(gameDate);
    if (date.getDay() === 3) quartaCount++;
  }

  return quartaCount >= 10;
}

/**
 * Normaliza o placar lido do team atual/histórico.
 * @param {BadgeGameTeam} team - Time avaliado.
 * @return {number} Placar numérico seguro.
 */
function getTeamScore(team: BadgeGameTeam): number {
  return Number.isFinite(team.score) ? team.score : 0;
}

/**
 * Resolve o placar canônico do time finalizado.
 * Prioriza live_scores e cai para team1_score/team2_score do game doc
 * antes do score armazenado no team doc.
 * @param {BadgeGameTeam} team - Time avaliado.
 * @param {number} index - Posição do time no array.
 * @param {number} teamCount - Quantidade de times no jogo.
 * @param {admin.firestore.DocumentData} [gameData] - Documento do jogo.
 * @param {admin.firestore.DocumentData} [liveScoreData] - Documento live_scores.
 * @return {number} Placar resolvido.
 */
function resolveCanonicalFinishedTeamScore(
  team: BadgeGameTeam,
  index: number,
  teamCount: number,
  gameData?: admin.firestore.DocumentData,
  liveScoreData?: admin.firestore.DocumentData,
): number {
  const storedScore = getTeamScore(team);
  if (teamCount !== 2) {
    return storedScore;
  }

  const liveScore = toLiveScore(liveScoreData);
  if (liveScore) {
    if (team.id === liveScore.team1Id || (!liveScore.team1Id && index === 0)) {
      return liveScore.team1Score;
    }
    if (team.id === liveScore.team2Id || (!liveScore.team2Id && index === 1)) {
      return liveScore.team2Score;
    }
  }

  if (!gameData) {
    return storedScore;
  }

  return resolveFinishedTeamScore(
    team.id,
    index,
    teamCount,
    storedScore,
    gameData,
  );
}

/**
 * Extrai apenas os adversários derrotados no jogo atual.
 * @param {string} userId - Usuário avaliado.
 * @param {BadgeGameTeam[]} [currentTeams] - Times do jogo atual.
 * @return {Set<string>} Opponent IDs derrotados no jogo atual.
 */
function getCurrentCarrascoOpponentIds(
  userId: string,
  currentTeams?: BadgeGameTeam[],
): Set<string> {
  if (!currentTeams || currentTeams.length < 2) {
    return new Set();
  }

  const userTeam = currentTeams.find((team) => team.playerIds.includes(userId));
  if (!userTeam) {
    return new Set();
  }

  const userScore = getTeamScore(userTeam);
  const defeatedOpponents = currentTeams
    .filter((team) => team.id !== userTeam.id && userScore > getTeamScore(team))
    .flatMap((team) => team.playerIds);

  return new Set(defeatedOpponents.filter(Boolean));
}

/**
 * Converte campos de data heterogêneos em epoch ms.
 * @param {unknown} raw - Valor cru de data/timestamp.
 * @return {number} Epoch ms ou 0 quando inválido.
 */
function getRecencyMs(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof raw === "object" && raw && "toDate" in raw) {
    try {
      const date = (raw as {toDate: () => Date}).toDate();
      const parsed = date.getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Seleciona um histórico recente e deduplicado de jogos para Carrasco.
 * @param {admin.firestore.QuerySnapshot} confirmationsSnap - Histórico do usuário.
 * @param {string} [currentGameId] - Jogo atual, removido da janela histórica.
 * @return {string[]} IDs de jogos recentes a inspecionar.
 */
function buildCarrascoHistoryGameIds(
  confirmationsSnap: admin.firestore.QuerySnapshot,
  currentGameId?: string,
): string[] {
  return [...new Set(
    confirmationsSnap.docs
      .map((doc) => doc.data())
      .sort((a, b) =>
        getRecencyMs(
          b.created_at ?? b.game_date ?? b.date
        ) - getRecencyMs(
          a.created_at ?? a.game_date ?? a.date
        )
      )
      .map((data) => data.game_id as string)
      .filter((gameId): gameId is string =>
        Boolean(gameId) &&
        gameId !== currentGameId,
      ),
  )].slice(0, CARRASCO_MAX_HISTORY_GAMES);
}

/**
 * Mapeia team docs em uma estrutura mínima para checks de badge.
 * @param {admin.firestore.QuerySnapshot} teamsSnap - Snapshot dos times.
 * @param {admin.firestore.DocumentData} [gameData] - Documento do jogo finalizado.
 * @param {admin.firestore.DocumentData} [liveScoreData] - Documento live_scores do jogo.
 * @return {BadgeGameTeam[]} Times normalizados.
 */
function buildBadgeGameTeams(
  teamsSnap: admin.firestore.QuerySnapshot,
  gameData?: admin.firestore.DocumentData,
  liveScoreData?: admin.firestore.DocumentData,
): BadgeGameTeam[] {
  const rawTeams = teamsSnap.docs.map((teamDoc) => {
    const teamData = teamDoc.data();
    return {
      id: teamDoc.id,
      playerIds: Array.isArray(teamData.player_ids) ?
        teamData.player_ids as string[] :
        [],
      score: typeof teamData.score === "number" ?
        teamData.score :
        0,
    };
  });

  return rawTeams.map((team, index) => ({
    ...team,
    score: resolveCanonicalFinishedTeamScore(
      team,
      index,
      rawTeams.length,
      gameData,
      liveScoreData,
    ),
  }));
}

/**
 * Verifica se usuario venceu o mesmo adversario 5x
 * (verifica se ha algum adversario com 5+ derrotas contra o usuario)
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [_userDoc] - Documento do usuario pre-carregado (nao utilizado)
 * @param {admin.firestore.QuerySnapshot} [_confirmationsSnap] - Snapshot compartilhado ignorado por este check.
 * @param {BadgeCheckContext} [context] - Contexto do jogo que disparou o trigger.
 * @return {Promise<boolean>} true se carrasco de alguem
 */
async function checkBadgeCarrasco(
  userId: string,
  _userDoc?: admin.firestore.DocumentSnapshot,
  _confirmationsSnap?: admin.firestore.QuerySnapshot,
  context?: BadgeCheckContext,
): Promise<boolean> {
  const targetOpponentIds = getCurrentCarrascoOpponentIds(
    userId,
    context?.currentTeams,
  );
  if (targetOpponentIds.size === 0) {
    return false;
  }

  // Carrasco deliberately owns a bounded query. The shared preloaded snapshot
  // is full-history because other badges need lifetime totals; reusing it here
  // would restore the unbounded fan-out this check is meant to prevent.
  const confSnap = await db()
    .collection("confirmations")
    .where("user_id", "==", userId)
    .where("was_present", "==", true)
    .orderBy("created_at", "desc")
    .limit(CARRASCO_MAX_HISTORY_GAMES + 1)
    .get();

  const historyGameIds = buildCarrascoHistoryGameIds(
    confSnap,
    context?.currentGameId,
  );
  if (historyGameIds.length === 0) {
    return false;
  }

  const lossesByOpponent: Record<string, number> = {};
  const gamesData = await Promise.all(
    historyGameIds.map(async (gameId) => {
      const [gameDoc, teamsSnap, liveScoreDoc] = await Promise.all([
        db().collection("games").doc(gameId).get(),
        db().collection("teams").where("game_id", "==", gameId).limit(GAME_TEAMS_QUERY_LIMIT).get(),
        db().collection("live_scores").doc(gameId).get(),
      ]);
      return {
        gameDoc,
        teams: buildBadgeGameTeams(
          teamsSnap,
          gameDoc.exists ? gameDoc.data() : undefined,
          liveScoreDoc.exists ? liveScoreDoc.data() : undefined,
        ),
      };
    })
  );

  for (const {gameDoc, teams} of gamesData) {
    if (!gameDoc.exists) continue;
    const game = gameDoc.data();
    if (!game || game.status !== "FINISHED") continue;

    const userTeam = teams.find((team) => team.playerIds.includes(userId));
    if (!userTeam) continue;

    const userScore = getTeamScore(userTeam);
    for (const opponentTeam of teams) {
      if (opponentTeam.id === userTeam.id) {
        continue;
      }
      if (userScore <= getTeamScore(opponentTeam)) {
        continue;
      }

      for (const oppId of opponentTeam.playerIds) {
        if (!targetOpponentIds.has(oppId)) {
          continue;
        }
        lossesByOpponent[oppId] = (lossesByOpponent[oppId] || 0) + 1;
        if (lossesByOpponent[oppId] >= 4) {
          return true;
        }
      }
    }
  }

  return false;
}

const BADGE_TRIGGERS: BadgeTrigger[] = [
  {badgeId: "streak_7", name: "Semana Perfeita", icon: "🔥", description: "7 jogos seguidos confirmados", xpReward: 100, check: checkBadgeStreak7},
  {badgeId: "mvp_1", name: "Estreante MVP", icon: "⭐", description: "Primeiro MVP conquistado", xpReward: 100, check: checkBadgeMVP1},
  {badgeId: "mvp_10", name: "Craque do MVP", icon: "🌟", description: "10 MVPs conquistados", xpReward: 300, check: checkBadgeMVP10},
  {badgeId: "goals_10", name: "Goleador", icon: "⚽", description: "10 gols marcados", xpReward: 50, check: checkBadgeGols10},
  {badgeId: "assists_50", name: "Garçom", icon: "👟", description: "50 assistências", xpReward: 50, check: checkBadgeAssistencias50},
  {badgeId: "wins_10", name: "Vencedor", icon: "🏅", description: "10 vitórias", xpReward: 100, check: checkBadgeStreak10Vitorias},
  {badgeId: "wins_50", name: "Campeão", icon: "🏆", description: "50 vitórias", xpReward: 400, check: checkBadgeVitorias50},
  {badgeId: "games_100", name: "Veterano", icon: "🎖️", description: "100 jogos disputados", xpReward: 500, check: checkBadge100Jogos},
  {badgeId: "onipresente", name: "Onipresente", icon: "🌍", description: "Jogou em 3+ campos diferentes", xpReward: 100, check: checkBadgeOnipresente},
  {badgeId: "rei_das_quartas", name: "Rei das Quartas", icon: "👑", description: "10 quartas-feiras de pelada", xpReward: 150, check: checkBadgeReiDasQuartas},
  {badgeId: "carrasco", name: "Carrasco", icon: "💀", description: "Venceu o mesmo adversário 5x", xpReward: 200, check: checkBadgeCarrasco},
];

/**
 * Firestore trigger: apos um jogo ser finalizado, verifica badges
 * para todos os jogadores que estiveram presentes.
 */
export const onGameFinishedCheckBadges = onDocumentUpdated(
  {
    document: "games/{gameId}",
    region: FUNCTION_REGION,
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;
    if (before.status === "FINISHED") return;
    if (after.status !== "FINISHED") return;

    const gameId = event.params.gameId;
    logger.info("Checking badges after game finished", {gameId});

    try {
      // FIX #2196: confirmations vivem na coleção RAIZ filtrada por game_id,
      // não em games/{gameId}/confirmations. Path canônico igual a index.ts.
      const confSnap = await db()
        .collection("confirmations")
        .where("game_id", "==", gameId)
        .where("was_present", "==", true)
        .limit(GAME_CONFIRMATIONS_QUERY_LIMIT)
        .get();
      const [currentTeamsSnap, currentLiveScoreDoc] = await Promise.all([
        db()
          .collection("teams")
          .where("game_id", "==", gameId)
          .limit(GAME_TEAMS_QUERY_LIMIT)
          .get(),
        db()
          .collection("live_scores")
          .doc(gameId)
          .get(),
      ]);
      const currentTeams = buildBadgeGameTeams(
        currentTeamsSnap,
        after,
        currentLiveScoreDoc.exists ? currentLiveScoreDoc.data() : undefined,
      );

      const userIds = confSnap.docs.map((d) => d.data().user_id as string);
      const uniqueUserIds = [...new Set(userIds)];

      // FIX #2196: pré-carrega os badges já conquistados de cada usuário em
      // paralelo (1 leitura da subcollection por usuário em vez de N leituras
      // individuais doc-a-doc no laço de triggers), eliminando o N+1.
      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          const badgesRef = db()
            .collection("users")
            .doc(userId)
            .collection("badges");

          // FIX #2365: pré-carrega userDoc (1x por jogador) + todas as
          // confirmações do usuário (1x por jogador) — evita que 7 badges
          // façam N+1 individual no users/{uid} e 3 badges façam a mesma
          // query de confirmations repetida.
          const [earnedSnap, userDoc, allUserConfirmationsSnap] =
            await Promise.all([
              badgesRef.limit(USER_BADGES_QUERY_LIMIT).get(),
              db().collection("users").doc(userId).get(),
              db()
                .collection("confirmations")
                .where("user_id", "==", userId)
                .where("was_present", "==", true)
                .limit(USER_CONFIRMATIONS_QUERY_LIMIT)
                .get(),
            ]);
          const earnedIds = new Set(earnedSnap.docs.map((d) => d.id));

          const earnedBadges: BadgeTrigger[] = [];
          const userRef = db().collection("users").doc(userId);
          for (const trigger of BADGE_TRIGGERS) {
            try {
              if (earnedIds.has(trigger.badgeId)) continue;

              const earned = await trigger.check(userId, userDoc, allUserConfirmationsSnap, {
                currentGameId: gameId,
                currentTeams,
              });
              if (earned) {
                const awarded = await awardBadgeWithXp(
                  userId,
                  trigger
                );
                if (awarded) {
                  earnedBadges.push(trigger);
                  earnedIds.add(trigger.badgeId);
                  logger.info("Badge earned", {
                    userId,
                    badgeId: trigger.badgeId,
                    xpReward: trigger.xpReward,
                    userPath: userRef.path,
                  });
                }
              }
            } catch (err) {
              logger.error("Error checking badge", {userId, badgeId: trigger.badgeId, err});
            }
          }
          if (earnedBadges.length > 0) {
            for (const trigger of earnedBadges) {
              try {
                await sendNotificationToUser(userId, {
                  title: `🏆 ${trigger.name}`,
                  body: trigger.description,
                  type: NotificationType.ACHIEVEMENT,
                  data: {badgeId: trigger.badgeId},
                });
              } catch (notifErr) {
                logger.error("Failed to send badge notification", {userId, badgeId: trigger.badgeId, notifErr});
              }
            }
          }
        })
      );
    } catch (err) {
      logger.error("Error in badge check", {gameId, err});
    }
  }
);
