/**
 * GAME HELPERS - Funções auxiliares de jogo
 *
 * Funções de conversão de dados Firestore,
 * cálculo de resultados, e busca em batch
 * de jogadores/estatísticas/streaks.
 */

import * as admin from "firebase-admin";
import {
  FIRESTORE_WHERE_IN_LIMIT,
} from "../constants";
import {
  Game,
  GameConfirmation,
  Team,
  LiveGameScore,
  UserStatistics,
} from "../models";
import {db} from "../_db";


// ==========================================
// CONVERSORES FIRESTORE → TIPO
// ==========================================

/**
 * Converte documento Firestore em
 * GameConfirmation.
 * @param {admin.firestore.DocumentData} raw
 *   Dados brutos do Firestore.
 * @return {GameConfirmation} Confirmação
 *   tipada.
 */
export function toGameConfirmation(
  raw: admin.firestore.DocumentData
): GameConfirmation {
  return {
    userId: raw.user_id ?? raw.userId ?? "",
    status: raw.status ?? "CONFIRMED",
    position: raw.position ?? "",
    goals: Number(raw.goals ?? 0),
    assists: Number(raw.assists ?? 0),
    saves: Number(raw.saves ?? 0),
    yellowCards: Number(
      raw.yellow_cards ?? raw.yellowCards ?? 0
    ),
    redCards: Number(
      raw.red_cards ?? raw.redCards ?? 0
    ),
    game_id:
      raw.game_id ?? raw.gameId ?? "",
    is_worst_player:
      raw.is_worst_player ??
      raw.isWorstPlayer ??
      false,
  };
}

/**
 * Limite máximo de placar por time.
 * (P0 #30: Score bounds validation)
 */
const MAX_SCORE = 100;

/**
 * Normaliza placar para o range válido
 * [0, MAX_SCORE].
 * @param {number} score Placar bruto.
 * @return {number} Placar normalizado.
 */
function clampScore(score: number): number {
  return Math.max(
    0, Math.min(MAX_SCORE, Math.round(score))
  );
}

/**
 * Converte documento Firestore em Team.
 * @param {string} id ID do documento.
 * @param {admin.firestore.DocumentData} raw
 *   Dados brutos do Firestore.
 * @return {Team} Time tipado.
 */
export function toTeam(
  id: string,
  raw: admin.firestore.DocumentData
): Team {
  const rawScore = Number(raw.score ?? 0);
  return {
    id: raw.id ?? id,
    playerIds: (
      raw.player_ids ?? raw.playerIds ?? []
    ) as string[],
    score: clampScore(rawScore),
  };
}

/**
 * Converte documento Firestore em
 * LiveGameScore.
 * @param {admin.firestore.DocumentData} raw
 *   Dados brutos do Firestore.
 * @return {LiveGameScore | null} Placar
 *   ao vivo tipado ou null.
 */
export function toLiveScore(
  raw?: admin.firestore.DocumentData | null
): LiveGameScore | null {
  if (!raw) return null;
  const rawTeam1Score = Number(
    raw.team1_score ?? raw.team1Score ?? 0
  );
  const rawTeam2Score = Number(
    raw.team2_score ?? raw.team2Score ?? 0
  );

  // P0 #30: Logar placares fora dos limites
  // para investigação
  if (
    rawTeam1Score > MAX_SCORE ||
    rawTeam2Score > MAX_SCORE
  ) {
    console.warn(
      "[SCORE_BOUNDS] Placar fora dos " +
      "limites detectado: " +
      `T1=${rawTeam1Score}, ` +
      `T2=${rawTeam2Score} ` +
      `(max=${MAX_SCORE}). ` +
      "Valores serão normalizados."
    );
  }

  return {
    gameId:
      raw.game_id ?? raw.gameId ?? "",
    team1Id:
      raw.team1_id ?? raw.team1Id ?? "",
    team2Id:
      raw.team2_id ?? raw.team2Id ?? "",
    team1Score: clampScore(rawTeam1Score),
    team2Score: clampScore(rawTeam2Score),
  };
}

/**
 * Obtém a data do jogo a partir do
 * documento.
 * @param {Game} game Documento do jogo.
 * @return {Date} Data do jogo.
 */
