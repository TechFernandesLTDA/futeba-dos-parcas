import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
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
// Firestore com cache local persistente (IndexedDB) — habilita offline reads,
// reduz latência e custos de read em sessões repetidas. Suporta múltiplas abas
// via persistentMultipleTabManager. Inicializado APÓS App Check (acima) pra
// que tokens sejam injetados automaticamente nos requests.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app, 'southamerica-east1');

// Wiring de emuladores para Playwright E2E e dev local (follow-up de #1079).
// Ativa só quando VITE_USE_EMULATOR='true' — produção nunca toca esses hosts.
if (import.meta.env.VITE_USE_EMULATOR === 'true' && typeof window !== 'undefined') {
  const host = '127.0.0.1';
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8085);
    connectStorageEmulator(storage, host, 9199);
    connectFunctionsEmulator(functions, host, 5001);
  } catch (err) {
    // Reconexão silenciosa: HMR pode re-importar o módulo
    console.warn('[firebase] emulator wiring skipped:', err);
  }
}

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
