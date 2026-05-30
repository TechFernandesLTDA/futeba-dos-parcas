import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from '../i18n/locales/pt-BR.json';
import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';

// Inicializa o i18next no ambiente de teste com pt-BR fixo (sem LanguageDetector,
// determinístico). Sem isto, componentes que usam useTranslation renderizavam a
// CHAVE (ex: "auth.email") em vez da string, quebrando ~120 testes que asseram
// strings PT-BR (getByLabelText('Email'), etc). O hang dos testes de search
// mascarava essas falhas no CI (job estourava antes de reportar). #2330
void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
});
