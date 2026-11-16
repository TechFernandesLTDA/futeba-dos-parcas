import { defineConfig, devices } from '@playwright/test';
import { PORTAS } from '../scripts/bateria/portas';

/**
 * Bateria de testes — Playwright contra o seed do Firebase Emulator Suite.
 *
 * Separada do `playwright.config.ts` (E2E existentes) porque usa outro seed
 * (scripts/bateria/seed-emulador.ts, com 24 contas, grupos e jogos em todos os
 * estados) e porque os testes daqui alteram dados: rodam em série, num worker.
 *
 * Não carrega `.env.production`: a configuração do Firebase é sempre a do
 * projeto demo, e o app só fala com os emuladores (VITE_USE_EMULATOR=true).
 *
 * Um comando: `scripts/bateria/rodar.sh web` (sobe emuladores, semeia e roda).
 * Spec: specs/feat-2026-11-15-bateria-de-testes.md
 */

const porta = Number(process.env.BATERIA_WEB_PORT ?? PORTAS.web);
const baseURL = `http://127.0.0.1:${porta}`;

// Projeto demo: o SDK do Firebase não alcança recurso real com ele.
const ambienteDemo: Record<string, string> = {
  VITE_USE_EMULATOR: 'true',
  // Portas próprias da bateria (scripts/bateria/portas.ts), não as do CI.
  VITE_EMULATOR_AUTH_PORT: String(PORTAS.auth),
  VITE_EMULATOR_FIRESTORE_PORT: String(PORTAS.firestore),
  VITE_EMULATOR_FUNCTIONS_PORT: String(PORTAS.functions),
  VITE_EMULATOR_STORAGE_PORT: String(PORTAS.storage),
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-futebadosparcas.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-futebadosparcas',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-futebadosparcas.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
};

export default defineConfig({
  testDir: './e2e-bateria',
  globalSetup: './e2e-bateria/globalSetup.ts',
  // Os fluxos mudam o estado do seed (entrar em grupo, finalizar jogo, votar).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-bateria', open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${porta} --strictPort`,
    url: baseURL,
    // Sempre um servidor novo: um reaproveitado poderia apontar para outras portas.
    reuseExistingServer: false,
    timeout: 60_000,
    env: ambienteDemo,
  },
});
