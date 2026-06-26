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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.components.AnimatedStateContainer
import com.futebadosparcas.ui.components.StateType
import com.futebadosparcas.ui.components.PlayerCardShareHelper
import com.futebadosparcas.ui.players.PlayerCardContent
import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.domain.model.UserStreak
import com.futebadosparcas.domain.model.WeeklyChallenge
import com.futebadosparcas.domain.model.UserChallengeProgress
import com.futebadosparcas.domain.model.UserBadge
import com.futebadosparcas.ui.components.*
import com.futebadosparcas.ui.components.animation.ConfettiAnimation
import com.futebadosparcas.ui.components.animation.ConfettiColors
import com.futebadosparcas.ui.components.animation.ConfettiType
import com.futebadosparcas.ui.components.animation.SuccessAnimationOverlay
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.home.components.*
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.AppDimensions
import com.futebadosparcas.ui.theme.rememberReduceMotion
import androidx.compose.ui.res.stringResource

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
    hapticManager: HapticManager? = null,
    /** ViewModel de onboarding para checklist de primeiros passos (Fase 1). */
    onboardingViewModel: com.futebadosparcas.ui.onboarding.OnboardingViewModel? = null
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()
    val loadingState by viewModel.loadingState.collectAsStateWithLifecycle()

    // Estado para controlar exibição do PlayerCard BottomSheet
    var showPlayerCard by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    val shareScope = androidx.compose.runtime.rememberCoroutineScope()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            AppTopBar.Root(
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
            // Transições animadas entre estados (fade + slide)
            AnimatedStateContainer(
                targetState = uiState,
                stateMapper = { state ->
                    when (state) {
                        is HomeUiState.Loading -> StateType.LOADING
                        is HomeUiState.Success -> StateType.SUCCESS
                        is HomeUiState.Error -> StateType.ERROR
                    }
                },
                modifier = Modifier.fillMaxSize(),
                label = "homeStateTransition"
            ) { currentState ->
                when (currentState) {
                    is HomeUiState.Loading -> {
                        HomeLoadingState()
                    }
                    is HomeUiState.Success -> {
                        HomeSuccessContent(
                            state = currentState,
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
                            onSeeAllGamesClick = onSeeAllGamesClick,
                            onboardingViewModel = onboardingViewModel
                        )
                    }
                    is HomeUiState.Error -> {
                        HomeErrorState(
                            message = currentState.message,
                            onRetry = { viewModel.loadHomeData(forceRetry = true) }
                        )
                    }
                }
            }

            // PlayerCard BottomSheet (outside AnimatedStateContainer)
            if (showPlayerCard && uiState is HomeUiState.Success) {
                val successState = uiState as HomeUiState.Success
                ModalBottomSheet(
                    onDismissRequest = { showPlayerCard = false },
                    sheetState = sheetState,
                    containerColor = MaterialTheme.colorScheme.surface
                ) {
                    PlayerCardContent(
                        user = successState.user,
                        stats = successState.statistics,
                        onClose = { showPlayerCard = false },
                        onShare = {
                            PlayerCardShareHelper.shareAsImage(
                                context = context,
                                user = successState.user,
                                stats = successState.statistics,
                                scope = shareScope,
                                generatedBy = successState.user.getDisplayName()
                            )
                        },
                        modifier = Modifier.padding(bottom = AppDimensions.spacing_huge)
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
    onSeeAllGamesClick: () -> Unit,
    onboardingViewModel: com.futebadosparcas.ui.onboarding.OnboardingViewModel? = null
) {
    var isRefreshing by remember { mutableStateOf(false) }

    // ✅ OTIMIZAÇÃO: Usar remember para estabilizar estados e evitar recomposições desnecessárias
    // Cada campo é memoizado com sua própria key para granularidade fina
    val games = remember(state.games) { state.games }
    val activities = remember(state.activities) { state.activities }
    val publicGames = remember(state.publicGames) { state.publicGames }
    val challenges = remember(state.challenges) { state.challenges }
    val recentBadges = remember(state.recentBadges) { state.recentBadges }
    val user = remember(state.user) { state.user }
    val statistics = remember(state.statistics) { state.statistics }
    val gamificationSummary = remember(state.gamificationSummary) {
        state.gamificationSummary
    }
    val streak = remember(state.streak) { state.streak }

    // ✅ OTIMIZAÇÃO P2#9: Usar derivedStateOf para evitar recálculos desnecessários
    // Cálculo é feito antes da LazyColumn para evitar invalidação prematura
    val hasAnyContent = remember { derivedStateOf {
        games.isNotEmpty() ||
            activities.isNotEmpty() ||
            publicGames.isNotEmpty() ||
            challenges.isNotEmpty() ||
            statistics != null ||
            recentBadges.isNotEmpty() ||
            streak != null
    } }.value

    val windowSizeClass = rememberWindowSizeClass()

    // ---- Checklist de Primeiros Passos (Fase 1) ----
    // Deriva os passos a partir de dados de domínio existentes (não são checkboxes manuais)
    val checklistSteps = remember(
        state.user,
        state.games,
        state.statistics?.totalGames
    ) {
        onboardingViewModel?.deriveChecklistSteps(
            hasNickname = state.user.nickname?.isNotBlank() == true,
            hasPhoto = state.user.photoUrl?.isNotBlank() == true,
            // FIX #1404: derivar contadores de dados já carregados em HomeUiState.
            // - groupCount: distinct groupIds dos jogos que o usuário participa
            //   (proxy razoável p/ "entrou em pelo menos 1 grupo"; só fica 0 se
            //   usuário não tem nenhum jogo confirmado nem upcoming).
            // - gamesPlayedCount: statistics.totalGames vem do StatisticsRepository
            //   carregado em FASE 2; nullable até carregar → 0 como fallback.
            groupCount = state.games.mapNotNull { it.game.groupId }.distinct().size,
            confirmationCount = state.games.size,
            gamesPlayedCount = state.statistics?.totalGames ?: 0
        )
    }
    var checklistDismissed by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val checklistVisible = onboardingViewModel != null &&
        !checklistDismissed &&
        checklistSteps != null &&
        checklistSteps.values.any { !it } // oculta quando tudo concluído

    // Verifica se todos os passos foram concluídos para exibir celebração
    val showCelebration by (onboardingViewModel?.showCelebration
        ?: kotlinx.coroutines.flow.MutableStateFlow(false))
        .collectAsStateWithLifecycle()
    val reduceMotion = rememberReduceMotion()
    val latestActivity = remember(activities) {
        activities.maxWithOrNull(
            compareBy<Activity> { it.createdAt ?: Long.MIN_VALUE }
                .thenBy { it.id }
        )
    }
    val latestActivityId = latestActivity?.id
    val latestRewardKind = latestActivity?.rewardCelebrationKind()
    var rewardBaselineCaptured by remember { mutableStateOf(false) }
    var lastSeenRewardActivityId by remember { mutableStateOf<String?>(null) }
    var rewardCelebrationKind by remember { mutableStateOf<RewardActivityCelebrationKind?>(null) }

    LaunchedEffect(latestActivityId, latestRewardKind, reduceMotion) {
        if (latestActivityId == null) {
            rewardCelebrationKind = null
            return@LaunchedEffect
        }

        if (!rewardBaselineCaptured) {
            rewardBaselineCaptured = true
            lastSeenRewardActivityId = latestActivityId
            return@LaunchedEffect
        }

        if (latestActivityId != lastSeenRewardActivityId) {
            rewardCelebrationKind = if (!reduceMotion) latestRewardKind else null
            lastSeenRewardActivityId = latestActivityId
        }
    }

    // Em tablets, centraliza o conteúdo com largura máxima para leitura confortável
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {

    // CelebrationSheet fora do LazyColumn
    if (onboardingViewModel != null) {
        com.futebadosparcas.ui.home.components.CelebrationSheet(
            visible = showCelebration,
            onDismiss = { onboardingViewModel.onCelebrationDismissed() }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxHeight()
            .then(
                if (!windowSizeClass.isCompact) {
                    Modifier.widthIn(max = windowSizeClass.contentMaxWidth)
                } else {
                    Modifier.fillMaxWidth()
                }
            ),
        verticalArrangement = Arrangement.Top,
        contentPadding = PaddingValues(top = AppDimensions.spacing_small, bottom = AppDimensions.spacing_large)
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

        // Checklist de Primeiros Passos (Fase 1 — exibido antes do streak)
        if (checklistVisible && checklistSteps != null) {
            item(key = "first_steps_checklist") {
                com.futebadosparcas.ui.home.components.FirstStepsChecklist(
                    steps = checklistSteps,
                    visible = true,
                    onDismiss = {
                        checklistDismissed = true
                        onboardingViewModel?.onChecklistDismissed(
                            userId = viewModel.getCurrentUserId() ?: "",
                            stepsDone = checklistSteps.values.count { it },
                            stepsTotal = checklistSteps.size
                        )
                    },
                    onStepClick = { step ->
                        when (step) {
                            com.futebadosparcas.domain.model.onboarding.OnboardingStep.COMPLETE_PROFILE ->
                                onShowPlayerCard() // Abre PlayerCard sheet para editar perfil
                            com.futebadosparcas.domain.model.onboarding.OnboardingStep.JOIN_OR_CREATE_GROUP ->
                                onJoinGroupClick()
                            com.futebadosparcas.domain.model.onboarding.OnboardingStep.CONFIRM_PRESENCE,
                            com.futebadosparcas.domain.model.onboarding.OnboardingStep.PLAY_FIRST_GAME ->
                                onSeeAllGamesClick()
                        }
                    },
                    modifier = Modifier.padding(top = AppDimensions.spacing_small)
                )
            }
        }

        // Streak Widget
        if (streak != null) {
            item(key = "streak") {
                StreakWidget(streak = streak)
            }
        }

        // Exibir estado vazio amigavel quando nao ha conteudo
        if (!hasAnyContent) {
            item(key = "welcome_empty_state") {
                WelcomeEmptyState(
                    userName = user.name.split(" ").firstOrNull()?.takeIf { it.isNotBlank() } ?: stringResource(R.string.default_player_name),
                    userLevel = gamificationSummary?.level ?: 0,
                    onCreateGame = onCreateGameClick,
                    onJoinGroup = onJoinGroupClick,
                    modifier = Modifier.padding(top = AppDimensions.spacing_small)
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
                    modifier = Modifier.padding(top = AppDimensions.spacing_large)
                )
            }
        }

        // Public Games Suggestions
        if (state.publicGames.isNotEmpty()) {
            item(key = "public_games") {
                PublicGamesSuggestions(
                    games = state.publicGames,
                    onGameClick = { game -> onGameClick(game.id) },
                    modifier = Modifier.padding(top = AppDimensions.spacing_large)
                )
            }
        }

        // Challenges
        if (state.challenges.isNotEmpty()) {
            item(key = "challenges") {
                ChallengesSection(
                    challenges = state.challenges,
                    modifier = Modifier.padding(top = AppDimensions.spacing_large)
                )
            }
        }

        // Statistics
        if (statistics != null) {
            item(key = "statistics") {
                ExpandableStatsSection(
                    statistics = statistics,
                    modifier = Modifier.padding(top = AppDimensions.spacing_large)
                )
            }
        }

        // Recent Badges
        if (state.recentBadges.isNotEmpty()) {
            item(key = "badges") {
                RecentBadgesCarousel(
                    badges = state.recentBadges,
                    modifier = Modifier.padding(top = AppDimensions.spacing_large)
                )
            }
        }
    } // fecha LazyColumn

    RewardActivityCelebrationOverlay(
        kind = rewardCelebrationKind,
        onDismiss = { rewardCelebrationKind = null },
        modifier = Modifier.fillMaxSize()
    )
    } // fecha Box adaptativo
}

@Composable
private fun RewardActivityCelebrationOverlay(
    kind: RewardActivityCelebrationKind?,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (kind == null) return

    val (type, colors, particleCount, durationMillis) = when (kind) {
        RewardActivityCelebrationKind.LEVEL -> RewardCelebrationSpec(
            type = ConfettiType.RISING,
            colors = ConfettiColors.SUCCESS,
            particleCount = 48,
            durationMillis = 2200
        )
        RewardActivityCelebrationKind.BADGE -> RewardCelebrationSpec(
            type = ConfettiType.CANNON,
            colors = ConfettiColors.GOLD,
            particleCount = 56,
            durationMillis = 2200
        )
        RewardActivityCelebrationKind.MVP -> RewardCelebrationSpec(
            type = ConfettiType.EXPLOSION,
            colors = ConfettiColors.MVP,
            particleCount = 60,
            durationMillis = 2400
        )
    }

    Box(modifier = modifier) {
        ConfettiAnimation(
            visible = true,
            modifier = Modifier.fillMaxSize(),
            type = type,
            colors = colors,
            particleCount = particleCount,
            durationMillis = durationMillis,
            onAnimationEnd = onDismiss
        )
        SuccessAnimationOverlay(
            visible = true,
            onDismiss = onDismiss,
            modifier = Modifier.fillMaxSize(),
            displayDurationMs = durationMillis.toLong()
        )
    }
}

private data class RewardCelebrationSpec(
    val type: ConfettiType,
    val colors: List<androidx.compose.ui.graphics.Color>,
    val particleCount: Int,
    val durationMillis: Int
)

/**
 * Estado de loading
 */
@Composable
private fun HomeLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_large),
        verticalArrangement = Arrangement.Top,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Shimmer para header
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .padding(bottom = AppDimensions.spacing_large)
        )

        // Shimmer para cards
        repeat(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp)
                    .padding(bottom = AppDimensions.spacing_medium)
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
            .padding(AppDimensions.spacing_large),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = stringResource(R.string.error_default),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(bottom = AppDimensions.spacing_small)
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onErrorContainer,
            modifier = Modifier.padding(bottom = AppDimensions.spacing_large)
        )

        // Protege contra double-tap: desabilita o botão e mostra loading durante o retry
        var isRetrying by remember { mutableStateOf(false) }
        Button(
            onClick = {
                isRetrying = true
                onRetry()
            },
            enabled = !isRetrying
        ) {
            if (isRetrying) {
                CircularProgressIndicator(
                    modifier = Modifier.size(AppDimensions.icon_small),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text(stringResource(R.string.action_retry))
            }
        }
    }
}
