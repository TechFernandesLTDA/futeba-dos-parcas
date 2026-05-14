/**
 * globalSetup do Playwright — executado UMA VEZ antes de qualquer teste.
 *
 * Responsabilidades:
 * 1. Validar que o emulador Firebase Auth está configurado
 * 2. Executar o seed de usuários E2E no emulador
 *
 * Referência Playwright:
 * https://playwright.dev/docs/test-global-setup-teardown
 */

import { seedE2EUsers } from '../../scripts/seed-e2e-users';

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

  // Executa o seed dos usuários de teste no emulador
  await seedE2EUsers();

  // eslint-disable-next-line no-console
  console.log('[globalSetup] Setup global concluído. Testes podem iniciar.\n');
}
