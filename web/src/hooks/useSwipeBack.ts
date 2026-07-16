import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSectionFallback } from '../config/navItems';
import { useReducedMotion } from './useReducedMotion';

interface UseSwipeBackOptions {
  /** Desabilita o gesto (ex.: em telas raiz onde não há para onde voltar). */
  disabled?: boolean;
  /** Distância máxima da borda esquerda para iniciar o gesto (px). Default 30. */
  edgeThreshold?: number;
  /** Distância horizontal mínima para confirmar o "voltar" (px). Default 80. */
  distanceThreshold?: number;
}

function asElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}

/**
 * Evita que o gesto global roube interações horizontais locais. O atributo de
 * opt-out cobre componentes cujo overflow não é mensurável no touchstart
 * (carrosséis virtualizados, por exemplo).
 */
export function shouldIgnoreSwipeBackTarget(target: EventTarget | null): boolean {
  let element = asElement(target);

  while (element && element !== document.documentElement) {
    if (element.hasAttribute('data-swipe-back-ignore')) return true;

    const styles = window.getComputedStyle(element);
    const touchAction = styles.getPropertyValue('touch-action') || styles.touchAction;
    if (touchAction.split(/\s+/).includes('pan-x')) return true;

    const overflowX = styles.overflowX;
    const canScrollHorizontally =
      (overflowX === 'auto' || overflowX === 'scroll') &&
      element.scrollWidth > element.clientWidth;
    if (canScrollHorizontally) return true;

    element = element.parentElement;
  }

  return false;
}

/**
 * #2194: gesto de swipe-back (arrastar da borda esquerda → direita) para
 * paridade com a navegação nativa iOS/Android no mobile web.
 *
 * #2722: visual feedback durante o arraste — expõe `dragProgress` (0–1) e
 * `isSwiping` para que o shell aplique transform/opacity live. Gateado por
 * prefers-reduced-motion (retorna 0 se reduzido).
 *
 * Regras:
 * - Só inicia se o toque começar perto da borda esquerda (edgeThreshold).
 * - Confirma o voltar apenas se o movimento horizontal exceder
 *   distanceThreshold E for predominantemente horizontal (evita conflito com
 *   scroll vertical).
 * - Ignora multitouch e gestos quando `disabled` (ex.: telas raiz).
 * - Se não houver history (deep link direto), navega para o fallback da seção.
 *
 * Integra com react-router via navigate(-1) com proteção anti-no-history.
 */
export function useSwipeBack({
  disabled = false,
  edgeThreshold = 30,
  distanceThreshold = 80,
}: UseSwipeBackOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Sem listeners: evita um swipe invisível que navega de surpresa para quem
    // pediu redução de movimento (#3768).
    if (disabled || reducedMotion) return;

    const cleanup = () => {
      trackingRef.current = false;
      startXRef.current = null;
      startYRef.current = null;
      setIsSwiping(false);
      setDragProgress(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || shouldIgnoreSwipeBackTarget(e.target)) {
        trackingRef.current = false;
        return;
      }
      const touch = e.touches[0];
      if (touch.clientX <= edgeThreshold) {
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        trackingRef.current = true;
      } else {
        trackingRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || startXRef.current === null || startYRef.current === null) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = Math.abs(touch.clientY - startYRef.current);

      if (dx > 0 && dx > dy * 1.5) {
        setIsSwiping(true);
        setDragProgress(Math.min(1, dx / distanceThreshold));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        cleanup();
        return;
      }
      if (!trackingRef.current || startXRef.current === null || startYRef.current === null) {
        cleanup();
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;
      cleanup();

      if (dx > distanceThreshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (location.key === 'default' || window.history.length <= 1) {
          navigate(getSectionFallback(location.pathname), { replace: true });
        } else {
          navigate(-1);
        }
      }
    };

    const onTouchCancel = () => {
      cleanup();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      cleanup();
    };
  }, [disabled, edgeThreshold, distanceThreshold, navigate, location.key, location.pathname, reducedMotion]);

  return { isSwiping, dragProgress: reducedMotion ? 0 : dragProgress };
}
