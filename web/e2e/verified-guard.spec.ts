/**
 * E2E — Guarda de verificação (VerifiedRoute / ProtectedRoute).
 *
 * Valida o perfil PLAYER NÃO verificado (claim `verified=false`, seed
 * e2e-test-player-unverified): qualquer rota protegida fora de
 * /onboarding/* deve redirecionar para o onboarding (phone primeiro —
 * o Auth record do seed não tem phoneNumber), em vez de deixar o
 * usuário bater nas Firestore rules e falhar silenciosamente.
 *
 * Referências: FIX #1024, GAP #7 (#1080), App.tsx ProtectedRoute.
 */
import { test, expect } from './fixtures';

test.describe('E2E — Domínio Acesso — Guarda de verificação (unverified)', () => {
  test('unverified cai direto no onboarding após o login', async ({
    unverifiedPage,
  }) => {
    // A fixture unverifiedPage já termina o login aguardando /onboarding/phone.
    await expect(unverifiedPage).toHaveURL(/\/onboarding\/(phone|cpf)/);
  });

  test('unverified não acessa /game/create — redireciona para onboarding', async ({
    unverifiedPage,
  }) => {
    await unverifiedPage.goto('/game/create');

    // VerifiedRoute/ProtectedRoute intercepta: volta para o onboarding.
    await expect(unverifiedPage).toHaveURL(/\/onboarding\/(phone|cpf)/, {
      timeout: 10000,
    });

    // Tela de verificação de telefone renderizada (não tela de erro).
    await expect(
      unverifiedPage.getByText(/verificar telefone/i)
    ).toBeVisible({ timeout: 10000 });

    // NÃO deve mostrar tela de erro genérica.
    await expect(
      unverifiedPage.getByText(/algo deu errado/i)
    ).toHaveCount(0);
  });

  test('unverified acessa /onboarding/phone sem bloqueio (rota permitida)', async ({
    unverifiedPage,
  }) => {
    await unverifiedPage.goto('/onboarding/phone');

    // Permanece na rota de onboarding — sem redirect e sem erro.
    await expect(unverifiedPage).toHaveURL(/\/onboarding\/phone/, {
      timeout: 10000,
    });
    await expect(
      unverifiedPage.getByText(/verificar telefone/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      unverifiedPage.getByText(/algo deu errado/i)
    ).toHaveCount(0);
  });

  test('player verificado acessa /game/create normalmente', async ({
    playerPage,
  }) => {
    // Contraparte: o fluxo de criação de jogo continua aberto para
    // quem tem verified=true (não regrediu com a guarda).
    await playerPage.goto('/game/create');

    // Não deve ser redirecionado para onboarding nem para login.
    await expect(playerPage).not.toHaveURL(/\/onboarding\//, {
      timeout: 10000,
    });
    await expect(playerPage).not.toHaveURL(/\/login/, { timeout: 10000 });
    await expect(
      playerPage.getByText(/algo deu errado/i)
    ).toHaveCount(0);
  });
});
