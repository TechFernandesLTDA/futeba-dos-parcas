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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.PlayerCardShareHelper
import com.futebadosparcas.ui.players.PlayerCardContent
import com.futebadosparcas.data.model.Activity
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.domain.model.UserStreak
import com.futebadosparcas.domain.model.WeeklyChallenge
import com.futebadosparcas.domain.model.UserChallengeProgress
import com.futebadosparcas.domain.model.UserBadge
import com.futebadosparcas.ui.components.*
import com.futebadosparcas.ui.components.modern.ErrorState
import com.futebadosparcas.ui.components.modern.ErrorType
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
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onGameClick: (gameId: String) -> Unit = {},
    onConfirmGame: (gameId: String) -> Unit = {},
    onProfileClick: () -> Unit = {},  // Mantido para compatibilidade, mas não usado para foto
    onSettingsClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    onGroupsClick: () -> Unit = {},
    onMapClick: () -> Unit = {},
    onLevelJourneyClick: () -> Unit = {},  // Navegacao para Rumo ao Estrelato
    onCreateGameClick: () -> Unit = {},    // Navegacao para criar novo jogo
    onJoinGroupClick: () -> Unit = {},     // Navegacao para entrar em grupo
    onSeeAllGamesClick: () -> Unit = {},   // Navegacao para ver todos os jogos
    hapticManager: HapticManager? = null
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()
    val loadingState by viewModel.loadingState.collectAsStateWithLifecycle()

    // Estado para controlar exibição do PlayerCard BottomSheet
    var showPlayerCard by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current

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
        contentWindowInsets = WindowInsets(0, 0, 0, 0) // Remove padding padrão, vamos gerenciar manualmente
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
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
                        onConfirmGame = onConfirmGame,
                        onShowPlayerCard = { showPlayerCard = true },
                        onSettingsClick = onSettingsClick,
                        onNotificationsClick = onNotificationsClick,
                        onGroupsClick = onGroupsClick,
                        onMapClick = onMapClick,
                        onLevelJourneyClick = onLevelJourneyClick,
                        onCreateGameClick = onCreateGameClick,
                        onJoinGroupClick = onJoinGroupClick,
                        onSeeAllGamesClick = onSeeAllGamesClick
                    )

                    // PlayerCard BottomSheet
                    if (showPlayerCard) {
                        ModalBottomSheet(
                            onDismissRequest = { showPlayerCard = false },
                            sheetState = sheetState,
                            containerColor = MaterialTheme.colorScheme.surface
                        ) {
                            PlayerCardContent(
                                user = state.user,
                                stats = state.statistics,
                                onClose = { showPlayerCard = false },
                                onShare = {
                                    PlayerCardShareHelper.shareAsImage(
                                        context = context,
                                        user = state.user,
                                        stats = state.statistics,
                                        generatedBy = state.user.getDisplayName()
                                    )
                                },
                                modifier = Modifier.padding(bottom = 32.dp)
                            )
                        }
                    }
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
}

