import { describe, expect, it } from 'vitest';
import { getRewardActivityKind } from './GamificationCelebration.utils';

describe('getRewardActivityKind', () => {
  it('detecta subida de nivel por tipo ou referencia', () => {
    expect(getRewardActivityKind('LEVEL_UP')).toBe('level');
    expect(getRewardActivityKind('notification', 'level')).toBe('level');
  });

  it('detecta badge por tipo ou referencia', () => {
    expect(getRewardActivityKind('BADGE_UNLOCKED')).toBe('badge');
    expect(getRewardActivityKind('ACHIEVEMENT')).toBe('badge');
    expect(getRewardActivityKind('notification', 'badge')).toBe('badge');
  });

  it('detecta MVP e XP', () => {
    expect(getRewardActivityKind('MVP_WON')).toBe('mvp');
    expect(getRewardActivityKind('xp_added')).toBe('xp');
    expect(getRewardActivityKind('experience_granted')).toBe('xp');
  });

  it('ignora atividades sem recompensa', () => {
    expect(getRewardActivityKind('GAME_SCHEDULED')).toBeNull();
    expect(getRewardActivityKind('GROUP_INVITE')).toBeNull();
  });
});
