package com.futebadosparcas.ui.theme

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

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
