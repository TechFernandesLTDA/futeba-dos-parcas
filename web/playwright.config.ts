import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Executado uma vez antes de todos os testes:
  // valida emulador + realiza seed dos usuários E2E
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:5173',
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
    command: process.env.CI ? 'npm run preview -- --port 5173 --strictPort' : 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 60000 : 30000,
  },
});
