// Source of truth: shared/xp-constants.json — keep in sync
import type { Theme } from '@mui/material/styles';
import xpConstants from '../../../shared/xp-constants.json';
import { gamificationColors, rarityColors } from '../theme';
import { getGamificationColors, getGamificationTextColors } from '../utils/gamificationColors';

export const LEAGUE_DIVISIONS = ['BRONZE', 'PRATA', 'OURO', 'DIAMANTE'] as const;

export type LeagueDivision = typeof LEAGUE_DIVISIONS[number];

const LEGACY_LEAGUE_DIVISION_ALIASES: Readonly<Record<string, LeagueDivision>> = {
  BRONZE: 'BRONZE',
  PRATA: 'PRATA',
  SILVER: 'PRATA',
  OURO: 'OURO',
  GOLD: 'OURO',
  DIAMANTE: 'DIAMANTE',
  DIAMOND: 'DIAMANTE',
  PLATINUM: 'DIAMANTE',
  CHAMPION: 'DIAMANTE',
};

/**
 * Normaliza o contrato recebido sem persistir mudanças em documentos legados.
 * Valores desconhecidos são tratados como Bronze de forma fail-safe.
 */
export function normalizeLeagueDivision(value: unknown): LeagueDivision {
  if (typeof value !== 'string') return 'BRONZE';
  return LEGACY_LEAGUE_DIVISION_ALIASES[value.trim().toUpperCase()] ?? 'BRONZE';
}

export type BadgeType =
  | 'HAT_TRICK' | 'PAREDAO' | 'ARTILHEIRO_MES'
  | 'FOMINHA' | 'STREAK_7' | 'STREAK_30'
  | 'ORGANIZADOR_MASTER' | 'INFLUENCER'
  | 'LENDA' | 'FAIXA_PRETA' | 'MITO'
  | 'FIRST_GAME' | 'STREAK_3' | 'MVP_1' | 'MVP_10' | 'MVP_50'
  | 'GOALS_10' | 'GOALS_100' | 'GOALS_500'
  | 'ASSISTS_50' | 'ASSISTS_200'
  | 'WINS_10' | 'WINS_50'
  | 'GAMES_100' | 'GAMES_500';

export type BadgeRarity = 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO';

export type CardRarity = 'COMUM' | 'INCOMUM' | 'RARO' | 'EPICO' | 'LENDARIO';

export type ChallengeType = 
  | 'SCORE_GOALS' 
  | 'WIN_GAMES' 
  | 'ASSISTS'
  | 'CLEAN_SHEETS' 
  | 'PLAY_GAMES' 
  | 'INVITE_PLAYERS';

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  scheduleId?: string;
  createdAt?: Date;
  closedAt?: Date;
}

export interface SeasonParticipation {
  id: string;
  userId: string;
  seasonId: string;
  groupId?: string;
  division: LeagueDivision;
  points: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  mvpCount: number;
}

export interface SeasonFinalStanding {
  id: string;
  seasonId: string;
  userId: string;
  finalDivision: LeagueDivision;
  finalRating: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  frozenAt?: Date;
}

export interface Badge {
  id: string;
  type: BadgeType;
  name: string;
  description: string;
  iconUrl: string;
  xpReward: number;
  rarity: BadgeRarity;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  count: number;
  unlockedAt?: Date;
  lastEarnedAt?: Date;
}

export interface UserStreak {
  id: string;
  userId: string;
  scheduleId?: string;
  currentStreak: number;
  longestStreak: number;
  lastGameDate?: string;
  streakStartedAt?: string;
}

export interface WeeklyChallenge {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  targetValue: number;
  xpReward: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  scheduleId?: string;
}

