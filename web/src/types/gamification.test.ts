import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import xpConstants from '../../../shared/xp-constants.json';
import {
  DIVISION_CONFIG,
  LEAGUE_DIVISIONS,
  XP_VALUES,
  getDivisionFromRating,
  getDivisionLabel,
  normalizeLeagueDivision,
} from './gamification';

describe('league division contract', () => {
  it('matches the four canonical values produced by Functions and KMP', () => {
    expect(LEAGUE_DIVISIONS).toEqual(['BRONZE', 'PRATA', 'OURO', 'DIAMANTE']);
    expect(Object.keys(DIVISION_CONFIG)).toEqual(LEAGUE_DIVISIONS);

    const repoRoot = resolve(process.cwd(), '..');
    const functionsSource = readFileSync(resolve(repoRoot, 'functions/src/league.ts'), 'utf8');
    const kmpSource = readFileSync(resolve(
      repoRoot,
      'shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/LeagueDivision.kt',
    ), 'utf8');

    for (const division of LEAGUE_DIVISIONS) {
      expect(functionsSource).toContain(`return "${division}"`);
      expect(kmpSource).toContain(`@SerialName("${division}")`);
    }
  });

  it.each([
    ['BRONZE', 'BRONZE'],
    ['PRATA', 'PRATA'],
    ['SILVER', 'PRATA'],
    ['OURO', 'OURO'],
    ['GOLD', 'OURO'],
    ['DIAMANTE', 'DIAMANTE'],
    ['DIAMOND', 'DIAMANTE'],
    ['PLATINUM', 'DIAMANTE'],
    ['CHAMPION', 'DIAMANTE'],
    [' silver ', 'PRATA'],
    ['desconhecida', 'BRONZE'],
    [null, 'BRONZE'],
  ])('normalizes legacy value %j to %s', (input, expected) => {
    expect(normalizeLeagueDivision(input)).toBe(expected);
  });

  it('uses the canonical 0–100 rating thresholds from shared/xp-constants.json', () => {
    const { BRONZE_MAX, PRATA_MAX, OURO_MAX, DIAMANTE_MAX } = xpConstants.leagueThresholds;
    expect(DIVISION_CONFIG.BRONZE.minRating).toBe(0);
    expect(DIVISION_CONFIG.PRATA.minRating).toBe(BRONZE_MAX);
    expect(DIVISION_CONFIG.OURO.minRating).toBe(PRATA_MAX);
    expect(DIVISION_CONFIG.DIAMANTE.minRating).toBe(OURO_MAX);

    expect(getDivisionFromRating(0)).toBe('BRONZE');
    expect(getDivisionFromRating(BRONZE_MAX - 0.01)).toBe('BRONZE');
    expect(getDivisionFromRating(BRONZE_MAX)).toBe('PRATA');
    expect(getDivisionFromRating(PRATA_MAX)).toBe('OURO');
    expect(getDivisionFromRating(OURO_MAX)).toBe('DIAMANTE');
    expect(getDivisionFromRating(DIAMANTE_MAX)).toBe('DIAMANTE');
  });

  it('resolves labels through the centralized i18n key', () => {
    const translate = (key: string) => `translated:${key}`;
    expect(getDivisionLabel('PRATA', translate)).toBe('translated:league.silver');
    expect(getDivisionLabel('GOLD', translate)).toBe('translated:league.gold');
  });
});

describe('XP_VALUES single source of truth (#4341)', () => {
  it('has no numeric literal outside shared/xp-constants.json', () => {
    const sharedValues = new Set<number>();
    for (const group of Object.values(xpConstants)) {
      if (group && typeof group === 'object') {
        for (const value of Object.values(group)) {
          if (typeof value === 'number') sharedValues.add(value);
        }
      }
    }
    for (const [action, value] of Object.entries(XP_VALUES)) {
      expect(sharedValues.has(value as number), `${action}=${String(value)} não está em shared/xp-constants.json`).toBe(true);
    }
  });

  it('does not define BEST_GK, which has no XP award in the backend', () => {
    expect(XP_VALUES).not.toHaveProperty('BEST_GK');
  });
});
