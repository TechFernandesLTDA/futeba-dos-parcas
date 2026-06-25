import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { app } from './firebase';

export const storage = getStorage(app);

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_EMULATOR === 'true' &&
  typeof window !== 'undefined'
) {
  try {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  } catch (err) {
    console.warn('[firebase-storage] emulator wiring skipped:', err);
  }
}
