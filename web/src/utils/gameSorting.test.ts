import { describe, expect, it } from 'vitest';
import { sortGamesForDisplay, type SortableGame } from './gameSorting';

interface TestGame extends SortableGame {
  id: string;
}

describe('sortGamesForDisplay', () => {
  it('ordena proximos jogos pelo inicio real em ordem crescente', () => {
    const games: TestGame[] = [
      { id: 'late', date: '2026-07-07', time: '21:00', maxPlayers: 10, playersCount: 2 },
      { id: 'early', date: '2026-07-07', time: '19:00', maxPlayers: 10, playersCount: 2 },
      { id: 'date-time-first', date: '2026-07-08', time: '23:00', dateTime: new Date(2026, 6, 7, 18, 30), maxPlayers: 10, playersCount: 2 },
    ];

    expect(sortGamesForDisplay(games, 'date', 'all').map((game) => game.id)).toEqual([
      'date-time-first',
      'early',
      'late',
    ]);
  });

  it('ordena jogos finalizados pelo inicio real em ordem decrescente', () => {
    const games: TestGame[] = [
      { id: 'older', date: '2026-07-04', time: '21:00', maxPlayers: 10, playersCount: 2 },
      { id: 'newer', date: '2026-07-05', time: '19:00', maxPlayers: 10, playersCount: 2 },
    ];

    expect(sortGamesForDisplay(games, 'date', 'FINISHED').map((game) => game.id)).toEqual([
      'newer',
      'older',
    ]);
  });
});
