import { describe, expect, it } from 'vitest';
import { buildScreenPerformanceStats } from './performanceDashboard';

describe('buildScreenPerformanceStats', () => {
  it('averages LCP only across records that actually reported LCP', () => {
    const stats = buildScreenPerformanceStats([
      { screenName: 'LeagueScreen', timeToInteractive: 1000, lcp: 1200, performanceViolations: '' },
      { screenName: 'LeagueScreen', timeToInteractive: 2000, performanceViolations: 'TTI' },
      { screenName: 'LeagueScreen', timeToInteractive: 3000, lcp: 2400, performanceViolations: '' },
    ]);

    expect(stats.LeagueScreen).toMatchObject({
      count: 3,
      avgTTI: 2000,
      avgLCP: 1800,
      violations: 1,
    });
  });
});
