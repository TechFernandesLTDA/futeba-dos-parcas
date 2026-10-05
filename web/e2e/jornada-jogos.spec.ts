/**
 * Testes E2E da jornada crítica: login → aba Jogos.
 *
 * Cobre:
 *   1. Acesso público — a home (/?tab=1) é pública: não autenticado vê a aba
 *      Jogos com os CTAs "Entrar"/"Criar conta" (funil de growth).
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
   * A home com a aba Jogos é PÚBLICA (descoberta sem login — funil de growth:
   * landing_viewed → signup_cta_clicked). Não autenticado vê os jogos com os
   * CTAs "Entrar"/"Criar conta" no cabeçalho.
   */
  baseTest('não autenticado — /?tab=1 renderiza aba Jogos pública com CTA de login', async ({ page }) => {
    await page.goto('/?tab=1');

    // Aba Jogos renderiza (não há mais redirect para /login — home pública)
    await expect(page.getByRole('heading', { name: /jogos/i })).toBeVisible({ timeout: 10_000 });

    // CTA de login/cadastro presente no cabeçalho (funil de conversão)
    await expect(page.getByRole('link', { name: /entrar/i })).toBeVisible({ timeout: 10_000 });
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

    // Título da seção (timeout maior: goto recarrega o documento e a
    // restauração de sessão no emulador pode levar >5s no runner)
    await fixtureExpect(
      playerPage.getByRole('heading', { name: /jogos/i })
    ).toBeVisible({ timeout: 10_000 });

    // Aba de filtro "Todos" sempre presente
    await fixtureExpect(
      playerPage.getByRole('tab', { name: /todos/i })
    ).toBeVisible({ timeout: 10_000 });

    // FAB de criação de jogo — o rótulo também aparece no nav desktop
    // ("Criar Jogo"), então pegamos o primeiro match (FAB) sem strict violation
    await fixtureExpect(
      playerPage.getByRole('button', { name: /criar jogo/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  /**
   * PLAYER não verificado — /game/create aciona o guarda VerifiedRoute.
   * O seed cria o usuário dedicado `e2e-test-player-unverified` (custom claim
   * verified=false), portanto a VerifiedRoute deve redirecionar para o
   * onboarding de telefone.
   */
  test('PLAYER não verificado — /game/create redireciona para onboarding', async ({ unverifiedPlayerPage }) => {
    await unverifiedPlayerPage.goto('/game/create');
    await fixtureExpect(unverifiedPlayerPage).toHaveURL(/onboarding/, { timeout: 15_000 });
  });

  /**
   * FIELD_OWNER — aba Jogos renderiza a mesma estrutura.
   * Garante que o chrome da aba não é role-específico.
   */
  test('FIELD_OWNER — aba Jogos exibe título, filtros e FAB', async ({ fieldOwnerPage }) => {
    await fieldOwnerPage.goto('/?tab=1');

    await fixtureExpect(
      fieldOwnerPage.getByRole('heading', { name: /jogos/i })
    ).toBeVisible({ timeout: 10_000 });

    await fixtureExpect(
      fieldOwnerPage.getByRole('tab', { name: /todos/i })
    ).toBeVisible({ timeout: 10_000 });

    await fixtureExpect(
      fieldOwnerPage.getByRole('button', { name: /criar jogo/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
