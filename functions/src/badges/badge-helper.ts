/**
 * Badge awarding logic extracted for testability.
 * Funcoes puras que determinam quais badges
 * devem ser concedidas.
 */
import {
  BADGE_STREAK_THRESHOLDS,
  BADGE_VETERAN_THRESHOLDS,
  BADGE_WINNER_THRESHOLDS,
  BADGE_DEFENSIVE_WALL_SAVES,
} from "../constants";

export interface ConfirmationData {
  goals: number;
  assists: number;
  saves: number;
  position: string;
  isMvp?: boolean;
  isWorstPlayer?: boolean;
}

export interface PlayerStats {
  totalGames: number;
  gamesWon: number;
  currentMvpStreak: number;
}

export interface BadgeContext {
  confirmation: ConfirmationData;
  newStats: PlayerStats;
  streak: number;
  newMvpStreak: number;
  newLevel: number;
  currentLevel?: number;
  result: "WIN" | "DRAW" | "LOSS";
  opponentScore?: number;
}

/**
 * Determina quais badges de streak devem
 * ser concedidas.
 *
 * @param {number} streak - Streak atual do jogador.
 * @return {string[]} Lista de badges de streak.
 */
export function getStreakBadges(
  streak: number
): string[] {
  const badges: string[] = [];
  if (streak >= BADGE_STREAK_THRESHOLDS.STREAK_30) {
    badges.push("streak_30");
  } else if (streak >= BADGE_STREAK_THRESHOLDS.IRON_MAN) {
    badges.push("iron_man");
  } else if (streak >= 7) {
    badges.push("streak_7");
  }
  return badges;
}

/**
 * Determina quais badges de gols devem
 * ser concedidas.
 *
 * @param {number} goals - Gols marcados no jogo.
 * @return {string[]} Lista de badges de gols.
 */
export function getGoalsBadges(
  goals: number
): string[] {
  const badges: string[] = [];
  if (goals >= 5) {
    badges.push("hat_trick", "poker", "manita");
  } else if (goals >= 4) {
    badges.push("hat_trick", "poker");
  } else if (goals >= 3) {
    badges.push("hat_trick");
  }
  return badges;
}

/**
 * Determina quais badges de assistencias
 * devem ser concedidas.
 *
 * @param {number} assists - Assistencias no jogo.
 * @return {string[]} Lista de badges de assist.
 */
export function getAssistsBadges(
  assists: number
): string[] {
  const badges: string[] = [];
  if (assists >= 3) {
    badges.push("playmaker");
  }
  return badges;
}

/**
 * Determina se o jogador merece a badge
 * balanced_player.
 *
 * @param {number} goals - Gols marcados.
 * @param {number} assists - Assistencias feitas.
 * @return {string[]} Lista com badge ou vazia.
 */
export function getBalancedPlayerBadge(
  goals: number,
  assists: number
): string[] {
  return (goals >= 2 && assists >= 2) ?
    ["balanced_player"] : [];
}

/**
 * Determina quais badges de MVP devem
 * ser concedidas.
 *
 * @param {boolean} isMvp - Se o jogador e MVP.
 * @param {number} newMvpStreak - Streak de MVP.
 * @return {string[]} Lista de badges de MVP.
 */
export function getMvpBadges(
  isMvp: boolean,
  newMvpStreak: number
): string[] {
  const badges: string[] = [];
  if (isMvp && newMvpStreak === 3) {
    badges.push("mvp_streak_3");
  }
  return badges;
}

/**
 * Determina quais badges de veterano devem
 * ser concedidas.
 *
 * @param {number} totalGames - Total de jogos.
 * @return {string[]} Lista de badges veterano.
 */
export function getVeteranBadges(
  totalGames: number
): string[] {
  const badges: string[] = [];
  if (totalGames === BADGE_VETERAN_THRESHOLDS.VETERAN_100) {
    badges.push("veteran_100");
  }
  if (totalGames === BADGE_VETERAN_THRESHOLDS.VETERAN_50) {
    badges.push("veteran_50");
  }
  return badges;
}

