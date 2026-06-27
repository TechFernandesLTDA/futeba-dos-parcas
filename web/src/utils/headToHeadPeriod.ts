export type HeadToHeadPeriod = 'all' | '30d' | '90d' | '365d';

const PERIOD_DAYS: Record<Exclude<HeadToHeadPeriod, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

export interface HeadToHeadPeriodGame {
  date: string;
  dateTime?: { toDate?: () => Date };
}

function parseGameDate(game: HeadToHeadPeriodGame): Date | null {
  const timestampDate = game.dateTime?.toDate?.();
  if (timestampDate && !Number.isNaN(timestampDate.getTime())) {
    return timestampDate;
  }

  if (!game.date) return null;
  const parsedDate = new Date(game.date);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function isGameWithinHeadToHeadPeriod(
  game: HeadToHeadPeriodGame,
  period: HeadToHeadPeriod,
  now: Date = new Date()
): boolean {
  if (period === 'all') return true;

  const gameDate = parseGameDate(game);
  if (!gameDate) return false;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
  cutoff.setHours(0, 0, 0, 0);
  return gameDate >= cutoff && gameDate <= now;
}
