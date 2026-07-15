import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
  type EventParams,
} from 'firebase/analytics';

export let analytics: Analytics | null = null;
let analyticsInitialization: Promise<Analytics | null> | null = null;

async function initializeAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !import.meta.env.PROD) {
    return null;
  }

  try {
    if (!(await isSupported())) {
      return null;
    }

    // Keep analytics out of the startup path and avoid forcing every unit-test
    // Firebase mock to expose the application instance.
    const { app } = await import('./firebase');
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
    if (instance) {
      try {
        logEvent(instance, eventName, params);
      } catch {
        // Event delivery is best-effort and must not affect product flows.
      }
    }
  });
}
