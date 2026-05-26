/**
 * Performance budgets based on Web Vitals thresholds
 * Used by PerformanceDashboard to show compliance
 */
export const PERFORMANCE_BUDGETS = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
} as const;

/**
 * Get performance rating based on metric value and thresholds
 */
export function getPerformanceRating(
  metric: keyof typeof PERFORMANCE_BUDGETS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const budget = PERFORMANCE_BUDGETS[metric];
  if (value <= budget.good) return 'good';
  if (value <= budget.poor) return 'needs-improvement';
  return 'poor';
}
