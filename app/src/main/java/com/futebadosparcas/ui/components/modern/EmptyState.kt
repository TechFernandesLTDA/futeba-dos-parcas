package com.futebadosparcas.ui.components.modern

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Empty state moderno com ilustração, mensagem e CTA
 *
 * Segue Material 3 Design System para estados vazios
 *
 * @param icon Ícone ilustrativo (pode ser substituído por Lottie animation)
 * @param title Título principal
 * @param message Mensagem descritiva
 * @param actionText Texto do botão de ação (opcional)
 * @param onAction Ação ao clicar no botão (opcional)
 */
@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ícone ilustrativo
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(120.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Título
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Mensagem
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        // Botão de ação (se fornecido)
        if (actionText != null && onAction != null) {
            Spacer(modifier = Modifier.height(24.dp))

            FilledTonalButton(
                onClick = onAction,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
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

/**
 * Empty state pré-configurado para lista de jogos
 */
@Composable
fun EmptyGamesState(
    modifier: Modifier = Modifier,
    onCreateGame: (() -> Unit)? = null
) {
    EmptyState(
        icon = Icons.Default.SportsFootball,
        title = "Nenhum jogo agendado",
        message = "Crie o primeiro jogo e convoque seus amigos para uma pelada!",
        actionText = if (onCreateGame != null) "Criar Jogo" else null,
        onAction = onCreateGame,
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para confirmações
 */
@Composable
fun EmptyConfirmationsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.PeopleAlt,
        title = "Nenhuma confirmação ainda",
        message = "Aguardando os jogadores confirmarem presença.",
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para estatísticas
 */
@Composable
fun EmptyStatisticsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.BarChart,
        title = "Sem estatísticas",
        message = "Participe de jogos para ver suas estatísticas aqui!",
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para badges
 */
@Composable
fun EmptyBadgesState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.EmojiEvents,
        title = "Nenhuma conquista ainda",
        message = "Jogue mais partidas para desbloquear badges e conquistas!",
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para notificações
 */
@Composable
fun EmptyNotificationsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.Notifications,
        title = "Nenhuma notificação",
        message = "Você está em dia! Nenhuma novidade por enquanto.",
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para busca sem resultados
 */
@Composable
fun EmptySearchState(
    searchQuery: String,
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.SearchOff,
        title = "Nenhum resultado",
        message = "Não encontramos nada para \"$searchQuery\".\nTente buscar com outros termos.",
        modifier = modifier
    )
}

/**
 * Variante compacta para empty state em cards/seções
 */
@Composable
fun CompactEmptyState(
    icon: ImageVector,
    message: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(48.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}
