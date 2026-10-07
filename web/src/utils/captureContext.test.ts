import { afterEach, describe, expect, it } from 'vitest';
import { captureContext } from './captureContext';

describe('captureContext', () => {
  const originalPathname = window.location.pathname;

  afterEach(() => {
    window.history.replaceState({}, '', originalPathname);
  });

  it('retorna plataforma "web" e app_version preenchido', () => {
    const ctx = captureContext();
    expect(ctx.platform).toBe('web');
    expect(typeof ctx.app_version).toBe('string');
    expect(ctx.app_version.length).toBeGreaterThan(0);
  });

  it('captura a rota atual (pathname) como screen_route', () => {
    window.history.replaceState({}, '', '/tela-erro');
    expect(captureContext().screen_route).toBe('/tela-erro');
  });

  it('captura device_info do navegador com tipos válidos', () => {
    const info = captureContext().device_info;
    expect(typeof info.userAgent).toBe('string');
    expect(info.userAgent.length).toBeGreaterThan(0);
    expect(typeof info.platform).toBe('string');
    expect(typeof info.language).toBe('string');
    expect(info.language.length).toBeGreaterThan(0);
    expect(info.screenResolution).toMatch(/^\d+x\d+$/);
    expect(typeof info.pixelRatio).toBe('number');
    expect(info.pixelRatio).toBeGreaterThan(0);
    expect(typeof info.vendor).toBe('string');
  });

  it('locale espelha navigator.language', () => {
    expect(captureContext().locale).toBe(navigator.language);
  });

  it('estrutura completa bate com o contrato de FeedbackContext', () => {
    const ctx = captureContext();
    expect(Object.keys(ctx).sort()).toEqual(
      ['app_version', 'device_info', 'locale', 'platform', 'screen_route'].sort(),
    );
    expect(Object.keys(ctx.device_info).sort()).toEqual(
      ['language', 'pixelRatio', 'platform', 'screenResolution', 'userAgent', 'vendor'].sort(),
    );
  });

  it('devicePixelRatio falsy (0) é normalizado para 1', () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    try {
      expect(captureContext().device_info.pixelRatio).toBe(1);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: original, configurable: true });
    }
  });
});
