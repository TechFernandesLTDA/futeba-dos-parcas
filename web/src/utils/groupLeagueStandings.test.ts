import { describe, expect, it } from 'vitest';
import { compareGroupLeagueStandings, type SortableGroupLeagueStanding } from './groupLeagueStandings';

function standing(overrides: Partial<SortableGroupLeagueStanding>): SortableGroupLeagueStanding {
  return {
    userName: 'Jogador',
    points: 0,
    gamesPlayed: 0,
    wins: 0,
    goalsScored: 0,
    goalDifference: 0,
    ...overrides,
  };
}

describe('compareGroupLeagueStandings', () => {
  it('prioritizes points before all other criteria', () => {
    const standings = [
      standing({ userName: 'B', points: 8, gamesPlayed: 20 }),
      standing({ userName: 'A', points: 10, gamesPlayed: 1 }),
    ].sort(compareGroupLeagueStandings);

    expect(standings.map((item) => item.userName)).toEqual(['A', 'B']);
  });

  it('uses attendance as the first tie-breaker after points', () => {
    const standings = [
      standing({ userName: 'Baixa presenca', points: 10, gamesPlayed: 2, wins: 5 }),
      standing({ userName: 'Alta presenca', points: 10, gamesPlayed: 8, wins: 1 }),
    ].sort(compareGroupLeagueStandings);

    expect(standings[0].userName).toBe('Alta presenca');
  });

  it('falls back to wins, goal difference, goals scored, then name', () => {
    const standings = [
      standing({ userName: 'Daniel', points: 10, gamesPlayed: 5, wins: 2, goalDifference: 3, goalsScored: 9 }),
      standing({ userName: 'Bruno', points: 10, gamesPlayed: 5, wins: 3, goalDifference: 1, goalsScored: 5 }),
      standing({ userName: 'Carlos', points: 10, gamesPlayed: 5, wins: 2, goalDifference: 4, goalsScored: 3 }),
      standing({ userName: 'André', points: 10, gamesPlayed: 5, wins: 2, goalDifference: 3, goalsScored: 9 }),
    ].sort(compareGroupLeagueStandings);

    expect(standings.map((item) => item.userName)).toEqual(['Bruno', 'Carlos', 'André', 'Daniel']);
  });
});
