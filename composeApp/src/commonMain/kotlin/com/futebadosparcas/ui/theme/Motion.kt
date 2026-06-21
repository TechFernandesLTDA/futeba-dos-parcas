package com.futebadosparcas.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing

/**
 * Tokens de motion compartilhados (composeApp / iOS) — Futeba dos Parças (#2755)
 *
 * Fonte canônica: shared/design-tokens.json#motion (durations + easings).
 * Mantém paridade cross-platform com:
 *  - Android :app — app/src/main/java/com/futebadosparcas/ui/theme/AppMotion.kt
 *  - Web         — web/src/theme/motion.ts
 *
 * Alinhado ao Material Design 3 Motion:
 * https://m3.material.io/styles/motion/overview
 *
 * Disponibiliza durations/easings para as telas iOS (Compose Multiplatform)
 * compartilharem o mesmo vocabulário de animação das demais plataformas.
 * O valor canônico vive no design-tokens.json; o check de paridade
 * (scripts/check-design-tokens-parity.js) garante que não há drift.
 */

// ==========================================
// DURAÇÕES (em milissegundos)
// ==========================================
object MotionDuration {
    /** Ações instantâneas: tooltips, micro-feedback */
    const val Short = 150

    /** Transições padrão: navegação entre telas, modais */
    const val Medium = 300

    /** Animações elaboradas: onboarding, celebração de XP */
    const val Long = 500

    /** Versão reduzida das durações para acessibilidade (reduced-motion) */
    const val ShortReduced = 0
    const val MediumReduced = 0
    const val LongReduced = 0

    /** Retorna a duração ajustada para reduced-motion */
    fun getShort(reduced: Boolean) = if (reduced) ShortReduced else Short
    fun getMedium(reduced: Boolean) = if (reduced) MediumReduced else Medium
    fun getLong(reduced: Boolean) = if (reduced) LongReduced else Long
}

// ==========================================
// CURVAS DE EASING (Material 3)
// ==========================================
object MotionEasing {
    /**
     * Standard — uso geral. Elementos que entram e saem do viewport.
     * Equivalente CSS: cubic-bezier(0.2, 0, 0, 1)
     */
    val Standard: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)

    /**
     * Emphasized — foco e destaque. Transições de high-emphasis (FAB, hero).
     * Equivalente CSS: cubic-bezier(0.2, 0, 0, 1)
     */
    val Emphasized: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)

    /**
     * Decelerate — elementos que entram em tela (deslizam para dentro).
     * Equivalente CSS: cubic-bezier(0, 0, 0, 1)
     */
    val Decelerate: Easing = CubicBezierEasing(0f, 0f, 0f, 1f)

    /**
     * Accelerate — elementos que saem de tela (deslizam para fora).
     * Equivalente CSS: cubic-bezier(0.3, 0, 1, 1)
     */
    val Accelerate: Easing = CubicBezierEasing(0.3f, 0f, 1f, 1f)
}
