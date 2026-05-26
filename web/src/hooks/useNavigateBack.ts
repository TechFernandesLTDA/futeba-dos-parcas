import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * FIX #584/M1 + #574: navigate(-1) sem history (acesso direto via URL ou
 * refresh) gera erro "no history" ou tela em branco. Este hook fornece
 * fallback determinístico pra um destino seguro.
 *
 * Uso:
 *   const goBack = useNavigateBack('/');
 *   <IconButton onClick={goBack}>...</IconButton>
 *
 * @param fallback Destino caso não haja history (default: '/').
 */
export function useNavigateBack(fallback: string = '/') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    // location.key === 'default' indica primeira entrada na sessão
    // (sem history). Em React Router 6+, key é stable per entry.
    if (location.key === 'default' || window.history.length <= 1) {
      navigate(fallback, { replace: true });
    } else {
      navigate(-1);
    }
  }, [navigate, location.key, fallback]);
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
