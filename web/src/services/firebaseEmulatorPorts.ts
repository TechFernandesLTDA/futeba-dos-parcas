function portaDoEmulador(valor: string | undefined, padrao: number): number {
  const porta = Number(valor);
  return Number.isInteger(porta) && porta > 0 && porta < 65536 ? porta : padrao;
}

/**
 * Portas dos emuladores do Firebase. O padrão é o do `firebase.json`; a bateria
 * de testes (scripts/bateria) sobe em portas próprias para não disputar com o
 * E2E do CI no mesmo Mac e informa as dela por `VITE_EMULATOR_*_PORT`.
 */
export const emulatorPorts = {
  auth: portaDoEmulador(import.meta.env.VITE_EMULATOR_AUTH_PORT, 9099),
  firestore: portaDoEmulador(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT, 8085),
  functions: portaDoEmulador(import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT, 5001),
  storage: portaDoEmulador(import.meta.env.VITE_EMULATOR_STORAGE_PORT, 9199),
};
