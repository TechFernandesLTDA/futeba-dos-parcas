import base from './playwright.bateria.config';
import { defineConfig } from '@playwright/test';

/**
 * Passada visual sobre os dados da simulação de uso
 * (scripts/bateria/simulacao). Mesmo servidor e emuladores da bateria;
 * só muda a pasta de testes e o relatório.
 */
export default defineConfig({
  ...base,
  testDir: './e2e-sim',
  timeout: 15 * 60_000,
  reporter: [['list']],
});
