/**
 * Badge awarding logic extracted for testability.
 * Funcoes puras que determinam quais badges devem ser concedidas.
 */

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
    result: "WIN" | "DRAW" | "LOSS";
    opponentScore?: number;
}

/**
 * Determina quais badges de streak devem ser concedidas.
 */
export function getStreakBadges(streak: number): string[] {
  const badges: string[] = [];
  if (streak >= 30) badges.push("streak_30");
  else if (streak >= 10) badges.push("iron_man");
  else if (streak >= 7) badges.push("streak_7");
  return badges;
}

/**
 * Determina quais badges de gols devem ser concedidas.
 */
export function getGoalsBadges(goals: number): string[] {
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
 * Determina quais badges de assistencias devem ser concedidas.
 */
export function getAssistsBadges(assists: number): string[] {
  const badges: string[] = [];
  if (assists >= 3) {
    badges.push("playmaker");
  }
  return badges;
}

/**
 * Determina se o jogador merece a badge balanced_player.
 */
export function getBalancedPlayerBadge(goals: number, assists: number): string[] {
  return (goals >= 2 && assists >= 2) ? ["balanced_player"] : [];
}

/**
 * Determina quais badges de MVP devem ser concedidas.
 */
export function getMvpBadges(isMvp: boolean, newMvpStreak: number): string[] {
  const badges: string[] = [];
  if (isMvp && newMvpStreak === 3) {
    badges.push("mvp_streak_3");
  }
  return badges;
}

/**
 * Determina quais badges de veterano devem ser concedidas.
 */
export function getVeteranBadges(totalGames: number): string[] {
  const badges: string[] = [];
  if (totalGames === 100) badges.push("veteran_100");
  if (totalGames === 50) badges.push("veteran_50");
  return badges;
}

/**
 * Determina quais badges de nivel devem ser concedidas.
 */
export function getLevelBadges(level: number): string[] {
  const badges: string[] = [];
  if (level >= 10) {
    badges.push("level_10", "level_5");
  } else if (level >= 5) {
    badges.push("level_5");
  }
  return badges;
}

/**
 * Determina quais badges de goleiro devem ser concedidas.
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

  // DEFENSIVE_WALL - 10+ defesas
  if (saves >= 10) {
    badges.push("defensive_wall");
  }

  return badges;
}

/**
 * Determina quais badges de vitoria devem ser concedidas.
 */
export function getWinnerBadges(result: string, gamesWon: number): string[] {
  const badges: string[] = [];

  if (result === "WIN") {
    if (gamesWon === 50) badges.push("winner_50");
    if (gamesWon === 25) badges.push("winner_25");
  }

  return badges;
}

/**
 * Calcula novo MVP streak baseado no resultado.
 */
export function calculateMvpStreak(
  currentStreak: number,
  isMvp: boolean
): number {
  return isMvp ? currentStreak + 1 : 0;
}

/**
 * Coleta todas as badges que devem ser concedidas para um contexto.
 */
export function getAllBadgesToAward(context: BadgeContext): string[] {
  const {confirmation, newStats, streak, newMvpStreak, newLevel, result, opponentScore} = context;
  const badges: string[] = [];

  badges.push(...getStreakBadges(streak));
  badges.push(...getGoalsBadges(confirmation.goals));
  badges.push(...getAssistsBadges(confirmation.assists));
  badges.push(...getBalancedPlayerBadge(confirmation.goals, confirmation.assists));
  badges.push(...getMvpBadges(confirmation.isMvp || false, newMvpStreak));
  badges.push(...getVeteranBadges(newStats.totalGames));
  badges.push(...getLevelBadges(newLevel));
  badges.push(...getGoalkeeperBadges(confirmation.position, confirmation.saves, opponentScore));
  badges.push(...getWinnerBadges(result, newStats.gamesWon));

  return badges;
}
