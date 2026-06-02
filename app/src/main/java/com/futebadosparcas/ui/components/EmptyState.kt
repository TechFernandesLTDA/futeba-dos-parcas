package com.futebadosparcas.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

@Deprecated(
    message = "Use modern/EmptyState instead",
    replaceWith = ReplaceWith("EmptyState", "com.futebadosparcas.ui.components.modern.EmptyState")
)
/**
 * Estados vazios diferenciados para melhor UX
 */
sealed class EmptyStateType {
    /**
     * Nenhum dado disponível (primeira vez, lista vazia)
     */
    data class NoData(
        val title: String,
        val description: String,
        val icon: ImageVector = Icons.Default.Inbox,
        val actionLabel: String? = null,
        val onAction: (() -> Unit)? = null
    ) : EmptyStateType()

    /**
     * Erro com opção de retry
     */
    data class Error(
        val title: String,
        val description: String,
        val icon: ImageVector = Icons.Default.Error,
        val actionLabel: String? = null,
        val onRetry: () -> Unit
    ) : EmptyStateType()

    /**
     * Sem conexão com internet
     */
    data class NoConnection(
        val title: String? = null,
        val description: String? = null,
        val icon: ImageVector = Icons.Default.WifiOff,
        val actionLabel: String? = null,
        val onRetry: () -> Unit
    ) : EmptyStateType()

    /**
     * Busca sem resultados
     */
    data class NoResults(
        val title: String? = null,
        val description: String,
        val icon: ImageVector = Icons.Default.SearchOff,
        val actionLabel: String? = null,
        val onAction: (() -> Unit)? = null
    ) : EmptyStateType()
}

@Deprecated(
    message = "Use modern/EmptyState instead",
    replaceWith = ReplaceWith("EmptyState", "com.futebadosparcas.ui.components.modern.EmptyState")
)
/**
 * Componente principal de Empty State
 * Exibe diferentes estados vazios com animações suaves
 */
@Composable
fun EmptyState(
    type: EmptyStateType,
    modifier: Modifier = Modifier,
    visible: Boolean = true
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut(),
        modifier = modifier
    ) {
        when (type) {
            is EmptyStateType.NoData -> EmptyStateContent(
                icon = type.icon,
                title = type.title,
                description = type.description,
                iconTint = MaterialTheme.colorScheme.primary,
                actionLabel = type.actionLabel,
                onAction = type.onAction
            )

            is EmptyStateType.Error -> EmptyStateContent(
                icon = type.icon,
                title = type.title,
                description = type.description,
                iconTint = MaterialTheme.colorScheme.error,
                actionLabel = type.actionLabel ?: stringResource(R.string.action_try_again),
                onAction = type.onRetry
            )

            is EmptyStateType.NoConnection -> EmptyStateContent(
                icon = type.icon,
                title = type.title ?: stringResource(R.string.empty_state_no_connection_title),
                description = type.description ?: stringResource(R.string.empty_state_no_connection_desc),
                iconTint = MaterialTheme.colorScheme.tertiary,
                actionLabel = type.actionLabel ?: stringResource(R.string.action_try_again),
                onAction = type.onRetry
            )

            is EmptyStateType.NoResults -> EmptyStateContent(
                icon = type.icon,
                title = type.title ?: stringResource(R.string.empty_state_no_results_title),
                description = type.description,
                iconTint = MaterialTheme.colorScheme.secondary,
                actionLabel = type.actionLabel ?: stringResource(R.string.action_clear_search),
                onAction = type.onAction
            )
        }
    }
}

/**
 * Conteúdo interno do Empty State
 */
@Composable
private fun EmptyStateContent(
    icon: ImageVector,
    title: String,
    description: String,
    iconTint: Color,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ícone
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = iconTint.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Título
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Descrição
        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        // Ação (se disponível)
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(24.dp))

            FilledTonalButton(
                onClick = onAction,
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = iconTint.copy(alpha = 0.12f),
                    contentColor = iconTint
                )
            ) {
                Text(text = actionLabel)
            }
        }
    }
}

@Deprecated(
    message = "Use modern/CompactEmptyState instead",
    replaceWith = ReplaceWith("CompactEmptyState", "com.futebadosparcas.ui.components.modern.CompactEmptyState")
)
/**
 * Variante compacta para uso em seções menores
 */
@Composable
fun EmptyStateCompact(
    icon: ImageVector,
    message: String,
    modifier: Modifier = Modifier,
    iconTint: Color = MaterialTheme.colorScheme.primary,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = iconTint.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(16.dp))

            TextButton(onClick = onAction) {
                Text(text = actionLabel)
            }
        }
    }
}

@Deprecated(
    message = "Use modern/EmptyGamesState instead",
    replaceWith = ReplaceWith("EmptyGamesState", "com.futebadosparcas.ui.components.modern.EmptyGamesState")
)
@Suppress("DEPRECATION")
/**
 * Empty State para listas de jogos
 */
@Composable
fun EmptyGamesState(
    modifier: Modifier = Modifier,
    onCreateGame: (() -> Unit)? = null
) {
    EmptyState(
        type = EmptyStateType.NoData(
            title = stringResource(R.string.empty_state_no_games_title),
            description = stringResource(R.string.empty_state_no_games_desc),
            icon = Icons.Default.SportsScore,
            actionLabel = if (onCreateGame != null) stringResource(R.string.create_game) else null,
            onAction = onCreateGame
        ),
        modifier = modifier
    )
}

@Deprecated(
    message = "Use modern/EmptyPlayersState instead",
    replaceWith = ReplaceWith("EmptyPlayersState", "com.futebadosparcas.ui.components.modern.EmptyPlayersState")
)
@Suppress("DEPRECATION")
/**
 * Empty State para lista de jogadores
 */
@Composable
fun EmptyPlayersState(
    modifier: Modifier = Modifier,
    onInvitePlayers: (() -> Unit)? = null
) {
    EmptyState(
        type = EmptyStateType.NoData(
            title = stringResource(R.string.empty_state_no_players_title),
            description = stringResource(R.string.empty_state_no_players_desc),
            icon = Icons.Default.GroupAdd,
            actionLabel = if (onInvitePlayers != null) stringResource(R.string.invite_players) else null,
            onAction = onInvitePlayers
        ),
        modifier = modifier
    )
}

@Deprecated(
    message = "Use modern/EmptySearchState instead",
    replaceWith = ReplaceWith("EmptySearchState", "com.futebadosparcas.ui.components.modern.EmptySearchState")
)
@Suppress("DEPRECATION")
/**
 * Empty State para busca sem resultados
 */
@Composable
fun EmptySearchState(
    query: String,
    onClearSearch: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyState(
        type = EmptyStateType.NoResults(
            description = stringResource(R.string.empty_state_desc_no_results, query),
            onAction = onClearSearch
        ),
        modifier = modifier
    )
}
