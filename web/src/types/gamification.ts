export type LeagueDivision = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'CHAMPION';

export type BadgeType = 
  | 'HAT_TRICK' 
  | 'PAREDAO' 
  | 'ARTILHEIRO_MES'
  | 'FOMINHA' 
  | 'STREAK_7' 
  | 'STREAK_30'
  | 'ORGANIZADOR_MASTER' 
  | 'INFLUENCER'
  | 'LENDA' 
  | 'FAIXA_PRETA' 
  | 'MITO';

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

export const DIVISION_CONFIG: Record<LeagueDivision, { label: string; color: string; minPoints: number }> = {
  BRONZE: { label: 'Bronze', color: '#5D4037', minPoints: 0 },
  SILVER: { label: 'Prata', color: '#757575', minPoints: 100 },
  GOLD: { label: 'Ouro', color: '#FFD700', minPoints: 300 },
  PLATINUM: { label: 'Platina', color: '#00E676', minPoints: 600 },
  DIAMOND: { label: 'Diamante', color: '#00BCD4', minPoints: 1000 },
  CHAMPION: { label: 'Campeão', color: '#E91E63', minPoints: 2000 },
};

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  requirement: string;
  xpReward: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first_game', name: 'Primeira Pelada', description: 'Participe do seu primeiro jogo', icon: '⚽', category: 'participation', rarity: 'COMMON', requirement: 'Participar de 1 jogo', xpReward: 50 },
  { id: 'streak_3', name: 'Sequência Iniciante', description: 'Jogue 3 partidas seguidas', icon: '🔥', category: 'streak', rarity: 'COMMON', requirement: 'Sequência de 3 jogos', xpReward: 30 },
  { id: 'streak_7', name: 'Semana Perfeita', description: 'Jogue 7 partidas seguidas', icon: '💪', category: 'streak', rarity: 'RARE', requirement: 'Sequência de 7 jogos', xpReward: 100 },
  { id: 'streak_30', name: 'Mês Imbatível', description: 'Jogue 30 partidas seguidas', icon: '🏆', category: 'streak', rarity: 'LEGENDARY', requirement: 'Sequência de 30 jogos', xpReward: 500 },
  { id: 'mvp_1', name: 'Estreante MVP', description: 'Seja eleito MVP pela primeira vez', icon: '⭐', category: 'mvp', rarity: 'COMMON', requirement: '1 MVP', xpReward: 100 },
  { id: 'mvp_10', name: 'Estrela em Ascensão', description: 'Seja eleito MVP 10 vezes', icon: '🌟', category: 'mvp', rarity: 'RARE', requirement: '10 MVPs', xpReward: 300 },
  { id: 'mvp_50', name: 'Lenda do MVP', description: 'Seja eleito MVP 50 vezes', icon: '👑', category: 'mvp', rarity: 'LEGENDARY', requirement: '50 MVPs', xpReward: 1000 },
  { id: 'goals_10', name: 'Goleador', description: 'Marque 10 gols', icon: '🥅', category: 'goals', rarity: 'COMMON', requirement: '10 gols', xpReward: 50 },
  { id: 'goals_100', name: 'Artilheiro', description: 'Marque 100 gols', icon: '⚽', category: 'goals', rarity: 'RARE', requirement: '100 gols', xpReward: 200 },
  { id: 'goals_500', name: 'Máquina de Gols', description: 'Marque 500 gols', icon: '🎯', category: 'goals', rarity: 'LEGENDARY', requirement: '500 gols', xpReward: 1000 },
  { id: 'assists_50', name: 'Garçom', description: 'Dê 50 assistências', icon: '👟', category: 'assists', rarity: 'COMMON', requirement: '50 assists', xpReward: 50 },
  { id: 'assists_200', name: 'Mestre das Assistências', description: 'Dê 200 assistências', icon: '🎭', category: 'assists', rarity: 'RARE', requirement: '200 assists', xpReward: 300 },
  { id: 'wins_10', name: 'Vencedor', description: 'Vença 10 jogos', icon: '🏅', category: 'wins', rarity: 'COMMON', requirement: '10 vitórias', xpReward: 100 },
  { id: 'wins_50', name: 'Campeão', description: 'Vença 50 jogos', icon: '🏆', category: 'wins', rarity: 'RARE', requirement: '50 vitórias', xpReward: 400 },
  { id: 'games_100', name: 'Veterano', description: 'Participe de 100 jogos', icon: '🎖️', category: 'participation', rarity: 'EPIC', requirement: '100 jogos', xpReward: 500 },
  { id: 'games_500', name: 'Lenda Viva', description: 'Participe de 500 jogos', icon: '🏟️', category: 'participation', rarity: 'LEGENDARY', requirement: '500 jogos', xpReward: 2000 },
];

