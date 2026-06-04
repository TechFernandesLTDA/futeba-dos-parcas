/**
 * Testes E2E da jornada crítica: login → aba Jogos.
 *
 * Cobre:
 *   1. Acesso público — usuário não autenticado é redirecionado para /login
 *      ao tentar acessar a home (/?tab=1).
 *   2. PLAYER autenticado — aba Jogos renderiza corretamente (título, filtros,
 *      FAB "Criar Jogo") mesmo sem jogos criados (estado vazio esperado).
 *   3. Guarda VerifiedRoute — PLAYER não verificado (sem telefone/CPF) é
 *      redirecionado para /onboarding/phone ao tentar acessar /game/create.
 *   4. FIELD_OWNER autenticado — mesma estrutura da aba Jogos.
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
// Validam comportamento público antes do login.
// ==========================================

baseTest.describe('Jornada Jogos — UI pública', () => {
  /**
   * Usuário não autenticado que tenta acessar a home
   * deve ser redirecionado para /login.
   */
  baseTest('não autenticado — /?tab=1 redireciona para login', async ({ page }) => {
    await page.goto('/?tab=1');
    await expect(page).toHaveURL(/login/);
  });

  /**
   * Usuário não autenticado que tenta acessar /game/create
   * deve ser redirecionado para /login (AuthRoute protege antes da VerifiedRoute).
   */
  baseTest('não autenticado — /game/create redireciona para login', async ({ page }) => {
    await page.goto('/game/create');
    await expect(page).toHaveURL(/login/);
  });
});

// ==========================================
// JORNADA CRÍTICA COM FIXTURES DE ROLE
// Valida a jornada completa login → aba Jogos
// e o guarda VerifiedRoute para criação de jogo.
//
// ATENÇÃO: Estes testes requerem emulador
// Firebase Auth rodando + VITE_USE_EMULATOR=true.
// Consulte web/e2e/README.md#emulator-wiring.
// ==========================================

test.describe('Jornada Jogos — fixtures por role (requer emulador)', () => {
  /**
   * PLAYER — aba Jogos renderiza estrutura correta.
   * Valida: título h6 "Jogos", aba de filtro "Todos" e FAB "Criar Jogo".
   * O seed não cria jogos, portanto o estado vazio deve ser renderizado
   * sem erros (não há asserção de conteúdo vazio — só estrutura chrome).
   */
  test('PLAYER — aba Jogos exibe título, filtros e FAB', async ({ playerPage }) => {
    // Navega diretamente para a aba Jogos (viewport-agnóstico — evita clicar em nav chrome)
    await playerPage.goto('/?tab=1');

    // Título da seção
    await fixtureExpect(
      playerPage.getByRole('heading', { name: /jogos/i })
    ).toBeVisible();

    // Aba de filtro "Todos" sempre presente
    await fixtureExpect(
      playerPage.getByRole('tab', { name: /todos/i })
    ).toBeVisible();

    // FAB de criação de jogo sempre visível para PLAYER
    await fixtureExpect(
      playerPage.getByRole('button', { name: /criar jogo/i })
    ).toBeVisible();
  });

  /**
   * PLAYER não verificado — /game/create aciona o guarda VerifiedRoute.
   * O seed cria o usuário sem phone_verified/cpf_verified, portanto
   * a VerifiedRoute deve redirecionar para o onboarding de telefone.
   */
  test('PLAYER não verificado — /game/create redireciona para onboarding', async ({ playerPage }) => {
    await playerPage.goto('/game/create');
    await playerPage.waitForURL(/onboarding/);
    await fixtureExpect(playerPage).toHaveURL(/onboarding/);
  });

  /**
   * FIELD_OWNER — aba Jogos renderiza a mesma estrutura.
   * Garante que o chrome da aba não é role-específico.
   */
  test('FIELD_OWNER — aba Jogos exibe título, filtros e FAB', async ({ fieldOwnerPage }) => {
    await fieldOwnerPage.goto('/?tab=1');

    await fixtureExpect(
      fieldOwnerPage.getByRole('heading', { name: /jogos/i })
    ).toBeVisible();

    await fixtureExpect(
      fieldOwnerPage.getByRole('tab', { name: /todos/i })
    ).toBeVisible();

    await fixtureExpect(
      fieldOwnerPage.getByRole('button', { name: /criar jogo/i })
    ).toBeVisible();
  });
});
