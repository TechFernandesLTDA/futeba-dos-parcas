package com.futebadosparcas.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing

/**
 * Tokens de animação centralizados — Futeba dos Parças (#2195)
 *
 * Alinhados ao Material Design 3 Motion:
 * https://m3.material.io/styles/motion/overview
 *
 * Equivalentes Web: motion.ts (web/src/theme/motion.ts)
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
