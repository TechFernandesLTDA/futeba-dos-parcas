package com.futebadosparcas.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf

/**
 * Tokens de motion compartilhados (composeApp / iOS) — Futeba dos Parças (#2755, #2735)
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

/**
 * Lê o estado de reduced-motion diretamente do sistema dentro de um contexto @Composable.
 * - Android: verifica Settings.Global.ANIMATOR_DURATION_SCALE == 0 via LocalContext
 * - iOS: verifica UIAccessibility.isReduceMotionEnabled via interop
 * Usado pelo FutebaTheme para inicializar o LocalReducedMotion.
 */
@Composable
internal expect fun readSystemReduceMotion(): Boolean

/**
 * CompositionLocal que indica se o usuário solicitou redução de animações.
 * Provido pelo FutebaTheme; consumir via rememberReduceMotion().
 */
val LocalReducedMotion = compositionLocalOf { false }

/**
 * Helper que lê o estado de reduced-motion via CompositionLocal.
 * Deve ser chamado dentro da árvore do FutebaTheme.
 */
@Composable
@ReadOnlyComposable
fun rememberReduceMotion(): Boolean = LocalReducedMotion.current

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
