import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDirtyGuardResult {
  /** True quando dialog "Descartar mudanças?" deve aparecer. */
  isBlocked: boolean;
  /**
   * Tenta executar uma ação de fechamento/navegação.
   *
   * - Se `isDirty=false`: executa `onConfirmed()` imediatamente.
   * - Se `isDirty=true`: bloqueia + abre dialog. `proceed()` executará a ação
   *   pendente; `cancel()` descarta a tentativa.
   *
   * Substitui o pattern antigo onde o caller tinha que conferir `isBlocked`
   * antes de navegar — agora a decisão é centralizada no hook.
   */
  attemptClose: (onConfirmed: () => void) => void;
  /** Confirma descartar mudanças e executa a ação pendente. */
  proceed: () => void;
  /** Cancela a tentativa de fechamento (volta a editar). */
  cancel: () => void;
}

/**
 * Bloqueia reload/fechamento de aba do browser quando há mudanças não salvas
 * E intercepta tentativas de navegação interna via close button.
 *
 * NOTA HISTÓRICA: a camada de bloqueio de navegação interna via `useBlocker`
 * do react-router foi removida porque exige RouterProvider/createBrowserRouter
 * (DataRouter API). O app usa <BrowserRouter> legacy, e chamar useBlocker fora
 * do DataRouter lança erro síncrono no useContext, derrubando a tela.
 *
 * Para readicionar bloqueio em sidebar/links seria preciso migrar a árvore
 * de rotas pra createBrowserRouter + RouterProvider.
 *
 * Este hook protege:
 * 1. `beforeunload` (fechar aba/reload)
 * 2. Click no botão de fechar do FormScaffold via `attemptClose`
 *
 * NÃO protege: navegação via sidebar / Link / programmatic navigate em
 * outros pontos. Esses caem em `beforeunload` se o user fechar a aba.
 *
 * @param isDirty Se há mudanças não salvas
 */
export function useDirtyGuard(isDirty: boolean): UseDirtyGuardResult {
  const [pendingDecision, setPendingDecision] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const attemptClose = useCallback(
    (onConfirmed: () => void) => {
      if (isDirty) {
        pendingActionRef.current = onConfirmed;
        setPendingDecision(true);
      } else {
        onConfirmed();
      }
    },
    [isDirty]
  );

  const proceed = useCallback(() => {
    setPendingDecision(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  const cancel = useCallback(() => {
    setPendingDecision(false);
    pendingActionRef.current = null;
  }, []);

  return {
    isBlocked: pendingDecision,
    attemptClose,
    proceed,
    cancel,
  };
}
