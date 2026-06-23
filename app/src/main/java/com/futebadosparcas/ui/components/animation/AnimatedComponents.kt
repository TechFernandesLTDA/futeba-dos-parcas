package com.futebadosparcas.ui.components.animation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionEasing
import com.futebadosparcas.ui.theme.MotionSpring
import com.futebadosparcas.ui.theme.rememberReduceMotion
import kotlinx.coroutines.delay

/**
 * Componentes com micro-animações para feedback visual.
 * Melhora a experiência do usuário com animações sutis e responsivas.
 */

// ==================== Press Animations ====================

/**
 * Wrapper que adiciona animação de escala ao pressionar.
 * Escala suave para baixo quando pressionado.
 */
@Composable
fun PressableScale(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    scaleOnPress: Float = 0.96f,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) scaleOnPress else 1f,
        animationSpec = MotionSpring.effects(reduceMotion),
        label = "pressScale"
    )

    Box(
        modifier = modifier
            .scale(scale)
            .clickable(
                interactionSource = interactionSource,
                indication = null, // Remove ripple padrão
                enabled = enabled,
                role = Role.Button,
                onClick = onClick
            )
    ) {
        content()
    }
}

/**
 * Wrapper que adiciona animação de bounce ao pressionar.
 * Efeito de "mola" mais pronunciado.
 */
@Composable
fun BouncyPress(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) 0.92f else 1f,
        animationSpec = MotionSpring.effects(reduceMotion),
        label = "bounceScale"
    )

    Box(
        modifier = modifier
            .scale(scale)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                role = Role.Button,
                onClick = onClick
            )
    ) {
        content()
    }
}

// ==================== Entrance Animations ====================

/**
 * Animação de fade + slide de baixo para cima.
 * Ideal para items de lista aparecendo.
 */
@Composable
fun FadeSlideIn(
    visible: Boolean,
    modifier: Modifier = Modifier,
    delayMillis: Int = 0,
    durationMillis: Int = 300,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val enterDuration = if (reduceMotion) MotionDuration.MediumReduced else durationMillis
    val exitDuration = if (reduceMotion) MotionDuration.ShortReduced else durationMillis / 2
    var showContent by remember { mutableStateOf(false) }

    LaunchedEffect(visible) {
        if (visible) {
            delay(delayMillis.toLong())
            showContent = true
        } else {
            showContent = false
        }
    }

    AnimatedVisibility(
        visible = showContent,
        modifier = modifier,
        enter = fadeIn(
            animationSpec = tween(enterDuration, easing = MotionEasing.Decelerate)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = tween(enterDuration, easing = MotionEasing.Decelerate)
        ),
        exit = fadeOut(
            animationSpec = tween(exitDuration, easing = MotionEasing.Accelerate)
        ) + slideOutVertically(
            targetOffsetY = { -it / 4 },
            animationSpec = tween(exitDuration, easing = MotionEasing.Accelerate)
        )
    ) {
        content()
    }
}

/**
 * Animação de pop/scale para elementos que aparecem.
 * Ideal para badges, notificações, conquistas.
 */
@Composable
fun PopIn(
    visible: Boolean,
    modifier: Modifier = Modifier,
    delayMillis: Int = 0,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    var showContent by remember { mutableStateOf(false) }

    LaunchedEffect(visible) {
        if (visible) {
            delay(delayMillis.toLong())
            showContent = true
        } else {
            showContent = false
        }
    }

    AnimatedVisibility(
        visible = showContent,
        modifier = modifier,
        enter = scaleIn(
            initialScale = 0.5f,
            animationSpec = MotionSpring.effects(reduceMotion)
        ) + fadeIn(),
        exit = scaleOut(
            targetScale = 0.8f,
            animationSpec = tween(
                durationMillis = MotionDuration.getShort(reduceMotion),
                easing = MotionEasing.Standard
            )
        ) + fadeOut()
    ) {
        content()
    }
}

// ==================== Number Animations ====================

/**
 * Animação de contagem de número.
 * Ideal para estatísticas, XP, pontuações.
 */
@Composable
fun AnimatedCounter(
    targetValue: Int,
    modifier: Modifier = Modifier,
    durationMillis: Int = 1000,
    content: @Composable (Int) -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val animationDuration = if (reduceMotion) MotionDuration.MediumReduced else durationMillis
    val animatedValue = remember { Animatable(0f) }

    LaunchedEffect(targetValue) {
        animatedValue.animateTo(
            targetValue = targetValue.toFloat(),
            animationSpec = tween(animationDuration, easing = MotionEasing.Standard)
        )
    }

    Box(modifier = modifier) {
        content(animatedValue.value.toInt())
    }
}

/**
 * Animação de troca de conteúdo com crossfade.
 */
@Composable
fun <T> CrossfadeContent(
    targetState: T,
    modifier: Modifier = Modifier,
    content: @Composable (T) -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val crossfadeDuration = MotionDuration.getMedium(reduceMotion)

    AnimatedContent(
        targetState = targetState,
        modifier = modifier,
        transitionSpec = {
            fadeIn(animationSpec = tween(crossfadeDuration, easing = MotionEasing.Standard)) togetherWith
                fadeOut(animationSpec = tween(crossfadeDuration, easing = MotionEasing.Standard))
        },
        label = "crossfade"
    ) { state ->
        content(state)
    }
}

// ==================== Pulse Animations ====================

/**
 * Animação de pulso para chamar atenção.
 * Ideal para notificações, badges novos.
 */
