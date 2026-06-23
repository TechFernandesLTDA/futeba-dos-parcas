export type RewardActivityKind = 'xp' | 'level' | 'badge' | 'mvp';

export function getRewardActivityKind(type: string, referenceType?: string): RewardActivityKind | null {
  const normalizedType = type.toUpperCase();
  const normalizedReference = referenceType?.toLowerCase();

  if (normalizedType === 'LEVEL_UP' || normalizedReference === 'level') {
    return 'level';
  }

  if (normalizedType === 'BADGE_UNLOCKED' || normalizedType === 'ACHIEVEMENT' || normalizedReference === 'badge') {
    return 'badge';
  }

  if (normalizedType.includes('MVP')) {
    return 'mvp';
  }

  if (normalizedType.includes('XP') || normalizedType.includes('EXPERIENCE')) {
    return 'xp';
  }

  return null;
}
