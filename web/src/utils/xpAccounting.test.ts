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

  it('prioriza experience_points canônico sobre experiencePoints legado', () => {
    expect(getExperiencePoints({
      experiencePoints: 350,
      experience_points: 850,
    })).toBe(850);
  });

  it('deriva o nível do XP mesmo quando o nível persistido está obsoleto', () => {
    expect(getEffectiveLevel({
      level: 2,
      experience_points: 850,
    })).toBe(3);
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

  it('cobre todos os aliases de XP total (xp, total_xp, totalXp)', () => {
    expect(getExperiencePoints({ xp: 42 })).toBe(42);
    expect(getExperiencePoints({ total_xp: 43 })).toBe(43);
    expect(getExperiencePoints({ totalXp: 44 })).toBe(44);
  });

  it('cobre todos os aliases de XP ganho (xp_gained, amount)', () => {
    expect(getXpEarned({ xp_gained: 11 })).toBe(11);
    expect(getXpEarned({ amount: 12 })).toBe(12);
  });

  it('cobre todos os aliases de nível logado (levelAfter, new_level)', () => {
    expect(getLogLevelAfter({ levelAfter: 6 })).toBe(6);
    expect(getLogLevelAfter({ new_level: 7 })).toBe(7);
  });

  it('deriva o nível a partir de xpAfter/xp_after (sem nível logado)', () => {
    const expected = getEffectiveLevel({ experience_points: 850 });
    expect(getLogLevelAfter({ xpAfter: 850 })).toBe(expected);
    expect(getLogLevelAfter({ xp_after: 850 })).toBe(expected);
  });

  it('aplica o fallback quando o campo está ausente', () => {
    expect(getExperiencePoints({}, 7)).toBe(7);
    expect(getXpEarned({}, 5)).toBe(5);
  });

  it('converte strings numéricas e ignora strings vazias', () => {
    expect(getExperiencePoints({ xp: '55' })).toBe(55);
    expect(getXpEarned({ amount: '20' })).toBe(20);
    expect(getExperiencePoints({ xp: '', total_xp: 8 })).toBe(8);
  });

  it('rejeita valores não-finitos e cai para o próximo alias', () => {
    expect(getExperiencePoints({ xp: NaN, totalXp: 9 })).toBe(9);
    expect(getExperiencePoints({ experience_points: Infinity, xp: 3 })).toBe(3);
  });
});
