/**
 * GAME HELPERS - Funções auxiliares de jogo
 *
 * Funções de conversão de dados Firestore,
 * cálculo de resultados, e busca em batch
 * de jogadores/estatísticas/streaks.
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue, FieldPath} from "firebase-admin/firestore";
import {
  FIRESTORE_WHERE_IN_LIMIT,
  GAME_GENDERS,
  DEFAULT_GAME_GENDER,
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
  clampStat,
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
  const hasPresenceSignal =
    "checked_in" in raw ||
    "checkedIn" in raw ||
    "was_present" in raw ||
    "wasPresent" in raw;
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
    // SECFIX #430 / FIX #2797: lê flag de overlap temporal do Firestore.
    suspiciousOverlap: raw.suspicious_overlap === true,
    checkedIn: raw.checked_in === true || raw.checkedIn === true,
    wasPresent: raw.was_present === true || raw.wasPresent === true,
    hasPresenceSignal,
  };
}

/**
 * Define se uma confirmação pode gerar XP/estatística/voto.
 *
 * Jogos legados podem não ter campos de check-in. Nesse caso, `CONFIRMED`
 * continua elegível para não quebrar processamento histórico. Quando o doc
 * já possui sinal de presença (`checked_in`/`was_present`), presença real é
 * obrigatória.
 *
 * @param {GameConfirmation} confirmation Confirmação do jogador.
 * @return {boolean} true quando o jogador participou de fato.
 */
export function isParticipationEligible(
  confirmation: GameConfirmation
): boolean {
  if (confirmation.status !== "CONFIRMED") return false;
  if (confirmation.suspiciousOverlap === true) return false;
  if (confirmation.hasPresenceSignal) {
    return confirmation.checkedIn === true ||
      confirmation.wasPresent === true;
  }
  return true;
}

/**
 * Variante para docs brutos de confirmação usados em callables de votação.
 * @param {admin.firestore.DocumentData | undefined} raw Dados da confirmação.
 * @return {boolean} true quando o jogador pode votar/receber voto.
 */
