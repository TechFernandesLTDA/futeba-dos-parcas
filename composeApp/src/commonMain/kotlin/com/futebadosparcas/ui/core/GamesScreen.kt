package com.futebadosparcas.ui.core

import com.futebadosparcas.compose.di.koinViewModelOrNull
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.games_card_cd_no_status
import com.futebadosparcas.compose.resources.games_card_cd_with_status
import com.futebadosparcas.compose.resources.games_confirmed_count
import com.futebadosparcas.compose.resources.games_create_game_cd
import com.futebadosparcas.compose.resources.games_create_new_game
import com.futebadosparcas.compose.resources.games_empty_description
import com.futebadosparcas.compose.resources.games_empty_title
import com.futebadosparcas.compose.resources.games_error_title
import com.futebadosparcas.compose.resources.games_schedule_at
import com.futebadosparcas.compose.resources.games_schedule_time_not_defined
import com.futebadosparcas.compose.resources.games_status_cancelled_label
import com.futebadosparcas.compose.resources.games_status_confirmed_label
import com.futebadosparcas.compose.resources.games_status_finished_label
import com.futebadosparcas.compose.resources.games_status_live_label
import com.futebadosparcas.compose.resources.games_status_open_label
import com.futebadosparcas.compose.resources.games_status_scheduled_label
import com.futebadosparcas.compose.resources.games_time_inline
import com.futebadosparcas.compose.resources.games_time_missing
import com.futebadosparcas.compose.resources.games_title
import com.futebadosparcas.compose.resources.retry
import com.futebadosparcas.domain.model.GameWithConfirmations
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel

/**
 * GamesScreen – Tela principal de listagem de jogos do Futeba dos Parças.
 *
 * Exibe uma lista vertical com cards de jogo, estados de loading/empty/error
 * e um FAB para criar novo jogo.
 * ViewModel obtido via koinViewModel().
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamesScreen(
    viewModel: GamesViewModel? = koinViewModelOrNull<GamesViewModel>(),
    onGameClick: (String) -> Unit = {},
    onCreateGameClick: () -> Unit = {}
) {
    val fallbackState = remember {
        mutableStateOf<GamesUiState>(GamesUiState.Error("Dados de jogos indisponíveis neste ambiente."))
    }
    val uiState by (viewModel?.uiState?.collectAsStateWithLifecycle() ?: fallbackState)
    val title = stringResource(Res.string.games_title)

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            AdaptiveTopBar(
                title = title,
                containerColor = MaterialTheme.colorScheme.surface
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateGameClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    Icons.Default.Add,
                    contentDescription = stringResource(Res.string.games_create_game_cd)
                )
            }
        }
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            val contentMaxWidth = if (maxWidth >= 840.dp) 920.dp else 720.dp
            when (val state = uiState) {
                is GamesUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize().widthIn(max = contentMaxWidth),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is GamesUiState.Success -> {
                    GamesList(
                        games = state.games,
                        onGameClick = onGameClick,
                        maxWidth = contentMaxWidth
                    )
                }
                is GamesUiState.Empty -> {
                    GamesEmptyState(
                        onCreateGameClick = onCreateGameClick,
                        maxWidth = contentMaxWidth
                    )
                }
                is GamesUiState.Error -> {
                    GamesErrorState(
                        message = state.message,
                        onRetry = { viewModel?.loadGames() },
                        maxWidth = contentMaxWidth
                    )
                }
            }
        }
    }
}

// =============================================================================
// Componentes internos da tela
// =============================================================================

/**
 * Lista de cards de jogos
 */
