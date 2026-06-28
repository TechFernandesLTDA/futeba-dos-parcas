import { describe, expect, it } from 'vitest';
import { normalizePlayerStats } from './playerStats';

describe('normalizePlayerStats', () => {
  it('prioriza statistics/user_streaks sobre agregados legados do users', () => {
    const stats = normalizePlayerStats(
      {
        totalGames: 12,
        totalGoals: 7,
        totalAssists: 5,
        gamesWon: 8,
        gamesDraw: 2,
        gamesLost: 2,
        bestPlayerCount: 3,
        current_streak: 4,
        longest_streak: 9,
      },
      {
        total_games: 1,
        total_goals: 1,
        total_assists: 1,
        total_wins: 1,
        mvp_count: 1,
        current_streak: 1,
      },
      'user-1',
    );

    expect(stats).toMatchObject({
      userId: 'user-1',
      totalGames: 12,
      totalGoals: 7,
      totalAssists: 5,
      totalWins: 8,
      totalDraws: 2,
      totalLosses: 2,
      mvpCount: 3,
      currentStreak: 4,
      bestStreak: 9,
    });
    expect(stats.winRate).toBeCloseTo(8 / 12);
    expect(stats.avgGoalsPerGame).toBeCloseTo(7 / 12);
  });

  it('usa users como fallback quando statistics ainda nao existe', () => {
    const stats = normalizePlayerStats(
      undefined,
      {
        total_games: 6,
        total_goals: 2,
        total_assists: 4,
        total_wins: 3,
        mvp_count: 1,
      },
      'legacy-user',
    );

    expect(stats.totalGames).toBe(6);
    expect(stats.totalGoals).toBe(2);
    expect(stats.totalAssists).toBe(4);
    expect(stats.totalWins).toBe(3);
    expect(stats.mvpCount).toBe(1);
  });
});
