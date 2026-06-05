/**
 * Configuração Jest para testes de integração com emulador Firebase.
 *
 * Spike #2531: prova que o emulador dispara onInviteRedeemed e que um teste
 * Jest pode observar deterministicamente o member doc resultante.
 *
 * Execução:
 *   firebase emulators:exec --only firestore,functions \
 *     'npx jest -c jest.integration.config.js test/integration/invite-redeemed.spike.test.ts'
 *
 * Diferenças em relação ao jest.config.js padrão:
 * - testMatch aponta para test/integration/
 * - testTimeout mais alto (30 s) — triggers são assíncronos
 * - SEM mock de firebase-admin / firebase-functions/v2/firestore
 *   (o objetivo é bater no emulador real)
 * - moduleNameMapper mantido para @google-cloud/* stubs (evita SyntaxError ESM)
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/integration/**/*.test.ts"],
  testTimeout: 30000,
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.json",
      isolatedModules: true,
    }],
  },
  moduleNameMapper: {
    "^@google-cloud/storage$": "<rootDir>/test/__mocks__/google-cloud-storage.ts",
    "^@google-cloud/logging$": "<rootDir>/test/__mocks__/google-cloud-logging.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  clearMocks: true,
  verbose: true,
};
