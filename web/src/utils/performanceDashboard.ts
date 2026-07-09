export interface PerformanceDashboardRecord {
  screenName: string;
  timeToInteractive: number;
  lcp?: number;
  performanceViolations: string;
}
export interface PerformanceDashboardScreenStats {
  count: number;
  avgTTI: number;
  avgLCP: number;
  violations: number;
}

interface MutablePerformanceDashboardScreenStats extends PerformanceDashboardScreenStats {
  totalTTI: number;
  totalLCP: number;
  lcpCount: number;
}

export function buildScreenPerformanceStats(records: PerformanceDashboardRecord[]) {
  return records.reduce<Record<string, MutablePerformanceDashboardScreenStats>>((acc, record) => {
    if (!acc[record.screenName]) {
      acc[record.screenName] = {
        count: 0,
        avgTTI: 0,
        avgLCP: 0,
        violations: 0,
        totalTTI: 0,
        totalLCP: 0,
        lcpCount: 0,
      };
    }

    const stats = acc[record.screenName];
    stats.count += 1;
    stats.totalTTI += record.timeToInteractive;
    stats.avgTTI = stats.totalTTI / stats.count;

    if (typeof record.lcp === 'number') {
      stats.totalLCP += record.lcp;
      stats.lcpCount += 1;
      stats.avgLCP = stats.totalLCP / stats.lcpCount;
    }

    if (record.performanceViolations) {
      stats.violations += 1;
    }

    return acc;
  }, {});
}