export interface UserChallengeProgress {
  id: string;
  userId: string;
  challengeId: string;
  currentProgress: number;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface PlayerCard {
  id: string;
  userId: string;
  season: string;
  attackRating: number;
  defenseRating: number;
  physicalRating: number;
  techniqueRating: number;
  overallRating: number;
  rarity: CardRarity;
  level: number;
  totalGames: number;
  specialTrait?: string;
  cardImageUrl?: string;
}

export interface HeadToHead {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  totalGames: number;
  player1Goals: number;
  player2Goals: number;
}

export interface Milestone {
  type: string;
  displayName: string;
  description: string;
  xpReward: number;
  threshold: number;
  field: string;
}

export interface RankingPlayer {
  userId: string;
  userName: string;
  userPhoto?: string;
  level: number;
  division: LeagueDivision;
  points: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  mvpCount: number;
  currentStreak: number;
}

// Cores alinhadas com gamificationColors em theme/index.ts (single source of truth)
// ⚠️ #4041: o campo `color` abaixo é o metal LIGHT estático (pensado como FUNDO —
// borda, tinta, barra de progresso) e NÃO é theme-aware. Para uso visual em telas:
//   • fundo/borda  → `getDivisionColor(division, theme)` (theme-aware #2163)
//   • texto        → `getDivisionTextColor(division, theme)` (AA #4041 — no light
//     prata #E0E0E0 = 1.32:1 e ouro #FFD700 = 1.40:1 como texto reprovam)
export const DIVISION_CONFIG: Record<LeagueDivision, {
  label: string;
  labelKey: string;
  color: string;
  minRating: number;
}> = {
  BRONZE: { label: 'Bronze', labelKey: 'league.bronze', color: gamificationColors.bronze, minRating: 0 },
  PRATA: { label: 'Prata', labelKey: 'league.silver', color: gamificationColors.silver, minRating: 30 },
  OURO: { label: 'Ouro', labelKey: 'league.gold', color: gamificationColors.gold, minRating: 50 },
  DIAMANTE: { label: 'Diamante', labelKey: 'league.diamond', color: gamificationColors.level, minRating: 70 },
};

export function getDivisionLabel(
  division: unknown,
  translate?: (key: string) => string,
): string {
  const config = DIVISION_CONFIG[normalizeLeagueDivision(division)];
  return translate ? translate(config.labelKey) : config.label;
}

/**
 * Cor da divisão, theme-aware (#2163). Em dark/OLED retorna a variante mais
 * brilhante de `gamificationColorsDark` para manter contraste WCAG. Pensada
 * para FUNDO/borda/tinta; para TEXTO use `getDivisionTextColor` (#4041).
 */
export function getDivisionColor(division: unknown, theme: Theme): string {
  const colors = getGamificationColors(theme);
  const map: Record<LeagueDivision, string> = {
    BRONZE: colors.bronze,
    PRATA: colors.silver,
    OURO: colors.gold,
    DIAMANTE: colors.level,
  };
  return map[normalizeLeagueDivision(division)];
}

/**
 * Cor da divisão segura como TEXTO (#4041): no light usa os tons escuros de
 * `gamificationColorsOnLight` (prata/ouro puros reprovam AA sobre paper);
 * no dark devolve as variantes brilhantes (iguais a `getDivisionColor`).
 */
export function getDivisionTextColor(division: unknown, theme: Theme): string {
  const colors = getGamificationTextColors(theme);
  const map: Record<LeagueDivision, string> = {
    BRONZE: colors.bronze,
    PRATA: colors.silver,
    OURO: colors.gold,
    DIAMANTE: colors.level,
  };
  return map[normalizeLeagueDivision(division)];
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: BadgeRarity;
  requirement: string;
  xpReward: number;
  progressStat?: 'totalGoals' | 'totalAssists' | 'totalWins' | 'totalSaves';
  progressThreshold?: number;
}

// FIX #4138: IDs alinhados aos que as Cloud Functions realmente gravam em
// user_badges (badge-helper.ts, game-badges.ts, xp/pipeline.ts milestones).
// Antes: HAT_TRICK/PAREDAO (uppercase) nunca casavam com hat_trick/paredao
// gravados, e ~15 badges gravadas não existiam no catálogo (invisíveis).
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first_game', name: 'Primeira Pelada', description: 'Participe do seu primeiro jogo', icon: '⚽', category: 'participation', rarity: 'COMUM', requirement: 'Participar de 1 jogo', xpReward: 50 },
  { id: 'streak_3', name: 'Sequência Iniciante', description: 'Jogue 3 partidas seguidas', icon: '🔥', category: 'streak', rarity: 'COMUM', requirement: 'Sequência de 3 jogos', xpReward: 30 },
  { id: 'streak_7', name: 'Semana Perfeita', description: 'Jogue 7 partidas seguidas', icon: '💪', category: 'streak', rarity: 'RARO', requirement: 'Sequência de 7 jogos', xpReward: 100 },
  { id: 'streak_30', name: 'Mês Imbatível', description: 'Jogue 30 partidas seguidas', icon: '🏆', category: 'streak', rarity: 'LENDARIO', requirement: 'Sequência de 30 jogos', xpReward: 500 },
  { id: 'iron_man', name: 'Homem de Ferro', description: 'Jogue várias partidas seguidas sem faltar', icon: '⚙️', category: 'streak', rarity: 'EPICO', requirement: 'Sequência longa de jogos', xpReward: 400 },
  { id: 'mvp_1', name: 'Estreante MVP', description: 'Seja eleito MVP pela primeira vez', icon: '⭐', category: 'mvp', rarity: 'COMUM', requirement: '1 MVP', xpReward: 100 },
  { id: 'mvp_10', name: 'Estrela em Ascensão', description: 'Seja eleito MVP 10 vezes', icon: '🌟', category: 'mvp', rarity: 'RARO', requirement: '10 MVPs', xpReward: 300 },
  { id: 'mvp_50', name: 'Lenda do MVP', description: 'Seja eleito MVP 50 vezes', icon: '👑', category: 'mvp', rarity: 'LENDARIO', requirement: '50 MVPs', xpReward: 1000 },
  { id: 'mvp_streak_3', name: 'MVP 3x Seguidas', description: 'Seja eleito MVP 3 partidas seguidas', icon: '✨', category: 'mvp', rarity: 'EPICO', requirement: '3 MVPs seguidos', xpReward: 250 },
  { id: 'goals_10', name: 'Goleador', description: 'Marque 10 gols', icon: '🥅', category: 'goals', rarity: 'COMUM', requirement: '10 gols', xpReward: 50, progressStat: 'totalGoals', progressThreshold: 10 },
  { id: 'goals_100', name: 'Artilheiro', description: 'Marque 100 gols', icon: '⚽', category: 'goals', rarity: 'RARO', requirement: '100 gols', xpReward: 200, progressStat: 'totalGoals', progressThreshold: 100 },
  { id: 'goals_500', name: 'Máquina de Gols', description: 'Marque 500 gols', icon: '🎯', category: 'goals', rarity: 'LENDARIO', requirement: '500 gols', xpReward: 1000, progressStat: 'totalGoals', progressThreshold: 500 },
  { id: 'assists_50', name: 'Garçom', description: 'Dê 50 assistências', icon: '👟', category: 'assists', rarity: 'COMUM', requirement: '50 assists', xpReward: 50, progressStat: 'totalAssists', progressThreshold: 50 },
  { id: 'assists_200', name: 'Mestre das Assistências', description: 'Dê 200 assistências', icon: '🎭', category: 'assists', rarity: 'RARO', requirement: '200 assists', xpReward: 300, progressStat: 'totalAssists', progressThreshold: 200 },
  { id: 'wins_10', name: 'Vencedor', description: 'Vença 10 jogos', icon: '🏅', category: 'wins', rarity: 'COMUM', requirement: '10 vitórias', xpReward: 100, progressStat: 'totalWins', progressThreshold: 10 },
  { id: 'wins_50', name: 'Campeão', description: 'Vença 50 jogos', icon: '🏆', category: 'wins', rarity: 'RARO', requirement: '50 vitórias', xpReward: 400, progressStat: 'totalWins', progressThreshold: 50 },
  { id: 'winner_25', name: 'Conquistador', description: 'Vença 25 jogos', icon: '🎖️', category: 'wins', rarity: 'RARO', requirement: '25 vitórias', xpReward: 300, progressStat: 'totalWins', progressThreshold: 25 },
  { id: 'winner_50', name: 'Tetacampeão', description: 'Vença 50 jogos', icon: '🥇', category: 'wins', rarity: 'EPICO', requirement: '50 vitórias', xpReward: 450, progressStat: 'totalWins', progressThreshold: 50 },
  { id: 'saves_10', name: 'Muralha', description: 'Faça 10 defesas', icon: '🧤', category: 'saves', rarity: 'COMUM', requirement: '10 defesas', xpReward: 100, progressStat: 'totalSaves', progressThreshold: 10 },
  { id: 'saves_50', name: 'Paredão', description: 'Faça 50 defesas', icon: '🛡️', category: 'saves', rarity: 'RARO', requirement: '50 defesas', xpReward: 300, progressStat: 'totalSaves', progressThreshold: 50 },
  { id: 'games_100', name: 'Veterano', description: 'Participe de 100 jogos', icon: '🎖️', category: 'participation', rarity: 'EPICO', requirement: '100 jogos', xpReward: 500 },
  { id: 'games_500', name: 'Lenda Viva', description: 'Participe de 500 jogos', icon: '🏟️', category: 'participation', rarity: 'LENDARIO', requirement: '500 jogos', xpReward: 2000 },
  { id: 'veteran_50', name: 'Veterano (50)', description: 'Participe de 50 jogos', icon: '📌', category: 'participation', rarity: 'RARO', requirement: '50 jogos', xpReward: 300 },
  { id: 'veteran_100', name: 'Veterano (100)', description: 'Participe de 100 jogos', icon: '🏅', category: 'participation', rarity: 'EPICO', requirement: '100 jogos', xpReward: 450 },
  { id: 'level_5', name: 'Nível 5', description: 'Alcance o nível 5', icon: '5️⃣', category: 'level', rarity: 'COMUM', requirement: 'Nível 5', xpReward: 100 },
  { id: 'level_10', name: 'Nível 10', description: 'Alcance o nível 10', icon: '🔟', category: 'level', rarity: 'RARO', requirement: 'Nível 10', xpReward: 300 },
  { id: 'hat_trick', name: 'Hat-Trick', description: 'Marque 3+ gols em uma única partida', icon: '⚽', category: 'performance', rarity: 'RARO', requirement: '3+ gols em uma partida', xpReward: 150 },
  { id: 'poker', name: 'Poker de Gols', description: 'Marque 4+ gols em uma única partida', icon: '♠️', category: 'performance', rarity: 'EPICO', requirement: '4+ gols em uma partida', xpReward: 200 },
  { id: 'manita', name: 'Manita', description: 'Marque 5+ gols em uma única partida', icon: '🖐️', category: 'performance', rarity: 'LENDARIO', requirement: '5+ gols em uma partida', xpReward: 300 },
  { id: 'playmaker', name: 'Maestro', description: 'Dê 3+ assistências em uma partida', icon: '🎩', category: 'performance', rarity: 'RARO', requirement: '3+ assistências em uma partida', xpReward: 150 },
  { id: 'balanced_player', name: 'Jogador Completo', description: 'Gol e assistência na mesma partida', icon: '⚖️', category: 'performance', rarity: 'COMUM', requirement: '1 gol e 1 assistência em uma partida', xpReward: 100 },
  { id: 'clean_sheet', name: 'Clean Sheet', description: 'Termine uma partida sem sofrer gols como goleiro', icon: '🥚', category: 'performance', rarity: 'COMUM', requirement: 'Clean sheet como goleiro', xpReward: 100 },
  { id: 'paredao', name: 'Paredão', description: 'Faça várias defesas em uma partida', icon: '🧱', category: 'performance', rarity: 'RARO', requirement: 'Muitas defesas em uma partida', xpReward: 150 },
  { id: 'defensive_wall', name: 'Muralha Defensiva', description: 'Domine as defesas na partida', icon: '🛡️', category: 'performance', rarity: 'EPICO', requirement: 'Performance defensiva excepcional', xpReward: 200 },
  { id: 'onipresente', name: 'Onipresente', description: 'Esteja presente em praticamente todos os jogos', icon: '👁️', category: 'participation', rarity: 'EPICO', requirement: 'Presença em quase todos os jogos', xpReward: 350 },
  { id: 'rei_das_quartas', name: 'Rei das Quartas', description: 'Domine os jogos de quarta-feira', icon: '👑', category: 'participation', rarity: 'RARO', requirement: 'Presença consistente às quartas', xpReward: 200 },
  { id: 'carrasco', name: 'Carrasco', description: 'Decida jogos com gols no fim', icon: '🗡️', category: 'performance', rarity: 'RARO', requirement: 'Gols decisivos', xpReward: 200 },
  { id: 'mesa_oficial_10', name: 'Mesa Oficial (10)', description: 'Anote a súmula de 10 jogos', icon: '📝', category: 'community', rarity: 'COMUM', requirement: '10 jogos como anotador', xpReward: 100 },
  { id: 'mesa_oficial_25', name: 'Mesa Oficial (25)', description: 'Anote a súmula de 25 jogos', icon: '📋', category: 'community', rarity: 'RARO', requirement: '25 jogos como anotador', xpReward: 250 },
  { id: 'mesa_oficial_50', name: 'Mesa Oficial (50)', description: 'Anote a súmula de 50 jogos', icon: '📚', category: 'community', rarity: 'EPICO', requirement: '50 jogos como anotador', xpReward: 400 },
  { id: 'ambassador_bronze', name: 'Embaixador Bronze', description: 'Convide 3 jogadores que entraram no app', icon: '🥉', category: 'community', rarity: 'COMUM', requirement: '3 convites convertidos', xpReward: 100 },
  { id: 'ambassador_prata', name: 'Embaixador Prata', description: 'Convide 10 jogadores que entraram no app', icon: '🥈', category: 'community', rarity: 'RARO', requirement: '10 convites convertidos', xpReward: 200 },
  { id: 'ambassador_ouro', name: 'Embaixador Ouro', description: 'Convide 30 jogadores que entraram no app', icon: '🥇', category: 'community', rarity: 'EPICO', requirement: '30 convites convertidos', xpReward: 350 },
  { id: 'ambassador_lenda', name: 'Embaixador Lenda', description: 'Convide 100 jogadores que entraram no app', icon: '👑', category: 'community', rarity: 'LENDARIO', requirement: '100 convites convertidos', xpReward: 600 },
  { id: 'ARTILHEIRO_MES', name: 'Artilheiro do Mês', description: 'Seja o maior goleador do mês', icon: '👑', category: 'performance', rarity: 'EPICO', requirement: 'Mais gols no mês', xpReward: 300 },
  { id: 'FOMINHA', name: 'Fominha', description: 'Jogue 3 partidas na mesma semana', icon: '🔥', category: 'presence', rarity: 'COMUM', requirement: '3 jogos na mesma semana', xpReward: 50 },
  { id: 'ORGANIZADOR_MASTER', name: 'Organizador Master', description: 'Organize 10 jogos', icon: '📋', category: 'community', rarity: 'RARO', requirement: '10 jogos organizados', xpReward: 200 },
  { id: 'INFLUENCER', name: 'Influencer', description: 'Convide 5 novos jogadores para o App', icon: '✨', category: 'community', rarity: 'RARO', requirement: '5 novos jogadores convidados', xpReward: 200 },
  { id: 'LENDA', name: 'Lenda', description: 'Alcance o nível máximo', icon: '🏆', category: 'level', rarity: 'LENDARIO', requirement: 'Nível 20', xpReward: 1000 },
  { id: 'FAIXA_PRETA', name: 'Faixa Preta', description: 'Participe de 200 jogos', icon: '🥋', category: 'level', rarity: 'EPICO', requirement: '200 jogos', xpReward: 800 },
  { id: 'MITO', name: 'Mito', description: 'Seja eleito MVP 20 vezes', icon: '💎', category: 'level', rarity: 'LENDARIO', requirement: '20 MVPs', xpReward: 1000 },
];

