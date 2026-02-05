package com.futebadosparcas.ui.games

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.ui.components.FutebaTopBar
import com.futebadosparcas.ui.components.ShimmerGameCard
import com.futebadosparcas.ui.components.modern.ErrorState
import com.futebadosparcas.ui.components.modern.ErrorType
import com.futebadosparcas.ui.theme.GamificationColors

/**
 * GamesScreen - Tela de listagem de jogos em Jetpack Compose
 *
 * Features:
 * - Listagem responsiva (grid ou lista)
 * - Filtros por tipo (Todos, Abertos, Meus Jogos)
 * - Cards com informações do jogo
 * - Estados de loading, success, error
 * - Pull-to-refresh (via Fragment)
 * - Navegação via callbacks
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamesScreen(
    viewModel: GamesViewModel,
    onGameClick: (gameId: String) -> Unit = {},
    onCreateGameClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    onGroupsClick: () -> Unit = {},
    onMapClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            FutebaTopBar(
                unreadCount = unreadCount,
                onNavigateNotifications = onNotificationsClick,
                onNavigateGroups = onGroupsClick,
                onNavigateMap = onMapClick
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateGameClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.create_game))
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (uiState) {
                is GamesUiState.Loading -> {
                    GamesLoadingState()
                }
                is GamesUiState.Success -> {
                    val state = uiState as GamesUiState.Success
                    GamesSuccessContent(
                        games = state.games,
                        onGameClick = onGameClick,
                        onFilterChange = { filterType ->
                            viewModel.loadGames(filterType)
                        }
                    )
                }
                is GamesUiState.Empty -> {
                    GamesEmptyState(
                        onCreateGameClick = onCreateGameClick
                    )
                }
                is GamesUiState.Error -> {
                    val state = uiState as GamesUiState.Error
                    GamesErrorState(
                        message = state.message,
                        onRetry = {
                            viewModel.loadGames()
                        }
                    )
                }
            }
        }
    }
}

/**
 * Conteúdo quando temos jogos para exibir
 */
@Composable
private fun GamesSuccessContent(
    games: List<GameWithConfirmations>,
    onGameClick: (gameId: String) -> Unit,
    onFilterChange: (GameFilterType) -> Unit
) {
    var selectedFilter by remember { mutableStateOf(GameFilterType.ALL) }

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Filtros
        GamesFilters(
            selectedFilter = selectedFilter,
            onFilterChange = { newFilter ->
                selectedFilter = newFilter
                onFilterChange(newFilter)
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        )

        // Lista de jogos
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
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
}

/**
 * Filtros para tipos de jogos
 */
@Composable
private fun GamesFilters(
    selectedFilter: GameFilterType,
    onFilterChange: (GameFilterType) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = selectedFilter == GameFilterType.ALL,
            onClick = { onFilterChange(GameFilterType.ALL) },
            label = { Text(stringResource(R.string.all_games)) },
            leadingIcon = {
                Icon(
                    imageVector = if (selectedFilter == GameFilterType.ALL) Icons.Default.Check else Icons.Default.CalendarMonth,
                    contentDescription = stringResource(R.string.all_games),
                    modifier = Modifier.size(FilterChipDefaults.IconSize)
                )
            }
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.OPEN,
            onClick = { onFilterChange(GameFilterType.OPEN) },
            label = { Text(stringResource(R.string.open_games)) },
            leadingIcon = {
                Icon(
                    imageVector = if (selectedFilter == GameFilterType.OPEN) Icons.Default.Check else Icons.Default.LockOpen,
                    contentDescription = stringResource(R.string.open_games),
                    modifier = Modifier.size(FilterChipDefaults.IconSize)
                )
            }
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.MY_GAMES,
            onClick = { onFilterChange(GameFilterType.MY_GAMES) },
            label = { Text(stringResource(R.string.my_games)) },
            leadingIcon = {
                Icon(
                    imageVector = if (selectedFilter == GameFilterType.MY_GAMES) Icons.Default.Check else Icons.Default.Person,
                    contentDescription = stringResource(R.string.my_games),
                    modifier = Modifier.size(FilterChipDefaults.IconSize)
                )
            }
        )
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
    Card(
        modifier = modifier
            .clickable(onClick = onClick)
            .fillMaxWidth()
            .heightIn(min = 120.dp),
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
            // Header com local e tipo de campo
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
                    shape = RoundedCornerShape(6.dp),
                    color = getFieldTypeColor(game.game.gameType),
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
                    text = buildString {
                        append(game.game.date)
                        if (game.game.time.isNotEmpty()) {
                            append(" ${game.game.time}")
                        } else {
                            append(" (--:--)")
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (game.game.time.isEmpty()) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            // Confirmações
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
                    text = "${game.game.playersCount} ${stringResource(R.string.confirmed_players)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                // Status badge
                if (game.game.status.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = getStatusColor(game.game.status),
                        modifier = Modifier.padding(end = 4.dp)
                    ) {
                        Text(
                            text = getStatusText(game.game.status),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Estado de loading
 */
@Composable
private fun GamesLoadingState() {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(6, key = { "shimmer_$it" }) {
            ShimmerGameCard()
        }
    }
}

/**
 * Estado vazio
 */
@Composable
private fun GamesEmptyState(
    onCreateGameClick: () -> Unit
) {
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
            text = stringResource(R.string.no_games),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Text(
            text = stringResource(R.string.no_games_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 16.dp)
        )

        Button(onClick = onCreateGameClick) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.create_game), modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.create_game))
        }
    }
}

