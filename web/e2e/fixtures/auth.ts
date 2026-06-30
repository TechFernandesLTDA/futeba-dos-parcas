/**
 * Funções auxiliares de autenticação para testes E2E Playwright.
 *
 * Cada função recebe uma `Page` do Playwright, navega até /login,
 * preenche as credenciais do usuário de teste correspondente ao role
 * e aguarda o redirecionamento pós-login.
 *
 * Pré-requisito:
 * - Emulador Firebase Auth rodando (FIREBASE_AUTH_EMULATOR_HOST definido)
 * - Web app apontando para o emulador (VITE_USE_EMULATOR=true)
 * - seed-e2e-users.ts executado via globalSetup
 * - Arquivo web/.env.test com as credenciais configuradas
 *
 * Consulte web/e2e/README.md para instruções completas de setup.
 */

import { Page } from '@playwright/test';

// ==========================================
// CREDENCIAIS DOS USUÁRIOS DE TESTE
// Lidas das variáveis de ambiente definidas
// em web/.env.test (nunca hardcoded).
// ==========================================

interface TestCredentials {
  email: string;
  password: string;
}

function getCredentials(
  emailVar: string,
  passwordVar: string,
  roleName: string
): TestCredentials {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];

  if (!email || !password) {
    throw new Error(
      `[fixtures/auth] Variáveis de ambiente ausentes para o role ${roleName}.\n` +
      `Defina ${emailVar} e ${passwordVar} em web/.env.test.\n` +
      'Consulte web/.env.test.example para o template.'
    );
  }

  return { email, password };
}

// ==========================================
// AÇÃO DE LOGIN COMPARTILHADA
// ==========================================

/**
 * Realiza login via formulário na página /login e aguarda
 * o redirecionamento para a home (/).
 *
 * Os seletores são baseados nos atributos do LoginScreen.tsx:
 * - Form aria-label="Entrar"
 * - TextField label="Email"
 * - TextField label="Senha"
 * - Button type="submit" com texto "Entrar"
 */
async function performLogin(page: Page, credentials: TestCredentials): Promise<void> {
  await page.goto('/login');

  // Aguarda o formulário estar visível antes de interagir
  const loginForm = page.locator('form[aria-label="Entrar"]');
  await loginForm.waitFor({ state: 'visible' });

  // Preenche email usando o label do TextField MUI
  await loginForm.getByRole('textbox', { name: 'Email' }).fill(credentials.email);

  // Preenche senha sem confundir com o botão "Mostrar senha".
  await loginForm.getByRole('textbox', { name: 'Senha' }).fill(credentials.password);

  // Submete o formulário clicando no botão "Entrar"
  await loginForm.getByRole('button', { name: 'Entrar' }).click();

  // Aguarda redirecionamento para a home — resolveRedirect() retorna '/' por default
  await page.waitForURL('/');
}

// ==========================================
// FUNÇÕES PÚBLICAS POR ROLE
// ==========================================

/**
 * Autentica como usuário com role PLAYER.
 * Credenciais lidas de VITE_TEST_PLAYER_EMAIL / VITE_TEST_PLAYER_PASSWORD.
 */
export async function loginAsPlayer(page: Page): Promise<void> {
  const credentials = getCredentials(
    'VITE_TEST_PLAYER_EMAIL',
    'VITE_TEST_PLAYER_PASSWORD',
    'PLAYER'
  );
  await performLogin(page, credentials);
}

/**
 * Autentica como usuário com role FIELD_OWNER.
 * Credenciais lidas de VITE_TEST_FIELD_OWNER_EMAIL / VITE_TEST_FIELD_OWNER_PASSWORD.
 */
export async function loginAsFieldOwner(page: Page): Promise<void> {
  const credentials = getCredentials(
    'VITE_TEST_FIELD_OWNER_EMAIL',
    'VITE_TEST_FIELD_OWNER_PASSWORD',
    'FIELD_OWNER'
  );
  await performLogin(page, credentials);
}

/**
 * Autentica como usuário com role ADMIN.
 * Credenciais lidas de VITE_TEST_ADMIN_EMAIL / VITE_TEST_ADMIN_PASSWORD.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const credentials = getCredentials(
    'VITE_TEST_ADMIN_EMAIL',
    'VITE_TEST_ADMIN_PASSWORD',
    'ADMIN'
  );
  await performLogin(page, credentials);
}
