import { describe, it, expect } from 'vitest';
import { balancedDraw, PlayerForDraw } from './balancedDraw';

function createPlayer(
  id: string,
  name: string,
  level: number,
  position: 'GOALKEEPER' | 'FIELD' = 'FIELD'
): PlayerForDraw {
  return { id, name, level, position };
}

describe('balancedDraw', () => {
  it('returns empty teams for empty input', () => {
    const result = balancedDraw([], 2);
    expect(result.teams).toHaveLength(2);
    expect(result.teams.every((t) => t.players.length === 0)).toBe(true);
    expect(result.balanceScore).toBe(0);
    expect(result.isBalanced).toBe(true);
  });

  it('distributes 4 players into 2 balanced teams with snake draft', () => {
    const players = [
      createPlayer('1', 'P1', 90),
      createPlayer('2', 'P2', 80),
      createPlayer('3', 'P3', 70),
      createPlayer('4', 'P4', 60),
    ];

    const result = balancedDraw(players, 2, 1, 'SNAKE_DRAFT');

    expect(result.teams).toHaveLength(2);
    expect(result.teams[0].players.length + result.teams[1].players.length).toBe(4);
    expect(result.balanceScore).toBeLessThanOrEqual(10);
  });

  it('distributes 4 players with greedy strategy', () => {
    const players = [
      createPlayer('1', 'P1', 90),
      createPlayer('2', 'P2', 80),
      createPlayer('3', 'P3', 70),
      createPlayer('4', 'P4', 60),
    ];

    const result = balancedDraw(players, 2, 1, 'GREEDY');

    expect(result.teams).toHaveLength(2);
    expect(result.teams[0].players.length + result.teams[1].players.length).toBe(4);
    expect(result.balanceScore).toBeLessThanOrEqual(15);
  });

  it('distributes goalkeepers across teams', () => {
    const players = [
      createPlayer('gk1', 'GK1', 90, 'GOALKEEPER'),
      createPlayer('gk2', 'GK2', 80, 'GOALKEEPER'),
      createPlayer('1', 'P1', 70),
      createPlayer('2', 'P2', 60),
      createPlayer('3', 'P3', 50),
      createPlayer('4', 'P4', 40),
    ];

    const result = balancedDraw(players, 2, 1);

    const gkInTeam0 = result.teams[0].players.filter((p) => p.position === 'GOALKEEPER').length;
    const gkInTeam1 = result.teams[1].players.filter((p) => p.position === 'GOALKEEPER').length;
    expect(gkInTeam0).toBe(1);
    expect(gkInTeam1).toBe(1);
  });

  it('distributes players into 3 teams', () => {
    const players = Array.from({ length: 9 }, (_, i) =>
      createPlayer(`${i}`, `P${i}`, 50 + i * 3)
    );

    const result = balancedDraw(players, 3);

    expect(result.teams).toHaveLength(3);
    expect(result.teams.reduce((sum, t) => sum + t.players.length, 0)).toBe(9);
  });

  it('handles 14 players typical soccer match', () => {
    const players: PlayerForDraw[] = [
      createPlayer('gk1', 'GK1', 80, 'GOALKEEPER'),
      createPlayer('gk2', 'GK2', 75, 'GOALKEEPER'),
    ];
    for (let i = 1; i <= 12; i++) {
      players.push(createPlayer(`p${i}`, `P${i}`, 50 + i * 3));
    }

    const result = balancedDraw(players, 2, 1);

    expect(result.teams[0].players.length + result.teams[1].players.length).toBe(14);
    expect(result.teams[0].players.filter((p) => p.position === 'GOALKEEPER').length).toBe(1);
    expect(result.teams[1].players.filter((p) => p.position === 'GOALKEEPER').length).toBe(1);
  });

  it('calculates balance score correctly', () => {
    const players = [
      createPlayer('1', 'P1', 70),
      createPlayer('2', 'P2', 70),
      createPlayer('3', 'P3', 70),
      createPlayer('4', 'P4', 70),
    ];

    const result = balancedDraw(players, 2);

    expect(result.isBalanced).toBe(true);
    expect(result.balanceScore).toBeLessThan(5);
  });

  it('handles odd number of players', () => {
    const players = Array.from({ length: 7 }, (_, i) =>
      createPlayer(`${i}`, `P${i}`, 50)
    );

    const result = balancedDraw(players, 2);

    expect(result.teams[0].players.length + result.teams[1].players.length).toBe(7);
    expect(Math.abs(result.teams[0].players.length - result.teams[1].players.length)).toBeLessThanOrEqual(1);
  });

  it('returns correct strategy in result', () => {
    const players = [createPlayer('1', 'P1', 50)];

    const snake = balancedDraw(players, 2, 1, 'SNAKE_DRAFT');
    const greedy = balancedDraw(players, 2, 1, 'GREEDY');

    expect(snake.strategy).toBe('SNAKE_DRAFT');
    expect(greedy.strategy).toBe('GREEDY');
  });
});
