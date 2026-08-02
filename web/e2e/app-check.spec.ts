import { test, expect } from '@playwright/test';

/**
 * #3869 — Teste de regressão para emissão de App Check.
 *
 * O App Check só é inicializado quando:
 *   - VITE_RECAPTCHA_SITE_KEY está definido (build-time)
 *   - NÃO estamos em modo emulador
 *
 * Portanto este teste SÓ é significativo contra produção (ou preview build
 * sem emuladores). Em CI/local (localhost + emuladores) ele é PULADO, pois a
 * app não inicializa o App Check e não há o que atestar.
 *
 * Rodar manualmente contra produção (critério de aceite #2 do #3869):
 *   E2E_BASE_URL=https://futebadosparcas.web.app npx playwright test app-check
 *
 * O gate é por host (não localhost) e não depende de VITE_RECAPTCHA_SITE_KEY
 * em runtime — essa variável é build-time e já está no bundle de produção.
 */

// Gate baseado no host alvo: roda somente quando apontamos para um host
// remoto (produção/preview). Em localhost (CI/local) o teste é pulado porque
// a app roda em modo emulador (sem App Check).
const targetBaseUrl =
  process.env.E2E_BASE_URL ?? process.env.BASE_URL;
const isProductionTarget =
  !!targetBaseUrl && !/127\.0\.0\.1|localhost/i.test(targetBaseUrl);

test.describe('App Check regression — #3869', () => {
  // Pula a suite inteira quando o alvo é localhost. Usar test.skip(condicao)
  // dentro do describe é o padrão idiomático do Playwright (e type-safe), em
  // vez de selecionar entre `test` e `test.skip` (que produz união sem
  // `.describe`).
  test.skip(!isProductionTarget, 'Só roda contra host remoto (E2E_BASE_URL)');

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