/**
 * Conteúdo da tela quando sucesso
 *
 * Otimizado para scroll suave:
 * - Keys estáveis em todos os itens
 * - Valores estabilizados com remember
 * - Evita recomposições durante scroll
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
    onConfirmGame: (gameId: String) -> Unit,
    onShowPlayerCard: () -> Unit,
    onSettingsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    onGroupsClick: () -> Unit,
    onMapClick: () -> Unit,
    onLevelJourneyClick: () -> Unit,
    onCreateGameClick: () -> Unit,
    onJoinGroupClick: () -> Unit,
    onSeeAllGamesClick: () -> Unit
) {
    var isRefreshing by remember { mutableStateOf(false) }

    // ✅ OTIMIZAÇÃO: Usar remember para estabilizar estados e evitar recomposições desnecessárias
    // Cada campo é memoizado com sua própria key para granularidade fina
    val games = remember(state.games.hashCode()) { state.games }
    val activities = remember(state.activities.hashCode()) { state.activities }
    val publicGames = remember(state.publicGames.hashCode()) { state.publicGames }
    val challenges = remember(state.challenges.hashCode()) { state.challenges }
    val recentBadges = remember(state.recentBadges.hashCode()) { state.recentBadges }
    val user = remember(state.user.id, state.user.experiencePoints) { state.user }
    val statistics = remember(state.statistics?.hashCode()) { state.statistics }
    val gamificationSummary = remember(state.gamificationSummary.level, state.gamificationSummary.progressPercent) {
        state.gamificationSummary
    }
    val streak = remember(state.streak?.hashCode()) { state.streak }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize(),
        verticalArrangement = Arrangement.Top,
        contentPadding = PaddingValues(top = 8.dp, bottom = 16.dp) // Padding reduzido
    ) {
        // Status de Sincronização
        item(key = "sync_status") {
            SyncStatusBanner(isConnected = isOnline)
        }

        // Header Expressivo com Perfil
        item(key = "header") {
            ExpressiveHubHeader(
                user = user,
                summary = gamificationSummary,
                statistics = statistics,
                hapticManager = hapticManager,
                onProfileClick = onShowPlayerCard,
                onLevelClick = onLevelJourneyClick  // Abre Rumo ao Estrelato ao clicar no nível
            )
        }

        // Streak Widget
        if (streak != null) {
            item(key = "streak") {
                StreakWidget(streak = streak)
            }
        }

        // Verificar se há conteudo para exibir na tela principal.
        // Inclui: jogos, atividades, jogos publicos, desafios, estatisticas, badges e streak.
        // Se nenhum conteudo existir, exibe WelcomeEmptyState para usuarios novos
        // ou que ainda nao participaram de jogos, evitando tela em branco.
        val hasAnyContent = games.isNotEmpty() ||
            state.activities.isNotEmpty() ||
            state.publicGames.isNotEmpty() ||
            state.challenges.isNotEmpty() ||
            statistics != null ||
            state.recentBadges.isNotEmpty() ||
            streak != null

        // Exibir estado vazio amigavel quando nao ha conteudo
        if (!hasAnyContent) {
            item(key = "welcome_empty_state") {
                WelcomeEmptyState(
                    userName = user.name.split(" ").firstOrNull()?.takeIf { it.isNotBlank() } ?: stringResource(R.string.default_player_name),
                    userLevel = gamificationSummary?.level ?: 0,
                    onCreateGame = onCreateGameClick,
                    onJoinGroup = onJoinGroupClick,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }

        // Jogos Próximos - Nova seção com status de confirmação
        if (games.isNotEmpty()) {
            item(key = "upcoming_games") {
                UpcomingGamesSection(
                    games = games,
                    onGameClick = onGameClick,
                    onConfirmClick = onConfirmGame,
                    onSeeAllClick = onSeeAllGamesClick
                )
            }
        }

        // Activity Feed
        if (state.activities.isNotEmpty()) {
            item(key = "activity_feed") {
                ActivityFeedSection(
                    activities = state.activities,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Public Games Suggestions
        if (state.publicGames.isNotEmpty()) {
            item(key = "public_games") {
                PublicGamesSuggestions(
                    games = state.publicGames,
                    onGameClick = { game -> onGameClick(game.id) },
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Challenges
        if (state.challenges.isNotEmpty()) {
            item(key = "challenges") {
                ChallengesSection(
                    challenges = state.challenges,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }

        // Statistics
        if (statistics != null) {
            item(key = "statistics") {
                ExpandableStatsSection(
                    statistics = statistics,
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
        if (state.recentBadges.isNotEmpty()) {
            item(key = "badges") {
                RecentBadgesCarousel(
                    badges = state.recentBadges,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
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
 * Estado de erro usando componente moderno com ilustração
 */
@Composable
private fun HomeErrorState(
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
        actionText = stringResource(R.string.action_retry)
    )
}

