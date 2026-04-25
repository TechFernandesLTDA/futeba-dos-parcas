import { useState, useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, messagingPromise } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('useNotificationPermission');

export function useNotificationPermission() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [loading, setLoading] = useState(false);

  // Escutar notificações em foreground
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
          // Salvar token no Firestore
          await updateDoc(doc(db, 'users', user.id), {
            fcmTokens: arrayUnion(token),
          });
        }
      }
    } catch (error) {
      logger.error('Erro ao solicitar permissão de notificação:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return { permission, requestPermission, loading };
}
