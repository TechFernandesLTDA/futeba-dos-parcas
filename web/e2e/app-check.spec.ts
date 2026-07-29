import { test, expect } from '@playwright/test';

/**
 * #3869 — Teste de regressão para emissão de App Check.
 *
 * O App Check só é inicializado quando:
 *   - VITE_RECAPTCHA_SITE_KEY está definido
 *   - NÃO estamos em modo emulador
 *
 * Portanto este teste SÓ é significativo contra produção (ou preview build
 * sem emuladores). Em CI local (localhost:5173 + emuladores) ele é pulado.
 *
 * Rodar manualmente contra produção:
 *   BASE_URL=https://futebadosparcas.web.app npx playwright test app-check
 *
 * Critério de aceite #2 do #3869: "Validar emissão de token em
 * futebadosparcas.web.app e domínios customizados".
 */

const isProductionTarget = !process.env.VITE_USE_FIREBASE_EMULATORS &&
  !!process.env.VITE_RECAPTCHA_SITE_KEY;

const testSuite = isProductionTarget ? test : test.skip;

testSuite.describe('App Check regression — #3869', () => {
  test('login page não emite appCheck/fetch-status-error no console', async ({ page }) => {
    const appCheckErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        msg.type() === 'error' &&
        (text.includes('appCheck/fetch-status-error') ||
          text.includes('app/missing') ||
          text.includes('[firebase/app-check]'))
      ) {
        appCheckErrors.push(text);
      }
    });

    await page.goto('/login');
    // Dá tempo para o SDK inicializar App Check e tentar a atestação.
    await page.waitForTimeout(3000);

    expect(appCheckErrors, `App Check errors detectados:\n${appCheckErrors.join('\n')}`).toEqual([]);
  });
});
