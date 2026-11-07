import type { Analytics, EventParams } from 'firebase/analytics';

export let analytics: Analytics | null = null;
let analyticsInitialization: Promise<Analytics | null> | null = null;
let logEventFn: ((instance: Analytics, eventName: string, params?: EventParams) => void) | null = null;

async function initializeAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !import.meta.env.PROD) {
    return null;
  }

  try {
    const { getAnalytics, isSupported, logEvent } = await import('firebase/analytics');
    if (!(await isSupported())) {
      return null;
    }

    // Keep analytics out of the startup path and avoid forcing every unit-test
    // Firebase mock to expose the application instance.
    const { app } = await import('./firebase');
    logEventFn = logEvent;
    analytics = getAnalytics(app);
    return analytics;
  } catch {
    // Analytics must never prevent the application from starting.
    return null;
  }
}

export function getFirebaseAnalytics(): Promise<Analytics | null> {
  analyticsInitialization ??= initializeAnalytics();
  return analyticsInitialization;
}

export function logFirebaseAnalyticsEvent(eventName: string, params: EventParams): void {
  void getFirebaseAnalytics().then((instance) => {
    if (instance && logEventFn) {
      try {
        logEventFn(instance, eventName, params);
      } catch {
        // Event delivery is best-effort and must not affect product flows.
      }
    }
  });
}
