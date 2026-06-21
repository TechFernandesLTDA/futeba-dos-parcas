import type { Game, GameStatus, GameVisibility } from '../types/game';

export const UPCOMING_GAME_STATUSES: readonly GameStatus[] = ['SCHEDULED', 'CONFIRMED', 'LIVE'];
export const SCHEDULING_BLOCKING_STATUSES: readonly GameStatus[] = ['SCHEDULED', 'CONFIRMED', 'LIVE'];

export function isSchedulingBlockingStatus(status: unknown): boolean {
  return SCHEDULING_BLOCKING_STATUSES.includes(status as GameStatus);
}

export function getIsPublicFromVisibility(visibility: GameVisibility | string | undefined): boolean {
  return visibility === 'PUBLIC_OPEN' || visibility === 'PUBLIC_CLOSED';
}

export function getGameStartDate(game: Pick<Game, 'dateTime' | 'date' | 'time'>): Date | null {
  if (game.dateTime instanceof Date) return game.dateTime;
  if (!game.date || !game.time) return null;
  const date = new Date(`${game.date}T${game.time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isFutureGame(game: Pick<Game, 'dateTime' | 'date' | 'time'>, now = new Date()): boolean {
  const startsAt = getGameStartDate(game);
  return startsAt ? startsAt.getTime() >= now.getTime() : false;
}

export function isUpcomingGame(
  game: Pick<Game, 'status' | 'dateTime' | 'date' | 'time'>,
  now = new Date(),
): boolean {
  return UPCOMING_GAME_STATUSES.includes(game.status) && isFutureGame(game, now);
}
