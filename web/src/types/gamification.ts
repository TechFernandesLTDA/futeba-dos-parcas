// Source of truth: shared/xp-constants.json — keep in sync
import xpConstants from '../../../shared/xp-constants.json';
import { gamificationColors, rarityColors } from '../theme';

export type LeagueDivision = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'CHAMPION';

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
export const DIVISION_CONFIG: Record<LeagueDivision, { label: string; color: string; minPoints: number }> = {
  BRONZE: { label: 'Bronze', color: gamificationColors.bronze, minPoints: 0 },
  SILVER: { label: 'Prata', color: gamificationColors.silver, minPoints: 100 },
  GOLD: { label: 'Ouro', color: gamificationColors.gold, minPoints: 300 },
  PLATINUM: { label: 'Platina', color: gamificationColors.platinum, minPoints: 600 },
  DIAMOND: { label: 'Diamante', color: gamificationColors.level, minPoints: 1000 },
  CHAMPION: { label: 'Campeão', color: gamificationColors.champion, minPoints: 2000 },
};

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: BadgeRarity;
  requirement: string;
  xpReward: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first_game', name: 'Primeira Pelada', description: 'Participe do seu primeiro jogo', icon: '⚽', category: 'participation', rarity: 'COMUM', requirement: 'Participar de 1 jogo', xpReward: 50 },
  { id: 'streak_3', name: 'Sequência Iniciante', description: 'Jogue 3 partidas seguidas', icon: '🔥', category: 'streak', rarity: 'COMUM', requirement: 'Sequência de 3 jogos', xpReward: 30 },
  { id: 'streak_7', name: 'Semana Perfeita', description: 'Jogue 7 partidas seguidas', icon: '💪', category: 'streak', rarity: 'RARO', requirement: 'Sequência de 7 jogos', xpReward: 100 },
  { id: 'streak_30', name: 'Mês Imbatível', description: 'Jogue 30 partidas seguidas', icon: '🏆', category: 'streak', rarity: 'LENDARIO', requirement: 'Sequência de 30 jogos', xpReward: 500 },
  { id: 'mvp_1', name: 'Estreante MVP', description: 'Seja eleito MVP pela primeira vez', icon: '⭐', category: 'mvp', rarity: 'COMUM', requirement: '1 MVP', xpReward: 100 },
  { id: 'mvp_10', name: 'Estrela em Ascensão', description: 'Seja eleito MVP 10 vezes', icon: '🌟', category: 'mvp', rarity: 'RARO', requirement: '10 MVPs', xpReward: 300 },
  { id: 'mvp_50', name: 'Lenda do MVP', description: 'Seja eleito MVP 50 vezes', icon: '👑', category: 'mvp', rarity: 'LENDARIO', requirement: '50 MVPs', xpReward: 1000 },
  { id: 'goals_10', name: 'Goleador', description: 'Marque 10 gols', icon: '🥅', category: 'goals', rarity: 'COMUM', requirement: '10 gols', xpReward: 50 },
  { id: 'goals_100', name: 'Artilheiro', description: 'Marque 100 gols', icon: '⚽', category: 'goals', rarity: 'RARO', requirement: '100 gols', xpReward: 200 },
  { id: 'goals_500', name: 'Máquina de Gols', description: 'Marque 500 gols', icon: '🎯', category: 'goals', rarity: 'LENDARIO', requirement: '500 gols', xpReward: 1000 },
  { id: 'assists_50', name: 'Garçom', description: 'Dê 50 assistências', icon: '👟', category: 'assists', rarity: 'COMUM', requirement: '50 assists', xpReward: 50 },
  { id: 'assists_200', name: 'Mestre das Assistências', description: 'Dê 200 assistências', icon: '🎭', category: 'assists', rarity: 'RARO', requirement: '200 assists', xpReward: 300 },
  { id: 'wins_10', name: 'Vencedor', description: 'Vença 10 jogos', icon: '🏅', category: 'wins', rarity: 'COMUM', requirement: '10 vitórias', xpReward: 100 },
  { id: 'wins_50', name: 'Campeão', description: 'Vença 50 jogos', icon: '🏆', category: 'wins', rarity: 'RARO', requirement: '50 vitórias', xpReward: 400 },
  { id: 'games_100', name: 'Veterano', description: 'Participe de 100 jogos', icon: '🎖️', category: 'participation', rarity: 'EPICO', requirement: '100 jogos', xpReward: 500 },
  { id: 'games_500', name: 'Lenda Viva', description: 'Participe de 500 jogos', icon: '🏟️', category: 'participation', rarity: 'LENDARIO', requirement: '500 jogos', xpReward: 2000 },
  { id: 'HAT_TRICK', name: 'Hat-Trick', description: 'Marque 3+ gols em uma única partida', icon: '⚽', category: 'performance', rarity: 'RARO', requirement: '3+ gols em uma partida', xpReward: 150 },
  { id: 'PAREDAO', name: 'Paredão', description: 'Termine uma partida sem sofrer gols como goleiro', icon: '🧤', category: 'performance', rarity: 'RARO', requirement: 'Clean sheet como goleiro', xpReward: 150 },
  { id: 'ARTILHEIRO_MES', name: 'Artilheiro do Mês', description: 'Seja o maior goleador do mês', icon: '👑', category: 'performance', rarity: 'EPICO', requirement: 'Mais gols no mês', xpReward: 300 },
  { id: 'FOMINHA', name: 'Fominha', description: 'Jogue 3 partidas na mesma semana', icon: '🔥', category: 'presence', rarity: 'COMUM', requirement: '3 jogos na mesma semana', xpReward: 50 },
  { id: 'ORGANIZADOR_MASTER', name: 'Organizador Master', description: 'Organize 10 jogos', icon: '📋', category: 'community', rarity: 'RARO', requirement: '10 jogos organizados', xpReward: 200 },
  { id: 'INFLUENCER', name: 'Influencer', description: 'Convide 5 novos jogadores para o App', icon: '✨', category: 'community', rarity: 'RARO', requirement: '5 novos jogadores convidados', xpReward: 200 },
  { id: 'LENDA', name: 'Lenda', description: 'Alcance o nível máximo', icon: '🏆', category: 'level', rarity: 'LENDARIO', requirement: 'Nível 20', xpReward: 1000 },
  { id: 'FAIXA_PRETA', name: 'Faixa Preta', description: 'Participe de 200 jogos', icon: '🥋', category: 'level', rarity: 'EPICO', requirement: '200 jogos', xpReward: 800 },
  { id: 'MITO', name: 'Mito', description: 'Seja eleito MVP 20 vezes', icon: '💎', category: 'level', rarity: 'LENDARIO', requirement: '20 MVPs', xpReward: 1000 },
];

export const BADGE_RARITY_CONFIG: Record<BadgeRarity, { label: string; color: string }> = {
  COMUM: { label: 'Comum', color: rarityColors.COMUM },
  RARO: { label: 'Raro', color: rarityColors.RARO },
  EPICO: { label: 'Épico', color: rarityColors.EPICO },
  LENDARIO: { label: 'Lendário', color: rarityColors.LENDARIO },
};

export const CARD_RARITY_CONFIG: Record<CardRarity, { label: string; color: string }> = {
  COMUM: { label: 'Comum', color: rarityColors.COMUM },
  INCOMUM: { label: 'Incomum', color: '#4CAF50' },
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
  // Legacy aliases for backward compatibility (web-only concepts)
  BEST_GK: 25,
  BOLA_MURCHA: xpConstants.xpActions.WORST_PLAYER,
};

export function getDivisionFromPoints(points: number): LeagueDivision {
  if (points >= 2000) return 'CHAMPION';
  if (points >= 1000) return 'DIAMOND';
  if (points >= 600) return 'PLATINUM';
  if (points >= 300) return 'GOLD';
  if (points >= 100) return 'SILVER';
  return 'BRONZE';
}

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
