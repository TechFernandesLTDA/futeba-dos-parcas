import { describe, expect, it } from 'vitest';
import type { HeadToHeadStats } from '../hooks/useHeadToHead';
import { buildFriendlyComparisonSummary, type FriendlyComparisonLabels } from './friendlyComparison';

const labels: FriendlyComparisonLabels = {
  title: 'Comparativo amistoso',
  games: 'Jogos',
  opponents: 'Adversarios',
  sameTeam: 'Mesmo time',
  goals: 'gols',
  assists: 'assistencias',
  mvp: 'MVP',
  directWins: 'vitorias',
  draws: 'Empates',
  together: 'Parceria',
  balancedHeadline: 'Duelo equilibrado',
  winsHeadline: (playerName) => `${playerName} esta na frente nas vitorias`,
  goalsHeadline: (playerName) => `${playerName} lidera nos gols`,
};

function stats(overrides: Partial<HeadToHeadStats>): HeadToHeadStats {
  return {
    totalGames: 3,
    gamesAgainst: 2,
    gamesTogether: 1,
    p1WinsAgainst: 0,
    p2WinsAgainst: 0,
    drawsAgainst: 2,
    p1WinsTogether: 0,
    p2WinsTogether: 0,
    drawsTogether: 0,
    p1TotalGoals: 0,
    p2TotalGoals: 0,
    p1TotalAssists: 0,
    p2TotalAssists: 0,
    p1MvpCount: 0,
    p2MvpCount: 0,
    p1WinRate: 0,
    p2WinRate: 0,
    matches: [],
    ...overrides,
  };
}

describe('buildFriendlyComparisonSummary', () => {
  it('highlights the player with more direct wins', () => {
    const summary = buildFriendlyComparisonSummary(
      'Renan',
      'Bruno',
      stats({ p1WinsAgainst: 2, p2WinsAgainst: 1 }),
      labels
    );

    expect(summary.headline).toBe('Renan esta na frente nas vitorias');
    expect(summary.playerOne.wins).toBe(2);
    expect(summary.shareText).toContain('Renan x Bruno');
  });

  it('uses goals as a friendly tie-breaker when direct wins are tied', () => {
    const summary = buildFriendlyComparisonSummary(
      'Renan',
      'Bruno',
      stats({ p1WinsAgainst: 1, p2WinsAgainst: 1, p1TotalGoals: 3, p2TotalGoals: 5 }),
      labels
    );

    expect(summary.headline).toBe('Bruno lidera nos gols');
  });

  it('keeps the tone balanced when wins and goals are tied', () => {
    const summary = buildFriendlyComparisonSummary(
      'Renan',
      'Bruno',
      stats({ p1WinsAgainst: 1, p2WinsAgainst: 1, p1TotalGoals: 2, p2TotalGoals: 2 }),
      labels
    );

    expect(summary.headline).toBe('Duelo equilibrado');
    expect(summary.shareText).toContain('Empates: 2');
  });
});
