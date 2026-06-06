/**
 * globalSetup do Playwright — executado UMA VEZ antes de qualquer teste.
 *
 * Responsabilidades:
 * 1. Validar que os emuladores Firebase estão configurados
 * 2. Executar o seed de dados E2E no emulador (apenas local/dev)
 *
 * Em CI, os seeds já rodam via workflow steps (tsx CLI) antes do Playwright.
 * O globalSetup só executa seeds em ambiente local para conveniência do dev.
 *
 * Referência Playwright:
 * https://playwright.dev/docs/test-global-setup-teardown
 */

export default async function globalSetup(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('\n[globalSetup] Iniciando setup global dos testes E2E...');

  // Validação explícita: o emulador DEVE estar rodando antes dos testes
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      '\n[globalSetup] FIREBASE_AUTH_EMULATOR_HOST não definido.\n' +
      'Inicie o emulador antes de rodar os testes:\n' +
      '  firebase emulators:start --only auth,firestore,functions\n' +
      'E defina a variável:\n' +
      '  export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\n' +
      'Consulte web/e2e/README.md para instruções completas.'
    );
  }

  // Em CI, os seeds já rodam via workflow steps (tsx CLI).
  // Em local, executa seeds para conveniência do dev.
  if (!process.env.CI) {
    // eslint-disable-next-line no-console
    console.log('[globalSetup] Ambiente local — executando seeds...');

    // Dynamic import evita problemas de CJS/ESM interop com scripts .ts
    // quando Playwright carrega o globalSetup em contexto CommonJS.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { seedE2EUsers } = require('../../scripts/seed-e2e-users');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { seedE2EGroups } = require('../../scripts/seed-e2e-groups');

    await seedE2EUsers();
    await seedE2EGroups();
  } else {
    // eslint-disable-next-line no-console
    console.log('[globalSetup] CI detectado — seeds executados pelo workflow.');
  }

  // eslint-disable-next-line no-console
  console.log('[globalSetup] Setup global concluído. Testes podem iniciar.\n');
}
