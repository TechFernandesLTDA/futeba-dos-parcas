/**
 * League Promotion/Relegation Logic
 * Ported from Kotlin LeagueService.kt
 *
 * Regras:
 * - Bronze: LR 0-29
 * - Prata: LR 30-49
 * - Ouro: LR 50-69
 * - Diamante: LR 70-100
 *
 * Promocao: LR >= limite superior por 3 jogos
 * consecutivos.
 * Rebaixamento: LR < limite inferior por 3 jogos
 * consecutivos.
 * Protecao: 5 jogos de imunidade apos
 * promocao/rebaixamento.
 */

import {logger} from "firebase-functions/v2";
import {LEAGUE_THRESHOLDS} from "./constants";

export const PROMOTION_GAMES_REQUIRED = 3;
export const RELEGATION_GAMES_REQUIRED = 3;
export const PROTECTION_GAMES = 5;

export interface LeagueState {
  division: string;
  promotionProgress: number;
  relegationProgress: number;
  protectionGames: number;
}

/**
 * Retorna o threshold da proxima divisao.
 *
 * @param {string} division - Divisao atual.
 * @return {number} Threshold para promocao.
 */
export function getNextDivisionThreshold(
  division: string
): number {
  switch (division) {
  case "BRONZE": return LEAGUE_THRESHOLDS.BRONZE_MAX;
  case "PRATA": return LEAGUE_THRESHOLDS.PRATA_MAX;
  case "OURO": return LEAGUE_THRESHOLDS.OURO_MAX;
  case "DIAMANTE": return LEAGUE_THRESHOLDS.DIAMANTE_MAX;
  default: return LEAGUE_THRESHOLDS.DIAMANTE_MAX;
  }
}

/**
 * Retorna o threshold da divisao anterior.
 *
 * @param {string} division - Divisao atual.
 * @return {number} Threshold para rebaixamento.
 */
export function getPreviousDivisionThreshold(
  division: string
): number {
  switch (division) {
  case "BRONZE": return 0;
  case "PRATA": return LEAGUE_THRESHOLDS.BRONZE_MAX;
  case "OURO": return LEAGUE_THRESHOLDS.PRATA_MAX;
  case "DIAMANTE": return LEAGUE_THRESHOLDS.OURO_MAX;
  default: return 0;
  }
}

/**
 * Retorna a proxima divisao acima da atual.
 *
 * @param {string} current - Divisao atual.
 * @return {string} Proxima divisao.
 */
export function getNextDivision(
  current: string
): string {
  switch (current) {
  case "BRONZE": return "PRATA";
  case "PRATA": return "OURO";
  case "OURO": return "DIAMANTE";
  case "DIAMANTE": return "DIAMANTE";
  default: return current;
  }
}

/**
 * Retorna a divisao abaixo da atual.
 *
 * @param {string} current - Divisao atual.
 * @return {string} Divisao anterior.
 */
export function getPreviousDivision(
  current: string
): string {
  switch (current) {
  case "BRONZE": return "BRONZE";
  case "PRATA": return "BRONZE";
  case "OURO": return "PRATA";
  case "DIAMANTE": return "OURO";
  default: return current;
  }
}

/**
 * Calcula o novo estado da liga baseado no
 * rating atual. Implementa a logica de
 * promocao/rebaixamento com:
 * - 3 jogos consecutivos acima do threshold
 *   para promocao
 * - 3 jogos consecutivos abaixo do threshold
 *   para rebaixamento
 * - 5 jogos de protecao apos mudanca de divisao
 *
 * @param {LeagueState} currentState - Estado atual.
 * @param {number} newRating - Novo rating.
 * @return {LeagueState} Novo estado da liga.
 */
