package com.futebadosparcas.ui.theme

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Tokens de motion centralizados — Futeba dos Parças (#2195, #2755)
 *
 * Fonte canônica: shared/design-tokens.json#motion (durations + easings).
 * Mantém paridade cross-platform com:
 *  - composeApp / iOS — composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/theme/Motion.kt
 *  - Web              — web/src/theme/motion.ts
 *
 * Alinhado ao Material Design 3 Motion:
 * https://m3.material.io/styles/motion/overview
 *
 * O check de paridade (scripts/check-design-tokens-parity.js) garante que
 * durations/easings não divergem entre as plataformas.
 */

/**
 * CompositionLocal indicando se o usuário solicitou redução de animações.
 * Lê Settings.Global.ANIMATOR_DURATION_SCALE — 0 significa reduzido.
 */
val LocalReducedMotion = compositionLocalOf { false }

/**
 * Helper que lê o estado de reduced-motion do sistema via CompositionLocal.
 */
@Composable
@ReadOnlyComposable
fun rememberReduceMotion(): Boolean = LocalReducedMotion.current

/**
 * Obtém o estado de reduced-motion diretamente do sistema (sem CompositionLocal).
 * Usado para inicializar o LocalReducedMotion.
 */
fun readSystemReduceMotion(context: Context): Boolean {
    return try {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE
        ) == 0f
    } catch (e: Exception) {
        false
    }
}

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

    /** Versão reduzida das durações para acessibilidade */
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

object MotionSpring {
    fun <T> spatial(reduced: Boolean): FiniteAnimationSpec<T> =
        if (reduced) {
            snap()
        } else {
            spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessMediumLow
            )
        }

    fun <T> effects(reduced: Boolean): FiniteAnimationSpec<T> =
        if (reduced) {
            snap()
        } else {
            spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMedium
            )
        }
}