@Composable
private fun GamesList(
    games: List<GameWithConfirmations>,
    onGameClick: (String) -> Unit,
    maxWidth: androidx.compose.ui.unit.Dp
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = maxWidth),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(games, key = { it.game.id }) { game ->
            GameCard(
                game = game,
                onClick = { onGameClick(game.game.id) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/**
 * Card individual de jogo
 */
@Composable
private fun GameCard(
    game: GameWithConfirmations,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scheduleDescription = if (game.game.time.isNotEmpty()) {
        stringResource(Res.string.games_schedule_at, game.game.date, game.game.time)
    } else {
        stringResource(Res.string.games_schedule_time_not_defined, game.game.date)
    }
    val statusText = if (game.game.status.isNotEmpty()) {
        gameStatusText(game.game.status)
    } else {
        null
    }
    val locationDescription = buildString {
        append(game.game.locationName)
        if (game.game.locationAddress.isNotEmpty()) {
            append(", ")
            append(game.game.locationAddress)
        }
    }
    val cardContentDescription = if (statusText != null) {
        stringResource(
            Res.string.games_card_cd_with_status,
            locationDescription,
            scheduleDescription,
            game.game.playersCount,
            statusText
        )
    } else {
        stringResource(
            Res.string.games_card_cd_no_status,
            locationDescription,
            scheduleDescription,
            game.game.playersCount
        )
    }

    Card(
        onClick = onClick,
        modifier = modifier
            .heightIn(min = 120.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = cardContentDescription
                role = Role.Button
            },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Linha superior: local + badge tipo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = game.game.locationName,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (game.game.locationAddress.isNotEmpty()) {
                        Text(
                            text = game.game.locationAddress,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                // Badge de tipo de campo
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = gameFieldTypeColor(game.game.gameType),
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Text(
                        text = game.game.gameType,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Data e hora
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = if (game.game.time.isNotEmpty()) {
                        stringResource(Res.string.games_time_inline, game.game.date, game.game.time)
                    } else {
                        stringResource(Res.string.games_time_missing, game.game.date)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (game.game.time.isEmpty()) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            // Confirmações e status
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = stringResource(Res.string.games_confirmed_count, game.game.playersCount),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.weight(1f))

                if (game.game.status.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = gameStatusColor(game.game.status),
                        modifier = Modifier.padding(end = 4.dp)
                    ) {
                        Text(
                            text = gameStatusText(game.game.status),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Estado vazio – nenhum jogo agendado com CTA para criar jogo
 */
@Composable
private fun GamesEmptyState(
    onCreateGameClick: () -> Unit,
    maxWidth: androidx.compose.ui.unit.Dp
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .widthIn(max = maxWidth)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.EventNote,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = stringResource(Res.string.games_empty_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() }
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = stringResource(Res.string.games_empty_description),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .padding(bottom = 24.dp)
        )
        FilledTonalButton(
            onClick = onCreateGameClick,
            modifier = Modifier
                .fillMaxWidth(0.6f)
                .height(48.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(Res.string.games_create_new_game))
        }
    }
}

/**
 * Estado de erro com botão de retry
 */
@Composable
private fun GamesErrorState(
    message: String,
    onRetry: () -> Unit,
    maxWidth: androidx.compose.ui.unit.Dp
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .widthIn(max = maxWidth)
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.games_error_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.semantics { heading() }
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 16.dp),
            textAlign = TextAlign.Center
        )
        Button(onClick = onRetry) {
            Text(stringResource(Res.string.retry))
        }
    }
}

// =============================================================================
// Funções auxiliares de cor e texto (precisam ser @Composable para acessar
// MaterialTheme.colorScheme)
// =============================================================================

/**
 * Retorna a cor associada ao tipo de campo
 */
@Composable
private fun gameFieldTypeColor(fieldType: String) = when (fieldType.lowercase()) {
    "society" -> MaterialTheme.colorScheme.tertiary
    "futsal"  -> MaterialTheme.colorScheme.secondary
    "grama", "campo" -> MaterialTheme.colorScheme.primary
    "areia"   -> MaterialTheme.colorScheme.error
    else      -> MaterialTheme.colorScheme.outline
}

/**
 * Retorna a cor associada ao status do jogo
 */
@Composable
private fun gameStatusColor(status: String) = when (status.uppercase()) {
    "OPEN"      -> MaterialTheme.colorScheme.tertiary
    "CONFIRMED" -> MaterialTheme.colorScheme.secondary
    "SCHEDULED" -> MaterialTheme.colorScheme.primary
    "LIVE"      -> MaterialTheme.colorScheme.primary
    "FINISHED"  -> MaterialTheme.colorScheme.outline
    "CANCELLED" -> MaterialTheme.colorScheme.error
    else        -> MaterialTheme.colorScheme.outline
}

/**
 * Traduz o status do jogo para texto legível
 */
@Composable
private fun gameStatusText(status: String): String = when (status.uppercase()) {
    "OPEN"      -> stringResource(Res.string.games_status_open_label)
    "CONFIRMED" -> stringResource(Res.string.games_status_confirmed_label)
    "SCHEDULED" -> stringResource(Res.string.games_status_scheduled_label)
    "LIVE"      -> stringResource(Res.string.games_status_live_label)
    "FINISHED"  -> stringResource(Res.string.games_status_finished_label)
    "CANCELLED" -> stringResource(Res.string.games_status_cancelled_label)
    else        -> status
}
