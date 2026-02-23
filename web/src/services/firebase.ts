import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBMzIKlfST4gJm3RM3QQXY-N0doVE6vMQE",
  authDomain: "futebadosparcas.firebaseapp.com",
  projectId: "futebadosparcas",
  storageBucket: "futebadosparcas.firebasestorage.app",
  messagingSenderId: "490094091078",
  appId: "1:490094091078:web:abcd1234efgh5678"
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
