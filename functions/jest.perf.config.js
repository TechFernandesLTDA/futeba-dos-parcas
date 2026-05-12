/**
 * JEST CONFIG — SUITE DE PERFORMANCE
 *
 * Configuração separada para testes de performance de queries Firestore.
 * Requer emulador Firestore rodando em FIRESTORE_EMULATOR_HOST (padrão: 127.0.0.1:8085).
 *
 * Uso local: npm run test:perf
 * CI: firebase emulators:exec --only firestore 'cd functions && npm run test:perf'
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Apenas os testes de performance
  testMatch: ["**/test/performance/**/*.test.ts"],
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
  },
  clearMocks: true,
  // Sem coverage — foco é em medir performance
  collectCoverage: false,
  verbose: true,
  // Timeout maior para seed de dados e queries contra emulador
  testTimeout: 120_000,
  // forceExit: Firestore connection pool não fecha graciosamente após teardown,
  // causando "import after teardown" race. Pragmatic exit pós-suite encerra tudo.
  forceExit: true,
  // detectOpenHandles ajuda a debugar leaks; manter off em CI pra speed
  detectOpenHandles: false,
};
