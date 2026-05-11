import { useState, useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
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
          // Salvar token no Firestore usando arrayUnion
          // e limitar o array a 5 tokens para evitar
          // crescimento ilimitado (#921)
          const MAX_FCM_TOKENS = 5;
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token),
          });
          // Verificar se ultrapassou o limite e remover
          // tokens mais antigos (além do novo)
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const tokens: string[] =
              (snap.data()?.fcmTokens as string[]) || [];
            if (tokens.length > MAX_FCM_TOKENS) {
              // Remover tokens excedentes (os mais antigos,
              // que são os primeiros no array)
              const tokensToRemove =
                tokens.slice(0, tokens.length - MAX_FCM_TOKENS);
              for (const oldToken of tokensToRemove) {
                await updateDoc(userRef, {
                  fcmTokens: arrayRemove(oldToken),
                });
              }
            }
          }
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
