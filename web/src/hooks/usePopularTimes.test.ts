import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('../services/firebase', () => ({
  db: {},
}));

import { buildPopularTimes } from './usePopularTimes';

describe('buildPopularTimes', () => {
  it('ignores cancelled games without biasing the sample by status ordering', () => {
    const popularTimes = buildPopularTimes([
      { status: 'SCHEDULED', time: '20:00' },
      { status: 'FINISHED', time: '20:00' },
      { status: 'CANCELLED', time: '18:00' },
      { status: 'SCHEDULED', time: '19:00' },
    ]);

    expect(popularTimes).toEqual([
      { time: '20:00', count: 2, percentage: 67 },
      { time: '19:00', count: 1, percentage: 33 },
    ]);
  });
});
