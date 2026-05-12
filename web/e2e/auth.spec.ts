/**
 * Testes E2E de autenticação.
 *
 * Inclui tanto testes sem autenticação (usando a `page` padrão do Playwright)
 * quanto smoke tests usando os fixtures de role (playerPage, adminPage, etc.)
 * para validar que o fluxo completo de login funciona por role.
 *
 * Pré-requisito para os testes com fixture:
 *   - Emulador Firebase Auth rodando (FIREBASE_AUTH_EMULATOR_HOST definido)
 *   - VITE_USE_EMULATOR=true no web app
 *   - seed-e2e-users.ts executado (automático via globalSetup)
 *   Consulte web/e2e/README.md para instruções.
 */

import { test as baseTest, expect } from '@playwright/test';
import { test, expect as fixtureExpect } from './fixtures';

// ==========================================
// TESTES SEM AUTENTICAÇÃO (page padrão)
// Validam a UI pública da tela de login.
// ==========================================

baseTest.describe('Authentication — UI pública', () => {
  baseTest('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /login|entrar/i })).toBeVisible();
  });

  baseTest('should show register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /cadastr/i })).toBeVisible();
  });

  baseTest('should navigate from login to register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /cadastr|criar conta/i }).click();
    await expect(page).toHaveURL(/register/);
  });

  baseTest('should show validation errors on empty login submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await expect(page.getByText(/obrigatório|inválido|preencha/i)).toBeVisible();
  });
});

// ==========================================
// SMOKE TESTS COM FIXTURES DE ROLE
// Validam que cada role consegue autenticar
// e acessar a home pós-login.
//
// ATENÇÃO: Estes testes requerem emulador
// Firebase Auth rodando + VITE_USE_EMULATOR=true.
// Consulte web/e2e/README.md#emulator-wiring.
// ==========================================

test.describe('Authentication — fixtures por role (requer emulador)', () => {
  /**
   * Smoke: PLAYER consegue fazer login e é redirecionado para /.
   * Valida o fixture playerPage e o fluxo de autenticação completo.
   */
  test('PLAYER — login bem-sucedido e redirect para home', async ({ playerPage }) => {
    // O fixture já realizou login; verificamos que chegamos na home
    await fixtureExpect(playerPage).toHaveURL('/');

    // Verifica que o usuário está autenticado (não redirecionou de volta para /login)
    await fixtureExpect(playerPage).not.toHaveURL(/login/);
  });

  /**
   * Smoke: FIELD_OWNER consegue fazer login e é redirecionado para /.
   */
  test('FIELD_OWNER — login bem-sucedido e redirect para home', async ({ fieldOwnerPage }) => {
    await fixtureExpect(fieldOwnerPage).toHaveURL('/');
    await fixtureExpect(fieldOwnerPage).not.toHaveURL(/login/);
  });

  /**
   * Smoke: ADMIN consegue fazer login e é redirecionado para /.
   */
  test('ADMIN — login bem-sucedido e redirect para home', async ({ adminPage }) => {
    await fixtureExpect(adminPage).toHaveURL('/');
    await fixtureExpect(adminPage).not.toHaveURL(/login/);
  });
});
