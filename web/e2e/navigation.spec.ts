import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('página inicial pública exibe CTA de login para não autenticados', async ({ page }) => {
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
