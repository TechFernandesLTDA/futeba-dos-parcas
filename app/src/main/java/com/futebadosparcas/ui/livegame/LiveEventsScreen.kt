package com.futebadosparcas.ui.livegame

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * LiveEventsScreen - Exibe eventos ao vivo de um jogo
 *
 * Mostra:
 * - Lista de eventos (gols, substituições, etc)
 * - Tipo de evento com ícone
 * - Nome do jogador
 * - Timestamp do evento
 * - Atualização em tempo real via Firestore
 *
 * Features:
 * - Auto-refresh de eventos
 * - Loading state com shimmer
 * - Empty state quando sem eventos
 * - Cores por tipo de evento
 */
@Composable
fun LiveEventsScreen(
    viewModel: LiveEventsViewModel,
    onEventClick: (eventId: String) -> Unit = {},
    gameId: String = ""
) {
    val events by viewModel.events.collectAsStateWithLifecycle()

    LaunchedEffect(gameId) {
        if (gameId.isNotEmpty()) {
            viewModel.observeEvents(gameId)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (events.isEmpty()) {
            LiveEventsEmptyState()
        } else {
            LiveEventsContent(
                events = events,
                onEventClick = onEventClick
            )
        }
    }
}

/**
 * Conteúdo quando temos eventos
 */
@Composable
private fun LiveEventsContent(
    events: List<GameEvent>,
    onEventClick: (eventId: String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(events, key = { it.id }) { event ->
            GameEventCard(
                event = event,
                onClick = { onEventClick(event.id) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/**
 * Card de evento de jogo
 */
@Composable
private fun GameEventCard(
    event: GameEvent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 80.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = getEventColor(event.eventType)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Ícone do tipo de evento
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            ) {
                Icon(
                    imageVector = getEventIcon(event.eventType),
                    contentDescription = stringResource(R.string.cd_event_type_icon),
                    modifier = Modifier
                        .size(40.dp)
                        .padding(8.dp),
                    tint = MaterialTheme.colorScheme.onSurface
                )
            }

            // Informações do evento
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.Center
            ) {
                // Tipo de evento
                Text(
                    text = getEventTypeLabel(event.eventType),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Jogador e time
                Text(
                    text = event.playerName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                )

                // Assistência (se houver)
                if (!event.assistedById.isNullOrEmpty()) {
                    Text(
                        text = stringResource(R.string.live_game_assist_by, event.assistedByName ?: event.assistedById ?: ""),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Minuto do evento
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
            ) {
                Text(
                    text = "⏱",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(6.dp),
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

/**
 * Estado vazio quando não há eventos
 */
@Composable
private fun LiveEventsEmptyState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.EventNote,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.live_game_no_events),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Text(
            text = stringResource(R.string.live_game_no_events_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

/**
 * Obtém a cor baseada no tipo de evento
 */
@Composable
private fun getEventColor(eventType: String): androidx.compose.ui.graphics.Color {
    return when (eventType.lowercase()) {
        "goal" -> com.futebadosparcas.ui.theme.MatchEventColors.GoalBackground
        "substitution" -> com.futebadosparcas.ui.theme.MatchEventColors.SubstitutionBackground
        "yellowcard" -> com.futebadosparcas.ui.theme.MatchEventColors.YellowCardBackground
        "redcard" -> com.futebadosparcas.ui.theme.MatchEventColors.RedCardBackground
        "foul" -> com.futebadosparcas.ui.theme.MatchEventColors.FoulBackground
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
}

/**
 * Obtém ícone baseado no tipo de evento
 */
private fun getEventIcon(eventType: String) = when (eventType.lowercase()) {
    "goal" -> Icons.Default.Stars
    "substitution" -> Icons.Default.Person
    "yellowcard" -> Icons.Default.Warning
    "redcard" -> Icons.Default.Close
    "foul" -> Icons.Default.Gavel
    else -> Icons.AutoMirrored.Filled.EventNote
}

/**
 * Obtém label do tipo de evento
 */
@Composable
private fun getEventTypeLabel(eventType: String): String {
    val prefix = when (eventType.lowercase()) {
        "goal" -> "⚽ "
        "substitution" -> "🔄 "
        "yellowcard" -> "🟨 "
        "redcard" -> "🔴 "
        "foul" -> "⚠️ "
        else -> "📝 "
    }
    val label = when (eventType.lowercase()) {
        "goal" -> stringResource(R.string.live_game_event_goal)
        "substitution" -> stringResource(R.string.live_game_event_substitution)
        "yellowcard" -> stringResource(R.string.live_game_event_yellow_card)
        "redcard" -> stringResource(R.string.live_game_event_red_card)
        "foul" -> stringResource(R.string.live_game_event_foul)
        else -> stringResource(R.string.live_game_event_default)
    }
    return prefix + label
}
