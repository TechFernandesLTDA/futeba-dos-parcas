import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldPath, FieldValue, Timestamp} from "firebase-admin/firestore";
import {
  FUNCTION_REGION,
  MAX_ASSISTS_PER_GAME,
  MAX_GOALS_PER_GAME,
  MAX_SAVES_PER_GAME,
} from "../constants";
import {sendNotificationToUsers, NotificationType} from "../notifications/helpers";
import {mirrorBadgeToRoot} from "../badges/user-badge-docs";

const db = () => admin.firestore();
const WEEKLY_GAMES_QUERY_LIMIT = 5000;
const GAME_CONFIRMATIONS_QUERY_LIMIT = 200;
const GAME_TEAMS_QUERY_LIMIT = 100;

export interface WeeklyPlayerScore {
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
}

export type WeeklyScores = Record<string, WeeklyPlayerScore>;

/**
 * Retorna a chave da semana no formato "YYYY-WW" para a data fornecida.
 * @param {Date} date - Data base
 * @return {string} Chave da semana
 */
export function getWeekKey(date: Date): string {
  // FIX #2497: usa métodos UTC (não locais) para ser determinístico
  // independentemente do TZ do runtime. Combinado com nowInBrt() no handler,
  // os campos UTC do Date representam o horário-parede BRT.
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNum = Math.ceil((days + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-${String(weekNum).padStart(2, "0")}`;
}

/**
 * Calcula o intervalo (inicio e fim) de uma semana a partir da chave.
 * @param {string} weekKey - Chave da semana no formato YYYY-WW
 * @return {Object} Objeto com start e end (Date)
 */
export function getWeekRange(weekKey: string): { start: Date; end: Date } {
  // FIX #2497: aritmética em UTC (determinística por TZ) E consistente com
  // getWeekKey. O `+1` que existia aqui tornava getWeekRange(getWeekKey(d))
  // adiantado em 1 dia → o domingo encerrado caía FORA do range mesmo com a
  // data correta. Agora o offset espelha exatamente getWeekKey:
  //   getWeekKey: weekNum = ceil((days + dow0 + 1)/7)
  //   ⇒ semana w cobre os índices [(w-1)*7 - dow0 , w*7 - dow0 - 1]
  const [year, week] = weekKey.split("-").map(Number);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const daysOffset = (week - 1) * 7 - jan1.getUTCDay();
  const start = new Date(Date.UTC(year, 0, 1 + daysOffset, 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return {start, end};
}

/**
 * Retorna um Date cujos campos UTC representam o horário-parede atual em BRT
 * (America/Sao_Paulo), independentemente do TZ do runtime. TZ-independente
 * (usa Intl.formatToParts) — base correta para getWeekKey/getWeekRange.
 *
 * @return {Date} Instante com campos UTC = horário-parede BRT.
 */
export function nowInBrt(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // hour pode vir "24" em alguns ICU para meia-noite — normaliza.
  const hour = get("hour") % 24;
  return new Date(Date.UTC(
    get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second")
  ));
}

/**
 * Retorna a chave da semana que ja terminou no momento de referencia.
 *
 * O cron roda domingo a noite em BRT, mas a semana do produto comeca no
 * domingo. Sem esse deslocamento, ele processa a semana que acabou de comecar
 * e deixa jogos de segunda a sabado fora do ranking.
 *
 * @param {Date} referenceDate - Data/hora de referencia em horario-parede BRT
 * @return {string} Chave da semana encerrada
 */
export function getCompletedWeekKey(referenceDate: Date): string {
  const previousDay = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);
  return getWeekKey(previousDay);
}

/**
 * D5: Normaliza e aplica o limite anti-cheat por jogo aos stats semanais.
 * @param {number} goals Gols reportados no jogo
 * @param {number} assists Assistências reportadas no jogo
 * @param {number} saves Defesas reportadas no jogo
 * @return {{goals: number, assists: number, saves: number}} Stats limitados
 */
export function clampWeeklyStats(
  goals: number,
  assists: number,
  saves: number
): { goals: number; assists: number; saves: number } {
  return {
    goals: Math.max(0, Math.min(Math.floor(goals || 0), MAX_GOALS_PER_GAME)),
    assists: Math.max(0, Math.min(Math.floor(assists || 0), MAX_ASSISTS_PER_GAME)),
    saves: Math.max(0, Math.min(Math.floor(saves || 0), MAX_SAVES_PER_GAME)),
  };
}

/**
 * D7: Ordenação determinística com critérios de desempate consistentes:
 * 1. Pontos (descendente)
 * 2. Gols (descendente)
 * 3. Assistências (descendente)
 * 4. Vitórias (descendente)
 * 5. Nome do usuário (ascendente)
 * 6. ID do usuário (ascendente)
 *
 * @param {T[]} items Lista de jogadores do ranking
 * @return {T[]} Lista ordenada de forma determinística
 */
export function sortWeeklyRankings<T extends {
  points: number;
  goals?: number;
  assists?: number;
  wins?: number;
  userName?: string;
  userId: string;
}>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aGoals = a.goals ?? 0;
    const bGoals = b.goals ?? 0;
    if (bGoals !== aGoals) return bGoals - aGoals;
    const aAssists = a.assists ?? 0;
    const bAssists = b.assists ?? 0;
    if (bAssists !== aAssists) return bAssists - aAssists;
    const aWins = a.wins ?? 0;
    const bWins = b.wins ?? 0;
    if (bWins !== aWins) return bWins - aWins;
    const nameCmp = (a.userName || "").localeCompare(b.userName || "");
    if (nameCmp !== 0) return nameCmp;
    return a.userId.localeCompare(b.userId);
  });
}

/**
 * D7: Desempate determinístico para scout ranking (pontos -> nome -> userId).
 * @param {T[]} items Lista de técnicos do scout ranking
 * @return {T[]} Lista ordenada de forma determinística
 */
export function sortScoutRankings<T extends {
  points: number;
  userName?: string;
  userId: string;
}>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const nameCmp = (a.userName || "").localeCompare(b.userName || "");
    if (nameCmp !== 0) return nameCmp;
    return a.userId.localeCompare(b.userId);
  });
}

/**
 * D5: Acumula os stats de uma confirmação no placar semanal do jogador com limites anti-cheat.
 * @param {WeeklyPlayerScore} s Placar semanal do jogador
 * @param {object} c Confirmação do jogo
 */
export function applyConfirmationToWeeklyScore(
  s: WeeklyPlayerScore,
  c: {
    goals?: number;
    assists?: number;
    saves?: number;
    is_mvp?: boolean;
    is_worst_player?: boolean;
  }
): void {
  const rawGoals = (c.goals as number) || 0;
  const rawAssists = (c.assists as number) || 0;
  const rawSaves = (c.saves as number) || 0;
  const clamped = clampWeeklyStats(rawGoals, rawAssists, rawSaves);

  s.presence += 1;
  s.points += 3;

  s.goals += clamped.goals;
  s.points += clamped.goals * 5;

  s.assists += clamped.assists;
  s.points += clamped.assists * 3;

  s.saves += clamped.saves;

  if (c.is_mvp) {
    s.mvp += 1;
    s.points += 8;
  }

  if (c.is_worst_player) {
    s.bolaMurcha += 1;
    s.points -= 3;
  }
}

export const processWeeklyRanking = onSchedule(
  {
    schedule: "every sunday 23:57",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    // FIX #2497: o cron dispara domingo 23:57 BRT == segunda 02:57 UTC. Com
    // `new Date()` cru (UTC), getWeekKey/getWeekRange caíam na semana SEGUINTE
    // → a semana recém-encerrada nunca recebia ranking (off-by-one de TZ).
    // nowInBrt() retorna um Date com campos UTC = horário-parede BRT, base
    // correta para a aritmética de semana (agora também em UTC, determinística).
    // FIX #2842: como a semana comeca no domingo, o cron precisa rankear a
    // semana que acabou no sabado anterior, nao a semana iniciada no domingo
    // do disparo.
    const now = nowInBrt();
    /* istanbul ignore next -- scheduled handler wiring; date selection is covered via getCompletedWeekKey(). */
    const weekKey = getCompletedWeekKey(now);
    const {start, end} = getWeekRange(weekKey);

    logger.info("Processing weekly ranking", {weekKey, start: start.toISOString(), end: end.toISOString()});

    const gamesRef = db().collection("games");
    const gamesSnap = await gamesRef
      .where("status", "==", "FINISHED")
      .where("date", ">=", start.toISOString().split("T")[0])
      .where("date", "<=", end.toISOString().split("T")[0])
      .limit(WEEKLY_GAMES_QUERY_LIMIT)
      .get();

    if (gamesSnap.empty) {
      logger.info("No games in week", {weekKey});
      return;
    }

    const scores: WeeklyScores = {};

    // FIX #2198: confirmations/teams vivem na coleção RAIZ filtrada por
    // game_id (path canônico igual a index.ts), e são lidas em paralelo
    // por jogo, em chunks de 10 para limitar concorrência.
    const perGameSnaps: Array<{
      confSnap: admin.firestore.QuerySnapshot;
      teamsSnap: admin.firestore.QuerySnapshot;
    }> = [];
    const CHUNK_SIZE = 10;
    const gameDocs = gamesSnap.docs;
    for (let i = 0; i < gameDocs.length; i += CHUNK_SIZE) {
      const chunk = gameDocs.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (gameDoc) => {
          const gameId = gameDoc.id;
          const [confSnap, teamsSnap] = await Promise.all([
            db()
              .collection("confirmations")
              .where("game_id", "==", gameId)
              .where("was_present", "==", true)
              .limit(GAME_CONFIRMATIONS_QUERY_LIMIT)
              .get(),
            db()
              .collection("teams")
              .where("game_id", "==", gameId)
              .limit(GAME_TEAMS_QUERY_LIMIT)
              .get(),
          ]);
          return {confSnap, teamsSnap};
        })
      );
      perGameSnaps.push(...chunkResults);
    }

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

        // D5: Acumula presença, gols, assistências, defesas com anti-cheat, MVP e Bola Murcha
        applyConfirmationToWeeklyScore(s, c);

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

    // D7: Desempate determinístico (pontos -> gols -> assistências -> vitórias -> nome -> userId)
    const rankings = sortWeeklyRankings(Object.values(scores));
    const topRankings = rankings.slice(0, 100);

    const rankingDoc = db().collection("weekly-rankings").doc(weekKey);
    await rankingDoc.set({
      week_key: weekKey,
      start_date: Timestamp.fromDate(start),
      end_date: Timestamp.fromDate(end),
      rankings: topRankings,
      total_players: rankings.length,
      total_games: gamesSnap.size,
      created_at: FieldValue.serverTimestamp(),
    });

    // Scout ranking: dream team scoring
    // FIX #2198: em vez de escanear TODOS os usuários (~10k) buscando o
    // dream_team de cada um, usa collectionGroup("dream_team") que retorna
    // SOMENTE os usuários que de fato montaram um time dos sonhos. O doc
    // canônico é users/{uid}/dream_team/current (vide web/useDreamTeam.ts).
    // FIX #2647: adiciona cursor-based pagination ao collectionGroup para
    // evitar timeout em bases grandes.
    const scoutRankings: Array<{ userId: string; userName: string; points: number }> = [];
    const pointsByOwner: Array<{ userId: string; points: number }> = [];

    {
      let lastDoc:
        admin.firestore.QueryDocumentSnapshot | null = null;
      const DREAM_TEAM_PAGE_LIMIT = 500;
      while (true) {
        let dtQuery = db().collectionGroup("dream_team")
          .orderBy(FieldPath.documentId())
          .limit(DREAM_TEAM_PAGE_LIMIT)
          // PERF: projection — só o array de jogadores é usado para pontuar.
          .select("players");
        if (lastDoc) {
          dtQuery = dtQuery.startAfter(lastDoc);
        }
        const dreamTeamsSnap = await dtQuery.get();
        if (dreamTeamsSnap.empty) break;

        for (const teamDoc of dreamTeamsSnap.docs) {
          if (teamDoc.id !== "current") continue;

          const ownerId = teamDoc.ref.parent.parent?.id;
          if (!ownerId) continue;

          const teamData = teamDoc.data();
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

        if (dreamTeamsSnap.size < DREAM_TEAM_PAGE_LIMIT) break;
        lastDoc = dreamTeamsSnap.docs[dreamTeamsSnap.size - 1];
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

    // D7: Desempate determinístico para scout ranking (pontos -> nome -> userId)
    const sortedScoutRankings = sortScoutRankings(scoutRankings);

    if (sortedScoutRankings.length > 0) {
      const scoutDoc = db().collection("weekly-rankings").doc(`${weekKey}_scout`);
      await scoutDoc.set({
        week_key: weekKey,
        type: "scout",
        rankings: sortedScoutRankings.slice(0, 50),
        created_at: FieldValue.serverTimestamp(),
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
          earned_at: FieldValue.serverTimestamp(),
          expires_at: Timestamp.fromDate(
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          ),
          earned: true,
        });

        // FIX #4138: espelha para user_badges raiz (único lugar lido
        // pelos clientes) — antes o mito era invisível nas telas.
        await mirrorBadgeToRoot(topPlayer.userId, {
          badgeId: `mito_rodada_${weekKey}`,
          name: `Mito da Rodada ${weekKey}`,
          icon: "👑",
          type: "MITO_RODADA",
          earnedAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromDate(
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          ),
          earned: true,
          count: 1,
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
