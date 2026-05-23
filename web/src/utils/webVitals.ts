import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
import { analytics } from '../services/firebase';
import { logEvent } from 'firebase/analytics';
import { trackEvent } from './analytics';
import { createLogger } from './logger';

const logger = createLogger('WebVitals');

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * Report Web Vitals to Firebase Analytics for Real User Monitoring (RUM)
 * Only reports in production to avoid noise from development
 */
export function reportWebVitals() {
  if (import.meta.env.DEV) {
    logger.debug('Disabled in development mode');
    return;
  }

  const sendToAnalytics = (metric: WebVitalMetric) => {
    // Send to Firebase Analytics
    if (analytics) {
      logEvent(analytics, 'web_vital', {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigation_type: metric.navigationType,
      });
    }

    // Also send to our analytics tracker (type-safe)
    trackEvent('web_vital', {
      name: metric.name as 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB' | 'FID',
      value: metric.value,
      rating: metric.rating,
    });

    // Log to console for debugging (only in dev)
    if (import.meta.env.DEV) {
      logger.debug(`[${metric.name}]`, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
      });
    }
  };

  // Core Web Vitals
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}

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
