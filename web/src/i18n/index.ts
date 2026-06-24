import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ptBR from './locales/pt-BR.json';

const localeLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
};

export async function loadLanguageResources(language: string | undefined) {
  const normalized = language?.split('-')[0];
  if (!normalized || normalized === 'pt' || i18n.hasResourceBundle(normalized, 'translation')) {
    return;
  }

  const loader = localeLoaders[normalized];
  if (!loader) return;

  const messages = await loader();
  i18n.addResourceBundle(normalized, 'translation', messages.default, true, true);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
    },
    partialBundledLanguages: true,
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en', 'es'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    // Em DEV: loga no console chaves ausentes para facilitar detecção precoce de drift.
    // Em produção o fallback para pt-BR já cobre — não alterar comportamento prod.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (_lngs: readonly string[], _ns: string, key: string) => {
          console.error(`[i18n] chave ausente: "${key}"`);
        }
      : undefined,
  });

i18n.on('languageChanged', (language) => {
  void loadLanguageResources(language);
});

void loadLanguageResources(i18n.resolvedLanguage || i18n.language);

export default i18n;