@Composable
fun PulseAnimation(
    modifier: Modifier = Modifier,
    pulseFraction: Float = 1.1f,
    durationMillis: Int = 1000,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val pulseDuration = if (reduceMotion) MotionDuration.MediumReduced else durationMillis / 2
    val infiniteScale = remember { Animatable(1f) }

    LaunchedEffect(reduceMotion) {
        if (!reduceMotion) {
            while (true) {
                infiniteScale.animateTo(
                    targetValue = pulseFraction,
                    animationSpec = tween(pulseDuration, easing = MotionEasing.Standard)
                )
                infiniteScale.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(pulseDuration, easing = MotionEasing.Standard)
                )
            }
        } else {
            infiniteScale.snapTo(1f)
        }
    }

    Box(
        modifier = modifier.scale(infiniteScale.value)
    ) {
        content()
    }
}

/**
 * Indicador de "ao vivo" com pulso.
 */
@Composable
fun LiveIndicator(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.error,
    size: Dp = 8.dp
) {
    val reduceMotion = rememberReduceMotion()
    val alpha = remember { Animatable(1f) }

    LaunchedEffect(reduceMotion) {
        if (!reduceMotion) {
            val pulseDuration = MotionDuration.Long + MotionDuration.Medium
            while (true) {
                alpha.animateTo(0.3f, animationSpec = tween(pulseDuration, easing = MotionEasing.Standard))
                alpha.animateTo(1f, animationSpec = tween(pulseDuration, easing = MotionEasing.Standard))
            }
        } else {
            alpha.snapTo(1f)
        }
    }

    Box(
        modifier = modifier
            .graphicsLayer { this.alpha = alpha.value }
            .background(
                color = color,
                shape = CircleShape
            )
            .size(size)
    )
}

// ==================== Shake Animation ====================

/**
 * Animação de shake para erros/validação.
 */
@Composable
fun ShakeOnError(
    trigger: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val offsetX = remember { Animatable(0f) }

    LaunchedEffect(trigger, reduceMotion) {
        if (trigger && !reduceMotion) {
            val shakeDuration = MotionDuration.Short / 3
            repeat(3) {
                offsetX.animateTo(10f, animationSpec = tween(shakeDuration, easing = MotionEasing.Standard))
                offsetX.animateTo(-10f, animationSpec = tween(shakeDuration, easing = MotionEasing.Standard))
            }
            offsetX.animateTo(0f, animationSpec = tween(shakeDuration, easing = MotionEasing.Standard))
        } else if (reduceMotion) {
            offsetX.snapTo(0f)
        }
    }

    Box(
        modifier = modifier.graphicsLayer {
            translationX = offsetX.value
        }
    ) {
        content()
    }
}

// ==================== Rotation Animation ====================

/**
 * Animação de rotação para loading ou refresh.
 */
@Composable
fun SpinAnimation(
    modifier: Modifier = Modifier,
    durationMillis: Int = 1000,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val rotation = remember { Animatable(0f) }

    LaunchedEffect(reduceMotion) {
        if (!reduceMotion) {
            while (true) {
                rotation.animateTo(
                    targetValue = 360f,
                    animationSpec = tween(durationMillis, easing = MotionEasing.Standard)
                )
                rotation.snapTo(0f)
            }
        } else {
            rotation.snapTo(0f)
        }
    }

    Box(
        modifier = modifier.graphicsLayer {
            rotationZ = rotation.value
        }
    ) {
        content()
    }
}

// ==================== Success Animation ====================

/**
 * Animação de sucesso (checkmark).
 * Escala + fade para confirmações.
 */
@Composable
fun SuccessAnimation(
    visible: Boolean,
    modifier: Modifier = Modifier,
    onAnimationEnd: () -> Unit = {},
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val scale = remember { Animatable(0f) }

    LaunchedEffect(visible, reduceMotion) {
        if (visible) {
            scale.animateTo(
                targetValue = if (reduceMotion) 1f else 1.2f,
                animationSpec = MotionSpring.effects(reduceMotion)
            )
            scale.animateTo(
                targetValue = 1f,
                animationSpec = MotionSpring.effects(reduceMotion)
            )
            delay(MotionDuration.getLong(reduceMotion).toLong())
            onAnimationEnd()
        } else {
            scale.snapTo(0f)
        }
    }

    if (visible || scale.value > 0f) {
        Box(
            modifier = modifier
                .scale(scale.value)
                .graphicsLayer { alpha = scale.value }
        ) {
            content()
        }
    }
}

// ==================== Swipe Hint Animation ====================

/**
 * Animação de dica de swipe (para tutoriais).
 */
@Composable
fun SwipeHintAnimation(
    modifier: Modifier = Modifier,
    direction: SwipeDirection = SwipeDirection.LEFT,
    content: @Composable () -> Unit
) {
    val reduceMotion = rememberReduceMotion()
    val offsetX = remember { Animatable(0f) }
    val targetOffset = when (direction) {
        SwipeDirection.LEFT -> -30f
        SwipeDirection.RIGHT -> 30f
    }

    LaunchedEffect(reduceMotion) {
        if (!reduceMotion) {
            while (true) {
                delay((MotionDuration.Long * 4).toLong())
                offsetX.animateTo(targetOffset, animationSpec = tween(MotionDuration.getMedium(false), easing = MotionEasing.Standard))
                offsetX.animateTo(0f, animationSpec = tween(MotionDuration.getMedium(false), easing = MotionEasing.Standard))
                delay(MotionDuration.getLong(false).toLong())
                offsetX.animateTo(targetOffset, animationSpec = tween(MotionDuration.getMedium(false), easing = MotionEasing.Standard))
                offsetX.animateTo(0f, animationSpec = tween(MotionDuration.getMedium(false), easing = MotionEasing.Standard))
            }
        } else {
            offsetX.snapTo(0f)
        }
    }

    Box(
        modifier = modifier.graphicsLayer {
            translationX = offsetX.value
        }
    ) {
        content()
    }
}

enum class SwipeDirection {
    LEFT, RIGHT
}
