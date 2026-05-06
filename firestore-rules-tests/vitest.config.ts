import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Cada suite roda em isolamento (importante para limpeza do emulador)
    isolate: true,
    // Timeout maior pois o emulador pode ser lento no primeiro request
    testTimeout: 30000,
    hookTimeout: 30000,
    // Execução sequencial — evita conflitos de estado no emulador
    sequence: {
      concurrent: false,
    },
    // Arquivo de configuração do ambiente de teste
    setupFiles: ["./src/setup.ts"],
    // Glob de arquivos de teste
    include: ["src/**/*.test.ts"],
    reporters: ["verbose"],
  },
});