/**
 * FIX #4138: badges dinâmicas (temporárias) gravadas com id parametrizado
 * pelas functions — `mito_rodada_{weekKey}` (weekly-ranking) e
 * `mvp_liga_{monthKey}` (season-cycle). Não podem viver no catálogo
 * estático; derivamos a definição do prefixo.
 */
export function getDynamicBadgeDefinition(badgeId: string): BadgeDefinition | null {
  if (badgeId.startsWith('mito_rodada_')) {
    return {
      id: badgeId,
      name: 'Mito da Rodada',
      description: 'Melhor pontuação da rodada no ranking semanal',
      icon: '👑',
      category: 'performance',
      rarity: 'EPICO',
      requirement: 'Ser o #1 da rodada',
      xpReward: 0,
    };
  }
  if (badgeId.startsWith('mvp_liga_')) {
    return {
      id: badgeId,
      name: 'MVP da Liga',
      description: 'MVP do mês na temporada da liga',
      icon: '🏆',
      category: 'performance',
      rarity: 'LENDARIO',
      requirement: 'MVP do mês',
      xpReward: 0,
    };
  }
  return null;
}

export const BADGE_RARITY_CONFIG: Record<BadgeRarity, { label: string; color: string }> = {
  COMUM: { label: 'Comum', color: rarityColors.COMUM },
  RARO: { label: 'Raro', color: rarityColors.RARO },
  EPICO: { label: 'Épico', color: rarityColors.EPICO },
  LENDARIO: { label: 'Lendário', color: rarityColors.LENDARIO },
};

