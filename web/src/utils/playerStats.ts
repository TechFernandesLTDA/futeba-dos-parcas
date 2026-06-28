import { snakeToCamel } from './firestoreHelpers';
import { UserStats } from '../types/user';

type RawDoc = Record<string, unknown> | null | undefined;

const STAT_ALIASES = {
  totalGames: ['totalGames', 'gamesPlayed'],
  totalGoals: ['totalGoals', 'goals'],
  totalAssists: ['totalAssists', 'assists'],
  totalSaves: ['totalSaves', 'saves'],
  totalWins: ['totalWins', 'gamesWon', 'wins'],
  totalDraws: ['totalDraws', 'gamesDraw', 'draws'],
  totalLosses: ['totalLosses', 'gamesLost', 'losses'],
  mvpCount: ['mvpCount', 'bestPlayerCount'],
  bestGkCount: ['bestGkCount', 'bestGoalkeeperCount'],
  yellowCards: ['yellowCards', 'totalYellowCards'],
  redCards: ['redCards', 'totalRedCards'],
  currentStreak: ['currentStreak'],
  bestStreak: ['bestStreak', 'longestStreak'],
} as const;

function asRecord(doc: RawDoc): Record<string, unknown> {
  return doc ? snakeToCamel(doc) : {};
}

function pickNumber(
  primary: Record<string, unknown>,
  fallback: Record<string, unknown>,
  aliases: readonly string[],
): number {
  for (const source of [primary, fallback]) {
    for (const key of aliases) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return 0;
}

export function normalizePlayerStats(
  primaryRaw?: RawDoc,
  fallbackRaw?: RawDoc,
  userId = '',
): UserStats {
  const primary = asRecord(primaryRaw);
  const fallback = asRecord(fallbackRaw);

  const totalGames = pickNumber(primary, fallback, STAT_ALIASES.totalGames);
  const totalGoals = pickNumber(primary, fallback, STAT_ALIASES.totalGoals);
  const totalAssists = pickNumber(primary, fallback, STAT_ALIASES.totalAssists);
  const totalWins = pickNumber(primary, fallback, STAT_ALIASES.totalWins);

  return {
    userId,
    totalGames,
    totalGoals,
    totalAssists,
    totalWins,
    totalDraws: pickNumber(primary, fallback, STAT_ALIASES.totalDraws),
    totalLosses: pickNumber(primary, fallback, STAT_ALIASES.totalLosses),
    totalSaves: pickNumber(primary, fallback, STAT_ALIASES.totalSaves),
    mvpCount: pickNumber(primary, fallback, STAT_ALIASES.mvpCount),
    bestGkCount: pickNumber(primary, fallback, STAT_ALIASES.bestGkCount),
    currentStreak: pickNumber(primary, fallback, STAT_ALIASES.currentStreak),
    bestStreak: pickNumber(primary, fallback, STAT_ALIASES.bestStreak),
    yellowCards: pickNumber(primary, fallback, STAT_ALIASES.yellowCards),
    redCards: pickNumber(primary, fallback, STAT_ALIASES.redCards),
    avgGoalsPerGame: totalGames > 0 ? totalGoals / totalGames : 0,
    avgAssistsPerGame: totalGames > 0 ? totalAssists / totalGames : 0,
    winRate: totalGames > 0 ? totalWins / totalGames : 0,
    level: pickNumber(primary, fallback, ['level']),
    experiencePoints: pickNumber(primary, fallback, ['experiencePoints', 'xp']),
  };
}