export const BADGE_RARITY_CONFIG: Record<BadgeRarity, { label: string; color: string }> = {
  COMUM: { label: 'Comum', color: '#9E9E9E' },
  RARO: { label: 'Raro', color: '#2196F3' },
  EPICO: { label: 'Épico', color: '#9C27B0' },
  LENDARIO: { label: 'Lendário', color: '#FFD700' },
};

export const CARD_RARITY_CONFIG: Record<CardRarity, { label: string; color: string }> = {
  COMUM: { label: 'Comum', color: '#8E8E8E' },
  INCOMUM: { label: 'Incomum', color: '#4CAF50' },
  RARO: { label: 'Raro', color: '#2196F3' },
  EPICO: { label: 'Épico', color: '#9C27B0' },
  LENDARIO: { label: 'Lendário', color: '#FFD700' },
};

export const XP_VALUES = {
  PARTICIPATION: 10,
  GOAL: 5,
  ASSIST: 3,
  SAVE: 2,
  MVP: 50,
  WIN: 20,
  STREAK_3: 10,
  STREAK_7: 20,
  STREAK_10: 30,
  BEST_GK: 25,
  BOLA_MURCHA: -20,
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

export const LEVEL_TABLE: LevelEntry[] = [
  // Fase 1: Níveis 0-10 (Progressão Base)
  { level: 0,  xpRequired: 0,      name: 'Novato',       phrase: 'Todo craque começou assim. Bora jogar!' },
  { level: 1,  xpRequired: 100,    name: 'Iniciante',    phrase: 'Primeiros passos na pelada. Continue assim!' },
  { level: 2,  xpRequired: 350,    name: 'Amador',       phrase: 'Já mostra garra em campo!' },
  { level: 3,  xpRequired: 850,    name: 'Regular',      phrase: 'Presença garantida na pelada!' },
  { level: 4,  xpRequired: 1850,   name: 'Experiente',   phrase: 'Conhece cada canto do campo!' },
  { level: 5,  xpRequired: 3850,   name: 'Habilidoso',   phrase: 'Dribles e passes que encantam!' },
  { level: 6,  xpRequired: 7350,   name: 'Profissional', phrase: 'Joga como se fosse pago pra isso!' },
  { level: 7,  xpRequired: 12850,  name: 'Expert',       phrase: 'Domina todos os fundamentos!' },
  { level: 8,  xpRequired: 20850,  name: 'Mestre',       phrase: 'Nível de academia de futebol!' },
  { level: 9,  xpRequired: 32850,  name: 'Lenda',        phrase: 'Seu nome é lembrado nas peladas!' },
  { level: 10, xpRequired: 52850,  name: 'Imortal',      phrase: 'Transcendeu o futebol amador!' },

  // Fase 2: Níveis 11-20 (Lendas do Futebol)
  { level: 11, xpRequired: 75000,  name: 'Garrincha',        phrase: 'Alegria do Povo! Dribla até o vento!' },
  { level: 12, xpRequired: 100000, name: 'Zico',             phrase: 'O Galinho de Quintino! Craque nato!' },
  { level: 13, xpRequired: 128000, name: 'Cruyff',           phrase: 'Futebol Total! Visão de jogo única!' },
  { level: 14, xpRequired: 160000, name: 'Beckham',          phrase: 'Precisão cirúrgica nos passes!' },
  { level: 15, xpRequired: 198000, name: 'Ronaldinho',       phrase: 'Joga bonito! O sorriso do futebol!' },
  { level: 16, xpRequired: 242000, name: 'Ronaldo Fenômeno', phrase: 'Fenômeno! Velocidade e gols!' },
  { level: 17, xpRequired: 295000, name: 'Messi',            phrase: 'La Pulga! Gênio da bola!' },
  { level: 18, xpRequired: 360000, name: 'Cristiano Ronaldo', phrase: 'CR7! Determinação e excelência!' },
  { level: 19, xpRequired: 440000, name: 'Diego Maradona',   phrase: 'La Mano de Dios! Pura magia!' },
  { level: 20, xpRequired: 528500, name: 'Pelé',             phrase: 'O Rei do Futebol! Nível máximo!' },
];

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
