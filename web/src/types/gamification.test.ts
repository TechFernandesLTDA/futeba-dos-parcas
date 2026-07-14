import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIVISION_CONFIG,
  LEAGUE_DIVISIONS,
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

  it('uses the canonical 0–100 rating thresholds', () => {
    expect(getDivisionFromRating(0)).toBe('BRONZE');
    expect(getDivisionFromRating(29.99)).toBe('BRONZE');
    expect(getDivisionFromRating(30)).toBe('PRATA');
    expect(getDivisionFromRating(50)).toBe('OURO');
    expect(getDivisionFromRating(70)).toBe('DIAMANTE');
    expect(getDivisionFromRating(100)).toBe('DIAMANTE');
  });

  it('resolves labels through the centralized i18n key', () => {
    const translate = (key: string) => `translated:${key}`;
    expect(getDivisionLabel('PRATA', translate)).toBe('translated:league.silver');
    expect(getDivisionLabel('GOLD', translate)).toBe('translated:league.gold');
  });
});
