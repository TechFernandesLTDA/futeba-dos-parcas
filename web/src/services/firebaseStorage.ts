import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { app } from './firebase';

export const storage = getStorage(app);
// O SDK tenta uploads falhos por 10 minutos por padrão, sem necessariamente
// emitir progresso/erro. Em redes móveis isso aparenta congelamento. Mantemos
// retry suficiente para oscilações curtas e deixamos o helper fazer fallback.
storage.maxUploadRetryTime = 30_000;

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
