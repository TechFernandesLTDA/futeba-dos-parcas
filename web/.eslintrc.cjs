module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react-refresh'],
  rules: {
    // React Refresh
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // Boas práticas
    'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],

    // Padrões obrigatórios Firestore/Error — detectados em auditoria 2026-05-08 (#601)
    'no-restricted-syntax': [
      'warn',
      {
        // Rule 1: onSnapshot sem 3º argumento de erro (engole erros Firestore silenciosamente)
        // Correto: onSnapshot(q, (snap) => { ... }, (err) => { logger.error(...); showError(...) })
        selector: "CallExpression[callee.name='onSnapshot']:not([arguments.2])",
        message: '`onSnapshot` precisa de 3º argumento para tratar erros Firestore. Ex: `(err) => { logger.error(err); showError(...) }`. Erros silenciosos são bug crítico — vide auditoria #601.',
      },
      {
        // Rule 2: catch com logger.error mas sem feedback ao usuário (showError/setError/throw)
        // Correto: catch(err) { logger.error(...); showError('mensagem') }
        selector: "CatchClause:has(CallExpression[callee.object.name='logger'][callee.property.name='error']):not(:has(CallExpression[callee.name='showError'])):not(:has(CallExpression[callee.name='setError'])):not(:has(CallExpression[callee.property.name='setError'])):not(:has(CallExpression[callee.property.name='current'])):not(:has(CallExpression[callee.name=/^set\w*Error$/])):not(:has(ThrowStatement))",
        message: '`catch { logger.error }` sem `showError`, `setError` ou `throw` engole o erro pro usuário. Adicione feedback UI — vide auditoria #601.',
      },
    ],
  },
  overrides: [
    {
      // Regras de sizing para telas (src/pages/) — #2581
      // TODO: re-enable after fixing remaining violations (~65 warn in 05/2026)
      files: ['src/pages/**/*.tsx'],
      rules: {
        'no-restricted-syntax': [
          'off',
          {
            selector: "JSXOpeningElement[name.name='Container'] JSXAttribute[name.name='maxWidth']",
            message: 'Use `<PageContainer maxWidth="tier">` com tokens de pageTokens.ts. Tiers: focused(xs) | form(md) | list(lg) | detail(lg) | dashboard(xl).',
          },
          {
            selector: "Property[key.name='maxWidth'] > Literal[raw=/^[0-9]+$/]",
            message: 'Use tokens semanticos de pageTokens.ts em vez de larguras numericas hardcoded.',
          },
        ],
      },
    },
  ],
};
