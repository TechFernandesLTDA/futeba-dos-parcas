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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

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
        val actionLabel: String = "Tentar Novamente",
        val onRetry: () -> Unit
    ) : EmptyStateType()

    /**
     * Sem conexão com internet
     */
    data class NoConnection(
        val title: String = "Sem conexão",
        val description: String = "Verifique sua conexão com a internet e tente novamente",
        val icon: ImageVector = Icons.Default.WifiOff,
        val actionLabel: String = "Tentar Novamente",
        val onRetry: () -> Unit
    ) : EmptyStateType()

    /**
     * Busca sem resultados
     */
    data class NoResults(
        val title: String = "Nenhum resultado encontrado",
        val description: String,
        val icon: ImageVector = Icons.Default.SearchOff,
        val actionLabel: String? = "Limpar Busca",
        val onAction: (() -> Unit)? = null
    ) : EmptyStateType()
}

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
                actionLabel = type.actionLabel,
                onAction = type.onRetry
            )

            is EmptyStateType.NoConnection -> EmptyStateContent(
                icon = type.icon,
                title = type.title,
                description = type.description,
                iconTint = MaterialTheme.colorScheme.tertiary,
                actionLabel = type.actionLabel,
                onAction = type.onRetry
            )

            is EmptyStateType.NoResults -> EmptyStateContent(
                icon = type.icon,
                title = type.title,
                description = type.description,
                iconTint = MaterialTheme.colorScheme.secondary,
                actionLabel = type.actionLabel,
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
            title = "Nenhum jogo agendado",
            description = "Que tal criar o primeiro jogo e reunir a galera?",
            icon = Icons.Default.SportsScore,
            actionLabel = if (onCreateGame != null) "Criar Jogo" else null,
            onAction = onCreateGame
        ),
        modifier = modifier
    )
}

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
            title = "Nenhum jogador",
            description = "Convide seus amigos para começar a jogar!",
            icon = Icons.Default.GroupAdd,
            actionLabel = if (onInvitePlayers != null) "Convidar Jogadores" else null,
            onAction = onInvitePlayers
        ),
        modifier = modifier
    )
}

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
            description = "Nenhum resultado para \"$query\"",
            actionLabel = "Limpar Busca",
            onAction = onClearSearch
        ),
        modifier = modifier
    )
}