export function getGameDate(
  game?: Game
): Date {
  if (!game) return new Date();
  if (
    game.dateTime &&
    typeof game.dateTime.toDate === "function"
  ) {
    return game.dateTime.toDate();
  }
  if (game.date) {
    const parsed = new Date(game.date);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Retorna a chave da semana no formato
 * yyyy-WNN.
 * @param {Date} d Data de referência.
 * @return {string} Chave da semana.
 */
export function getWeekKey(d: Date): string {
  const year = d.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear =
    (d.getTime() - firstDayOfYear.getTime()) /
    86400000;
  const weekNumber = Math.ceil(
    (pastDaysOfYear +
      firstDayOfYear.getDay() + 1) / 7
  );
  return `${year}-W${weekNumber
    .toString()
    .padStart(2, "0")}`;
}

// ==========================================
// DETERMINAÇÃO DE RESULTADOS
// ==========================================

/**
 * Determina o resultado de cada time no jogo.
 * @param {Team[]} teams Times participantes.
 * @param {LiveGameScore | null} liveScore
 *   Placar ao vivo.
 * @return {Record<string, string>} Mapa de
 *   resultados por time.
 */
export function determineGameResults(
  teams: Team[],
  liveScore: LiveGameScore | null
): Record<string, "WIN" | "LOSS" | "DRAW"> {
  const results: Record<
    string, "WIN" | "LOSS" | "DRAW"
  > = {};
  if (teams.length < 2) return results;

  const t1 = teams.find(
    (t) => t.id === (
      liveScore ?
        liveScore.team1Id :
        teams[0].id
    )
  );
  const t2 = teams.find(
    (t) => t.id === (
      liveScore ?
        liveScore.team2Id :
        teams[1].id
    )
  );

  let s1 = t1 ? t1.score : 0;
  let s2 = t2 ? t2.score : 0;
  if (liveScore) {
    s1 = liveScore.team1Score;
    s2 = liveScore.team2Score;
  }

  if (t1 && t2) {
    if (s1 > s2) {
      results[t1.id] = "WIN";
      results[t2.id] = "LOSS";
    } else if (s2 > s1) {
      results[t1.id] = "LOSS";
      results[t2.id] = "WIN";
    } else {
      results[t1.id] = "DRAW";
      results[t2.id] = "DRAW";
    }
  }
  return results;
}

/**
 * Calcula o placar do adversário para um time.
 * Retorna -1 se não for possível determinar.
 * @param {Team | undefined} team Time do jogador.
 * @param {LiveGameScore | null} liveScore
 *   Placar ao vivo.
 * @param {Team[]} teams Todos os times.
 * @return {number} Placar do adversário ou -1.
 */
export function getOpponentScore(
  team: Team | undefined,
  liveScore: LiveGameScore | null,
  teams: Team[]
): number {
  if (liveScore) {
    if (
      team &&
      team.id === liveScore.team1Id
    ) {
      return liveScore.team2Score;
    } else if (
      team &&
      team.id === liveScore.team2Id
    ) {
      return liveScore.team1Score;
    }
  } else if (
    teams.length >= 2 && team
  ) {
    const opponent = teams.find(
      (t) => t.id !== team.id
    );
    if (opponent) {
      return opponent.score;
    }
  }
  return -1;
}

// ==========================================
// BUSCA EM BATCH (FIRESTORE)
// ==========================================

/**
 * Busca todos os usuários por IDs em chunks
 * de FIRESTORE_WHERE_IN_LIMIT.
 * @param {string[]} ids IDs dos usuários.
 * @return {Promise<Map>} Mapa de dados.
 */
export async function fetchAllUsers(
  ids: string[]
): Promise<
  Map<
    string,
    admin.firestore.DocumentData
  >
> {
  const result = new Map<
    string,
    admin.firestore.DocumentData
  >();
  const chunks: string[][] = [];
  for (
    let i = 0;
    i < ids.length;
    i += FIRESTORE_WHERE_IN_LIMIT
  ) {
    chunks.push(ids.slice(
      i, i + FIRESTORE_WHERE_IN_LIMIT
    ));
  }
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      db().collection("users")
        .where(
          admin.firestore
            .FieldPath.documentId(),
          "in",
          chunk
        )
        .get()
    )
  );
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      result.set(
        doc.id,
        doc.data() || {}
      );
    }
  }
  return result;
}

/**
 * Busca todas as estatísticas por IDs em
 * chunks de FIRESTORE_WHERE_IN_LIMIT.
 * @param {string[]} ids IDs dos usuários.
 * @return {Promise<Map>} Mapa de estatísticas.
 */
export async function fetchAllStats(
  ids: string[]
): Promise<Map<string, UserStatistics>> {
  const defaultStats: UserStatistics = {
    totalGames: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalSaves: 0,
    totalYellowCards: 0,
    totalRedCards: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
    bestPlayerCount: 0,
    worstPlayerCount: 0,
    currentMvpStreak: 0,
    bestMvpStreak: 0,
  };
  const result =
    new Map<string, UserStatistics>();
  const chunks: string[][] = [];
  for (
    let i = 0;
    i < ids.length;
    i += FIRESTORE_WHERE_IN_LIMIT
  ) {
    chunks.push(ids.slice(
      i, i + FIRESTORE_WHERE_IN_LIMIT
    ));
  }
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      db().collection("statistics")
        .where(
          admin.firestore
            .FieldPath.documentId(),
          "in",
          chunk
        )
        .get()
    )
  );
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      result.set(
        doc.id,
        (doc.data() || {
          ...defaultStats,
        }) as UserStatistics
      );
    }
  }
  // Preencher faltantes com defaults
  for (const id of ids) {
    if (!result.has(id)) {
      result.set(id, {...defaultStats});
    }
  }
  return result;
}

