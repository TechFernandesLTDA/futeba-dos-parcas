/**
 * globalSetup do Playwright — executado UMA VEZ antes de qualquer teste.
 *
 * Responsabilidades:
 * 1. Validar que os emuladores Firebase estão configurados
 * 2. Executar o seed de usuários E2E no emulador
 * 3. Executar o seed de grupos E2E no emulador (#2532)
 *
 * Referência Playwright:
 * https://playwright.dev/docs/test-global-setup-teardown
 */

import { seedE2EUsers } from '../../scripts/seed-e2e-users';
// seedE2EGroups imported via dynamic import() — o tsconfig CJS do e2e
// não expõe named exports corretamente para scripts fora do rootDir.

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

  // Executa o seed de grupos E2E (#2532) via dynamic import
  // (evita SyntaxError de named export em contexto CJS do Playwright)
  const { seedE2EGroups } = await import('../../scripts/seed-e2e-groups');
  await seedE2EGroups();

  // eslint-disable-next-line no-console
  console.log('[globalSetup] Setup global concluído. Testes podem iniciar.\n');
}
