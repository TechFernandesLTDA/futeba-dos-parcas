import { useState, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLocalStorage');

/**
 * Hook para gerenciar estado persistido no localStorage.
 * Sincroniza o valor entre React state e localStorage automaticamente.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (err) {
          logger.warn(`Erro ao salvar "${key}" no localStorage:`, err);
        }
        return nextValue;
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (err) {
      logger.warn(`Erro ao remover "${key}" do localStorage:`, err);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
