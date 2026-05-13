import { useState, useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db, messagingPromise } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('useNotificationPermission');

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
    });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

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
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token),
          });
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const tokens: string[] =
              (snap.data()?.fcmTokens as string[]) || [];
            if (tokens.length > MAX_FCM_TOKENS) {
              const tokensToRemove =
                tokens.slice(0, tokens.length - MAX_FCM_TOKENS);
              await updateDoc(userRef, {
                fcmTokens: arrayRemove(...tokensToRemove),
              });
            }
          }
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
