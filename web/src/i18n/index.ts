import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ptBR from './locales/pt-BR.json';

const localeLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
};

const STORAGE_KEY = 'i18nextLng';

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

function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// #3931: i18next faz fallback para pt-BR no init quando o idioma detectado
// (en/es) não tem bundle (partialBundledLanguages só mantém ativo um idioma
// com recursos). O cache do detector ainda sobrescreve o localStorage com o
// fallback durante o init — por isso capturamos a escolha do usuário ANTES,
// carregamos o bundle depois do init e reativamos via changeLanguage.
const storedLanguage = readStoredLanguage();

i18n.on('languageChanged', (language) => {
  void loadLanguageResources(language);
});

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
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: {
      bindI18nStore: 'added',
    },
    // Em DEV: loga no console chaves ausentes para facilitar detecção precoce de drift.
    // Em produção o fallback para pt-BR já cobre — não alterar comportamento prod.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (_lngs: readonly string[], _ns: string, key: string) => {
          console.error(`[i18n] chave ausente: "${key}"`);
        }
      : undefined,
  })
  .then(async () => {
    const normalized = storedLanguage?.split('-')[0];
    if (!normalized || normalized === 'pt' || i18n.hasResourceBundle(normalized, 'translation')) {
      return;
    }
    await loadLanguageResources(normalized);
    await i18n.changeLanguage(normalized);
  });

export default i18n;
