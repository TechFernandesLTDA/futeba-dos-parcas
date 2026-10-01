/**
 * Tokens de animação centralizados — Futeba dos Parças (#2195, #2755)
 *
 * Fonte canônica: shared/design-tokens.json#motion (durations + easings).
 * Mantém paridade cross-platform com:
 *  - Android :app     — app/src/main/java/com/futebadosparcas/ui/theme/AppMotion.kt
 *  - composeApp / iOS — composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/theme/Motion.kt
 *
 * Alinhados ao Material Design 3 Motion:
 * https://m3.material.io/styles/motion/overview
 *
 * Vocabulário único de motion da web: o tema MUI deriva transitions.duration /
 * transitions.easing destes tokens (ver web/src/theme/index.ts). O check de
 * paridade (scripts/check-design-tokens-parity.js) garante que não há drift.
 */

// ==========================================
// DURAÇÕES (em milissegundos)
// ==========================================
export const motionDuration = {
  /** Ações instantâneas: tooltips, micro-feedback (150ms) */
  short: 150,
  /** Transições padrão: navegação entre telas, modais (300ms) */
  medium: 300,
  /** Animações elaboradas: onboarding, celebração de XP (500ms) */
  long: 500,
} as const;

// ==========================================
// CURVAS DE EASING (Material 3)
// ==========================================
export const motionEasing = {
  /**
   * Standard — uso geral. Elementos que entram e saem do viewport, e também
   * as transições de high-emphasis (FAB, hero, celebrações).
   * cubic-bezier(0.2, 0, 0, 1)
   *
   * Não existe `emphasized` separado (#4115): a curva canônica do M3
   * `md.sys.motion.easing.emphasized` é um path de dois segmentos que não
   * cabe num único cubic-bezier, e a aproximação bezier oficial — material-web
   * `$easing-emphasized: $easing-standard` e Compose
   * `MotionTokens.EasingEmphasizedCubicBezier = CubicBezierEasing(0.2f, 0f, 0f, 1f)`
   * — é idêntica à standard. Manter um alias com o mesmo valor só prometia
   * uma diferença que nunca existiu. Decisão em specs/DECISIONS.md.
   */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',

  /**
   * Decelerate — elementos que entram em tela (deslizam para dentro).
   * cubic-bezier(0, 0, 0, 1)
   */
  decelerate: 'cubic-bezier(0, 0, 0, 1)',

  /**
   * Accelerate — elementos que saem de tela (deslizam para fora).
   * cubic-bezier(0.3, 0, 1, 1)
   */
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

// ==========================================
// HELPERS DE CSS TRANSITION
// ==========================================

/**
 * Gera string CSS `transition` para uso em sx/styled:
 * @example
 * sx={{ transition: motion('opacity', 'medium', 'standard') }}
 */
export function motion(
  property: string,
  duration: keyof typeof motionDuration = 'medium',
  easing: keyof typeof motionEasing = 'standard'
): string {
  return `${property} ${motionDuration[duration]}ms ${motionEasing[easing]}`;
}

/**
 * Objeto completo de tokens de animação para extensão do tema MUI.
 * Uso: `theme.motion.duration.medium`
 */
export const motionTokens = {
  duration: motionDuration,
  easing: motionEasing,
} as const;

export type MotionTokens = typeof motionTokens;
