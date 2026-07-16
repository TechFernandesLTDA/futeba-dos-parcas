import { describe, expect, it } from 'vitest';
import { getSpecificRouteFallback } from './routeFallback';

describe('getSpecificRouteFallback', () => {
  it.each([
    ['/notifications', 'list'],
    ['/weekly-ranking', 'list'],
    ['/dream-team', 'list'],
    ['/feed', 'list'],
    ['/players/nearby', 'list'],
    ['/whats-new', 'about'],
    ['/dev', 'form'],
    ['/owner/dashboard', 'statistics'],
  ] as const)('resolve %s como skeleton %s', (pathname, expected) => {
    expect(getSpecificRouteFallback(pathname)).toBe(expected);
  });

  it('preserva o matcher legado para grids já adequados', () => {
    expect(getSpecificRouteFallback('/groups/discover')).toBeNull();
    expect(getSpecificRouteFallback('/location/abc')).toBeNull();
  });
});
