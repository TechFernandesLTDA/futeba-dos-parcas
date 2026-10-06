import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('página inicial pública exibe CTA de login para não autenticados', async ({ page }) => {
    // Visitante recorrente (flags de onboarding) — sem isso a Home manda para /guide
    await page.addInitScript(() => {
      try {
        localStorage.setItem('pwa_install_prompt_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
        localStorage.setItem('whats_new_last_seen_version', JSON.stringify('999.0.0'));
        localStorage.setItem('appGuideShown', 'true');
        localStorage.setItem('profileSetupComplete', 'true');
      } catch { /* storage indisponível */ }
    });
    // A home é pública por design: não autenticado vê o conteúdo com os
    // CTAs "Entrar"/"Criar conta" (funil de growth) — sem redirect.
    await page.goto('/');
    await expect(page.getByRole('link', { name: /entrar/i })).toBeVisible({ timeout: 10_000 });
  });

  test('should have skip-nav link for accessibility', async ({ page }) => {
    await page.goto('/login');
    const skipNav = page.getByRole('link', { name: /pular para|skip to/i });
    await expect(skipNav).toBeAttached();
  });

  test('should have proper page title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Futeba dos Parças/);
  });
});
