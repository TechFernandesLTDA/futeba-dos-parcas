import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FUNCTION_REGION} from "../constants";
import {sendNotificationToUsers, NotificationType} from "../notifications/helpers";

const db = () => admin.firestore();

interface WeeklyScores {
  [userId: string]: {
    userId: string;
    userName: string;
    userPhoto?: string;
    points: number;
    goals: number;
    assists: number;
    saves: number;
    presence: number;
    mvp: number;
    wins: number;
    draws: number;
    losses: number;
    bolaMurcha: number;
  };
}

/**
 * Retorna a chave da semana no formato "YYYY-WW" para a data fornecida.
 * @param {Date} date - Data base
 * @return {string} Chave da semana
 */
function getWeekKey(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

/**
 * Calcula o intervalo (inicio e fim) de uma semana a partir da chave.
 * @param {string} weekKey - Chave da semana no formato YYYY-WW
 * @return {Object} Objeto com start e end (Date)
 */
function getWeekRange(weekKey: string): { start: Date; end: Date } {
  const [year, week] = weekKey.split("-").map(Number);
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - jan1.getDay() + 1;
  const start = new Date(year, 0, 1 + daysOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {start, end};
}

export const processWeeklyRanking = onSchedule(
  {
    schedule: "every sunday 23:59",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const now = new Date();
    const weekKey = getWeekKey(now);
    const {start, end} = getWeekRange(weekKey);

    logger.info("Processing weekly ranking", {weekKey, start: start.toISOString(), end: end.toISOString()});

    const gamesRef = db().collection("games");
    const gamesSnap = await gamesRef
      .where("status", "==", "FINISHED")
      .where("date", ">=", start.toISOString().split("T")[0])
      .where("date", "<=", end.toISOString().split("T")[0])
      .get();

    if (gamesSnap.empty) {
      logger.info("No games in week", {weekKey});
      return;
    }

    const scores: WeeklyScores = {};

    // FIX #2198: confirmations/teams vivem na coleção RAIZ filtrada por
    // game_id (path canônico igual a index.ts), e são lidas em paralelo
    // (Promise.all) em vez de sequencialmente por jogo.
    const perGameSnaps = await Promise.all(
      gamesSnap.docs.map(async (gameDoc) => {
        const gameId = gameDoc.id;
        const [confSnap, teamsSnap] = await Promise.all([
          db()
            .collection("confirmations")
            .where("game_id", "==", gameId)
            .where("was_present", "==", true)
            .get(),
          db()
            .collection("teams")
            .where("game_id", "==", gameId)
            .get(),
        ]);
        return {confSnap, teamsSnap};
      })
    );

    for (const {confSnap, teamsSnap} of perGameSnaps) {
      const teams = teamsSnap.docs.map((t) => ({
        playerIds: (t.data().player_ids as string[]) || [],
        score: (t.data().score as number) || 0,
      }));
      const teamScores = teams.map((t) => t.score);

      for (const confDoc of confSnap.docs) {
        const c = confDoc.data();
        const uid = c.user_id as string;

        if (!scores[uid]) {
          scores[uid] = {
            userId: uid,
            userName: (c.user_name as string) || "",
            userPhoto: (c.user_photo as string) || undefined,
            points: 0,
            goals: 0,
            assists: 0,
            saves: 0,
            presence: 0,
            mvp: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            bolaMurcha: 0,
          };
        }

        const s = scores[uid];

        s.presence += 1;
        s.points += 3;

        s.goals += (c.goals as number) || 0;
        s.points += ((c.goals as number) || 0) * 5;

        s.assists += (c.assists as number) || 0;
        s.points += ((c.assists as number) || 0) * 3;

        s.saves += (c.saves as number) || 0;

        if (c.is_mvp) {
          s.mvp += 1;
          s.points += 8;
        }

        if (c.is_worst_player) {
          s.bolaMurcha += 1;
          s.points -= 3;
        }

        const userTeam = teams.find((t) =>
          t.playerIds.includes(uid)
        );

        if (userTeam) {
          if (teamScores.length >= 2) {
            const maxScore = Math.max(...teamScores);
            const minScore = Math.min(...teamScores);
            if (userTeam.score === maxScore && maxScore !== minScore) {
              s.wins += 1;
              s.points += 2;
            } else if (userTeam.score === minScore && maxScore !== minScore) {
              s.losses += 1;
            } else {
              s.draws += 1;
              s.points += 1;
            }
          }
        }
      }
    }

    const rankings = Object.values(scores).sort((a, b) => b.points - a.points);

    const rankingDoc = db().collection("weekly-rankings").doc(weekKey);
    await rankingDoc.set({
      week_key: weekKey,
      start_date: admin.firestore.Timestamp.fromDate(start),
      end_date: admin.firestore.Timestamp.fromDate(end),
      rankings,
      total_games: gamesSnap.size,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Scout ranking: dream team scoring
    // FIX #2198: em vez de escanear TODOS os usuários (~10k) buscando o
    // dream_team de cada um, usa collectionGroup("dream_team") que retorna
    // SOMENTE os usuários que de fato montaram um time dos sonhos. O doc
    // canônico é users/{uid}/dream_team/current (vide web/useDreamTeam.ts).
    const scoutRankings: Array<{ userId: string; userName: string; points: number }> = [];

    const dreamTeamsSnap = await db()
      .collectionGroup("dream_team")
      .get();

    // Mapa de pontos por dono de time (apenas pontos positivos entram).
    const pointsByOwner: Array<{ userId: string; points: number }> = [];

    for (const teamDoc of dreamTeamsSnap.docs) {
      // Considera apenas o doc "current" (ignora histórico/outros docs).
      if (teamDoc.id !== "current") continue;

      // O dono do time é o pai do pai: users/{uid}/dream_team/current.
      const ownerId = teamDoc.ref.parent.parent?.id;
      if (!ownerId) continue;

      const teamData = teamDoc.data();
      // FIX #2284: valida o shape antes do cast.
      const rawPlayers = teamData?.players;
      if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) continue;
      const players = rawPlayers as Array<{ userId: string }>;

      let teamPoints = 0;
      for (const player of players) {
        const playerScore = rankings.find((r) => r.userId === player.userId);
        if (playerScore) {
          teamPoints += playerScore.points;
        }
      }

      if (teamPoints > 0) {
        pointsByOwner.push({userId: ownerId, points: teamPoints});
      }
    }

    // Busca os nomes dos donos em paralelo (apenas os que pontuaram —
    // conjunto muito menor que a base inteira de usuários).
    const ownerDocs = await Promise.all(
      pointsByOwner.map((o) =>
        db().collection("users").doc(o.userId).get()
      )
    );

    for (const [index, ownerDoc] of ownerDocs.entries()) {
      const owner = pointsByOwner[index];
      scoutRankings.push({
        userId: owner.userId,
        userName: (ownerDoc.data()?.name as string) || "Jogador",
        points: owner.points,
      });
    }

    scoutRankings.sort((a, b) => b.points - a.points);

    if (scoutRankings.length > 0) {
      const scoutDoc = db().collection("weekly-rankings").doc(`${weekKey}_scout`);
      await scoutDoc.set({
        week_key: weekKey,
        type: "scout",
        rankings: scoutRankings.slice(0, 50),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    logger.info("Weekly ranking saved", {
      weekKey,
      players: rankings.length,
      topPlayer: rankings[0]?.userName,
      topPoints: rankings[0]?.points,
    });

    // Mito da Rodada: badge temporario para o #1
    if (rankings.length > 0) {
      const topPlayer = rankings[0];
      try {
        const badgesRef = db()
          .collection("users")
          .doc(topPlayer.userId)
          .collection("badges");
        await badgesRef.doc(`mito_rodada_${weekKey}`).set({
          badge_id: `mito_rodada_${weekKey}`,
          name: `Mito da Rodada ${weekKey}`,
          icon: "👑",
          type: "MITO_RODADA",
          earned_at: admin.firestore.FieldValue.serverTimestamp(),
          expires_at: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          ),
          earned: true,
        });

        logger.info("Mito da Rodada badge awarded", {
          userId: topPlayer.userId,
          weekKey,
        });
      } catch (err) {
        logger.error("Failed to award Mito da Rodada", {weekKey, err});
      }
    }

    if (rankings.length > 0) {
      const userIds = rankings.map((r) => r.userId);
      try {
        await sendNotificationToUsers(userIds, {
          title: "Rodada encerrada!",
          body:
            `O ranking da semana ${weekKey} está pronto. ` +
            `${rankings[0]?.userName} é o líder com ${rankings[0]?.points} pts!`,
          type: NotificationType.RANKING_CHANGED,
          data: {weekKey},
        });
      } catch (err) {
        logger.error("Failed to send weekly ranking notification", {weekKey, err});
      }
    }
  }
);
