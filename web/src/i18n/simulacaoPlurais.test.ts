import { describe, expect, it } from 'vitest';
import i18n from 'i18next';

// Textos com número achados na simulação de uso (#4629): "1 jogos" e "assists".
describe('plurais das telas de estatística', () => {
  const t = i18n.getFixedT('pt-BR');

  it('sequência no singular e no plural', () => {
    expect(t('statistics.streakGames', { count: 1 })).toBe('1 jogo');
    expect(t('statistics.streakGames', { count: 4 })).toBe('4 jogos');
    expect(t('statistics.streakGames', { count: 0 })).toBe('0 jogos');
  });

  it('gols e assistências do resumo da semana em português', () => {
    expect(t('weeklyRecap.goalsCount', { count: 1 })).toBe('1 gol');
    expect(t('weeklyRecap.goalsCount', { count: 2 })).toBe('2 gols');
    expect(t('weeklyRecap.goalsCount', { count: 0 })).toBe('0 gols');
    expect(t('weeklyRecap.assistsCount', { count: 1 })).toBe('1 assistência');
    expect(t('weeklyRecap.assistsCount', { count: 0 })).toBe('0 assistências');
  });
});
