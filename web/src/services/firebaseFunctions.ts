import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';
import { shouldUseFirebaseEmulators } from './firebaseEmulatorMode';
import { emulatorPorts } from './firebaseEmulatorPorts';

export const functions = getFunctions(app, 'southamerica-east1');

if (shouldUseFirebaseEmulators) {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', emulatorPorts.functions);
  } catch (err) {
    console.warn('[firebase-functions] emulator wiring skipped:', err);
  }
}