export const CARD_RARITY_CONFIG: Record<CardRarity, { label: string; color: string }> = {
  COMUM: { label: 'Comum', color: rarityColors.COMUM },
  INCOMUM: { label: 'Incomum', color: rarityColors.INCOMUM }, // #2163: era #4CAF50 hardcoded
  RARO: { label: 'Raro', color: rarityColors.RARO },
  EPICO: { label: 'Épico', color: rarityColors.EPICO },
  LENDARIO: { label: 'Lendário', color: rarityColors.LENDARIO },
};

export const XP_VALUES = {
  PARTICIPATION: xpConstants.xpActions.PARTICIPATION,
  GOAL: xpConstants.xpActions.GOAL,
  ASSIST: xpConstants.xpActions.ASSIST,
  SAVE: xpConstants.xpActions.SAVE,
  CLEAN_SHEET: xpConstants.xpActions.CLEAN_SHEET,
  MVP: xpConstants.xpActions.MVP,
  WIN: xpConstants.xpActions.WIN,
  DRAW: xpConstants.xpActions.DRAW,
  STREAK_3: xpConstants.streakBonuses.STREAK_3,
  STREAK_5: xpConstants.streakBonuses.STREAK_5,
  STREAK_7: xpConstants.streakBonuses.STREAK_7,
  STREAK_10: xpConstants.streakBonuses.STREAK_10,
  WORST_PLAYER: xpConstants.xpActions.WORST_PLAYER,
  TOP_SCORER: xpConstants.performanceBonuses.TOP_SCORER,
  COMEBACK_14D: xpConstants.retentionBonuses.COMEBACK_14D,
  COMEBACK_30D: xpConstants.retentionBonuses.COMEBACK_30D,
  FIRST_GAME_OF_MONTH: xpConstants.retentionBonuses.FIRST_GAME_OF_MONTH,
  HAT_TRICK: xpConstants.performanceBonuses.HAT_TRICK,
  FIRST_GOAL: xpConstants.performanceBonuses.FIRST_GOAL,
  EVENT_RECORDER: xpConstants.performanceBonuses.EVENT_RECORDER_PER_EVENT,
  EARLY_CONFIRMATION: xpConstants.behaviorBonuses.EARLY_CONFIRMATION,
  ON_TIME_CHECKIN: xpConstants.behaviorBonuses.ON_TIME_CHECKIN,
  LAST_MINUTE_SAVER: xpConstants.behaviorBonuses.LAST_MINUTE_SAVER,
  WAITLIST_PROMOTED: xpConstants.behaviorBonuses.WAITLIST_PROMOTED,
  MONTHLY_STREAK_3: xpConstants.retentionBonuses.MONTHLY_STREAK_3,
  GOALKEEPER_GOAL: xpConstants.performanceBonuses.GOALKEEPER_GOAL,
  FAIR_PLAY: xpConstants.performanceBonuses.FAIR_PLAY,
  // Legacy aliases for backward compatibility (web-only concepts)
  BEST_GK: 25,
  BOLA_MURCHA: xpConstants.xpActions.WORST_PLAYER,
};

