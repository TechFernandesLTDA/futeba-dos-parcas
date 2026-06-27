import type { Group } from '../types/group';

export const RECONNECT_WINDOW_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReconnectSuggestion {
  groupId: string;
  groupName: string;
  memberCount: number;
  totalGamesPlayed: number;
  daysWithoutGame: number | null;
  lastScheduledAt: Date | null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDaysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS));
}

export function getReconnectSuggestions(
  groups: Group[],
  now = new Date(),
  staleAfterDays = RECONNECT_WINDOW_DAYS,
): ReconnectSuggestion[] {
  return groups
    .filter((group) => (group.totalGamesPlayed ?? 0) > 0)
    .map((group) => {
      const nextGameDate = group.nextGameDate instanceof Date && !Number.isNaN(group.nextGameDate.getTime())
        ? group.nextGameDate
        : null;
      const daysWithoutGame = nextGameDate ? getDaysSince(nextGameDate, now) : null;

      return {
        groupId: group.id,
        groupName: group.name,
        memberCount: group.memberCount ?? 0,
        totalGamesPlayed: group.totalGamesPlayed ?? 0,
        daysWithoutGame,
        lastScheduledAt: nextGameDate,
      };
    })
    .filter((suggestion) => {
      if (!suggestion.lastScheduledAt) return true;
      if (suggestion.lastScheduledAt > now) return false;
      return (suggestion.daysWithoutGame ?? 0) >= staleAfterDays;
    })
    .sort((a, b) => {
      const daysA = a.daysWithoutGame ?? Number.MAX_SAFE_INTEGER;
      const daysB = b.daysWithoutGame ?? Number.MAX_SAFE_INTEGER;
      if (daysA !== daysB) return daysB - daysA;
      return b.totalGamesPlayed - a.totalGamesPlayed;
    });
}
