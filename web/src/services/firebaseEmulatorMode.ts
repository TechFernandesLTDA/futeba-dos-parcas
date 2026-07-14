export interface FirebaseEmulatorEnvironment {
  DEV: boolean;
  MODE: string;
  VITE_USE_EMULATOR?: string;
}

/**
 * Permite emuladores no servidor de desenvolvimento ou em um build E2E
 * explicitamente produzido com `vite build --mode e2e`.
 */
export function isFirebaseEmulatorMode(
  env: FirebaseEmulatorEnvironment,
  isBrowser: boolean,
): boolean {
  return (
    isBrowser &&
    env.VITE_USE_EMULATOR === 'true' &&
    (env.DEV || env.MODE === 'e2e')
  );
}

// Mantém a expressão compilável diretamente pelo Vite/Rolldown. Em um build
// production normal os dois modos abaixo viram `false`, permitindo eliminar o
// wiring e os endpoints de emulador do bundle por dead-code.
export const shouldUseFirebaseEmulators =
  (import.meta.env.DEV || import.meta.env.MODE === 'e2e') &&
  import.meta.env.VITE_USE_EMULATOR === 'true' &&
  typeof window !== 'undefined';
