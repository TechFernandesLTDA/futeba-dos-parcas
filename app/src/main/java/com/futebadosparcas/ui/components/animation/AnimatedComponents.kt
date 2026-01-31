package com.futebadosparcas.ui.components.animation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
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
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
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
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) scaleOnPress else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
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
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) 0.92f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessMedium
        ),
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
            animationSpec = tween(durationMillis, easing = FastOutSlowInEasing)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = tween(durationMillis, easing = FastOutSlowInEasing)
        ),
        exit = fadeOut(
            animationSpec = tween(durationMillis / 2)
        ) + slideOutVertically(
            targetOffsetY = { -it / 4 },
            animationSpec = tween(durationMillis / 2)
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
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessLow
            )
        ) + fadeIn(),
        exit = scaleOut(
            targetScale = 0.8f,
            animationSpec = tween(150)
        ) + fadeOut()
    ) {
        content()
    }
}

/**
 * Animação staggered para listas.
 * Cada item aparece com um delay incremental.
 */
@Composable
fun StaggeredItem(
    index: Int,
    modifier: Modifier = Modifier,
    baseDelayMillis: Int = 50,
    content: @Composable () -> Unit
) {
    FadeSlideIn(
        visible = true,
        modifier = modifier,
        delayMillis = index * baseDelayMillis,
        content = content
    )
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
    val animatedValue = remember { Animatable(0f) }

    LaunchedEffect(targetValue) {
        animatedValue.animateTo(
            targetValue = targetValue.toFloat(),
            animationSpec = tween(durationMillis, easing = FastOutSlowInEasing)
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
    AnimatedContent(
        targetState = targetState,
        modifier = modifier,
        transitionSpec = {
            fadeIn(animationSpec = tween(300)) togetherWith
                fadeOut(animationSpec = tween(300))
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
    val infiniteScale = remember { Animatable(1f) }

    LaunchedEffect(Unit) {
        while (true) {
            infiniteScale.animateTo(
                targetValue = pulseFraction,
                animationSpec = tween(durationMillis / 2)
            )
            infiniteScale.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis / 2)
            )
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
    val alpha = remember { Animatable(1f) }

    LaunchedEffect(Unit) {
        while (true) {
            alpha.animateTo(0.3f, animationSpec = tween(800))
            alpha.animateTo(1f, animationSpec = tween(800))
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
    val offsetX = remember { Animatable(0f) }

    LaunchedEffect(trigger) {
        if (trigger) {
            repeat(3) {
                offsetX.animateTo(10f, animationSpec = tween(50))
                offsetX.animateTo(-10f, animationSpec = tween(50))
            }
            offsetX.animateTo(0f, animationSpec = tween(50))
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
    val rotation = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        while (true) {
            rotation.animateTo(
                targetValue = 360f,
                animationSpec = tween(durationMillis, easing = androidx.compose.animation.core.LinearEasing)
            )
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
    val scale = remember { Animatable(0f) }

    LaunchedEffect(visible) {
        if (visible) {
            scale.animateTo(
                targetValue = 1.2f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessLow
                )
            )
            scale.animateTo(
                targetValue = 1f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy
                )
            )
            delay(500)
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
    val offsetX = remember { Animatable(0f) }
    val targetOffset = when (direction) {
        SwipeDirection.LEFT -> -30f
        SwipeDirection.RIGHT -> 30f
    }

    LaunchedEffect(Unit) {
        while (true) {
            delay(2000)
            offsetX.animateTo(targetOffset, animationSpec = tween(300))
            offsetX.animateTo(0f, animationSpec = tween(300))
            delay(500)
            offsetX.animateTo(targetOffset, animationSpec = tween(300))
            offsetX.animateTo(0f, animationSpec = tween(300))
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
