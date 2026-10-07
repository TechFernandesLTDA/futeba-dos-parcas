import { describe, it, expect } from 'vitest';
import {
  isApplePlatform,
  getSearchShortcutTranslationKey,
} from './platformShortcut';

describe('isApplePlatform', () => {
  it.each(['MacIntel', 'Macintosh', 'MacPPC'])(
    'retorna true para Mac (%s)',
    (platform) => {
      expect(isApplePlatform(platform)).toBe(true);
    },
  );

  it.each(['iPhone', 'iPad', 'iPod'])(
    'retorna true para dispositivos iOS (%s)',
    (platform) => {
      expect(isApplePlatform(platform)).toBe(true);
    },
  );

  it('é case-insensitive (mac, IPHONE)', () => {
    expect(isApplePlatform('mac')).toBe(true);
    expect(isApplePlatform('IPHONE')).toBe(true);
  });

  it('detecta Mac dentro de strings compostas', () => {
    expect(isApplePlatform('Mozilla/5.0 (Macintosh)')).toBe(true);
  });

  it.each(['Win32', 'Win64', 'Linux x86_64', 'Linux armv8l', 'Android', ''])(
    'retorna false para plataforma não-Apple (%s)',
    (platform) => {
      expect(isApplePlatform(platform)).toBe(false);
    },
  );

  it('retorna false para undefined quando navigator.platform não é Apple', () => {
    // jsdom: navigator.platform é '' por padrão
    expect(isApplePlatform(undefined)).toBe(false);
  });

  it('usa navigator.platform quando platform não é informado', () => {
    const original = navigator.platform;
    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    try {
      expect(isApplePlatform()).toBe(true);
    } finally {
      Object.defineProperty(window.navigator, 'platform', {
        value: original,
        configurable: true,
      });
    }
  });
});

describe('getSearchShortcutTranslationKey', () => {
  it('retorna key Apple para plataformas Apple', () => {
    expect(getSearchShortcutTranslationKey('MacIntel')).toBe('shortcuts.searchKeyApple');
    expect(getSearchShortcutTranslationKey('iPhone')).toBe('shortcuts.searchKeyApple');
    expect(getSearchShortcutTranslationKey('iPad')).toBe('shortcuts.searchKeyApple');
  });

  it('retorna key default para plataformas não-Apple', () => {
    expect(getSearchShortcutTranslationKey('Win32')).toBe('shortcuts.searchKeyDefault');
    expect(getSearchShortcutTranslationKey('Linux x86_64')).toBe('shortcuts.searchKeyDefault');
    expect(getSearchShortcutTranslationKey('')).toBe('shortcuts.searchKeyDefault');
  });

  it('retorna key default quando não informado e navigator não é Apple', () => {
    expect(getSearchShortcutTranslationKey(undefined)).toBe('shortcuts.searchKeyDefault');
  });

  it('retorna key Apple quando navigator é Apple e não informado', () => {
    const original = navigator.platform;
    Object.defineProperty(window.navigator, 'platform', {
      value: 'iPhone',
      configurable: true,
    });
    try {
      expect(getSearchShortcutTranslationKey()).toBe('shortcuts.searchKeyApple');
    } finally {
      Object.defineProperty(window.navigator, 'platform', {
        value: original,
        configurable: true,
      });
    }
  });
});
