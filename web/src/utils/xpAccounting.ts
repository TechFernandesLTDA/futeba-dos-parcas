import { getLevelForXp } from '../types/gamification';

type XpLike = Record<string, unknown>;

function pickFiniteNumber(data: XpLike, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function getExperiencePoints(data: XpLike, fallback = 0): number {
  return pickFiniteNumber(data, [
    'experience_points',
    'experiencePoints',
    'xp',
    'total_xp',
    'totalXp',
  ]) ?? fallback;
}

export function getXpEarned(data: XpLike, fallback = 0): number {
  return pickFiniteNumber(data, [
    'xpEarned',
    'xp_earned',
    'xpGained',
    'xp_gained',
    'amount',
  ]) ?? fallback;
}

export function getEffectiveLevel(data: XpLike, xp = getExperiencePoints(data)): number {
  return getLevelForXp(xp);
}

export function getLogLevelAfter(data: XpLike, xpAfter?: number): number {
  const loggedLevel = pickFiniteNumber(data, [
    'levelAfter',
    'level_after',
    'newLevel',
    'new_level',
  ]);
  const loggedXpAfter = pickFiniteNumber(data, [
    'xpAfter',
    'xp_after',
  ]);
  return loggedLevel ?? getLevelForXp(loggedXpAfter ?? xpAfter ?? getExperiencePoints(data));
}
