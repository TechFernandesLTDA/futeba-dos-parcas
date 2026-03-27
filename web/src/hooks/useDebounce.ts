import { useState, useEffect } from 'react';

/**
 * Hook que atrasa a atualização de um valor até que o usuário pare de digitá-lo.
 * Útil para inputs de busca, evitando chamadas excessivas a cada caractere.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
