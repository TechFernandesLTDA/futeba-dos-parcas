import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBMzIKlfST4gJm3RM3QQXY-N0doVE6vMQE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "futebadosparcas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "futebadosparcas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "futebadosparcas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "490094091078",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:490094091078:web:abcd1234efgh5678",
};

export const app = initializeApp(firebaseConfig);
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
