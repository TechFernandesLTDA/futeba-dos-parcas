import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';

interface UseDirtyGuardResult {
  isBlocked: boolean;
  proceed: () => void;
  cancel: () => void;
}

/**
 * Bloqueia navegação (router + reload/close) quando há mudanças não salvas.
 *
 * Camadas:
 * 1. useBlocker: intercepta navegação interna do React Router
 * 2. beforeunload: intercepta reload/fechamento de aba do browser
 *
 * O caller deve renderizar um Dialog quando isBlocked=true e chamar
 * proceed() para confirmar saída ou cancel() para abortar.
 *
 * @param isDirty Se há mudanças não salvas
 */
export function useDirtyGuard(isDirty: boolean): UseDirtyGuardResult {
  // Callback precisa ser estável entre renders — caso contrário useBlocker
  // re-registra a cada render e dispara loop "Maximum update depth exceeded"
  // (React error 301), capturado pelo ErrorBoundary como "Oops!".
  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => {
      return isDirty && currentLocation.pathname !== nextLocation.pathname;
    },
    [isDirty]
  );
  const blocker = useBlocker(shouldBlock);

  const [pendingDecision, setPendingDecision] = useState(false);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setPendingDecision(true);
    }
  }, [blocker.state]);

  // Camada 2: reload/close de aba do browser
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
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const cancel = useCallback(() => {
    setPendingDecision(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  return {
    isBlocked: pendingDecision,
    proceed,
    cancel,
  };
}
