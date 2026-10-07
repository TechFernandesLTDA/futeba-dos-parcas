import { describe, expect, it } from 'vitest';
import { GAME_VALIDATION } from './validationConstants';

describe('validationConstants', () => {
  it('define os limites de jogadores', () => {
    expect(GAME_VALIDATION.MIN_PLAYERS).toBe(2);
    expect(GAME_VALIDATION.MAX_PLAYERS).toBe(50);
  });

  it('define os limites de goleiros', () => {
    expect(GAME_VALIDATION.MIN_GOALKEEPERS).toBe(0);
    expect(GAME_VALIDATION.MAX_GOALKEEPERS).toBe(4);
  });

  it('define os limites de times', () => {
    expect(GAME_VALIDATION.MIN_TEAMS).toBe(2);
    expect(GAME_VALIDATION.MAX_TEAMS).toBe(4);
  });

  it('define os limites de preço', () => {
    expect(GAME_VALIDATION.MIN_PRICE).toBe(0);
    expect(GAME_VALIDATION.MAX_PRICE).toBe(500);
  });

  it('todo par MIN/MAX é coerente (min <= max)', () => {
    const pairs: [number, number][] = [
      [GAME_VALIDATION.MIN_PLAYERS, GAME_VALIDATION.MAX_PLAYERS],
      [GAME_VALIDATION.MIN_GOALKEEPERS, GAME_VALIDATION.MAX_GOALKEEPERS],
      [GAME_VALIDATION.MIN_TEAMS, GAME_VALIDATION.MAX_TEAMS],
      [GAME_VALIDATION.MIN_PRICE, GAME_VALIDATION.MAX_PRICE],
    ];
    for (const [min, max] of pairs) {
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it('expõe exatamente os 8 limites esperados', () => {
    expect(Object.keys(GAME_VALIDATION).sort()).toEqual([
      'MAX_GOALKEEPERS',
      'MAX_PLAYERS',
      'MAX_PRICE',
      'MAX_TEAMS',
      'MIN_GOALKEEPERS',
      'MIN_PLAYERS',
      'MIN_PRICE',
      'MIN_TEAMS',
    ]);
  });

  it('todos os valores são números finitos não negativos', () => {
    for (const value of Object.values(GAME_VALIDATION)) {
      expect(typeof value).toBe('number');
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});
