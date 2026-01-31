package com.futebadosparcas.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.TransformOrigin
import androidx.navigation.NavBackStackEntry

/**
 * Transições compartilhadas e animações de navegação.
 * Define transições consistentes para toda a aplicação.
 */

// ==================== Durations ====================

object TransitionDurations {
    const val QUICK = 150
    const val NORMAL = 300
    const val SLOW = 450
    const val VERY_SLOW = 600
}

// ==================== Easing ====================

private val defaultEasing = FastOutSlowInEasing

// ==================== Standard Transitions ====================

/**
 * Transição padrão de slide horizontal (push/pop).
 */
object SlideTransition {

    fun enter(): EnterTransition {
        return slideInHorizontally(
            initialOffsetX = { fullWidth -> fullWidth },
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        )
    }

    fun exit(): ExitTransition {
        return slideOutHorizontally(
            targetOffsetX = { fullWidth -> -fullWidth / 4 },
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = TransitionDurations.QUICK,
                easing = defaultEasing
            )
        )
    }

    fun popEnter(): EnterTransition {
        return slideInHorizontally(
            initialOffsetX = { fullWidth -> -fullWidth / 4 },
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        )
    }

    fun popExit(): ExitTransition {
        return slideOutHorizontally(
            targetOffsetX = { fullWidth -> fullWidth },
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = TransitionDurations.QUICK,
                easing = defaultEasing
            )
        )
    }
}

/**
 * Transição de slide vertical (bottom sheet style).
 */
object VerticalSlideTransition {

    fun enter(): EnterTransition {
        return slideInVertically(
            initialOffsetY = { fullHeight -> fullHeight },
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL
            )
        )
    }

    fun exit(): ExitTransition {
        return slideOutVertically(
            targetOffsetY = { fullHeight -> fullHeight },
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = TransitionDurations.QUICK
            )
        )
    }
}

/**
 * Transição de fade simples.
 */
object FadeTransition {

    fun enter(): EnterTransition {
        return fadeIn(
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        )
    }

    fun exit(): ExitTransition {
        return fadeOut(
            animationSpec = tween(
                durationMillis = TransitionDurations.QUICK,
                easing = defaultEasing
            )
        )
    }
}

/**
 * Transição de scale + fade (para dialogs/modals).
 */
object ScaleTransition {

    fun enter(origin: TransformOrigin = TransformOrigin.Center): EnterTransition {
        return scaleIn(
            initialScale = 0.85f,
            transformOrigin = origin,
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL,
                easing = defaultEasing
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = TransitionDurations.NORMAL
            )
        )
    }

    fun exit(origin: TransformOrigin = TransformOrigin.Center): ExitTransition {
        return scaleOut(
            targetScale = 0.85f,
            transformOrigin = origin,
            animationSpec = tween(
                durationMillis = TransitionDurations.QUICK,
                easing = defaultEasing
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = TransitionDurations.QUICK
            )
        )
    }
}

// ==================== Context-Specific Transitions ====================

/**
 * Transições específicas por contexto de navegação.
 */
object NavigationTransitions {

    /**
     * Transição para telas principais (tabs).
     */
    object MainTabs {
        fun enter() = fadeIn(tween(TransitionDurations.QUICK))
        fun exit() = fadeOut(tween(TransitionDurations.QUICK))
    }

    /**
     * Transição para telas de detalhe.
     */
    object Detail {
        fun enter() = SlideTransition.enter()
        fun exit() = SlideTransition.exit()
        fun popEnter() = SlideTransition.popEnter()
        fun popExit() = SlideTransition.popExit()
    }

    /**
     * Transição para modais/dialogs.
     */
    object Modal {
        fun enter() = VerticalSlideTransition.enter()
        fun exit() = VerticalSlideTransition.exit()
    }

    /**
     * Transição para fullscreen overlays.
     */
    object Fullscreen {
        fun enter() = fadeIn(tween(TransitionDurations.SLOW)) +
                      scaleIn(initialScale = 1.05f, animationSpec = tween(TransitionDurations.SLOW))
        fun exit() = fadeOut(tween(TransitionDurations.NORMAL)) +
                     scaleOut(targetScale = 1.05f, animationSpec = tween(TransitionDurations.NORMAL))
    }
}

// ==================== Shared Element Simulation ====================

/**
 * Dados para simular shared element transition.
 * (Shared Element real requer Navigation 2.8+ com Compose 1.7+)
 */
data class SharedElementData(
    val key: String,
    val originX: Float,
    val originY: Float,
    val originWidth: Float,
    val originHeight: Float
)

/**
 * Estado global para shared elements.
 */
object SharedElementState {
    private val elements = mutableMapOf<String, SharedElementData>()

    fun register(key: String, data: SharedElementData) {
        elements[key] = data
    }

    fun get(key: String): SharedElementData? = elements[key]

    fun unregister(key: String) {
        elements.remove(key)
    }

    fun clear() {
        elements.clear()
    }
}

// ==================== Navigation Extensions ====================

/**
 * Extensões para usar transições com NavHost.
 */
object NavTransitionSpec {

    /**
     * Spec padrão para navegação.
     */
    fun defaultEnterTransition(): AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
        SlideTransition.enter()
    }

    fun defaultExitTransition(): AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
        SlideTransition.exit()
    }

    fun defaultPopEnterTransition(): AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
        SlideTransition.popEnter()
    }

    fun defaultPopExitTransition(): AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
        SlideTransition.popExit()
    }
}

// ==================== Composable Helpers ====================

/**
 * Wrapper para aplicar transição padrão em composables.
 */
@Composable
fun <T> AnimatedTransitionContent(
    targetState: T,
    transitionType: TransitionType = TransitionType.SLIDE,
    content: @Composable (T) -> Unit
) {
    androidx.compose.animation.AnimatedContent(
        targetState = targetState,
        transitionSpec = {
            when (transitionType) {
                TransitionType.SLIDE -> {
                    SlideTransition.enter() togetherWith SlideTransition.exit()
                }
                TransitionType.FADE -> {
                    FadeTransition.enter() togetherWith FadeTransition.exit()
                }
                TransitionType.SCALE -> {
                    ScaleTransition.enter() togetherWith ScaleTransition.exit()
                }
                TransitionType.VERTICAL -> {
                    VerticalSlideTransition.enter() togetherWith VerticalSlideTransition.exit()
                }
            }
        },
        label = "animated_content"
    ) { state ->
        content(state)
    }
}

enum class TransitionType {
    SLIDE,
    FADE,
    SCALE,
    VERTICAL
}
