module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
    "src/examples/**", // Exemplos não compilados
    "src/**/*.example.ts", // Arquivos .example.ts
    "src/**/*.js", // JS scripts não compilados por TS
    "test/**/*", // Testes não seguem Google style
    "jest.config.js", // Config JS sem tsconfig
    "jest.perf.config.js", // Config JS de performance sem tsconfig
    ".eslintrc.js", // Config JS não precisa de lint
    "src/**/*.d.ts", // Arquivos de declaração de tipo apenas
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    // Bump pra 120 — google style 80 é restritivo demais pra TS moderno
    // com tipos longos. Mantém legibilidade sem forçar quebras feias.
    "max-len": ["error", {"code": 120, "ignoreUrls": true, "ignoreStrings": true}],
    // Permite while(true) e similares em workers/loops intencionais
    "no-constant-condition": ["error", {"checkLoops": false}],
  },
};
