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

export default defineConfig({
  testDir: './e2e',
  // Executado uma vez antes de todos os testes:
  // valida emulador + realiza seed dos usuários E2E
  globalSetup: './e2e/globalSetup.ts',
  // Impede que travas fora do ciclo de timeout de um teste ocupem o runner até
  // o timeout externo do job. Localmente, 0 preserva a execução sem limite.
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
    baseURL: 'http://127.0.0.1:5173',
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
});
