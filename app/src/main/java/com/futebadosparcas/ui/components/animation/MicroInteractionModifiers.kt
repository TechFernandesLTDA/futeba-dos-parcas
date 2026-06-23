package com.futebadosparcas.ui.components.animation

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import com.futebadosparcas.ui.theme.MotionSpring
import com.futebadosparcas.ui.theme.rememberReduceMotion

/**
 * Escala aplicada ao pressionar (0.95 = 5% menor).
 */
private const val PRESS_SCALE = 0.95f

/**
 * Modificador que aplica animação de escala ao pressionar.
 *
 * Quando o usuário pressiona o elemento, ele encolhe suavemente para 95%
 * do tamanho e volta ao normal ao soltar. Essa micro-interação melhora
 * a responsividade tátil da interface, usa springs centralizadas e respeita
 * reduced-motion.
 *
 * Uso:
 * ```kotlin
 * Card(
 *     modifier = Modifier
 *         .pressScale()
 *         .clickable { ... }
 * ) { ... }
 * ```
 *
 * @param scale Escala mínima ao pressionar (padrão: 0.95f)
 */
fun Modifier.pressScale(
    scale: Float = PRESS_SCALE
): Modifier = composed {
    val reduceMotion = rememberReduceMotion()
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val animatedScale by animateFloatAsState(
        targetValue = if (isPressed) scale else 1f,
        animationSpec = MotionSpring.effects(reduceMotion),
        label = "pressScale"
    )

    this
        .graphicsLayer {
            scaleX = animatedScale
            scaleY = animatedScale
        }
}

/**
 * Modificador que combina animação de escala com callback de clique.
 *
 * Versão de conveniência que integra `pressScale` com `clickable`
 * em um único modificador, ideal para cards e botões personalizados.
 *
 * Uso:
 * ```kotlin
 * Card(
 *     modifier = Modifier.pressScaleClickable(
 *         onClick = { navigateToDetail(game.id) }
 *     )
 * ) { ... }
 * ```
 *
 * @param onClick Callback ao clicar
 * @param scale Escala mínima ao pressionar (padrão: 0.95f)
 * @param enabled Se o clique está habilitado
 */
fun Modifier.pressScaleClickable(
    onClick: () -> Unit,
    scale: Float = PRESS_SCALE,
    enabled: Boolean = true
): Modifier = composed {
    val reduceMotion = rememberReduceMotion()
    var isPressed by remember { mutableStateOf(false) }

    val animatedScale by animateFloatAsState(
        targetValue = if (isPressed) scale else 1f,
        animationSpec = MotionSpring.effects(reduceMotion),
        label = "pressScaleClickable"
    )

    this
        .graphicsLayer {
            scaleX = animatedScale
            scaleY = animatedScale
        }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            detectTapGestures(
                onPress = {
                    isPressed = true
                    try {
                        awaitRelease()
                    } finally {
                        isPressed = false
                    }
                },
                onTap = { onClick() }
            )
        }
}
