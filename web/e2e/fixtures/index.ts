/**
 * Fixtures Playwright estendidas com páginas autenticadas por role.
 *
 * Uso nos specs:
 *
 *   import { test, expect } from '../fixtures';
 *
 *   test('admin vê painel', async ({ adminPage }) => {
 *     await adminPage.goto('/admin');
 *     await expect(adminPage.getByText('Dashboard')).toBeVisible();
 *   });
 *
 * Fixtures disponíveis:
 * - playerPage     — página autenticada como PLAYER
 * - fieldOwnerPage — página autenticada como FIELD_OWNER
 * - adminPage      — página autenticada como ADMIN
 *
 * Cada fixture cria uma `page` isolada, realiza login e
 * salva o estado de storage para reúso dentro do mesmo worker.
 */

import { test as base, Page } from '@playwright/test';
import { loginAsPlayer, loginAsFieldOwner, loginAsAdmin, loginAsUnverifiedPlayer } from './auth';

// ==========================================
// TIPOS DAS FIXTURES ESTENDIDAS
// ==========================================

interface AuthFixtures {
  /** Página autenticada com role PLAYER. */
  playerPage: Page;
  /** Página autenticada com role FIELD_OWNER. */
  fieldOwnerPage: Page;
  /** Página autenticada com role ADMIN. */
  adminPage: Page;
  /** Página autenticada como PLAYER sem custom claim `verified`. */
  unverifiedPlayerPage: Page;
}

// ==========================================
// EXTENSÃO DO test BASE DO PLAYWRIGHT
// ==========================================

export const test = base.extend<AuthFixtures>({
  /**
   * Fixture playerPage: abre contexto isolado e autentica como PLAYER.
   * O estado de autenticação persiste durante o teste mas é descartado
   * ao final, garantindo isolamento entre specs.
   */
  playerPage: async ({ browser, baseURL }, use) => {
    // Contexto isolado para não vazar estado entre fixtures de roles diferentes
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await loginAsPlayer(page);

    // Cede a página autenticada para o corpo do teste
    await use(page);

    // Cleanup: fecha o contexto após o teste
    await context.close();
  },

  /**
   * Fixture fieldOwnerPage: abre contexto isolado e autentica como FIELD_OWNER.
   */
  fieldOwnerPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await loginAsFieldOwner(page);

    await use(page);

    await context.close();
  },

  /**
   * Fixture adminPage: abre contexto isolado e autentica como ADMIN.
   */
  adminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await loginAsAdmin(page);

    await use(page);

    await context.close();
  },
  /**
   * Fixture unverifiedPlayerPage: abre contexto isolado e autentica como
   * PLAYER sem o custom claim `verified` (para validar VerifiedRoute).
   */
  unverifiedPlayerPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await loginAsUnverifiedPlayer(page);

    await use(page);

    await context.close();
  },
});

// Re-exporta `expect` para que os specs possam importar tudo de um lugar só
export { expect } from '@playwright/test';