/**
 * Busca todos os streaks por IDs em chunks
 * de FIRESTORE_WHERE_IN_LIMIT.
 * @param {string[]} ids IDs dos usuários.
 * @return {Promise<Map>} Mapa de streaks.
 */
export async function fetchAllStreaks(
  ids: string[]
): Promise<Map<string, number>> {
  const result =
    new Map<string, number>();
  const chunks: string[][] = [];
  for (
    let i = 0;
    i < ids.length;
    i += FIRESTORE_WHERE_IN_LIMIT
  ) {
    chunks.push(ids.slice(
      i, i + FIRESTORE_WHERE_IN_LIMIT
    ));
  }
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      db().collection("user_streaks")
        .where(
          "user_id", "in", chunk
        )
        .get()
    )
  );
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const data = doc.data();
      const userId = data.user_id;
      if (userId) {
        // Suportar ambos os formatos:
        // camelCase e snake_case
        result.set(
          userId,
          data.currentStreak ||
            data.current_streak ||
            0
        );
      }
    }
  }
  // Preencher faltantes com 0
  for (const id of ids) {
    if (!result.has(id)) {
      result.set(id, 0);
    }
  }
  return result;
}

// ==========================================
// RANKING & SEASON HELPERS
// ==========================================

/**
 * Atualiza deltas de ranking semanal e mensal.
 * @param {admin.firestore.WriteBatch} batch
 *   Batch de escrita.
 * @param {string} uid ID do usuário.
 * @param {GameConfirmation} conf Confirmação.
 * @param {string} result Resultado do jogo.
 * @param {number} xp XP ganho.
 * @param {boolean} isMvp Se é MVP.
 * @param {string} weekKey Chave da semana.
 * @param {string} monthKey Chave do mês.
 */
export function updateRankingDeltas(
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
    goals_added: admin.firestore
      .FieldValue.increment(conf.goals),
    assists_added: admin.firestore
      .FieldValue.increment(conf.assists),
    saves_added: admin.firestore
      .FieldValue.increment(conf.saves),
    xp_added: admin.firestore
      .FieldValue.increment(xp),
    games_added: admin.firestore
      .FieldValue.increment(1),
    wins_added: admin.firestore
      .FieldValue.increment(
        result === "WIN" ? 1 : 0
      ),
    mvp_added: admin.firestore
      .FieldValue.increment(
        isMvp ? 1 : 0
      ),
    updated_at: admin.firestore
      .FieldValue.serverTimestamp(),
  };

  const weekId =
    `week_${weekKey}_${uid}`;
  batch.set(
    db().collection("ranking_deltas")
      .doc(weekId),
    {
      user_id: uid,
      period: "week",
      period_key: weekKey,
      ...fields,
    },
    {merge: true}
  );

  const monthId =
    `month_${monthKey}_${uid}`;
  batch.set(
    db().collection("ranking_deltas")
      .doc(monthId),
    {
      user_id: uid,
      period: "month",
      period_key: monthKey,
      ...fields,
    },
    {merge: true}
  );
}

/**
 * Atualiza participação na temporada.
 * @param {admin.firestore.WriteBatch} batch
 *   Batch de escrita.
 * @param {string} uid ID do usuário.
 * @param {string} seasonId ID da temporada.
 * @param {string} result Resultado do jogo.
 * @param {GameConfirmation} conf Confirmação.
 * @param {boolean} isMvp Se é MVP.
 * @param {string | null} groupId ID do grupo
 *   (opcional, para filtro por grupo no ranking).
 */
export function updateSeasonParticipation(
  batch: admin.firestore.WriteBatch,
  uid: string,
  seasonId: string,
  result: string,
  conf: GameConfirmation,
  isMvp: boolean,
  groupId?: string | null
) {
  const partId = `${seasonId}_${uid}`;
  const pointsToAdd = result === "WIN" ?
    3 :
    (result === "DRAW" ? 1 : 0);

  const data: Record<string, unknown> = {
    user_id: uid,
    season_id: seasonId,
    points: admin.firestore
      .FieldValue.increment(pointsToAdd),
    games_played: admin.firestore
      .FieldValue.increment(1),
    wins: admin.firestore
      .FieldValue.increment(
        result === "WIN" ? 1 : 0
      ),
    draws: admin.firestore
      .FieldValue.increment(
        result === "DRAW" ? 1 : 0
      ),
    losses: admin.firestore
      .FieldValue.increment(
        result === "LOSS" ? 1 : 0
      ),
    goals_scored: admin.firestore
      .FieldValue.increment(conf.goals),
    assists: admin.firestore
      .FieldValue.increment(conf.assists),
    mvp_count: admin.firestore
      .FieldValue.increment(
        isMvp ? 1 : 0
      ),
    last_calculated_at: admin.firestore
      .FieldValue.serverTimestamp(),
    created_at: admin.firestore
      .FieldValue.serverTimestamp(),
    updated_at: admin.firestore
      .FieldValue.serverTimestamp(),
  };

  if (groupId) {
    data.group_id = groupId;
  }

  batch.set(
    db().collection("season_participation")
      .doc(partId),
    data,
    {merge: true}
  );
}
