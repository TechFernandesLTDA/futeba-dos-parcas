import { getMessaging, isSupported } from 'firebase/messaging';
import { app } from './firebase';

export const messagingPromise = isSupported().then((supported) =>
  supported ? getMessaging(app) : null
);
