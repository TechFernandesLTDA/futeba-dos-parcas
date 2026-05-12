import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { trackEvent } from './analytics';
import { createLogger } from './logger';

const logger = createLogger('webVitals');

function report(metric: Metric) {
  trackEvent('web_vital', {
    name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    rating: metric.rating,
  });

  if (import.meta.env.DEV) {
    logger.info(`${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

// #1088 — Captura Core Web Vitals e envia ao Firebase Analytics via trackEvent.
// As callbacks de onCLS/onINP/etc registram event listeners no PerformanceObserver;
// não lançam exceções síncronas. Falhas no callback `report` são silenciosamente
// engolidas pela própria biblioteca, então não há catch necessário aqui.
export function initWebVitals() {
  onCLS(report);
  onINP(report);
  onLCP(report);
  onFCP(report);
  onTTFB(report);
}
