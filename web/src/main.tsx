import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { reportWebVitals } from './utils/webVitals';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Report Web Vitals to Firebase Analytics in production (Real User Monitoring)
reportWebVitals();

// Registrar Service Worker para PWA offline
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration falhou silenciosamente
    });
  });
}
