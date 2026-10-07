import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('visitante em / vê a landing pública (sem redirect)', async ({ page }) => {
    // Comportamento atual do produto: "/" é a landing pública de marketing
    // (CTA de cadastro); redirect para /login só em rotas autenticadas.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /futeba dos parças/i })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
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
