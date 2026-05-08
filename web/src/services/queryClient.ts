import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton do QueryClient compartilhado entre App.tsx e AuthContext.tsx.
 * Exportado para permitir limpeza de cache no logout e evitar vazamento
 * de dados entre contas no mesmo browser.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});
