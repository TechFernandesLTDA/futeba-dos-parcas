import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  documentId: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import {
  calculateHeadToHeadWinRates,
  fetchConfirmedConfirmationDocs,
  resolveHeadToHeadResults,
} from './useHeadToHead';

describe('resolveHeadToHeadResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('confirmations');
    mockQuery.mockReturnValue('query');
    mockWhere.mockReturnValue('where');
    mockOrderBy.mockReturnValue('orderBy');
    mockLimit.mockReturnValue('limit');
    mockStartAfter.mockReturnValue('startAfter');
  });

  it('does not depend on the query order of team documents', () => {
    const results = resolveHeadToHeadResults('team-a', 'team-b', [
      {
        id: 'team-b',
        gameId: 'game-1',
        name: 'Time B',
        color: '',
        playerIds: ['p2'],
        score: 1,
      },
      {
        id: 'team-a',
        gameId: 'game-1',
        name: 'Time A',
        color: '',
        playerIds: ['p1'],
        score: 4,
      },
    ]);

    expect(results).toEqual({
      p1Result: 'WIN',
      p2Result: 'LOSS',
    });
  });

  it('keeps same-team players aligned with their shared team result', () => {
    const results = resolveHeadToHeadResults('team-a', 'team-a', [
      {
        id: 'team-b',
        gameId: 'game-2',
        name: 'Time B',
        color: '',
        playerIds: ['p3'],
        score: 0,
      },
      {
        id: 'team-a',
        gameId: 'game-2',
        name: 'Time A',
        color: '',
        playerIds: ['p1', 'p2'],
        score: 2,
      },
    ]);

    expect(results).toEqual({
      p1Result: 'WIN',
      p2Result: 'WIN',
    });
  });

  it('returns zero win rate when the pair only has same-team matches', () => {
    expect(calculateHeadToHeadWinRates({
      gamesAgainst: 0,
      p1WinsAgainst: 4,
      p2WinsAgainst: 1,
    })).toEqual({
      p1WinRate: 0,
      p2WinRate: 0,
    });
  });

  it('paginates past the first 500 confirmations', async () => {
    const pageOne = Array.from({ length: 500 }, (_, index) => ({
      id: `doc-${index}`,
      data: () => ({ game_id: `game-${index}` }),
    }));
    const pageTwo = [
      { id: 'doc-500', data: () => ({ game_id: 'game-500' }) },
    ];

    mockGetDocs
      .mockResolvedValueOnce({ docs: pageOne })
      .mockResolvedValueOnce({ docs: pageTwo });

    const docs = await fetchConfirmedConfirmationDocs('player-1');

    expect(docs).toHaveLength(501);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockStartAfter).toHaveBeenCalledWith(pageOne[499]);
  });
});
