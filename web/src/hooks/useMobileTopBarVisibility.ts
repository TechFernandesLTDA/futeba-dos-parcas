import { createContext, useContext, useLayoutEffect } from 'react';

export type RegisterMobileTopBarOverride = () => () => void;

export const MobileTopBarOverrideContext = createContext<RegisterMobileTopBarOverride | null>(null);

/**
 * Registra que a tela atual já renderiza seu próprio header mobile.
 * Enquanto ativo, o MobileShell oculta a MobileTopBar global para evitar
 * cabeçalhos duplicados em rotas secundárias.
 */
export function useHideMobileTopBar(enabled = true) {
  const registerOverride = useContext(MobileTopBarOverrideContext);

  useLayoutEffect(() => {
    if (!enabled || !registerOverride) return;
    return registerOverride();
  }, [enabled, registerOverride]);
}
