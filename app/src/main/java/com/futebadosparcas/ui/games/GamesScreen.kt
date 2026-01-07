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
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
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
            leadingIcon = if (selectedFilter == GameFilterType.ALL) {
                { Icon(Icons.Default.Check, null, modifier = Modifier.size(FilterChipDefaults.IconSize)) }
            } else null
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.OPEN,
            onClick = { onFilterChange(GameFilterType.OPEN) },
            label = { Text(stringResource(R.string.open_games)) },
            leadingIcon = if (selectedFilter == GameFilterType.OPEN) {
                { Icon(Icons.Default.Check, null, modifier = Modifier.size(FilterChipDefaults.IconSize)) }
            } else null
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.MY_GAMES,
            onClick = { onFilterChange(GameFilterType.MY_GAMES) },
            label = { Text(stringResource(R.string.my_games)) },
            leadingIcon = if (selectedFilter == GameFilterType.MY_GAMES) {
                { Icon(Icons.Default.Check, null, modifier = Modifier.size(FilterChipDefaults.IconSize)) }
            } else null
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
                    text = "${game.game.date} ${game.game.time}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
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
                    text = "${game.game.playersCount} confirmados",
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
                            text = game.game.status,
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
            .systemBarsPadding()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(6) {
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
            .systemBarsPadding()
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
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.create_game))
        }
    }
}

/**
 * Estado de erro
 */
@Composable
private fun GamesErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
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
            text = stringResource(R.string.error),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 16.dp),
            textAlign = TextAlign.Center
        )

        Button(onClick = onRetry) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.retry))
        }
    }
}

/**
 * Obtém cor baseada no tipo de campo
 */
private fun getFieldTypeColor(fieldType: String) = when (fieldType.lowercase()) {
    "society" -> Color(0xFF2E7D32)
    "futsal" -> Color(0xFF1565C0)
    "grama" -> Color(0xFF558B2F)
    "campo" -> Color(0xFF7B1FA2)
    else -> Color(0xFF616161)
}

/**
 * Obtém cor baseada no status do jogo
 */
private fun getStatusColor(status: String) = when (status.lowercase()) {
    "aberto" -> Color(0xFF388E3C)
    "confirmado" -> Color(0xFF1976D2)
    "em andamento" -> Color(0xFFFFA000)
    "finalizado" -> Color(0xFF616161)
    else -> Color(0xFF616161)
}

/**
 * Formata data/hora do jogo
 */
private fun formatGameDateTime(timestamp: Long): String {
    val sdf = java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.getDefault())
    return sdf.format(java.util.Date(timestamp))
}