/**
 * Estado de erro usando componente moderno com ilustração
 */
@Composable
private fun GamesErrorState(
    message: String,
    onRetry: () -> Unit
) {
    // Detecta tipo de erro pela mensagem para exibir ícone apropriado
    val errorType = when {
        message.contains("conexão", ignoreCase = true) ||
            message.contains("network", ignoreCase = true) ||
            message.contains("internet", ignoreCase = true) -> ErrorType.NETWORK
        message.contains("timeout", ignoreCase = true) ||
            message.contains("tempo", ignoreCase = true) -> ErrorType.TIMEOUT
        message.contains("servidor", ignoreCase = true) ||
            message.contains("server", ignoreCase = true) -> ErrorType.SERVER
        message.contains("permissão", ignoreCase = true) ||
            message.contains("permission", ignoreCase = true) -> ErrorType.PERMISSION
        else -> ErrorType.GENERIC
    }

    ErrorState(
        errorType = errorType,
        message = message,
        onRetry = onRetry,
        actionText = stringResource(R.string.retry)
    )
}

/**
 * Obtém cor baseada no tipo de campo
 */
private fun getFieldTypeColor(fieldType: String) = when (fieldType.lowercase()) {
    "society" -> com.futebadosparcas.ui.theme.FieldTypeColors.Society
    "futsal" -> com.futebadosparcas.ui.theme.FieldTypeColors.Futsal
    "grama", "campo" -> com.futebadosparcas.ui.theme.FieldTypeColors.Campo
    "areia" -> com.futebadosparcas.ui.theme.FieldTypeColors.Areia
    else -> com.futebadosparcas.ui.theme.FieldTypeColors.Outros
}

/**
 * Obtém cor baseada no status do jogo
 */
private fun getStatusColor(status: String) = when (status.uppercase()) {
    "OPEN" -> com.futebadosparcas.ui.theme.GameStatusColors.Scheduled
    "CONFIRMED" -> com.futebadosparcas.ui.theme.GameStatusColors.InProgress
    "SCHEDULED" -> com.futebadosparcas.ui.theme.GameStatusColors.Scheduled
    "LIVE" -> com.futebadosparcas.ui.theme.GameStatusColors.Full
    "FINISHED" -> com.futebadosparcas.ui.theme.GameStatusColors.Finished
    "CANCELLED" -> com.futebadosparcas.ui.theme.GameStatusColors.Cancelled
    else -> com.futebadosparcas.ui.theme.GameStatusColors.Finished
}

/**
 * Traduz o status do jogo para texto legível
 */
@Composable
private fun getStatusText(status: String): String = when (status.uppercase()) {
    "OPEN" -> stringResource(R.string.status_display_open)
    "CONFIRMED" -> stringResource(R.string.status_display_confirmed)
    "SCHEDULED" -> stringResource(R.string.status_display_scheduled)
    "LIVE" -> stringResource(R.string.status_display_live)
    "FINISHED" -> stringResource(R.string.status_display_finished)
    "CANCELLED" -> stringResource(R.string.status_display_cancelled)
    else -> status
}

/**
 * Formata data/hora do jogo
 */
private fun formatGameDateTime(timestamp: Long): String {
    val sdf = java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.getDefault())
    return sdf.format(java.util.Date(timestamp))
}