export function getDivisionFromRating(rating: number): LeagueDivision {
  if (rating >= 70) return 'DIAMANTE';
  if (rating >= 50) return 'OURO';
  if (rating >= 30) return 'PRATA';
  return 'BRONZE';
}

/** @deprecated A divisão usa rating 0–100, não pontos sazonais. */
export const getDivisionFromPoints = getDivisionFromRating;

// ============================================================
// LevelTable - Fonte de verdade para níveis (idêntico ao Android)
// Espelha shared/src/commonMain/.../domain/model/LevelTable.kt
// ============================================================

export interface LevelEntry {
  level: number;
  xpRequired: number; // XP ABSOLUTO necessário para alcançar este nível
  name: string;
  phrase: string;
}

// Level table imported from shared/xp-constants.json (source of truth)
export const LEVEL_TABLE: LevelEntry[] = xpConstants.levelTable.levels.map((entry) => ({
  level: entry.level,
  xpRequired: entry.xpRequired,
  name: entry.name,
  phrase: entry.phrase,
}));

/** Retorna o nível correspondente ao XP absoluto */
export function getLevelForXp(totalXp: number): number {
  let level = 0;
  for (const entry of LEVEL_TABLE) {
    if (totalXp >= entry.xpRequired) {
      level = entry.level;
    } else {
      break;
    }
  }
  return level;
}

