import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';

export const functions = getFunctions(app, 'southamerica-east1');

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_EMULATOR === 'true' &&
  typeof window !== 'undefined'
) {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  } catch (err) {
    console.warn('[firebase-functions] emulator wiring skipped:', err);
  }
}
