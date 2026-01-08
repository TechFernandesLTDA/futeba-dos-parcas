package com.futebadosparcas.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    onGroupsClick: () -> Unit = {},
    onMapClick: () -> Unit = {},
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
                    onNotificationsClick = onNotificationsClick,
                    onGroupsClick = onGroupsClick,
                    onMapClick = onMapClick
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
@OptIn(ExperimentalLayoutApi::class)
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
    onNotificationsClick: () -> Unit,
    onGroupsClick: () -> Unit,
    onMapClick: () -> Unit
) {
    var isRefreshing by remember { mutableStateOf(false) }

    // Usar remember para evitar recomposições desnecessárias
    val games = remember(state.games) { state.games }
    val activities = remember(state.activities) { state.activities }
    val publicGames = remember(state.publicGames) { state.publicGames }
    val challenges = remember(state.challenges) { state.challenges }
    val recentBadges = remember(state.recentBadges) { state.recentBadges }

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
                onNavigateGroups = onGroupsClick,
                onNavigateMap = onMapClick
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
        if (games.isNotEmpty()) {
            item(key = "games_header") {
                Text(
                    text = stringResource(R.string.upcoming_games),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
                )
            }

            if (state.isGridView) {
                // Grid view - usando FlowRow para evitar LazyVerticalGrid aninhado
                item(key = "games_grid") {
                    FlowRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        games.take(6).forEach { game -> // Limitar a 6 jogos no grid
                            UpcomingGameCard(
                                game = game,
                                onClick = { onGameClick(game.id) },
                                modifier = Modifier.fillMaxWidth(0.48f)
                            )
                        }
                    }
                }
            } else {
                // List view
                items(games, key = { it.id }) { game ->
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
        if (activities.isNotEmpty()) {
            item(key = "activity_feed") {
                ActivityFeedSection(
                    activities = activities,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Public Games Suggestions
        if (publicGames.isNotEmpty()) {
            item(key = "public_games") {
                PublicGamesSuggestions(
                    games = publicGames,
                    onGameClick = { game -> onGameClick(game.id) },
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Challenges
        if (challenges.isNotEmpty()) {
            item(key = "challenges") {
                ChallengesSection(
                    challenges = challenges,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Statistics
        if (state.statistics != null) {
            item(key = "statistics") {
                ExpandableStatsSection(
                    statistics = state.statistics,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Activity Heatmap - Remover para reduzir peso da tela
        // if (activities.isNotEmpty()) {
        //     item(key = "heatmap") {
        //         ActivityHeatmapSection(
        //             activities = activities,
        //             modifier = Modifier.padding(top = 16.dp)
        //         )
        //     }
        // }

        // Recent Badges
        if (recentBadges.isNotEmpty()) {
            item(key = "badges") {
                RecentBadgesCarousel(
                    badges = recentBadges,
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
