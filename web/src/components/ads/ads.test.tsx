import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { getAdsConfig, isAdsAllowedPath } from '../../config/ads';
import { AdSenseBanner } from './AdSenseBanner';
import { resetAdSenseLoaderForTests } from './adsenseLoader';

describe('isAdsAllowedPath', () => {
  it.each([
    '/organizar-pelada',
    '/ranking-futebol-amador',
    '/gestao-de-pelada',
    '/como-funciona/',
    '/',
  ])('permite %s', (path) => {
    expect(isAdsAllowedPath(path)).toBe(true);
  });

  it('na Home só libera abas início, jogos e ranking', () => {
    expect(isAdsAllowedPath('/', '?tab=1')).toBe(true);
    expect(isAdsAllowedPath('/', '?tab=3')).toBe(true);
    expect(isAdsAllowedPath('/', '?tab=2')).toBe(false);
    expect(isAdsAllowedPath('/', '?tab=4')).toBe(false);
  });

  it.each([
    '/group/abc/cashbox',
    '/game/abc/payment',
    '/game/abc/receipt',
    '/admin/users',
    '/owner/dashboard',
    '/owner/onboarding',
    '/login',
    '/register',
    '/onboarding/phone',
    '/splash',
    '/game/create',
    '/game/abc/live',
    '/game/abc',
    '/parcerias',
    '/rota-que-nao-existe',
    '/settings',
  ])('bloqueia %s', (path) => {
    expect(isAdsAllowedPath(path)).toBe(false);
  });
});

describe('getAdsConfig', () => {
  it('retorna null sem publisher, sem slot ou com formato inválido', () => {
    expect(getAdsConfig({})).toBeNull();
    expect(getAdsConfig({ VITE_ADSENSE_PUBLISHER_ID: '', VITE_ADSENSE_SLOT_BANNER: '1' })).toBeNull();
    expect(getAdsConfig({ VITE_ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890123456' })).toBeNull();
    expect(getAdsConfig({ VITE_ADSENSE_PUBLISHER_ID: 'xyz', VITE_ADSENSE_SLOT_BANNER: '1' })).toBeNull();
  });

  it('não personalizado é o padrão', () => {
    const env = { VITE_ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890123456', VITE_ADSENSE_SLOT_BANNER: '99' };
    expect(getAdsConfig(env)?.nonPersonalized).toBe(true);
    expect(getAdsConfig({ ...env, VITE_ADSENSE_NON_PERSONALIZED: '0' })?.nonPersonalized).toBe(false);
  });
});

describe('AdSenseBanner', () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <AdSenseBanner />
      </MemoryRouter>
    );

  beforeEach(() => {
    resetAdSenseLoaderForTests();
    document.head.querySelectorAll('script[data-adsense-loader]').forEach((el) => el.remove());
    delete window.adsbygoogle;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sem env não renderiza nada e não injeta script', () => {
    vi.stubEnv('VITE_ADSENSE_PUBLISHER_ID', '');
    vi.stubEnv('VITE_ADSENSE_SLOT_BANNER', '');
    const { container } = renderAt('/organizar-pelada');
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelectorAll('script[src*="googlesyndication"]')).toHaveLength(0);
  });

  it('com env, em rota permitida, injeta um único script e mostra o bloco após carregar', async () => {
    vi.stubEnv('VITE_ADSENSE_PUBLISHER_ID', 'ca-pub-1234567890123456');
    vi.stubEnv('VITE_ADSENSE_SLOT_BANNER', '1234567890');
    renderAt('/organizar-pelada');
    renderAt('/como-funciona');
    const scripts = document.querySelectorAll('script[src*="adsbygoogle.js"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toContain('client=ca-pub-1234567890123456');
    expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1);
    (scripts[0] as HTMLScriptElement).onload?.(new Event('load'));
    await waitFor(() => expect(screen.getAllByLabelText('Publicidade').length).toBeGreaterThan(0));
  });

  it('com env, em rota bloqueada, não injeta script', () => {
    vi.stubEnv('VITE_ADSENSE_PUBLISHER_ID', 'ca-pub-1234567890123456');
    vi.stubEnv('VITE_ADSENSE_SLOT_BANNER', '1234567890');
    const { container } = renderAt('/group/abc/cashbox');
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelectorAll('script[src*="googlesyndication"]')).toHaveLength(0);
  });
});

describe('CSP do firebase.json', () => {
  it('autoriza o script e os frames do AdSense', () => {
    const firebase = JSON.parse(readFileSync(resolve(process.cwd(), '../firebase.json'), 'utf8'));
    const csp = firebase.hosting.headers
      .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
      .find((h: { key: string }) => h.key === 'Content-Security-Policy').value as string;
    const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';
    expect(directive('script-src')).toContain('https://pagead2.googlesyndication.com');
    expect(directive('frame-src')).toContain('https://googleads.g.doubleclick.net');
    expect(directive('connect-src')).toContain('https://pagead2.googlesyndication.com');
  });
});
