/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
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
  },
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};
