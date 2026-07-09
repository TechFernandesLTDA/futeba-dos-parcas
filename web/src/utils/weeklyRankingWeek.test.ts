import { describe, expect, it } from 'vitest';
import { getCompletedWeekKey } from './weeklyRankingWeek';

describe('getCompletedWeekKey', () => {
  it('reads the same completed week key that the Sunday night scheduler writes', () => {
    expect(getCompletedWeekKey(new Date('2026-07-05T23:57:00-03:00'))).toBe('2026-27');
  });

  it('stays on the completed week even when the UTC date has already rolled over', () => {
    expect(getCompletedWeekKey(new Date('2026-07-06T02:57:00Z'))).toBe('2026-27');
  });
});
