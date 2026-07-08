import { describe, expect, it } from 'vitest';
import {
  getEffectiveLevel,
  getExperiencePoints,
  getLogLevelAfter,
  getXpEarned,
} from './xpAccounting';

describe('xpAccounting', () => {
  it('preserva nível zero e XP absoluto de usuários novos', () => {
    expect(getExperiencePoints({ experience_points: 0 })).toBe(0);
    expect(getEffectiveLevel({ level: 0, experience_points: 0 })).toBe(0);
    expect(getEffectiveLevel({ experience_points: 0 })).toBe(0);
  });

  it('lê logs atuais de produção com aliases snake/camel', () => {
    expect(getXpEarned({ xp_earned: 50 })).toBe(50);
    expect(getXpEarned({ xpEarned: 30 })).toBe(30);
    expect(getLogLevelAfter({ level_after: 3, xp_after: 850 })).toBe(3);
    expect(getLogLevelAfter({ xp_after: 350 })).toBe(2);
  });

  it('mantém compatibilidade com campos legados de histórico', () => {
    expect(getXpEarned({ xpGained: 15 })).toBe(15);
    expect(getLogLevelAfter({ newLevel: 4 })).toBe(4);
  });
});
