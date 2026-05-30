/**
 * renderWithProviders — helper centralizado de render para testes.
 *
 * Envolve o componente com todos os providers obrigatórios:
 *   - QueryClientProvider (QueryClient com retry:false — sem flakiness em tests)
 *   - ToastProvider
 *   - MemoryRouter (opcional, habilitado por padrão)
 *   - ThemeProvider MUI (createTheme padrão)
 *
 * API idêntica à do @testing-library/react `render`:
 *   renderWithProviders(<MyComponent />, options?)
 *
 * Opções extras:
 *   - withRouter: false    → não envolve com MemoryRouter
 *   - initialEntries       → passa para MemoryRouter
 *   - queryClient          → usa QueryClient customizado em vez do padrão
 *
 * Referência: #2330
 */
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { ToastProvider } from '../contexts/ToastContext';

// Tema MUI padrão para testes — sem customização (consistência)
const defaultTheme = createTheme();

// Cria um QueryClient limpo para cada suíte de testes (retry:false evita
// que falhas de query fiquem retentando e deixem testes pendurados)
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Desabilita o MemoryRouter quando o teste já provê seu próprio router */
  withRouter?: boolean;
  /** Entries passadas ao MemoryRouter */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** QueryClient customizado — útil para inspecionar o cache no teste */
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    withRouter = true,
    initialEntries = ['/'],
    queryClient,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  // Cria um QueryClient fresco por chamada (evita vazamento de estado entre testes)
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    const content = (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ThemeProvider theme={defaultTheme}>
            {children}
          </ThemeProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    if (withRouter) {
      return (
        <MemoryRouter initialEntries={initialEntries}>
          {content}
        </MemoryRouter>
      );
    }

    return content;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * createTestWrapper — retorna um componente wrapper com providers para uso
 * em `renderHook({ wrapper: createTestWrapper() })`.
 *
 * Exemplo:
 *   const { result } = renderHook(() => useMyHook(), {
 *     wrapper: createTestWrapper(),
 *   });
 */
/**
 * createTestWrapper — retorna um componente wrapper com providers para uso
 * em `renderHook({ wrapper: createTestWrapper() })`.
 *
 * Usa apenas QueryClientProvider (sem ToastProvider) porque hook tests que
 * usam useToast já mockam ../contexts/ToastContext individualmente — o
 * ToastProvider real não é necessário para renderHook. #2330
 *
 * Exemplo:
 *   const { result } = renderHook(() => useMyHook(), {
 *     wrapper: createTestWrapper(),
 *   });
 */
export function createTestWrapper() {
  const client = createTestQueryClient();
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

// Re-exporta tudo do @testing-library/react para que os testes possam
// importar screen, waitFor, fireEvent, etc. de um único lugar
export * from '@testing-library/react';