export function isRawParticipationEligible(
  raw?: admin.firestore.DocumentData
): boolean {
  if (!raw) return false;
  return isParticipationEligible(toGameConfirmation(raw));
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
    logger.warn(
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
 * yyyy-WNN, usando timezone America/Sao_Paulo.
 * @param {Date} d Data de referência.
 * @return {string} Chave da semana.
 */
export function getWeekKey(d: Date): string {
  // FIX #2619: usar America/Sao_Paulo para weekKey, mantendo
  // consistência com o cron (timeZone: "America/Sao_Paulo").
  // Evita off-by-one quando a data UTC já virou o dia/mês/ano
  // mas BRT ainda não (ex: 01:00 UTC de 01/Fev = 22:00 BRT 31/Jan).
  const brtStr = d.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const [yearStr, monthStr, dayStr] = brtStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const brtDate = new Date(Date.UTC(year, month, day));
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const pastDaysOfYear =
    (brtDate.getTime() - firstDayOfYear.getTime()) /
    86400000;
  const weekNumber = Math.ceil(
    (pastDaysOfYear +
      firstDayOfYear.getUTCDay() + 1) / 7
  );
  return `${year}-W${weekNumber
    .toString()
    .padStart(2, "0")}`;
}

// ==========================================
// DETERMINAÇÃO DE RESULTADOS
// ==========================================

/**
 * FIX #2526: resultado de um time pelo ranking de placar entre TODOS os times
 * do jogo (modelo "ranking por placar", espelho de group-league.ts #2494).
 * Maior placar = WIN, menor = LOSS, intermediários = DRAW; todos empatados =
 * DRAW. Com 2 times reduz exatamente ao modelo clássico (sem regressão).
 *
 * @param {number} score - Placar do time.
 * @param {number} maxScore - Maior placar do jogo.
 * @param {number} minScore - Menor placar do jogo.
 * @return {"WIN" | "DRAW" | "LOSS"} Resultado.
 */
function rankResultGlobal(
  score: number,
  maxScore: number,
  minScore: number
): "WIN" | "DRAW" | "LOSS" {
  if (maxScore === minScore) return "DRAW";
  if (score === maxScore) return "WIN";
  if (score === minScore) return "LOSS";
  return "DRAW";
}

/**
 * Determina o resultado de cada time no jogo.
 * FIX #2526: suporta N times (N >= 2) via modelo "ranking por placar",
 * espelhando a correção aplicada em group-league.ts (#2494).
 * Jogadores do 3º time em diante agora recebem WIN/DRAW/LOSS corretos
 * em vez de DRAW por fallback.
 * @param {Team[]} teams Times participantes.
 * @param {LiveGameScore | null} liveScore
 *   Placar ao vivo (apenas para times 1 e 2 no modo LIVE;
 *   demais times usam team.score).
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

  // FIX #2526: modelo "ranking por placar" para N >= 2 times.
  // Maior placar = WIN, menor = LOSS, intermediários = DRAW.
  // Todos empatados = DRAW. Com 2 times reduz ao modelo clássico.
  // Usa liveScore como preferência para resolver placar (compat
  // reversa), fallback para team.score (N times ou ausência de
  // liveScore).
  const resolveScore = (t: Team): number => {
    if (liveScore) {
      if (t.id === liveScore.team1Id) return liveScore.team1Score;
      if (t.id === liveScore.team2Id) return liveScore.team2Score;
    }
    return t.score;
  };

  const allScores = teams.map((t) => resolveScore(t));
  const maxScore = Math.max(...allScores);
  const minScore = Math.min(...allScores);

  for (const t of teams) {
    results[t.id] = rankResultGlobal(
      resolveScore(t), maxScore, minScore
    );
  }
  return results;
}

/**
 * FIX #2526: placar "do oponente" = média (arredondada) dos DEMAIS times,
 * espelhando opponentAverage() de group-league.ts (#2494).
 * Com 2 times = placar do único oponente (idêntico ao comportamento antigo,
 * sem regressão). Elimina o sentinela -1 para times 3+ em jogos LIVE.
 * @param {Team | undefined} team Time do jogador.
 * @param {LiveGameScore | null} liveScore
 *   Placar ao vivo (team1/team2 usam placar ao vivo; demais usam team.score).
 * @param {Team[]} teams Todos os times.
 * @return {number} Média dos placares dos demais times (0 se indefinido).
 */
export function getOpponentScore(
  team: Team | undefined,
  liveScore: LiveGameScore | null,
  teams: Team[]
): number {
  if (!team || teams.length < 2) return -1;

  // FIX #2526: para N >= 2 times, usar média (arredondada) dos
  // placares dos DEMAIS times. Com 2 times = placar do único
  // oponente (idêntico ao comportamento antigo). Substitui a
  // lógica antiga que só tratava 2 times e retornava -1 p/ N > 2.
  const resolveScore = (t: Team): number => {
    if (liveScore) {
      if (t.id === liveScore.team1Id) return liveScore.team1Score;
      if (t.id === liveScore.team2Id) return liveScore.team2Score;
    }
    return t.score;
  };

  const others = teams.filter((t) => t.id !== team.id);
  if (others.length === 0) return -1;
  return Math.round(
    others.reduce((sum, t) => sum + resolveScore(t), 0) /
      others.length
  );
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
          FieldPath.documentId(),
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
          FieldPath.documentId(),
          "in",
          chunk
        )
        .get()
    )
  );
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      // FIX #2284: mescla os defaults SOB os dados crus, garantindo que
      // campos ausentes/malformados no doc não virem undefined no cast.
      const raw = doc.data();
      result.set(
        doc.id,
        {
          ...defaultStats,
          ...(typeof raw === "object" && raw !== null ? raw : {}),
        } as UserStatistics
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

type FirestoreSetWriter = {
  set: (
    documentRef: admin.firestore.DocumentReference,
    data: admin.firestore.DocumentData,
    options?: admin.firestore.SetOptions
  ) => unknown;
};

/**
 * Atualiza deltas de ranking semanal e mensal.
 * @param {FirestoreSetWriter} batch Batch ou transação de escrita.
 * @param {string} uid ID do usuário.
 * @param {GameConfirmation} conf Confirmação.
 * @param {string} result Resultado do jogo.
 * @param {number} xp XP ganho.
 * @param {boolean} isMvp Se é MVP.
 * @param {string} weekKey Chave da semana.
 * @param {string} monthKey Chave do mês.
 */
export function updateRankingDeltas(
  batch: FirestoreSetWriter,
  uid: string,
  conf: GameConfirmation,
  result: string,
  xp: number,
  isMvp: boolean,
  weekKey: string,
  monthKey: string
) {
  // FIX #2525: aplica caps anti-cheat (piso 0 + teto MAX) nos incrementos de
  // ranking_deltas. A mutação em index.ts já cobre o caminho principal, mas
  // este clamp garante correção caso updateRankingDeltas seja chamado por
  // outras rotas sem pré-sanitização.
  const cappedGoals = clampStat(conf.goals, MAX_GOALS_PER_GAME);
  const cappedAssists = clampStat(conf.assists, MAX_ASSISTS_PER_GAME);
  const cappedSaves = clampStat(conf.saves, MAX_SAVES_PER_GAME);

  const fields = {
    goals_added: FieldValue.increment(cappedGoals),
    assists_added: FieldValue.increment(cappedAssists),
    saves_added: FieldValue.increment(cappedSaves),
    xp_added: FieldValue.increment(xp),
    games_added: FieldValue.increment(1),
    wins_added: FieldValue.increment(
      result === "WIN" ? 1 : 0
    ),
    mvp_added: FieldValue.increment(
      isMvp ? 1 : 0
    ),
    updated_at: FieldValue.serverTimestamp(),
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
 * Normaliza o gênero/categoria de um jogo para um dos valores
 * válidos (MALE/FEMALE/MIXED). Jogos legados sem o campo, valores
 * desconhecidos ou nulos caem no default MIXED — preserva
 * compatibilidade com docs antigos.
 * @param {unknown} raw Valor cru de `game.gender`.
 * @return {string} Gênero normalizado (MALE/FEMALE/MIXED).
 */
export function normalizeGameGender(raw: unknown): string {
  if (typeof raw === "string") {
    const upper = raw.toUpperCase();
    if ((GAME_GENDERS as readonly string[]).includes(upper)) {
      return upper;
    }
  }
  return DEFAULT_GAME_GENDER;
}

/**
 * Atualiza participação na temporada.
 *
 * MODELO ADITIVO (Fase 4 — gênero): mantém os campos planos
 * (points/wins/...) que agregam TODOS os jogos = visão "combinada"
 * (comportamento histórico, partId continua `${seasonId}_${uid}`,
 * sem migração nem double-count). Adiciona em paralelo o mapa
 * aninhado `by_gender.{MALE|FEMALE|MIXED}` com os mesmos campos,
 * permitindo rankings segmentados por categoria do JOGO.
 * @param {FirestoreSetWriter} batch Batch ou transação de escrita.
 * @param {string} uid ID do usuário.
 * @param {string} seasonId ID da temporada.
 * @param {string} result Resultado do jogo.
 * @param {GameConfirmation} conf Confirmação.
 * @param {boolean} isMvp Se é MVP.
 * @param {string | null} groupId ID do grupo
 *   (opcional, para filtro por grupo no ranking).
 * @param {string} gameGender Categoria do jogo
 *   (MALE/FEMALE/MIXED). Default MIXED para jogos legados.
 */
export function updateSeasonParticipation(
  batch: FirestoreSetWriter,
  uid: string,
  seasonId: string,
  result: string,
  conf: GameConfirmation,
  isMvp: boolean,
  groupId?: string | null,
  gameGender?: string
) {
  const partId = `${seasonId}_${uid}`;
  const gender = normalizeGameGender(gameGender);
  const pointsToAdd = result === "WIN" ?
    3 :
    (result === "DRAW" ? 1 : 0);

  // FIX #2525: calcula valores capeados UMA VEZ antes da factory para que
  // tanto o campo plano quanto o mapa by_gender.{gender} usem o mesmo valor
  // sanitizado (piso 0 + teto MAX anti-cheat). Mantém consistência Fase 4b.
  const cappedGoals = clampStat(conf.goals, MAX_GOALS_PER_GAME);
  const cappedAssists = clampStat(conf.assists, MAX_ASSISTS_PER_GAME);

  // Factory de incrementos — gera instâncias NOVAS de FieldValue a
  // cada chamada para evitar aliasing do mesmo sentinel entre o
  // campo plano (combinado) e o mapa by_gender.{gender} (segmentado).
  const buildStats = (): Record<string, unknown> => {
    const inc = FieldValue.increment;
    return {
      points: inc(pointsToAdd),
      games_played: inc(1),
      wins: inc(result === "WIN" ? 1 : 0),
      draws: inc(result === "DRAW" ? 1 : 0),
      losses: inc(result === "LOSS" ? 1 : 0),
      goals_scored: inc(cappedGoals),
      assists: inc(cappedAssists),
      mvp_count: inc(isMvp ? 1 : 0),
    };
  };

  const data: Record<string, unknown> = {
    user_id: uid,
    season_id: seasonId,
    ...buildStats(),
    // Visão segmentada: mesmos incrementos sob by_gender.{gender}.
    by_gender: {
      [gender]: buildStats(),
    },
    last_calculated_at: FieldValue.serverTimestamp(),
    // FIX #2648: não incluir created_at — a cada jogo o merge
    // sobrescrevia o timestamp de criação original. A criação
    // inicial é feita por applyVotingXpDelta.
    updated_at: FieldValue.serverTimestamp(),
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
