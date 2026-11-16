/**
 * Bateria de testes — portas próprias dos emuladores.
 *
 * NÃO são as portas padrão do `firebase.json` (8085, 9099, 5001, 9199, 4000):
 * o runner self-hosted do CI sobe o E2E Gate nessas, no mesmo Mac. A bateria
 * usa `firebase.bateria.json`, com tudo deslocado e a UI desligada, para os
 * dois poderem rodar ao mesmo tempo.
 *
 * `conferir.ts` falha se este arquivo e o `firebase.bateria.json` divergirem.
 */
export const PORTAS = {
  auth: 19099,
  firestore: 18085,
  functions: 15001,
  storage: 19199,
  hub: 14400,
  logging: 14500,
  /** Servidor de desenvolvimento do web usado pelo Playwright da bateria. */
  web: 5183,
} as const;

export const PORTAS_PADRAO_DO_CI = [8085, 9099, 5001, 9199, 4000, 4400] as const;

export const HOST_LOCAL = '127.0.0.1';
export const hostDe = (servico: keyof typeof PORTAS): string => `${HOST_LOCAL}:${PORTAS[servico]}`;
