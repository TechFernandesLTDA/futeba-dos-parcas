import { describe, expect, it } from 'vitest';
import { isGameWithinHeadToHeadPeriod, type HeadToHeadPeriod } from './headToHeadPeriod';

function game(date: string) {
  return { date };
}

describe('isGameWithinHeadToHeadPeriod', () => {
  const now = new Date('2026-06-27T12:00:00Z');

  it('includes any valid or legacy game when period is all', () => {
    expect(isGameWithinHeadToHeadPeriod(game('2024-01-01'), 'all', now)).toBe(true);
    expect(isGameWithinHeadToHeadPeriod(game(''), 'all', now)).toBe(true);
  });

  it.each([
    ['30d', '2026-06-01', true],
    ['30d', '2026-05-01', false],
    ['90d', '2026-04-01', true],
    ['90d', '2026-01-01', false],
    ['365d', '2025-07-01', true],
    ['365d', '2025-01-01', false],
  ] as Array<[HeadToHeadPeriod, string, boolean]>)(
    'filters %s games by cutoff date',
    (period, date, expected) => {
      expect(isGameWithinHeadToHeadPeriod(game(date), period, now)).toBe(expected);
    }
  );

  it('excludes invalid dates from bounded periods', () => {
    expect(isGameWithinHeadToHeadPeriod(game('sem-data'), '30d', now)).toBe(false);
  });
});
