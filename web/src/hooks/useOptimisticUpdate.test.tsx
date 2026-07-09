import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

import { useOptimisticUpdate } from './useOptimisticUpdate';

function createDeferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = (reason?: unknown) => rej(reason);
  });
  return { promise, resolve, reject };
}

describe('useOptimisticUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa snapshot isolado por execução quando concorrentes falham em momentos diferentes', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(['items'], ['base']);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const firstMutation = createDeferred();
    const secondMutation = createDeferred();

    const { result } = renderHook(() => useOptimisticUpdate(), { wrapper });

    act(() => {
      void result.current.execute({
        queryKey: ['items'],
        mutationFn: () => firstMutation.promise,
        optimisticData: (old) => [...((old as string[]) ?? []), 'first'],
      });
      void result.current.execute({
        queryKey: ['items'],
        mutationFn: () => secondMutation.promise,
        optimisticData: (old) => [...((old as string[]) ?? []), 'second'],
      });
    });

    expect(queryClient.getQueryData(['items'])).toEqual(['base', 'first', 'second']);

    await act(async () => {
      firstMutation.reject(new Error('first failed'));
      try {
        await firstMutation.promise;
      } catch {
        // expected rejection
      }
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(['items'])).toEqual(['base']);
    });
    expect(mockShowError).toHaveBeenCalledTimes(1);

    await act(async () => {
      secondMutation.resolve();
      await secondMutation.promise;
    });
  });
});
