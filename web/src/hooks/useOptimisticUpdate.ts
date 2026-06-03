import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

interface OptimisticOptions {
  queryKey: unknown[];
  mutationFn: () => Promise<void>;
  optimisticData: (old: unknown) => unknown;
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticUpdate() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const snapshotRef = useRef<unknown>(null);

  const execute = useCallback(
    async ({ queryKey, mutationFn, optimisticData, successMessage, errorMessage }: OptimisticOptions) => {
      snapshotRef.current = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: unknown) => optimisticData(old));

      try {
        await mutationFn();
        queryClient.invalidateQueries({ queryKey });
        if (successMessage) showSuccess(successMessage);
      } catch {
        queryClient.setQueryData(queryKey, snapshotRef.current);
        showError(errorMessage || t('feedback.optimistic.saveError'));
      }
    },
    [queryClient, showSuccess, showError, t],
  );

  return { execute };
}
