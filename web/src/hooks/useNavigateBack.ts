import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSectionFallback } from '../config/navItems';

/**
 * FIX #584/M1 + #574: navigate(-1) sem history (acesso direto via URL ou
 * refresh) gera erro "no history" ou tela em branco. Este hook fornece
 * fallback determinístico pra um destino seguro.
 *
 * #2233: quando `fallback` é omitido, o destino é derivado da seção atual via
 * getSectionFallback (ex.: /badges → /?tab=4, /weekly-ranking → /?tab=3), de
 * modo que o Voltar sem history retorne para a seção coerente com a tela —
 * não sempre para Home. Passe um fallback explícito para sobrescrever.
 *
 * Uso:
 *   const goBack = useNavigateBack();            // fallback por seção
 *   const goBack = useNavigateBack('/?tab=4');   // fallback explícito
 *   <IconButton onClick={goBack}>...</IconButton>
 *
 * @param fallback Destino caso não haja history. Default: seção derivada do path.
 */
export function useNavigateBack(fallback?: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    // location.key === 'default' indica primeira entrada na sessão
    // (sem history). Em React Router 6+, key é stable per entry.
    if (location.key === 'default' || window.history.length <= 1) {
      const dest = fallback ?? getSectionFallback(location.pathname);
      navigate(dest, { replace: true });
    } else {
      navigate(-1);
    }
  }, [navigate, location.key, location.pathname, fallback]);
}

/**
 * #1933: Navegação com callback opcional pós-navigate.
 * Centraliza padrão comum de "navigate + ação colateral".
 *
 * Uso:
 *   const navigateWithCallback = useNavigateWithCallback();
 *   navigateWithCallback('/group/123', () => showSuccess('Grupo criado!'));
 */
export function useNavigateWithCallback() {
  const navigate = useNavigate();

  const navigateWithCallback = useCallback((
    to: string,
    callback?: () => void
  ) => {
    navigate(to);
    callback?.();
  }, [navigate]);

  return navigateWithCallback;
}
