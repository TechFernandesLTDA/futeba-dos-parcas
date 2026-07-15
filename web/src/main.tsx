import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { createLogger } from './utils/logger';
import { PwaInstallProvider } from './hooks/usePwaInstall';

const swLogger = createLogger('ServiceWorker');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PwaInstallProvider>
      <App />
    </PwaInstallProvider>
  </React.StrictMode>
);

// Registrar Service Worker para PWA offline
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // #2717: notifica o app sobre nova versão via evento customizado
        // em vez de auto-ativar e recarregar a página silenciosamente.
        // O usuário decide quando atualizar via toast no React.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              swLogger.info('Nova versão do app disponível.');
              window.dispatchEvent(new CustomEvent('sw-update-available', { detail: registration }));
            }
          });
        });
      })
      .catch((err) => {
        swLogger.error('Falha ao registrar o Service Worker:', err);
      });
  });
}
