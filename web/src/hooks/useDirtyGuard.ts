import { useCallback, useEffect, useState } from 'react';

interface UseDirtyGuardResult {
  isBlocked: boolean;
  proceed: () => void;
  cancel: () => void;
}

/**
 * Bloqueia reload/fechamento de aba do browser quando há mudanças não salvas.
 *
 * NOTA: a camada de bloqueio de navegação interna (useBlocker do react-router)
 * foi removida porque exige RouterProvider/createBrowserRouter (DataRouter API).
 * O app usa <BrowserRouter> legacy, e chamar useBlocker fora do DataRouter
 * lança erro síncrono no useContext, derrubando a tela com ErrorBoundary
 * (sintoma: "Oops!" em /game/create e /group/create em desktop).
 *
 * Para readicionar o bloqueio interno seria preciso migrar a árvore de rotas
 * pra createBrowserRouter + RouterProvider.
 *
 * O caller pode renderizar um Dialog quando isBlocked=true (atualmente nunca
 * acontece, mantido pra compatibilidade da interface) e chamar proceed/cancel.
 *
 * @param isDirty Se há mudanças não salvas
 */
export function useDirtyGuard(isDirty: boolean): UseDirtyGuardResult {
  const [pendingDecision, setPendingDecision] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const proceed = useCallback(() => {
    setPendingDecision(false);
  }, []);

  const cancel = useCallback(() => {
    setPendingDecision(false);
  }, []);

  return {
    isBlocked: pendingDecision,
    proceed,
    cancel,
  };
}
