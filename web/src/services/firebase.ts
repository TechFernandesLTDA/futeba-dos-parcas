import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBMzIKlfST4gJm3RM3QQXY-N0doVE6vMQE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "futebadosparcas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "futebadosparcas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "futebadosparcas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "490094091078",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:490094091078:web:2a2bb9d9048da03cb5a347",
};

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (err) {
  console.error('Firebase initialization failed:', err);
  throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
}

export { app };

// App Check — DEVE ser inicializado ANTES dos outros services (auth,
// firestore, functions) pra que SDK injete tokens automaticamente.
export let appCheck: ReturnType<typeof initializeAppCheck> | null = null;
if (typeof window !== 'undefined') {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (recaptchaKey) {
    try {
      // Em desenvolvimento, habilita token de debug para testes locais
      if (import.meta.env.DEV) {
        (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn('App Check initialization failed:', err);
    }
  } else if (import.meta.env.DEV) {
    console.warn('App Check not configured');
  }
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Messaging (optional, only in supported browsers)
export const messagingPromise = isSupported().then(supported => 
  supported ? getMessaging(app) : null
);

// Google Provider config
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
