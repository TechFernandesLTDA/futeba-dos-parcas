/**
 * Jest config para testes de integração contra emulador Firestore.
 *
 * Usado pelo CI test-harness (#2533) para rodar:
 *   npx jest --config jest.integration.config.js
 *
 * Requer FIRESTORE_EMULATOR_HOST definido (padrão 127.0.0.1:8085).
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: [
    '<rootDir>/test/**/*.integration.test.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  setupFilesAfterSetup: [],
  testTimeout: 30000,
  verbose: true,
  // Não coletar coverage — testes de integração medem
  // comportamento, não coverage de linha
  collectCoverage: false,
};
