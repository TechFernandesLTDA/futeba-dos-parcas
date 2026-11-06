import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Herda a config do Vite (plugins, aliases, bloco `test`) e só ajusta o que
// é específico de execução de testes. Em máquina carregada (CI, dev com
// outros processos), testes de render pesado passam de 5 s do default do
// Vitest; 15 s dá folga sem esconder travamentos de verdade.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      testTimeout: 15_000,
    },
  }),
);
