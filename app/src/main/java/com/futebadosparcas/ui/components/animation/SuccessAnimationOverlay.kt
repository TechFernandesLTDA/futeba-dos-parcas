package com.futebadosparcas.ui.components.animation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * Duração da exibição do overlay de sucesso (ms).
 */
private const val SUCCESS_DISPLAY_DURATION_MS = 1200L

/**
 * Duração da animação de entrada/saída (ms).
 */
private const val SUCCESS_ANIMATION_DURATION_MS = 300

/**
 * Overlay que exibe uma breve animação de sucesso (checkmark).
 *
 * Aparece centralizado sobre o conteúdo com uma animação de scale + fade,
 * permanece visível por um breve período e desaparece automaticamente.
 *
 * Ideal para feedback visual após ações como confirmar presença,
 * salvar configurações, ou concluir uma votação.
 *
 * Uso:
 * ```kotlin
 * var showSuccess by remember { mutableStateOf(false) }
 *
 * Box {
 *     // Conteúdo principal
 *     MyContent(
 *         onActionSuccess = { showSuccess = true }
 *     )
 *
 *     // Overlay de sucesso
 *     SuccessAnimationOverlay(
 *         visible = showSuccess,
 *         onDismiss = { showSuccess = false }
 *     )
 * }
 * ```
 *
 * @param visible Se o overlay deve ser exibido
 * @param onDismiss Callback ao terminar a animação (para resetar o estado)
 * @param modifier Modificador para o container
 * @param displayDurationMs Duração da exibição em milissegundos (padrão: 1200ms)
 */
@Composable
fun SuccessAnimationOverlay(
    visible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    displayDurationMs: Long = SUCCESS_DISPLAY_DURATION_MS
) {
    // Auto-dismiss após o tempo configurado
    if (visible) {
        LaunchedEffect(Unit) {
            delay(displayDurationMs)
            onDismiss()
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = tween(SUCCESS_ANIMATION_DURATION_MS, easing = FastOutSlowInEasing)
        ) + scaleIn(
            initialScale = 0.5f,
            animationSpec = tween(SUCCESS_ANIMATION_DURATION_MS, easing = FastOutSlowInEasing)
        ),
        exit = fadeOut(
            animationSpec = tween(SUCCESS_ANIMATION_DURATION_MS, easing = FastOutSlowInEasing)
        ) + scaleOut(
            targetScale = 0.5f,
            animationSpec = tween(SUCCESS_ANIMATION_DURATION_MS, easing = FastOutSlowInEasing)
        ),
        modifier = modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            // Círculo de fundo com cor primária
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}
