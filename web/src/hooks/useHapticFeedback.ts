import { useCallback } from 'react';

/**
 * #2218: feedback tátil/haptic na web para paridade com Android
 * (SoundboardReactions / MicroInteractionModifiers).
 *
 * Usa a Vibration API (`navigator.vibrate`) quando disponível — funciona em
 * Android/Chrome; iOS Safari ignora silenciosamente, então é fail-safe.
 *
 * Respeita `prefers-reduced-motion`: usuários que pedem menos movimento não
 * recebem vibração (a vibração é uma forma de "movimento" sensorial).
 *
 * Padrões alinhados ao Android (em ms):
 * - light:    toque leve (seleção, hover)
 * - medium:   ação confirmada (botão, swipe)
 * - heavy:    ação importante (criar jogo, votar)
 * - success:  padrão pulsante positivo (badge, level up)
 * - error:    padrão pulsante de erro (falha, validação)
 */
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [40, 30, 40],
  error: [60, 40, 60, 40, 60],
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useHapticFeedback() {
  const trigger = useCallback((pattern: HapticPattern = 'light') => {
    // Fallback silencioso: sem suporte ou usuário pediu menos movimento.
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (prefersReducedMotion()) return;
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // navigator.vibrate pode lançar em alguns navegadores embarcados — ignorar.
    }
  }, []);

  return { trigger };
}

export default useHapticFeedback;
