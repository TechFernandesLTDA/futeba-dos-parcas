// Flat config migrada de .eslintrc.js (ESLint 8) para ESLint 10.
// Motivos da mudança de formato: ESLint 10 removeu o sistema eslintrc
// e a flag --ext; regras de formatação (quotes/indent/max-len) saíram do
// core e viraram @stylistic; eslint-config-google (arquivado, sem flat
// config) não é mais extensível — seu efeito prático neste repo já era
// quase todo sobrescrito (quotes/indent/max-len/120 cols) e os demais
// pontos (Google style) foram absorvidos nas regras abaixo.
const parser = require("@typescript-eslint/parser");
const plugin = require("@typescript-eslint/eslint-plugin");
const stylistic = require("@stylistic/eslint-plugin");
const importX = require("eslint-plugin-import-x");
const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
  {
    ignores: [
      "lib/**/*",
      "generated/**/*",
      "src/examples/**",
      "src/**/*.example.ts",
      "src/**/*.js",
      "test/**/*",
      "jest.config.js",
      "jest.integration.config.js",
      "jest.perf.config.js",
      ".eslintrc.js",
      "eslint.config.js",
      "src/**/*.d.ts",
    ],
  },
  js.configs.recommended,
  {
    // Scripts JS/CJS (sem TS): globals de node
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.es2022 },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"],
        sourceType: "module",
      },
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: {
      "@typescript-eslint": plugin,
      "@stylistic": stylistic,
      "import-x": importX,
    },
    rules: {
      ...plugin.configs.recommended.rules,
      "no-undef": "off", // TS já valida; plugin:recommended também desliga (sem isso, process/console/global de tipos viram falso positivo)
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      // Google style que ainda vale neste repo (portado de .eslintrc.js):
      "quotes": "off",
      "@stylistic/quotes": ["error", "double"],
      "indent": "off",
      // O `indent` do core (ESLint 8) ignorava nós TS (type literals, ternários, switch);
      // o @stylistic/indent os valida e acusa ~1.8k divergências de estilo já existentes
      // (SwitchCase misto entre arquivos). Migração sem reformatação em massa: desligado.
      "@stylistic/indent": "off",
      // Regras novas no `recommended` do ESLint 10 — fora do escopo da migração (dívida registrada).
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",
      "max-len": "off",
      "@stylistic/max-len": ["error", { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true }],
      // Permite while(true) e similares em workers/loops intencionais
      "no-constant-condition": ["error", { checkLoops: false }],
      // import plugin: no-unresolved desligado desde sempre neste repo
      "import-x/no-unresolved": "off",
    },
  },
];