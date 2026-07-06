import type { GameStatus } from '../types/game';

export type GameSortMode = 'date' | 'spots' | 'nearest';

export interface SortableGame {
  dateTime?: Date;
  date: string;
  time?: string;
  maxPlayers: number;
  playersCount: number;
}

export function getGameStartTime(game: Pick<SortableGame, 'dateTime' | 'date' | 'time'>): number | null {
  if (game.dateTime instanceof Date && !Number.isNaN(game.dateTime.getTime())) {
    return game.dateTime.getTime();
  }

  const parsed = new Date(`${game.date}T${game.time || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function compareByStartTime(a: SortableGame, b: SortableGame, direction: 'asc' | 'desc') {
  const aStart = getGameStartTime(a) ?? Number.MAX_SAFE_INTEGER;
  const bStart = getGameStartTime(b) ?? Number.MAX_SAFE_INTEGER;
  return direction === 'asc' ? aStart - bStart : bStart - aStart;
}

export function sortGamesForDisplay<T extends SortableGame>(
  games: T[],
  sortBy: GameSortMode,
  statusFilter: 'all' | GameStatus,
): T[] {
  const sorted = [...games];

  if (sortBy === 'spots') {
    return sorted.sort((a, b) => (b.maxPlayers - b.playersCount) - (a.maxPlayers - a.playersCount));
  }

  const direction = statusFilter === 'FINISHED' ? 'desc' : 'asc';
  return sorted.sort((a, b) => compareByStartTime(a, b, direction));
}
