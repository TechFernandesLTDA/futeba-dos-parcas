import {
  deleteToken,
  getMessaging,
  getToken,
  type MessagePayload,
  isSupported,
} from 'firebase/messaging';
import { arrayRemove, doc, runTransaction } from 'firebase/firestore';
import { app, db } from './firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('firebaseMessaging');
const FCM_TOKEN_STORAGE_KEY = 'futeba:web-fcm-token';
const MAX_FCM_TOKENS = 5;
export const FOREGROUND_FCM_EVENT = 'futeba:foreground-fcm';

export const messagingPromise = isSupported().then((supported) =>
  supported ? getMessaging(app) : null
);

function readStoredFcmToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  } catch (error) {
    logger.debug('Failed to read stored FCM token:', error);
    return null;
  }
}

function writeStoredFcmToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    logger.debug('Failed to persist FCM token locally:', error);
  }
}

function getVapidKey() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    logger.warn('VITE_FIREBASE_VAPID_KEY não configurado');
    return null;
  }
  return vapidKey;
}

export async function registerBrowserFcmToken(userId: string) {
  const messaging = await messagingPromise;
  const vapidKey = getVapidKey();

  if (!messaging || !vapidKey) return null;

  const token = await getToken(messaging, { vapidKey });
  if (!token) {
    writeStoredFcmToken(null);
    return null;
  }

  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const currentTokens = snap.exists()
      ? (snap.data().fcmTokens as string[] | undefined) ?? []
      : [];
    const nextTokens = [...new Set([...currentTokens, token])].slice(-MAX_FCM_TOKENS);

    transaction.set(userRef, { fcmTokens: nextTokens }, { merge: true });
  });

  writeStoredFcmToken(token);
  return token;
}

export async function unregisterBrowserFcmToken(userId: string) {
  const messaging = await messagingPromise;
  const storedToken = readStoredFcmToken();
  let tokenToRemove = storedToken;

  if (messaging) {
    const vapidKey = getVapidKey();
    if (vapidKey) {
      try {
        tokenToRemove = await getToken(messaging, { vapidKey }) || storedToken;
      } catch (error) {
        logger.debug('Failed to resolve current FCM token before cleanup:', error);
      }
    }
  }

  if (tokenToRemove) {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const snap = await transaction.get(userRef);
      if (!snap.exists()) return;
      transaction.update(userRef, {
        fcmTokens: arrayRemove(tokenToRemove),
      });
    }).catch((error) => {
      logger.warn('Failed to remove FCM token from Firestore:', error);
    });
  }

  if (messaging) {
    await deleteToken(messaging).catch((error) => {
      logger.warn('Failed to unregister browser FCM token:', error);
    });
  }

  writeStoredFcmToken(null);
}

export function shouldShowForegroundNotification(payload: MessagePayload) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(FOREGROUND_FCM_EVENT, {
      cancelable: true,
      detail: payload,
    });
    const notPrevented = window.dispatchEvent(event);
    if (!notPrevented) {
      return false;
    }
  }

  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false;
  }

  const suppressFromPayload =
    payload.data?.suppress_system_notification === 'true' ||
    payload.data?.suppressSystemNotification === 'true';

  return !suppressFromPayload;
}
