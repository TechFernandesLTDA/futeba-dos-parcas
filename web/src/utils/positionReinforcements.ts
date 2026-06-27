import { getEffectiveRating, type PreferredPosition, type User } from '../types/user';
import { isLookingForGameToday } from './lookingForGameToday';

export type ReinforcementNeed = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'STRIKER' | 'ANY_FIELD';

export interface ReinforcementCandidate {
  user: User;
  need: ReinforcementNeed;
  isPreferredPositionMatch: boolean;
  isLookingToday: boolean;
  hasRecentPresence: boolean;
  rating: number;
  score: number;
}

export interface ReinforcementCandidateOptions {
  recentPresenceOnly?: boolean;
  now?: Date;
}

const NEED_TO_POSITIONS: Record<ReinforcementNeed, PreferredPosition[]> = {
  GOALKEEPER: ['GOLEIRO'],
  DEFENDER: ['ZAGUEIRO', 'LATERAL', 'VOLANTE'],
  MIDFIELDER: ['VOLANTE', 'MEIA'],
  STRIKER: ['ATACANTE'],
  ANY_FIELD: ['ZAGUEIRO', 'LATERAL', 'VOLANTE', 'MEIA', 'ATACANTE'],
};

const NEED_TO_RATING_ROLE: Record<ReinforcementNeed, Parameters<typeof getEffectiveRating>[1]> = {
  GOALKEEPER: 'GOALKEEPER',
  DEFENDER: 'DEFENDER',
  MIDFIELDER: 'MID',
  STRIKER: 'STRIKER',
  ANY_FIELD: 'MID',
};

const RECENT_PRESENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function getConfirmationPositionForNeed(need: ReinforcementNeed): 'GOALKEEPER' | 'FIELD' {
  return need === 'GOALKEEPER' ? 'GOALKEEPER' : 'FIELD';
}

export function getPreferredPositionsForNeed(need: ReinforcementNeed): PreferredPosition[] {
  return NEED_TO_POSITIONS[need];
}

export function hasRecentPresence(user: User, now = new Date()): boolean {
  if (!user.lastGameDate) return false;
  const lastGameAt = user.lastGameDate.getTime();
  if (Number.isNaN(lastGameAt)) return false;
  const ageMs = now.getTime() - lastGameAt;
  return ageMs >= 0 && ageMs <= RECENT_PRESENCE_WINDOW_MS;
}

export function buildReinforcementCandidates(
  users: User[],
  need: ReinforcementNeed,
  excludedUserIds: Set<string>,
  options: ReinforcementCandidateOptions = {},
): ReinforcementCandidate[] {
  const now = options.now ?? new Date();
  return users
    .filter((candidate) => candidate.id && candidate.isSearchable && !excludedUserIds.has(candidate.id))
    .map((candidate) => {
      const isPreferredPositionMatch = candidate.preferredPosition
        ? NEED_TO_POSITIONS[need].includes(candidate.preferredPosition)
        : false;
      const isLookingToday = isLookingForGameToday(candidate);
      const recentPresence = hasRecentPresence(candidate, now);
      const rating = getEffectiveRating(candidate, NEED_TO_RATING_ROLE[need]);
      const score = (isLookingToday ? 100 : 0) + (recentPresence ? 25 : 0) + (isPreferredPositionMatch ? 40 : 0) + rating;

      return {
        user: candidate,
        need,
        isPreferredPositionMatch,
        isLookingToday,
        hasRecentPresence: recentPresence,
        rating,
        score,
      };
    })
    .filter((candidate) => !options.recentPresenceOnly || candidate.hasRecentPresence)
    .filter((candidate) => candidate.isPreferredPositionMatch || candidate.rating >= 2.5 || candidate.isLookingToday)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.user.level !== a.user.level) return b.user.level - a.user.level;
      return a.user.name.localeCompare(b.user.name);
    });
}
