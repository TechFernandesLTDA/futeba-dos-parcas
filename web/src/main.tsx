import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { createLogger } from './utils/logger';

const swLogger = createLogger('ServiceWorker');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registrar Service Worker para PWA offline
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // #2204: detecta nova versão do SW e a ativa automaticamente.
        // Antes o SW novo ficava "waiting" indefinidamente (SKIP_WAITING nunca era enviado).
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // Só dispara o update quando há um controller anterior (já havia versão ativa).
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              swLogger.info('Nova versão do app disponível — ativando.');
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => {
        // #2204/#2290: registra a falha em vez de engolir silenciosamente.
        swLogger.error('Falha ao registrar o Service Worker:', err);
      });

    // Recarrega a página quando o novo SW assume o controle, garantindo assets atualizados.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
