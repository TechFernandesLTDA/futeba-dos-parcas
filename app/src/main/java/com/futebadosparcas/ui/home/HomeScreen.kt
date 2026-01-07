package com.futebadosparcas.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.ui.components.*
import com.futebadosparcas.ui.home.components.*
import com.futebadosparcas.util.HapticManager

/**
 * HomeScreen - Tela Principal consolidada em Jetpack Compose
 *
 * Exibe:
 * - Header com perfil do usuário (ExpressiveHubHeader)
 * - Status de sincronização
 * - Jogos próximos (grid ou lista)
 * - Widget de sequência (streak)
 * - Feed de atividades
 * - Sugestões de jogos públicos
 * - Desafios semanais
 * - Estatísticas
 * - Mapa de atividade (heatmap)
 * - Badges recentes
 *
 * Features:
 * - Pull-to-refresh
 * - Modo grid/lista para jogos
 * - Estados de loading, success, error
 * - Navegação via callbacks
 */
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onGameClick: (gameId: String) -> Unit = {},
    onProfileClick: () -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    hapticManager: HapticManager? = null
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()
    val loadingState by viewModel.loadingState.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when (uiState) {
            is HomeUiState.Loading -> {
                HomeLoadingState()
            }
            is HomeUiState.Success -> {
                val state = uiState as HomeUiState.Success
                HomeSuccessContent(
                    state = state,
                    isOnline = isOnline,
                    unreadCount = unreadCount,
                    viewModel = viewModel,
                    hapticManager = hapticManager,
                    onGameClick = onGameClick,
                    onProfileClick = onProfileClick,
                    onSettingsClick = onSettingsClick,
                    onNotificationsClick = onNotificationsClick
                )
            }
            is HomeUiState.Error -> {
                val state = uiState as HomeUiState.Error
                HomeErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadHomeData(forceRetry = true) }
                )
            }
        }
    }
}

/**
 * Conteúdo da tela quando sucesso
 */
@Composable
private fun HomeSuccessContent(
    state: HomeUiState.Success,
    isOnline: Boolean,
    unreadCount: Int,
    viewModel: HomeViewModel,
    hapticManager: HapticManager?,
    onGameClick: (gameId: String) -> Unit,
    onProfileClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onNotificationsClick: () -> Unit
) {
    var isRefreshing by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding(),
        verticalArrangement = Arrangement.Top,
        contentPadding = PaddingValues(bottom = 16.dp)
    ) {
        // Top Bar com notificações
        item {
            FutebaTopBar(
                unreadCount = unreadCount,
                onNavigateNotifications = onNotificationsClick,
                onNavigateGroups = {},
                onNavigateMap = {}
            )
        }

        // Status de Sincronização
        item {
            SyncStatusBanner(isConnected = isOnline)
        }

        // Header Expressivo com Perfil
        item {
            ExpressiveHubHeader(
                user = state.user,
                summary = state.gamificationSummary,
                statistics = state.statistics,
                hapticManager = hapticManager,
                onProfileClick = onProfileClick
            )
        }

        // Streak Widget
        item {
            if (state.streak != null) {
                StreakWidget(streak = state.streak)
            }
        }

        // Jogos Próximos
        if (state.games.isNotEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.upcoming_games),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
                )
            }

            if (state.isGridView) {
                // Grid view
                item {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.games, key = { it.id }) { game ->
                            UpcomingGameCard(
                                game = game,
                                onClick = { onGameClick(game.id) }
                            )
                        }
                    }
                }
            } else {
                // List view
                items(state.games, key = { it.id }) { game ->
                    UpcomingGameCard(
                        game = game,
                        onClick = { onGameClick(game.id) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }

        // Activity Feed
        if (state.activities.isNotEmpty()) {
            item {
                ActivityFeedSection(
                    activities = state.activities,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Public Games Suggestions
        if (state.publicGames.isNotEmpty()) {
            item {
                PublicGamesSuggestions(
                    games = state.publicGames,
                    onGameClick = { game -> onGameClick(game.id) },
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Challenges
        if (state.challenges.isNotEmpty()) {
            item {
                ChallengesSection(
                    challenges = state.challenges,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Statistics
        if (state.statistics != null) {
            item {
                ExpandableStatsSection(
                    statistics = state.statistics,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Activity Heatmap
        if (state.activities.isNotEmpty()) {
            item {
                ActivityHeatmapSection(
                    activities = state.activities,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Recent Badges
        if (state.recentBadges.isNotEmpty()) {
            item {
                RecentBadgesCarousel(
                    badges = state.recentBadges,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }
    }
}

/**
 * Card de jogo próximo - exibível em grid ou lista
 */
@Composable
private fun UpcomingGameCard(
    game: Game,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .clickable(onClick = onClick)
            .fillMaxWidth()
            .heightIn(min = 100.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Local e Data
            Text(
                text = game.locationName,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = "${game.date} às ${game.time}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )

            // Confirmações (Placeholder)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Confirmados: ${game.playersCount}/${game.maxPlayers}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

/**
 * Estado de loading
 */
@Composable
private fun HomeLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.Top,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Shimmer para header
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .padding(bottom = 16.dp)
        )

        // Shimmer para cards
        repeat(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp)
                    .padding(bottom = 12.dp)
            )
        }
    }
}

/**
 * Estado de erro
 */
@Composable
private fun HomeErrorState(
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
        Text(
            text = stringResource(R.string.error),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onErrorContainer,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Button(onClick = onRetry) {
            Text(stringResource(R.string.retry))
        }
    }
}

/**
 * Formata data/hora do jogo
 */
private fun formatGameDateTime(timestamp: Long): String {
    val sdf = java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.getDefault())
    return sdf.format(java.util.Date(timestamp))
}
