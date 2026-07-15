import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { logFirebaseAnalyticsEvent } = vi.hoisted(() => ({
  logFirebaseAnalyticsEvent: vi.fn(),
}));

vi.mock('../services/firebaseAnalytics', () => ({ logFirebaseAnalyticsEvent }));

import { trackEvent, trackScreenView } from './analytics';

describe('analytics', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    logFirebaseAnalyticsEvent.mockClear();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trackEvent loga em modo dev', () => {
    trackEvent('login', { method: 'email' });
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('login'),
      expect.objectContaining({ method: 'email' })
    );
    expect(logFirebaseAnalyticsEvent).toHaveBeenCalledWith('login', { method: 'email' });
  });

  it('trackScreenView registra tela', () => {
    trackScreenView('HomeScreen');
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('screen_viewed'),
      expect.objectContaining({ screen: 'HomeScreen' })
    );
  });

  it('trackEvent com parâmetros de jogo', () => {
    trackEvent('game_created', { fieldType: 'SOCIETY', groupId: 'g1' });
    expect(console.debug).toHaveBeenCalled();
  });

  it('captura UTMs uma vez e enriquece eventos posteriores', async () => {
    vi.resetModules();
    window.history.replaceState(
      {},
      '',
      '/launch?utm_source=instagram&utm_medium=social&utm_campaign=beta'
    );

    const analyticsModule = await import('./analytics');
    analyticsModule.trackEvent('landing_viewed', { page: 'launch' });

    window.history.replaceState({}, '', '/?utm_source=ignored');
    analyticsModule.trackEvent('signup_cta_clicked', { location: 'hero' });

    expect(logFirebaseAnalyticsEvent).toHaveBeenNthCalledWith(1, 'landing_viewed', {
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'beta',
      page: 'launch',
    });
    expect(logFirebaseAnalyticsEvent).toHaveBeenNthCalledWith(2, 'signup_cta_clicked', {
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'beta',
      location: 'hero',
    });
  });

  it('ignora valores vazios e limita valores de campanha', async () => {
    vi.resetModules();
    window.history.replaceState({}, '', `/?utm_source=%20&utm_campaign=${'x'.repeat(120)}`);

    const analyticsModule = await import('./analytics');
    expect(analyticsModule.getAcquisitionContext()).toEqual({ utm_campaign: 'x'.repeat(100) });
  });
});
