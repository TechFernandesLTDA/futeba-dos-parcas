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
 * Promoção: LR >= limite superior por 3 jogos consecutivos
 * Rebaixamento: LR < limite inferior por 3 jogos consecutivos
 * Proteção: 5 jogos de imunidade após promoção/rebaixamento
 */

export const PROMOTION_GAMES_REQUIRED = 3;
export const RELEGATION_GAMES_REQUIRED = 3;
export const PROTECTION_GAMES = 5;

export interface LeagueState {
    division: string;
    promotionProgress: number;
    relegationProgress: number;
    protectionGames: number;
}

export function getNextDivisionThreshold(division: string): number {
  switch (division) {
  case "BRONZE": return 30;
  case "PRATA": return 50;
  case "OURO": return 70;
  case "DIAMANTE": return 100;
  default: return 100;
  }
}

export function getPreviousDivisionThreshold(division: string): number {
  switch (division) {
  case "BRONZE": return 0;
  case "PRATA": return 30;
  case "OURO": return 50;
  case "DIAMANTE": return 70;
  default: return 0;
  }
}

export function getNextDivision(current: string): string {
  switch (current) {
  case "BRONZE": return "PRATA";
  case "PRATA": return "OURO";
  case "OURO": return "DIAMANTE";
  case "DIAMANTE": return "DIAMANTE";
  default: return current;
  }
}

export function getPreviousDivision(current: string): string {
  switch (current) {
  case "BRONZE": return "BRONZE";
  case "PRATA": return "BRONZE";
  case "OURO": return "PRATA";
  case "DIAMANTE": return "OURO";
  default: return current;
  }
}

/**
 * Calcula o novo estado da liga baseado no rating atual.
 * Implementa a lógica de promoção/rebaixamento com:
 * - 3 jogos consecutivos acima do threshold para promoção
 * - 3 jogos consecutivos abaixo do threshold para rebaixamento
 * - 5 jogos de proteção após mudança de divisão
 */
export function calculateLeaguePromotion(
  currentState: LeagueState,
  newRating: number
): LeagueState {
  let {division, promotionProgress, relegationProgress, protectionGames} = currentState;

  const nextThreshold = getNextDivisionThreshold(division);
  const prevThreshold = getPreviousDivisionThreshold(division);

  // Se estiver protegido, decrementar e não alterar progressos
  if (protectionGames > 0) {
    console.log(`[LEAGUE] Proteção ativa: ${protectionGames} jogos restantes`);
    return {
      division,
      promotionProgress: 0,
      relegationProgress: 0,
      protectionGames: protectionGames - 1,
    };
  }

  // Verificar Promoção
  if (newRating >= nextThreshold && division !== "DIAMANTE") {
    promotionProgress++;
    relegationProgress = 0;

    if (promotionProgress >= PROMOTION_GAMES_REQUIRED) {
      const newDivision = getNextDivision(division);
      console.log(`[LEAGUE] PROMOÇÃO: ${division} -> ${newDivision} (Rating: ${newRating.toFixed(1)})`);
      return {
        division: newDivision,
        promotionProgress: 0,
        relegationProgress: 0,
        protectionGames: PROTECTION_GAMES,
      };
    }
    console.log(`[LEAGUE] Progresso promoção: ${promotionProgress}/${PROMOTION_GAMES_REQUIRED} (Rating: ${newRating.toFixed(1)} >= ${nextThreshold})`);
  }
  // Verificar Rebaixamento
  else if (newRating < prevThreshold && division !== "BRONZE") {
    relegationProgress++;
    promotionProgress = 0;

    if (relegationProgress >= RELEGATION_GAMES_REQUIRED) {
      const newDivision = getPreviousDivision(division);
      console.log(`[LEAGUE] REBAIXAMENTO: ${division} -> ${newDivision} (Rating: ${newRating.toFixed(1)})`);
      return {
        division: newDivision,
        promotionProgress: 0,
        relegationProgress: 0,
        protectionGames: PROTECTION_GAMES,
      };
    }
    console.log(`[LEAGUE] Progresso rebaixamento: ${relegationProgress}/${RELEGATION_GAMES_REQUIRED} (Rating: ${newRating.toFixed(1)} < ${prevThreshold})`);
  }
  // Status quo - resetar progressos se saiu da zona
  else {
    if (newRating < nextThreshold) promotionProgress = 0;
    if (newRating >= prevThreshold) relegationProgress = 0;
  }

  return {
    division,
    promotionProgress,
    relegationProgress,
    protectionGames,
  };
}

/**
 * Calcula o League Rating baseado nos últimos jogos.
 * Fórmula: 40% PPJ + 30% WR + 20% GD + 10% MVP
 *
 * O resultado é sempre bound entre 0.0 e 100.0 para garantir integridade.
 */
export function calculateLeagueRating(recentGames: any[]): number {
  if (!recentGames || recentGames.length === 0) return 0;

  const gamesCount = recentGames.length;

  // PPJ - Pontos (XP) por Jogo (max 500 = 100 pontos)
  const avgXp = recentGames.reduce((sum, g) => sum + (g.xp_earned || 0), 0) / gamesCount;
  const ppjScore = Math.min(avgXp / 500.0, 1.0) * 100;

  // WR - Win Rate (100% = 100 pontos)
  const winRate = (recentGames.filter((g) => g.won).length / gamesCount) * 100;

  // GD - Goal Difference médio (+3 = 100, -3 = 0)
  const avgGD = recentGames.reduce((sum, g) => sum + (g.goal_diff || 0), 0) / gamesCount;
  const gdScore = Math.max(0, Math.min(1, (avgGD + 3) / 6.0)) * 100;

  // MVP Rate (50% = 100 pontos, cap)
  const mvpRate = recentGames.filter((g) => g.was_mvp).length / gamesCount;
  const mvpScore = Math.min(mvpRate / 0.5, 1.0) * 100;

  // Calcular e garantir bounds (0.0 - 100.0)
  const rating = (ppjScore * 0.4) + (winRate * 0.3) + (gdScore * 0.2) + (mvpScore * 0.1);
  return Math.max(0, Math.min(100, rating));
}

/**
 * Retorna a divisão baseada apenas no rating (sem lógica de promoção/rebaixamento).
 * Usado como fallback ou para sugestão visual.
 */
export function getDivisionForRating(rating: number): string {
  if (rating >= 70) return "DIAMANTE";
  if (rating >= 50) return "OURO";
  if (rating >= 30) return "PRATA";
  return "BRONZE";
}
