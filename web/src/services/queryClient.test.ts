import { afterEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { queryClient } from './queryClient';

describe('queryClient (singleton)', () => {
  afterEach(() => {
    queryClient.removeQueries();
  });

  it('exporta um QueryClient', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('usa staleTime de 5 minutos e 1 retry por padrão nas queries', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5);
    expect(defaults.queries?.retry).toBe(1);
  });

  it('não define defaults de mutation (herda o comportamento do React Query)', () => {
    expect(queryClient.getDefaultOptions().mutations).toBeUndefined();
  });

  it('é o mesmo singleton em imports repetidos (cache compartilhado App/AuthContext)', async () => {
    const { queryClient: deNovo } = await import('./queryClient');
    expect(deNovo).toBe(queryClient);
  });

  it('armazena e recupera dados por queryKey', () => {
    queryClient.setQueryData(['grupos', 'g1'], { nome: 'Pelada' });
    expect(queryClient.getQueryData(['grupos', 'g1'])).toEqual({ nome: 'Pelada' });

    queryClient.removeQueries({ queryKey: ['grupos', 'g1'] });
    expect(queryClient.getQueryData(['grupos', 'g1'])).toBeUndefined();
  });

  it('removeQueries limpa todo o cache (fluxo de logout, sem vazamento entre contas)', () => {
    queryClient.setQueryData(['a'], 1);
    queryClient.setQueryData(['b'], 2);
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    queryClient.removeQueries();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
