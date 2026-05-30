import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseSwipeBackOptions {
  /** Desabilita o gesto (ex.: em telas raiz onde não há para onde voltar). */
  disabled?: boolean;
  /** Distância máxima da borda esquerda para iniciar o gesto (px). Default 30. */
  edgeThreshold?: number;
  /** Distância horizontal mínima para confirmar o "voltar" (px). Default 80. */
  distanceThreshold?: number;
}

/**
 * #2194: gesto de swipe-back (arrastar da borda esquerda → direita) para
 * paridade com a navegação nativa iOS/Android no mobile web.
 *
 * Regras:
 * - Só inicia se o toque começar perto da borda esquerda (edgeThreshold).
 * - Confirma o voltar apenas se o movimento horizontal exceder
 *   distanceThreshold E for predominantemente horizontal (evita conflito com
 *   scroll vertical).
 * - Ignora multitouch e gestos quando `disabled` (ex.: telas raiz).
 *
 * Integra com react-router via navigate(-1).
 */
export function useSwipeBack({
  disabled = false,
  edgeThreshold = 30,
  distanceThreshold = 80,
}: UseSwipeBackOptions = {}) {
  const navigate = useNavigate();
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
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

    const onTouchEnd = (e: TouchEvent) => {
      if (!trackingRef.current || startXRef.current === null || startYRef.current === null) {
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;
      trackingRef.current = false;
      startXRef.current = null;
      startYRef.current = null;

      // Movimento horizontal suficiente e predominante (não é scroll vertical).
      if (dx > distanceThreshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        navigate(-1);
      }
    };

    const onTouchCancel = () => {
      trackingRef.current = false;
      startXRef.current = null;
      startYRef.current = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [disabled, edgeThreshold, distanceThreshold, navigate]);
}
