import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('useNotificationPermission');

function scheduleIdle(callback: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(callback, 2000);
  return () => globalThis.clearTimeout(id);
}

interface BackgroundNotificationPayload {
  type: string;
  data: Record<string, unknown>;
  notification: Record<string, unknown>;
}

export function useNotificationPermission() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [loading, setLoading] = useState(false);
  const [backgroundNotificationTick, setBackgroundNotificationTick] = useState(0);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    if (permission !== 'granted') {
      return () => {
        mounted = false;
      };
    }

    const cancelIdle = scheduleIdle(() => {
      Promise.all([
        import('../services/firebaseMessaging'),
        import('firebase/messaging'),
      ]).then(([{ messagingPromise }, { onMessage }]) => {
        messagingPromise.then((messaging) => {
          if (!mounted || !messaging) return;
          unsubscribe = onMessage(messaging, (payload) => {
            if (Notification.permission === 'granted' && payload.notification) {
              new Notification(payload.notification.title || 'Futeba dos Parças', {
                body: payload.notification.body,
                icon: '/favicon.ico',
              });
            }
          });
        }).catch((err) => {
          logger.error('Falha ao inicializar messaging:', err);
        });
      }).catch((err) => {
        logger.error('Falha ao carregar Firebase Messaging:', err);
      });
    });

    return () => {
      mounted = false;
      cancelIdle();
      if (unsubscribe) unsubscribe();
    };
  }, [permission]);

  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as BackgroundNotificationPayload;
      if (payload?.type === 'FCM_BACKGROUND_NOTIFICATION') {
        logger.info('Background notification received from SW:', payload);
        setBackgroundNotificationTick((prev) => prev + 1);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return;
    }

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted' && user?.id) {
        const [{ messagingPromise }, { getToken }, { doc, runTransaction, arrayUnion }, { db }] = await Promise.all([
          import('../services/firebaseMessaging'),
          import('firebase/messaging'),
          import('firebase/firestore'),
          import('../services/firebase'),
        ]);
        const messaging = await messagingPromise;
        if (!messaging) return;

        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
          logger.warn('VITE_FIREBASE_VAPID_KEY não configurado');
          return;
        }

        const token = await getToken(messaging, { vapidKey });
        if (token) {
          const MAX_FCM_TOKENS = 5;
          const userRef = doc(db, 'users', user.id);
          // FIX #1550: usa runTransaction para leitura+escrita atômica do array de tokens
          // sem transaction: dois dispositivos simultâneos podiam exceder o limite de 5
          await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(userRef);
            const currentTokens: string[] = snap.exists()
              ? (snap.data().fcmTokens as string[]) || []
              : [];
            const newTokens = [...new Set([...currentTokens, token])]; // dedup
            if (newTokens.length > MAX_FCM_TOKENS) {
              // mantém os mais recentes (slice do final)
              transaction.update(userRef, { fcmTokens: newTokens.slice(-MAX_FCM_TOKENS) });
            } else {
              transaction.update(userRef, { fcmTokens: arrayUnion(token) });
            }
          });
        }
      }
    } catch (error) {
      logger.error('Erro ao solicitar permissão de notificação:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return { permission, requestPermission, loading, backgroundNotificationTick };
}
