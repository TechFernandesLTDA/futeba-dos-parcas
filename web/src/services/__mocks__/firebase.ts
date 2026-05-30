/**
 * Mock automático de services/firebase para testes.
 *
 * Evita o erro "Missing Firebase config env vars" que ocorre quando testes
 * importam (direta ou transitivamente) services/firebase.ts sem configurar
 * variáveis de ambiente do Firebase. #2330
 *
 * Vitest usa este arquivo automaticamente quando testes chamam
 * vi.mock('../services/firebase') ou vi.mock('../../services/firebase').
 * Para mocks automáticos sem chamada explícita, adicionar ao vitest.config
 * ou usar globalSetup.
 */

export const db = {};
export const auth = { currentUser: null };
export const storage = {};
export const functions = {};
export const app = {};
export const appCheck = null;
export const messagingPromise = Promise.resolve(null);

// Stubs para funções que podem ser chamadas no setup
export const googleProvider = {};
