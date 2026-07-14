import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';
import { shouldUseFirebaseEmulators } from './firebaseEmulatorMode';

export const functions = getFunctions(app, 'southamerica-east1');

if (shouldUseFirebaseEmulators) {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  } catch (err) {
    console.warn('[firebase-functions] emulator wiring skipped:', err);
  }
}
