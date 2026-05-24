import { Game } from '../types/game';

const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;

export function getGameDateTimeMs(game: Game): number | null {
  if (game.dateTime instanceof Date) {
    return game.dateTime.getTime();
  }
  if (game.date) {
    const [year, month, day] = game.date.split('-').map(Number);
    const [hour, minute] = (game.time || '20:00').split(':').map(Number);
    if (year && month && day) {
      const brtDate = new Date(year, month - 1, day, hour || 20, minute || 0, 0);
      return brtDate.getTime() + 3 * 60 * 60 * 1000;
    }
  }
  return null;
}

export function detectGameConflicts(games: Game[]): Set<string> {
  const conflictIds = new Set<string>();
  const gamesWithTime = games
    .filter((g) => g.status !== 'CANCELLED' && g.status !== 'FINISHED')
    .map((g) => ({ game: g, timeMs: getGameDateTimeMs(g) }))
    .filter((g): g is { game: Game; timeMs: number } => g.timeMs !== null);

  for (let i = 0; i < gamesWithTime.length; i++) {
    for (let j = i + 1; j < gamesWithTime.length; j++) {
      const diff = Math.abs(gamesWithTime[i].timeMs - gamesWithTime[j].timeMs);
      if (diff < CONFLICT_WINDOW_MS) {
        conflictIds.add(gamesWithTime[i].game.id);
        conflictIds.add(gamesWithTime[j].game.id);
      }
    }
  }

  return conflictIds;
}