export function calculateLeaguePromotion(
  currentState: LeagueState,
  newRating: number
): LeagueState {
  let {
    division,
    promotionProgress,
    relegationProgress,
    protectionGames,
  } = currentState;

  const nextThreshold =
    getNextDivisionThreshold(division);
  const prevThreshold =
    getPreviousDivisionThreshold(division);

  // Se estiver protegido, decrementar
  // e nao alterar progressos
  if (protectionGames > 0) {
    const remaining = protectionGames;
    logger.info(
      `[LEAGUE] Protecao ativa: ${remaining}` +
      " jogos restantes"
    );
    return {
      division,
      promotionProgress: 0,
      relegationProgress: 0,
      protectionGames: protectionGames - 1,
    };
  }

  // Verificar Promocao
  if (
    newRating >= nextThreshold &&
    division !== "DIAMANTE"
  ) {
    promotionProgress++;
    relegationProgress = 0;

    if (
      promotionProgress >= PROMOTION_GAMES_REQUIRED
    ) {
      const newDivision =
        getNextDivision(division);
      const ratingStr = newRating.toFixed(1);
      logger.info(
        "[LEAGUE] PROMOCAO: " +
        `${division} -> ${newDivision}` +
        ` (Rating: ${ratingStr})`
      );
      return {
        division: newDivision,
        promotionProgress: 0,
        relegationProgress: 0,
        protectionGames: PROTECTION_GAMES,
      };
    }
    const required = PROMOTION_GAMES_REQUIRED;
    const ratingStr = newRating.toFixed(1);
    logger.info(
      "[LEAGUE] Progresso promocao: " +
      `${promotionProgress}/${required}` +
      ` (Rating: ${ratingStr}` +
      ` >= ${nextThreshold})`
    );
  } else if (
    // Verificar Rebaixamento
    newRating < prevThreshold &&
    division !== "BRONZE"
  ) {
    relegationProgress++;
    promotionProgress = 0;

    if (
      relegationProgress >= RELEGATION_GAMES_REQUIRED
    ) {
      const newDivision =
        getPreviousDivision(division);
      const ratingStr = newRating.toFixed(1);
      logger.info(
        "[LEAGUE] REBAIXAMENTO: " +
        `${division} -> ${newDivision}` +
        ` (Rating: ${ratingStr})`
      );
      return {
        division: newDivision,
        promotionProgress: 0,
        relegationProgress: 0,
        protectionGames: PROTECTION_GAMES,
      };
    }
    const required = RELEGATION_GAMES_REQUIRED;
    const ratingStr = newRating.toFixed(1);
    logger.info(
      "[LEAGUE] Progresso rebaixamento: " +
      `${relegationProgress}/${required}` +
      ` (Rating: ${ratingStr}` +
      ` < ${prevThreshold})`
    );
  } else {
    // Status quo - resetar progressos
    // se saiu da zona
    if (newRating < nextThreshold) {
      promotionProgress = 0;
    }
    if (newRating >= prevThreshold) {
      relegationProgress = 0;
    }
  }

  return {
    division,
    promotionProgress,
    relegationProgress,
    protectionGames,
  };
}

/** Dados de um jogo recente para calculo. */
interface RecentGame {
  xp_earned?: number;
  won?: boolean;
  goal_diff?: number;
  was_mvp?: boolean;
}

/**
 * Calcula o League Rating baseado nos ultimos
 * jogos.
 * Formula: 40% PPJ + 30% WR + 20% GD + 10% MVP
 *
 * O resultado e sempre bound entre 0.0 e 100.0
 * para garantir integridade.
 *
 * @param {RecentGame[]} recentGames - Jogos recentes.
 * @return {number} Rating calculado (0-100).
 */
export function calculateLeagueRating(
  recentGames: RecentGame[]
): number {
  if (!recentGames || recentGames.length === 0) {
    return 0;
  }

  const gamesCount = recentGames.length;

  // PPJ - Pontos (XP) por Jogo
  // (max 500 = 100 pontos)
  const totalXp = recentGames.reduce(
    (sum, g) => sum + (g.xp_earned || 0), 0
  );
  const avgXp = totalXp / gamesCount;
  const ppjScore =
    Math.min(avgXp / 500.0, 1.0) * 100;

  // WR - Win Rate (100% = 100 pontos)
  const wins = recentGames.filter(
    (g) => g.won
  ).length;
  const winRate = (wins / gamesCount) * 100;

  // GD - Goal Difference medio
  // (+3 = 100, -3 = 0)
  const totalGD = recentGames.reduce(
    (sum, g) => sum + (g.goal_diff || 0), 0
  );
  const avgGD = totalGD / gamesCount;
  const gdNorm = (avgGD + 3) / 6.0;
  const gdScore =
    Math.max(0, Math.min(1, gdNorm)) * 100;

  // MVP Rate (50% = 100 pontos, cap)
  const mvpCount = recentGames.filter(
    (g) => g.was_mvp
  ).length;
  const mvpRate = mvpCount / gamesCount;
  const mvpScore =
    Math.min(mvpRate / 0.5, 1.0) * 100;

  // Calcular e garantir bounds (0.0 - 100.0)
  const rating =
    (ppjScore * 0.4) +
    (winRate * 0.3) +
    (gdScore * 0.2) +
    (mvpScore * 0.1);
  return Math.max(0, Math.min(100, rating));
}

/**
 * Retorna a divisao baseada apenas no rating
 * (sem logica de promocao/rebaixamento).
 * Usado como fallback ou para sugestao visual.
 *
 * @param {number} rating - Rating do jogador.
 * @return {string} Nome da divisao.
 */
export function getDivisionForRating(
  rating: number
): string {
  if (rating >= 70) return "DIAMANTE";
  if (rating >= 50) return "OURO";
  if (rating >= 30) return "PRATA";
  return "BRONZE";
}
