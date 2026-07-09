import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { registerBrowserFcmToken, shouldShowForegroundNotification } from '../services/firebaseMessaging';
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showError } = useToast();
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
            if (
              Notification.permission === 'granted' &&
              payload.notification &&
              shouldShowForegroundNotification(payload)
            ) {
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
        await registerBrowserFcmToken(user.id);
      } else if (result === 'denied') {
        showError(t('feedback.notifications.permissionDenied'));
      }
    } catch (error) {
      logger.error('Erro ao solicitar permissão de notificação:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, t, user?.id]);

  return { permission, requestPermission, loading, backgroundNotificationTick };
}
