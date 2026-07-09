import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'games-ref'),
  query: vi.fn((_ref, ...parts) => parts),
  where: vi.fn((...args) => ({ type: 'where', args })),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
  }),
}));

import { fetchRecentLocationIds } from './useRecentLocations';

describe('useRecentLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderBy.mockReturnValue({ type: 'orderBy', args: ['dateTime', 'desc'] });
  });

  it('orders by dateTime desc and dedupes cancelled or repeated locations', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ status: 'SCHEDULED', location_id: 'loc-1' }) },
        { data: () => ({ status: 'CANCELLED', location_id: 'loc-2' }) },
        { data: () => ({ status: 'CONFIRMED', location_id: 'loc-1' }) },
        { data: () => ({ status: 'FINISHED', location_id: 'loc-3' }) },
      ],
    });

    await expect(fetchRecentLocationIds('user-1')).resolves.toEqual(['loc-1', 'loc-3']);
    expect(mockOrderBy).toHaveBeenCalledWith('dateTime', 'desc');
  });
});
