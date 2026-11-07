import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'i18nextLng';

describe('i18n cold-start locale loading (#3931)', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('carrega e ativa EN no cold-start sem changeLanguage explícito', async () => {
    localStorage.setItem(STORAGE_KEY, 'en');

    await import('./index');
    const { default: i18n } = await import('i18next');

    await vi.waitFor(() => {
      expect(i18n.language).toBe('en');
      expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    });

    expect(i18n.t('common.date.tomorrow')).toBe('Tomorrow');
  });

  it('carrega e ativa ES no cold-start sem changeLanguage explícito', async () => {
    localStorage.setItem(STORAGE_KEY, 'es');

    await import('./index');
    const { default: i18n } = await import('i18next');

    await vi.waitFor(() => {
      expect(i18n.language).toBe('es');
      expect(i18n.hasResourceBundle('es', 'translation')).toBe(true);
    });

    expect(i18n.t('common.date.tomorrow')).toBe('Mañana');
  });

  it('mantém pt-BR no cold-start (bundle bundled, sem lazy load)', async () => {
    localStorage.setItem(STORAGE_KEY, 'pt-BR');

    await import('./index');
    const { default: i18n } = await import('i18next');

    await vi.waitFor(() => {
      expect(i18n.language).toBe('pt-BR');
    });

    expect(i18n.hasResourceBundle('pt-BR', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(false);
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(false);
    expect(i18n.t('common.date.tomorrow')).toBe('Amanhã');
  });
});
