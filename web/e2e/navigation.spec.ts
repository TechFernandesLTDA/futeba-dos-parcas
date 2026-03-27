import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login|welcome/);
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
