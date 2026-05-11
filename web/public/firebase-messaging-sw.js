/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBMzIKlfST4gJm3RM3QQXY-N0doVE6vMQE",
  authDomain: "futebadosparcas.firebaseapp.com",
  projectId: "futebadosparcas",
  storageBucket: "futebadosparcas.firebasestorage.app",
  messagingSenderId: "490094091078",
  appId: "1:490094091078:web:abcd1234efgh5678"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Futeba dos Parças';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Resolver deep link a partir do payload de dados
  // Validar que a URL pertence ao mesmo origin para
  // evitar open-redirect via payload FCM malicioso
  const data = event.notification.data || {};
  let targetUrl = '/';

  try {
    const rawUrl = data.url || data.action || '/';
    // Se for caminho relativo, resolve no origin atual
    const resolved = new URL(rawUrl, self.location.origin);
    if (resolved.origin === self.location.origin) {
      targetUrl = resolved.href;
    } else {
      // URL de outro origin — ignorar e abrir raiz
      console.warn('[SW] Deep link ignorado (origin externo):', rawUrl);
    }
  } catch (e) {
    // rawUrl invalido — fallback para raiz
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já existe janela com a URL alvo, focar nela
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Se existe alguma janela aberta, navegar para a URL
      if (clientList.length > 0 && 'navigate' in clientList[0]) {
        return clientList[0].focus().then(() =>
          clientList[0].navigate(targetUrl)
        );
      }
      // Nenhuma janela aberta — abrir nova
      return clients.openWindow(targetUrl);
    })
  );
});
