import { useEffect } from 'react';

const APP_NAME = 'Futeba dos Parças';

/**
 * Hook para gerenciar o título do documento HTML.
 * Atualiza o title da aba do navegador e restaura ao desmontar.
 *
 * @example
 * useDocumentTitle('Jogos');       // → "Jogos | Futeba dos Parças"
 * useDocumentTitle();              // → "Futeba dos Parças"
 */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