/** Retorna a entrada da tabela de níveis para um nível específico */
export function getLevelEntry(level: number): LevelEntry {
  const clamped = Math.max(0, Math.min(level, 20));
  return LEVEL_TABLE[clamped];
}

/** Retorna o nome do nível */
export function getLevelName(level: number): string {
  return getLevelEntry(level).name;
}

/** Retorna a frase inspiradora do nível */
export function getLevelPhrase(level: number): string {
  return getLevelEntry(level).phrase;
}

/** Retorna o progresso de XP dentro do nível atual (0 a 1) */
export function getXpProgress(totalXp: number): number {
  const level = getLevelForXp(totalXp);
  if (level >= 20) return 1;
  const currentEntry = LEVEL_TABLE[level];
  const nextEntry = LEVEL_TABLE[level + 1];
  const xpInLevel = totalXp - currentEntry.xpRequired;
  const xpNeeded = nextEntry.xpRequired - currentEntry.xpRequired;
  if (xpNeeded <= 0) return 1;
  return Math.max(0, Math.min(xpInLevel / xpNeeded, 1));
}

/** Retorna o XP restante para o próximo nível */
export function getXpRemaining(totalXp: number): number {
  const level = getLevelForXp(totalXp);
  if (level >= 20) return 0;
  const nextEntry = LEVEL_TABLE[level + 1];
  return Math.max(0, nextEntry.xpRequired - totalXp);
}

/** @deprecated Use getLevelForXp/getXpProgress com XP absoluto */
export function getXPForNextLevel(level: number): number {
  if (level >= 20) return 0;
  const currentEntry = LEVEL_TABLE[Math.max(0, Math.min(level, 20))];
  const nextEntry = LEVEL_TABLE[Math.min(level + 1, 20)];
  return nextEntry.xpRequired - currentEntry.xpRequired;
}
