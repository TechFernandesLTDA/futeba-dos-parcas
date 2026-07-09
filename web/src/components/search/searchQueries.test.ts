import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((...args: unknown[]) => ({ kind: 'collection', args }));
const mockQuery = vi.fn((...args: unknown[]) => ({ kind: 'query', args }));
const mockWhere = vi.fn((...args: unknown[]) => ({ kind: 'where', args }));
const mockOrderBy = vi.fn((...args: unknown[]) => ({ kind: 'orderBy', args }));
const mockLimit = vi.fn((...args: unknown[]) => ({ kind: 'limit', args }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
}));

vi.mock('../../services/firebase', () => ({ db: { name: 'db' } }));

import { buildPublicGroupSearchQuery } from './searchQueries';

describe('buildPublicGroupSearchQuery', () => {
  beforeEach(() => {
    mockCollection.mockClear();
    mockQuery.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
  });

  it('inclui is_public na query de grupos', () => {
    const queryResult = buildPublicGroupSearchQuery('arena', 'arena\uf8ff');

    expect(mockCollection).toHaveBeenCalledWith({ name: 'db' }, 'groups');
    expect(mockWhere).toHaveBeenCalledWith('is_public', '==', true);
    expect(mockWhere).toHaveBeenCalledWith('name', '>=', 'arena');
    expect(mockWhere).toHaveBeenCalledWith('name', '<=', 'arena\uf8ff');
    expect(mockOrderBy).toHaveBeenCalledWith('name');
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(queryResult).toMatchObject({ kind: 'query' });
  });
});
