package com.futebadosparcas.util

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Animation Helper
 *
 * Provides utilities for creating smooth animations in Views and Compose.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var animationHelper: AnimationHelper
 *
 * // Fade in a view
 * animationHelper.fadeIn(view, duration = 300)
 *
 * // Scale animation for button press
 * animationHelper.scaleView(button, toScale = 0.95f, duration = 100)
 *
 * // Slide up animation
 * animationHelper.slideUp(view, fromY = 100f, duration = 400)
 * ```
 */
@Singleton
class AnimationHelper @Inject constructor() {

    /**
     * Default animation duration
     */
    val DEFAULT_DURATION = 300L
    val SHORT_DURATION = 150L
    val LONG_DURATION = 500L

    /**
     * Fade in animation
     */
    fun fadeIn(
        view: View,
        duration: Long = DEFAULT_DURATION,
        onEnd: (() -> Unit)? = null
    ) {
        view.alpha = 0f
        view.visibility = View.VISIBLE
        view.animate()
            .alpha(1f)
            .setDuration(duration)
            .setInterpolator(DecelerateInterpolator())
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    onEnd?.invoke()
                }
            })
            .start()
    }

    /**
     * Fade out animation
     */
    fun fadeOut(
        view: View,
        duration: Long = DEFAULT_DURATION,
        onEnd: (() -> Unit)? = null
    ) {
        view.animate()
            .alpha(0f)
            .setDuration(duration)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    view.visibility = View.GONE
                    onEnd?.invoke()
                }
            })
            .start()
    }

    /**
     * Scale animation
     */
    fun scaleView(
        view: View,
        toScale: Float = 1.0f,
        duration: Long = SHORT_DURATION,
        onEnd: (() -> Unit)? = null
    ) {
        view.animate()
            .scaleX(toScale)
            .scaleY(toScale)
            .setDuration(duration)
            .setInterpolator(OvershootInterpolator())
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    onEnd?.invoke()
                }
            })
            .start()
    }

    /**
     * Slide up animation
     */
    fun slideUp(
        view: View,
        fromY: Float = view.height.toFloat(),
        duration: Long = DEFAULT_DURATION,
        onEnd: (() -> Unit)? = null
    ) {
        view.translationY = fromY
        view.visibility = View.VISIBLE
        view.animate()
            .translationY(0f)
            .setDuration(duration)
            .setInterpolator(DecelerateInterpolator())
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    onEnd?.invoke()
                }
            })
            .start()
    }

    /**
     * Slide down animation
     */
    fun slideDown(
        view: View,
        toY: Float = view.height.toFloat(),
        duration: Long = DEFAULT_DURATION,
        onEnd: (() -> Unit)? = null
    ) {
        view.animate()
            .translationY(toY)
            .setDuration(duration)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    view.visibility = View.GONE
                    view.translationY = 0f
                    onEnd?.invoke()
                }
            })
            .start()
    }

    /**
     * Shake animation for error states
     */
    fun shake(view: View, duration: Long = 500L) {
        val animator = ObjectAnimator.ofFloat(view, "translationX", 0f, 25f, -25f, 25f, -25f, 15f, -15f, 6f, -6f, 0f)
        animator.duration = duration
        animator.interpolator = AccelerateDecelerateInterpolator()
        animator.start()
    }

    /**
     * Pulse animation for attention
     */
    fun pulse(
        view: View,
        scaleTo: Float = 1.1f,
        duration: Long = 500L,
        repeatCount: Int = 2
    ) {
        val scaleX = ObjectAnimator.ofFloat(view, "scaleX", 1f, scaleTo, 1f)
        val scaleY = ObjectAnimator.ofFloat(view, "scaleY", 1f, scaleTo, 1f)

        scaleX.duration = duration
        scaleY.duration = duration
        scaleX.repeatCount = repeatCount
        scaleY.repeatCount = repeatCount

        scaleX.start()
        scaleY.start()
    }

    /**
     * Rotate animation
     */
    fun rotate(
        view: View,
        fromDegrees: Float = 0f,
        toDegrees: Float = 360f,
        duration: Long = DEFAULT_DURATION,
        onEnd: (() -> Unit)? = null
    ) {
        view.animate()
            .rotation(toDegrees)
            .setDuration(duration)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    onEnd?.invoke()
                }
            })
            .start()
    }

    /**
     * Bounce animation
     */
    fun bounce(view: View, duration: Long = 500L) {
        val animator = ObjectAnimator.ofFloat(view, "translationY", 0f, -50f, 0f)
        animator.duration = duration
        animator.interpolator = OvershootInterpolator()
        animator.start()
    }

    /**
     * Number counter animation
     */
    fun animateNumber(
        from: Int,
        to: Int,
        duration: Long = 1000L,
        onUpdate: (Int) -> Unit
    ) {
        val animator = ValueAnimator.ofInt(from, to)
        animator.duration = duration
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation ->
            onUpdate(animation.animatedValue as Int)
        }
        animator.start()
    }

    /**
     * XP bar fill animation
     */
    fun animateProgressBar(
        from: Float,
        to: Float,
        duration: Long = 800L,
        onUpdate: (Float) -> Unit
    ) {
        val animator = ValueAnimator.ofFloat(from, to)
        animator.duration = duration
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation ->
            onUpdate(animation.animatedValue as Float)
        }
        animator.start()
    }
}

/**
 * Compose animation extensions
 */
object ComposeAnimations {

    /**
     * Default spring animation
     */
    fun <T> spring(
        dampingRatio: Float = Spring.DampingRatioMediumBouncy,
        stiffness: Float = Spring.StiffnessMedium
    ): SpringSpec<T> = spring(
        dampingRatio = dampingRatio,
        stiffness = stiffness
    )

    /**
     * Smooth fade animation spec
     */
    fun <T> smoothFade(): TweenSpec<T> = tween(
        durationMillis = 300,
        easing = FastOutSlowInEasing
    )

    /**
     * Quick fade animation spec
     */
    fun <T> quickFade(): TweenSpec<T> = tween(
        durationMillis = 150,
        easing = LinearOutSlowInEasing
    )

    /**
     * Slide animation spec
     */
    fun <T> slide(): TweenSpec<T> = tween(
        durationMillis = 400,
        easing = FastOutSlowInEasing
    )

    /**
     * Scale animation spec
     */
    fun <T> scale(): TweenSpec<T> = tween(
        durationMillis = 200,
        easing = FastOutSlowInEasing
    )
}

/**
 * Compose Enter/Exit transitions
 */
@Composable
fun slideInVerticallyEnterTransition(
    initialOffsetY: (fullHeight: Int) -> Int = { it }
): EnterTransition = slideInVertically(
    initialOffsetY = initialOffsetY,
    animationSpec = ComposeAnimations.slide()
) + fadeIn(animationSpec = ComposeAnimations.smoothFade())

@Composable
fun slideOutVerticallyExitTransition(
    targetOffsetY: (fullHeight: Int) -> Int = { it }
): ExitTransition = slideOutVertically(
    targetOffsetY = targetOffsetY,
    animationSpec = ComposeAnimations.slide()
) + fadeOut(animationSpec = ComposeAnimations.smoothFade())

@Composable
fun scaleInEnterTransition(): EnterTransition = scaleIn(
    initialScale = 0.8f,
    animationSpec = ComposeAnimations.scale()
) + fadeIn(animationSpec = ComposeAnimations.smoothFade())

@Composable
fun scaleOutExitTransition(): ExitTransition = scaleOut(
    targetScale = 0.8f,
    animationSpec = ComposeAnimations.scale()
) + fadeOut(animationSpec = ComposeAnimations.quickFade())

/**
 * Animated visibility with slide up effect
 */
@Composable
fun AnimatedVisibilitySlideUp(
    visible: Boolean,
    content: @Composable AnimatedVisibilityScope.() -> Unit
) {
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(
            initialOffsetY = { it },
            animationSpec = ComposeAnimations.slide()
        ) + fadeIn(animationSpec = ComposeAnimations.smoothFade()),
        exit = slideOutVertically(
            targetOffsetY = { it },
            animationSpec = ComposeAnimations.slide()
        ) + fadeOut(animationSpec = ComposeAnimations.smoothFade()),
        content = content
    )
}

/**
 * Animated visibility with scale effect
 */
@Composable
fun AnimatedVisibilityScale(
    visible: Boolean,
    content: @Composable AnimatedVisibilityScope.() -> Unit
) {
    AnimatedVisibility(
        visible = visible,
        enter = scaleInEnterTransition(),
        exit = scaleOutExitTransition(),
        content = content
    )
}