/**
 * Determina quais badges de nivel devem
 * ser concedidas.
 *
 * @param {number} level - Nivel atual do jogador.
 * @param {number} currentLevel - Nivel anterior
 *   (para detectar mudanca).
 * @return {string[]} Lista de badges de nivel.
 */
export function getLevelBadges(
  level: number,
  currentLevel?: number
): string[] {
  // Só premiar se o nível mudou
  if (
    currentLevel !== undefined &&
    level === currentLevel
  ) {
    return [];
  }
  const badges: string[] = [];
  if (level >= 10) {
    badges.push("level_10", "level_5");
  } else if (level >= 5) {
    badges.push("level_5");
  }
  return badges;
}

/**
 * Determina quais badges de goleiro devem
 * ser concedidas.
 *
 * @param {string} position - Posicao do jogador.
 * @param {number} saves - Defesas feitas.
 * @param {number} opponentScore - Gols do adversario.
 * @return {string[]} Lista de badges de goleiro.
 */
export function getGoalkeeperBadges(
  position: string,
  saves: number,
  opponentScore?: number
): string[] {
  const badges: string[] = [];

  if (position !== "GOALKEEPER") return badges;

  // CLEAN_SHEET - Goleiro sem sofrer gols
  if (opponentScore === 0) {
    badges.push("clean_sheet");

    // PAREDAO - Clean sheet COM 5+ defesas
    if (saves >= 5) {
      badges.push("paredao");
    }
  }

  // DEFENSIVE_WALL - defesas >= threshold
  if (saves >= BADGE_DEFENSIVE_WALL_SAVES) {
    badges.push("defensive_wall");
  }

  return badges;
}

/**
 * Determina quais badges de vitoria devem
 * ser concedidas.
 *
 * @param {string} result - Resultado do jogo.
 * @param {number} gamesWon - Total de vitorias.
 * @return {string[]} Lista de badges de vitoria.
 */
export function getWinnerBadges(
  result: string,
  gamesWon: number
): string[] {
  const badges: string[] = [];

  if (result === "WIN") {
    if (gamesWon === BADGE_WINNER_THRESHOLDS.WINNER_50) {
      badges.push("winner_50");
    }
    if (gamesWon === BADGE_WINNER_THRESHOLDS.WINNER_25) {
      badges.push("winner_25");
    }
  }

  return badges;
}

/**
 * Calcula novo MVP streak baseado no resultado.
 *
 * @param {number} currentStreak - Streak atual.
 * @param {boolean} isMvp - Se foi MVP no jogo.
 * @return {number} Novo valor do streak.
 */
export function calculateMvpStreak(
  currentStreak: number,
  isMvp: boolean
): number {
  return isMvp ? currentStreak + 1 : 0;
}

/**
 * Coleta todas as badges que devem ser
 * concedidas para um contexto.
 *
 * @param {BadgeContext} context - Contexto do jogo.
 * @return {string[]} Lista de todas as badges.
 */
export function getAllBadgesToAward(
  context: BadgeContext
): string[] {
  const {
    confirmation,
    newStats,
    streak,
    newMvpStreak,
    newLevel,
    result,
    opponentScore,
  } = context;
  const badges: string[] = [];

  badges.push(...getStreakBadges(streak));
  badges.push(
    ...getGoalsBadges(confirmation.goals)
  );
  badges.push(
    ...getAssistsBadges(confirmation.assists)
  );
  badges.push(
    ...getBalancedPlayerBadge(
      confirmation.goals,
      confirmation.assists
    )
  );
  badges.push(
    ...getMvpBadges(
      confirmation.isMvp || false,
      newMvpStreak
    )
  );
  badges.push(
    ...getVeteranBadges(newStats.totalGames)
  );
  badges.push(
    ...getLevelBadges(newLevel, context.currentLevel)
  );
  badges.push(
    ...getGoalkeeperBadges(
      confirmation.position,
      confirmation.saves,
      opponentScore
    )
  );
  badges.push(
    ...getWinnerBadges(result, newStats.gamesWon)
  );

  return badges;
}
