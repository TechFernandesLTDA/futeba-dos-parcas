package com.futebadosparcas.ui.components.lists

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Ação disponível ao fazer swipe em um card.
 *
 * @param icon Ícone da ação
 * @param label Rótulo descritivo
 * @param color Cor de fundo da ação
 * @param onAction Callback ao ativar a ação
 */
data class SwipeAction(
    val icon: ImageVector,
    val label: String,
    val color: Color,
    val onAction: () -> Unit
)

/**
 * Card com suporte a swipe para revelar ações.
 *
 * Implementa o padrão SwipeToDismissBox do Material 3 para
 * ações de swipe (editar, deletar, compartilhar, etc.).
 *
 * Uso:
 * ```kotlin
 * SwipeableActionCard(
 *     startToEndAction = SwipeAction(
 *         icon = Icons.Default.Edit,
 *         label = "Editar",
 *         color = MaterialTheme.colorScheme.primaryContainer,
 *         onAction = { editGame(game.id) }
 *     ),
 *     endToStartAction = SwipeAction(
 *         icon = Icons.Default.Delete,
 *         label = "Excluir",
 *         color = MaterialTheme.colorScheme.errorContainer,
 *         onAction = { deleteGame(game.id) }
 *     )
 * ) {
 *     GameCard(game = game)
 * }
 * ```
 *
 * @param modifier Modificador para o container
 * @param startToEndAction Ação ao fazer swipe da esquerda para direita (opcional)
 * @param endToStartAction Ação ao fazer swipe da direita para esquerda (opcional)
 * @param content Conteúdo do card
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeableActionCard(
    modifier: Modifier = Modifier,
    startToEndAction: SwipeAction? = null,
    endToStartAction: SwipeAction? = null,
    content: @Composable RowScope.() -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.StartToEnd -> {
                    startToEndAction?.onAction?.invoke()
                    false // Não remover, apenas executar ação
                }
                SwipeToDismissBoxValue.EndToStart -> {
                    endToStartAction?.onAction?.invoke()
                    false // Não remover, apenas executar ação
                }
                SwipeToDismissBoxValue.Settled -> false
            }
        }
    )

    // Resetar estado após ação
    LaunchedEffect(dismissState.currentValue) {
        if (dismissState.currentValue != SwipeToDismissBoxValue.Settled) {
            dismissState.snapTo(SwipeToDismissBoxValue.Settled)
        }
    }

    val enableDismissFromStartToEnd = startToEndAction != null
    val enableDismissFromEndToStart = endToStartAction != null

    SwipeToDismissBox(
        state = dismissState,
        modifier = modifier,
        enableDismissFromStartToEnd = enableDismissFromStartToEnd,
        enableDismissFromEndToStart = enableDismissFromEndToStart,
        backgroundContent = {
            // Fundo visível durante o swipe
            val direction = dismissState.dismissDirection

            val backgroundColor by animateColorAsState(
                targetValue = when (direction) {
                    SwipeToDismissBoxValue.StartToEnd ->
                        startToEndAction?.color ?: MaterialTheme.colorScheme.surface
                    SwipeToDismissBoxValue.EndToStart ->
                        endToStartAction?.color ?: MaterialTheme.colorScheme.surface
                    else -> MaterialTheme.colorScheme.surface
                },
                animationSpec = tween(200),
                label = "swipeBackgroundColor"
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(backgroundColor)
                    .padding(horizontal = 20.dp),
                contentAlignment = when (direction) {
                    SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
                    SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
                    else -> Alignment.CenterEnd
                }
            ) {
                val action = when (direction) {
                    SwipeToDismissBoxValue.StartToEnd -> startToEndAction
                    SwipeToDismissBoxValue.EndToStart -> endToStartAction
                    else -> null
                }

                if (action != null) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = action.icon,
                            contentDescription = action.label,
                            modifier = Modifier.size(24.dp),
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = action.label,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        },
        content = content
    )
}
