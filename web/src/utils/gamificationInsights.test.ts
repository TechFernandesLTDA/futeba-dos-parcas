import { describe, expect, it } from 'vitest';
import {
  getGamificationActionLabel,
  getNearBadgeInsights,
  getNearLevelInsight,
  summarizeXpLogBreakdown,
} from './gamificationInsights';

const t = (key: string) => key;

describe('gamificationInsights', () => {
  it('resume breakdown de xp_logs com labels estáveis', () => {
    expect(summarizeXpLogBreakdown({
      xpGoals: 25,
      xpTopScorer: 15,
      xpFairPlay: 5,
    }, t)).toEqual([
      '+25 gamification.actions.GOAL',
      '+15 gamification.actions.TOP_SCORER',
      '+5 gamification.actions.FAIR_PLAY',
    ]);
  });

  it('detecta quase nível abaixo de 100 XP', () => {
    expect(getNearLevelInsight(52_780)).toMatchObject({
      remainingXp: 70,
      level: 10,
      levelName: 'Imortal',
    });
    expect(getNearLevelInsight(52_650)).toBeNull();
  });

  it('detecta conquistas de milestone perto do desbloqueio', () => {
    const insights = getNearBadgeInsights({
      totalGoals: 8,
      totalAssists: 49,
      totalWins: 7,
      totalSaves: 9,
    }, new Set<string>());

    expect(insights.map((entry) => entry.badge.id)).toEqual(['assists_50', 'saves_10']);
    expect(insights[0]).toMatchObject({ remaining: 1, threshold: 50 });
  });

  it('rotula milestones genéricos sem confundir com primeira partida do mês', () => {
    expect(summarizeXpLogBreakdown({ xpMilestones: 50 }, t)).toEqual([
      '+50 gamification.actions.MILESTONE',
    ]);
  });

  it('normaliza label desconhecida por fallback legível', () => {
    expect(getGamificationActionLabel('custom_action', t)).toBe('CUSTOM ACTION');
  });
});
