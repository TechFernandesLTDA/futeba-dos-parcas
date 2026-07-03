import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {sendNotificationToUser, NotificationType} from "../notifications/helpers";
import {db} from "../_db";
import {getLevelForXp} from "../xp/pipeline";
import type {XpLog} from "../models";

interface BadgeTrigger {
  badgeId: string;
  name: string;
  icon: string;
  description: string;
  xpReward: number;
  check: (
    userId: string,
    userDoc?: admin.firestore.DocumentSnapshot,
    confirmationsSnap?: admin.firestore.QuerySnapshot
  ) => Promise<boolean>;
}

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
 * Verifica se usuario venceu o mesmo adversario 5x
 * (verifica se ha algum adversario com 5+ derrotas contra o usuario)
 * @param {string} userId - UID do usuario
 * @param {admin.firestore.DocumentSnapshot} [_userDoc] - Documento do usuario pre-carregado (nao utilizado)
 * @param {admin.firestore.QuerySnapshot} [confirmationsSnap] - Confirmations pre-carregadas (opcional)
 * @return {Promise<boolean>} true se carrasco de alguem
 */
async function checkBadgeCarrasco(
  userId: string,
  _userDoc?: admin.firestore.DocumentSnapshot,
  confirmationsSnap?: admin.firestore.QuerySnapshot
): Promise<boolean> {
  const confSnap = confirmationsSnap || await db()
    .collection("confirmations")
    .where("user_id", "==", userId)
    .where("was_present", "==", true)
    .get();

  const gameIds = confSnap.docs.map((d) => d.data().game_id as string).filter(Boolean);
  const lossesByOpponent: Record<string, number> = {};

  // FIX #2196: lê jogo + teams (coleção RAIZ filtrada por game_id) de todos os
  // jogos em paralelo, eliminando o N+1 sequencial doc-a-doc.
  const gamesData = await Promise.all(
    gameIds.map(async (gameId) => {
      const [gameDoc, teamsSnap] = await Promise.all([
        db().collection("games").doc(gameId).get(),
        db().collection("teams").where("game_id", "==", gameId).get(),
      ]);
      return {gameDoc, teamsSnap};
    })
  );

  for (const {gameDoc, teamsSnap} of gamesData) {
    if (!gameDoc.exists) continue;
    const game = gameDoc.data();
    if (!game || game.status !== "FINISHED") continue;

    const userTeam = teamsSnap.docs.find((t) =>
      (t.data().player_ids as string[])?.includes(userId)
    );
    const opponentTeam = teamsSnap.docs.find((t) =>
      !(t.data().player_ids as string[])?.includes(userId)
    );

    if (!userTeam || !opponentTeam) continue;
    const userScore = userTeam.data().score as number;
    const opponentScore = opponentTeam.data().score as number;

    if (userScore <= opponentScore) continue;

    const opponentIds = (opponentTeam.data().player_ids as string[]) || [];
    for (const oppId of opponentIds) {
      lossesByOpponent[oppId] = (lossesByOpponent[oppId] || 0) + 1;
    }
  }

  return Object.values(lossesByOpponent).some((count) => count >= 5);
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
        .get();

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
              badgesRef.get(),
              db().collection("users").doc(userId).get(),
              db()
                .collection("confirmations")
                .where("user_id", "==", userId)
                .where("was_present", "==", true)
                .get(),
            ]);
          const earnedIds = new Set(earnedSnap.docs.map((d) => d.id));

          const earnedBadges: BadgeTrigger[] = [];
          const userRef = db().collection("users").doc(userId);
          for (const trigger of BADGE_TRIGGERS) {
            try {
              if (earnedIds.has(trigger.badgeId)) continue;

              const earned = await trigger.check(userId, userDoc, allUserConfirmationsSnap);
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
