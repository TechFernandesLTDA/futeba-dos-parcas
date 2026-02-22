package com.futebadosparcas.ui.components.states

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun EmptyState(
    emoji: String,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null
) {
    var visible by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        visible = true
    }
    
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + scaleIn(
            initialScale = 0.9f,
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = emoji,
                fontSize = 64.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = description,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.8f)
            )

            if (actionText != null && onAction != null) {
                Spacer(modifier = Modifier.height(24.dp))

                FilledTonalButton(
                    onClick = onAction,
                    modifier = Modifier
                        .fillMaxWidth(0.5f)
                        .height(48.dp)
                ) {
                    Text(
                        text = actionText,
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
        }
    }
}

@Composable
fun EmptyStateCompact(
    emoji: String,
    message: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = emoji,
            fontSize = 48.sp,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        if (actionText != null && onAction != null) {
            Spacer(modifier = Modifier.height(16.dp))

            TextButton(onClick = onAction) {
                Text(text = actionText)
            }
        }
    }
}

@Composable
fun EmptyGamesState(
    modifier: Modifier = Modifier,
    onCreateGame: (() -> Unit)? = null
) {
    EmptyState(
        emoji = "\uD83C\uDFC0",
        title = "Nenhum jogo agendado",
        description = "Que tal criar o primeiro jogo e reunir a galera?",
        actionText = if (onCreateGame != null) "Criar Jogo" else null,
        onAction = onCreateGame,
        modifier = modifier
    )
}

@Composable
fun EmptyPlayersState(
    modifier: Modifier = Modifier,
    onInvite: (() -> Unit)? = null
) {
    EmptyState(
        emoji = "\uD83D\uDC65",
        title = "Nenhum jogador",
        description = "Convide seus amigos para começar a jogar!",
        actionText = if (onInvite != null) "Convidar" else null,
        onAction = onInvite,
        modifier = modifier
    )
}

@Composable
fun EmptyGroupsState(
    modifier: Modifier = Modifier,
    onCreateGroup: (() -> Unit)? = null
) {
    EmptyState(
        emoji = "\uD83D\uDC65",
        title = "Nenhum grupo",
        description = "Crie um grupo para organizar suas peladas!",
        actionText = if (onCreateGroup != null) "Criar Grupo" else null,
        onAction = onCreateGroup,
        modifier = modifier
    )
}

@Composable
fun EmptyNotificationsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        emoji = "\uD83D\uDD14",
        title = "Sem notificações",
        description = "Você está em dia! Novas notificações aparecerão aqui.",
        modifier = modifier
    )
}

@Composable
fun EmptySearchState(
    query: String,
    modifier: Modifier = Modifier,
    onClearSearch: (() -> Unit)? = null
) {
    EmptyState(
        emoji = "\uD83D\uDD0D",
        title = "Nenhum resultado",
        description = "Não encontramos nada para \"$query\"",
        actionText = if (onClearSearch != null) "Limpar busca" else null,
        onAction = onClearSearch,
        modifier = modifier
    )
}

@Composable
fun EmptyRankingState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        emoji = "\uD83C\uDFC6",
        title = "Ranking vazio",
        description = "Jogue algumas partidas para aparecer no ranking!",
        modifier = modifier
    )
}

@Composable
fun EmptyStatisticsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        emoji = "\uD83D\uDCCA",
        title = "Sem estatísticas",
        description = "Complete alguns jogos para ver suas estatísticas!",
        modifier = modifier
    )
}

@Composable
fun EmptyBadgesState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        emoji = "\uD83C\uDF96\uFE0F",
        title = "Nenhuma conquista",
        description = "Continue jogando para desbloquear conquistas!",
        modifier = modifier
    )
}

@Composable
fun EmptyLocationsState(
    modifier: Modifier = Modifier,
    onAddLocation: (() -> Unit)? = null
) {
    EmptyState(
        emoji = "\uD83D\uDCCD",
        title = "Nenhum local",
        description = "Adicione campos para organizar seus jogos!",
        actionText = if (onAddLocation != null) "Adicionar Local" else null,
        onAction = onAddLocation,
        modifier = modifier
    )
}

@Composable
fun EmptyActivitiesState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        emoji = "\uD83D\uDCDD",
        title = "Sem atividades",
        description = "As atividades recentes aparecerão aqui.",
        modifier = modifier
    )
}
