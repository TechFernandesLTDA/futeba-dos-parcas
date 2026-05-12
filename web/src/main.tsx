import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { logError } from './utils/errorLogger';
import { initWebVitals } from './utils/webVitals';

// Captura erros síncronos globais (ex: erros em scripts não-React, libs externas)
window.addEventListener('error', (e) => {
  logError(e.error ?? new Error(e.message || 'Erro global desconhecido'), {
    kind: 'window-error',
    filename: e.filename,
    lineno: e.lineno,
  });
});

// Captura Promises rejeitadas sem catch (ex: chamadas Firebase sem await+catch)
window.addEventListener('unhandledrejection', (e) => {
  logError(
    e.reason instanceof Error
      ? e.reason
      : new Error(String(e.reason ?? 'Unhandled promise rejection')),
    { kind: 'unhandled-rejection' }
  );
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// #1088: Core Web Vitals → Firebase Analytics
initWebVitals();

// Registrar Service Worker para PWA offline
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration falhou silenciosamente
    });
  });
}
