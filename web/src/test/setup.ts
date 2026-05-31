import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Wrapper global para todos os testes (render + renderHook).
// Fornece QueryClientProvider e ToastProvider por padrão, eliminando os erros
// "No QueryClient set" e "useToast must be used within a ToastProvider"
// que eram a raiz de ~100 falhas. #2330
// Testes que precisam de comportamento customizado podem passar wrapper próprio.
//
// NOTA: configure({ wrapper }) do RTL v16 NÃO funciona para renderHook —
// o wrapper só é lido pelo argumento da chamada, não do config global.
// Por isso fazemos monkey-patch de renderHook para injetar o wrapper
// quando o teste não passa um próprio. #2330

// GlobalWrapper inclui apenas QueryClientProvider.
// NÃO inclui ToastProvider pois testes que mockam ../contexts/ToastContext
// sem exportar ToastProvider quebravam o wrapper para todos os renders
// daquele arquivo. Testes que precisam de ToastProvider real usam
// renderWithProviders() de test/renderWithProviders.tsx. #2330
function GlobalWrapper({ children }: { children: React.ReactNode }) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return React.createElement(
    QueryClientProvider,
    { client: testQueryClient },
    children,
  );
}

// configure({ wrapper }) funciona para `render` mas NÃO para `renderHook` no RTL v16.
// Deixamos para consistência com render (afeta testes de componente).
configure({ wrapper: GlobalWrapper });

// Polyfill de crypto.subtle para jsdom — Web Crypto API não está disponível em
// jsdom por padrão. useOfflineQueue usa AES-GCM para criptografar a fila no
// localStorage. O mock abaixo simula encrypt/decrypt/importKey/exportKey/generateKey
// de forma síncrona (retorna dados fixos) para que o fluxo de persistência
// possa ser testado sem a API real. #2330
if (!globalThis.crypto?.subtle) {
  const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {
    ...globalThis.crypto,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: {
      generateKey: async () => mockKey,
      importKey: async () => mockKey,
      exportKey: async () => new Uint8Array(32).buffer,
      encrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data,
      decrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data,
    },
  };
}
