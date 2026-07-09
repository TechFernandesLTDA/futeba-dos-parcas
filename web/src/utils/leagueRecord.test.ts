import { describe, expect, it } from 'vitest';
import { getLeagueDrawCount, getLeagueLossCount, getLeagueWinRate } from './leagueRecord';

describe('leagueRecord', () => {
  it('keeps draws out of the loss column when losses are not provided', () => {
    expect(getLeagueDrawCount({ gamesPlayed: 10, wins: 6, draws: 3 })).toBe(3);
    expect(getLeagueLossCount({ gamesPlayed: 10, wins: 6, draws: 3 })).toBe(1);
  });

  it('prefers persisted losses when present', () => {
    expect(getLeagueLossCount({ gamesPlayed: 10, wins: 6, draws: 2, losses: 2 })).toBe(2);
  });

  it('calculates win rate from played games only', () => {
    expect(getLeagueWinRate({ gamesPlayed: 7, wins: 4, draws: 2 })).toBe(57);
  });
});
