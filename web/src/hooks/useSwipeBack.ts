import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSectionFallback } from '../config/navItems';
import { useReducedMotion } from './useReducedMotion';

interface UseSwipeBackOptions {
  /** Elemento visual que recebe o feedback do gesto sem provocar re-render. */
  targetRef: RefObject<HTMLElement | null>;
  /** Desabilita o gesto (ex.: em telas raiz onde não há para onde voltar). */
  disabled?: boolean;
  /** Distância máxima da borda esquerda para iniciar o gesto (px). Default 30. */
  edgeThreshold?: number;
  /** Distância horizontal mínima para confirmar o "voltar" (px). Default 80. */
  distanceThreshold?: number;
}

/**
 * Gesto de swipe-back com feedback escrito diretamente no compositor.
 *
 * `touchmove` não altera estado React. O progresso mais recente é aplicado no
 * máximo uma vez por frame e todo estilo inline é removido em end, cancel,
 * unmount, mudança de rota ou ativação de movimento reduzido.
 */
export function useSwipeBack({
  targetRef,
  disabled = false,
  edgeThreshold = 30,
  distanceThreshold = 80,
}: UseSwipeBackOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const pendingProgressRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);

  const clearVisualFeedback = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pendingProgressRef.current = 0;

    const target = targetRef.current;
    if (!target) return;
    target.style.removeProperty('transform');
    target.style.removeProperty('opacity');
    target.style.removeProperty('transition');
    target.style.removeProperty('will-change');
  }, [targetRef]);

  const clearGesture = useCallback(() => {
    trackingRef.current = false;
    startXRef.current = null;
    startYRef.current = null;
    clearVisualFeedback();
  }, [clearVisualFeedback]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    if (reducedMotion) clearVisualFeedback();
  }, [clearVisualFeedback, reducedMotion]);

  useEffect(() => {
    if (disabled) {
      clearGesture();
      return;
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        clearGesture();
        return;
      }

      const touch = event.touches[0];
      if (touch.clientX > edgeThreshold) {
        clearGesture();
        return;
      }

      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      trackingRef.current = true;

      if (!reducedMotionRef.current && targetRef.current) {
        targetRef.current.style.willChange = 'transform, opacity';
        targetRef.current.style.transition = 'none';
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (
        !trackingRef.current
        || startXRef.current === null
        || startYRef.current === null
        || reducedMotionRef.current
      ) return;

      const touch = event.touches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = Math.abs(touch.clientY - startYRef.current);
      if (dx <= 0 || dx <= dy * 1.5) return;

      pendingProgressRef.current = Math.min(1, dx / distanceThreshold);
      if (animationFrameRef.current !== null) return;

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        if (reducedMotionRef.current) {
          clearVisualFeedback();
          return;
        }

        const target = targetRef.current;
        if (!target) return;
        const progress = pendingProgressRef.current;
        target.style.transform = `translateX(${progress * 80}px)`;
        target.style.opacity = String(1 - progress * 0.15);
      });
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!trackingRef.current || startXRef.current === null || startYRef.current === null) {
        clearGesture();
        return;
      }

      const touch = event.changedTouches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;
      clearGesture();

      if (dx > distanceThreshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (location.key === 'default' || window.history.length <= 1) {
          navigate(getSectionFallback(location.pathname), { replace: true });
        } else {
          navigate(-1);
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', clearGesture, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', clearGesture);
      clearGesture();
    };
  }, [
    clearGesture,
    clearVisualFeedback,
    disabled,
    distanceThreshold,
    edgeThreshold,
    location.key,
    location.pathname,
    navigate,
    targetRef,
  ]);
}
