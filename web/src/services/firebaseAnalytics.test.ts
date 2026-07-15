import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseAnalyticsMocks = vi.hoisted(() => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock('firebase/analytics', () => firebaseAnalyticsMocks);
vi.mock('./firebase', () => ({ app: { name: 'test-app' } }));

describe('firebaseAnalytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('PROD', true);
  });

  it('envia evento quando o Firebase Analytics está disponível', async () => {
    const analyticsInstance = { app: { name: 'test-app' } };
    firebaseAnalyticsMocks.isSupported.mockResolvedValue(true);
    firebaseAnalyticsMocks.getAnalytics.mockReturnValue(analyticsInstance);

    const { logFirebaseAnalyticsEvent, getFirebaseAnalytics } = await import('./firebaseAnalytics');
    logFirebaseAnalyticsEvent('landing_viewed', { page: 'launch' });
    await getFirebaseAnalytics();

    expect(firebaseAnalyticsMocks.logEvent).toHaveBeenCalledWith(
      analyticsInstance,
      'landing_viewed',
      { page: 'launch' }
    );
  });

  it('é no-op quando Analytics não é suportado', async () => {
    firebaseAnalyticsMocks.isSupported.mockResolvedValue(false);

    const { logFirebaseAnalyticsEvent, getFirebaseAnalytics } = await import('./firebaseAnalytics');
    logFirebaseAnalyticsEvent('landing_viewed', { page: 'launch' });
    await getFirebaseAnalytics();

    expect(firebaseAnalyticsMocks.getAnalytics).not.toHaveBeenCalled();
    expect(firebaseAnalyticsMocks.logEvent).not.toHaveBeenCalled();
  });

  it('é no-op seguro quando a inicialização falha', async () => {
    firebaseAnalyticsMocks.isSupported.mockRejectedValue(new Error('blocked'));

    const { logFirebaseAnalyticsEvent, getFirebaseAnalytics } = await import('./firebaseAnalytics');
    expect(await getFirebaseAnalytics()).toBeNull();
    expect(() => logFirebaseAnalyticsEvent('landing_viewed', {})).not.toThrow();
  });
});
