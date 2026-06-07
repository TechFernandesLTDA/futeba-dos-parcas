/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  // Exclui testes de performance e integração — requerem emulador Firestore.
  // Rodar via: npm run test:perf (jest.perf.config.js) ou
  // npm run test:integration (jest.integration.config.js)
  testPathIgnorePatterns: ["/node_modules/", "/test/performance/", "/test/integration/", ".integration.test.ts", "presence-notifications.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.json",
      isolatedModules: true,
    }],
  },
  // FIX: @google-cloud/storage e @google-cloud/logging usam ESM exports
  // incompatíveis com CommonJS jest. Stubs globais para tests.
  moduleNameMapper: {
    "^@google-cloud/storage$": "<rootDir>/test/__mocks__/google-cloud-storage.ts",
    "^@google-cloud/logging$": "<rootDir>/test/__mocks__/google-cloud-logging.ts",
    // Handle .js imports in TypeScript files (resolve to .ts)
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  // Reporters explicitos: "lcov" gera coverage/lcov.info, consumido pelo gate
  // de diff-coverage no CI (functions-ci.yml). "text-summary" imprime o resumo
  // no log do CI e "text" mantem o detalhamento por arquivo. Como definir o
  // array SUBSTITUI o default do jest (que ja inclui lcov), listamos todos
  // explicitamente para nao perder os reporters de texto.
  coverageReporters: ["lcov", "text-summary", "text"],
  verbose: true,
};
