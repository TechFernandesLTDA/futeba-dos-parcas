import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFiles(): void {
  const values = new Map<string, string>();

  for (const file of ['.env.production', '.env', '.env.local', '.env.test']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      values.set(key, value);
    }
  }

  for (const [key, value] of values) {
    process.env[key] ??= value;
  }
}

loadEnvFiles();

// #3869: permite apontar os testes E2E para um host remoto (ex.: produção,
// para validar a emissão do App Check) via E2E_BASE_URL/BASE_URL. Quando o
// alvo é remoto, desligamos o webServer local (vite dev/preview) e o
// globalSetup (que exige o emulador Firebase) — a app já está publicada.
// Sem essas variáveis (CI/local), o comportamento é idêntico ao anterior:
// localhost:5173 + webServer + globalSetup.
const remoteBaseUrl =
  process.env.E2E_BASE_URL ?? process.env.BASE_URL;
const isRemoteTarget =
  !!remoteBaseUrl && !/127\.0\.0\.1|localhost/i.test(remoteBaseUrl);
const baseURL = isRemoteTarget ? remoteBaseUrl! : 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  // Executado uma vez antes de todos os testes:
  // valida emulador + realiza seed dos usuários E2E.
  // Pulado quando o alvo é remoto (produção): não há emulador pra semear.
  globalSetup: isRemoteTarget ? undefined : './e2e/globalSetup.ts',
  globalTimeout: process.env.CI ? 15 * 60 * 1000 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ]
    : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // #3869: só sobe o servidor local (vite dev/preview) quando o alvo é
  // localhost. Em alvo remoto (produção) a app já está publicada e o
  // Playwright navega direto no baseURL configurado acima.
  ...(isRemoteTarget
    ? {}
    : {
        webServer: {
          // No CI usamos o app pré-buildado servido por `vite preview` (estático,
          // baixa memória) em vez de `vite dev` (compila on-the-fly, alta memória).
          // O dev server somado a Java emulators + functions + chromium estourava o
          // runner self-hosted (OOM, exit 137). #2784
          command: process.env.CI
            ? 'npm run preview -- --host 127.0.0.1 --port 5173 --strictPort'
            : 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI,
          timeout: process.env.CI ? 60000 : 30000,
        },
      }),
});
