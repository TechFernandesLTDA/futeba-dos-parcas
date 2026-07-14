import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { shouldUseFirebaseEmulators } from './firebaseEmulatorMode';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingKeys.length > 0) {
  throw new Error(`Missing Firebase config env vars: ${missingKeys.join(', ')}`);
}

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
  if (recaptchaKey && !shouldUseFirebaseEmulators) {
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
  } else if (import.meta.env.DEV && !shouldUseFirebaseEmulators) {
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

// O modo `e2e` permite preview otimizado; builds normais continuam imunes a um
// VITE_USE_EMULATOR vazado porque o helper também exige DEV ou MODE=e2e.
if (shouldUseFirebaseEmulators) {
  const host = '127.0.0.1';
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8085);
  } catch (err) {
    // Reconexão silenciosa: HMR pode re-importar o módulo
    console.warn('[firebase] emulator wiring skipped:', err);
  }
}

// Google Provider config
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
