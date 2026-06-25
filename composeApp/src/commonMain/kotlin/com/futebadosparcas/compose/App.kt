package com.futebadosparcas.compose

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.di.composeAppKoinModules
import com.futebadosparcas.compose.navigation.AppRoutes
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.feature_hub_actions
import com.futebadosparcas.compose.resources.feature_hub_action_content_description
import com.futebadosparcas.compose.resources.game_detail_blocked_players
import com.futebadosparcas.compose.resources.game_detail_hub_title
import com.futebadosparcas.compose.resources.game_detail_invite_players
import com.futebadosparcas.compose.resources.game_detail_organizer_tools
import com.futebadosparcas.compose.resources.game_detail_owner_stats
import com.futebadosparcas.compose.resources.game_detail_post_game_report
import com.futebadosparcas.compose.resources.groups_hub_action_blocked
import com.futebadosparcas.compose.resources.groups_hub_action_blocked_body
import com.futebadosparcas.compose.resources.groups_hub_action_games
import com.futebadosparcas.compose.resources.groups_hub_action_games_body
import com.futebadosparcas.compose.resources.groups_hub_action_whats_new
import com.futebadosparcas.compose.resources.groups_hub_action_whats_new_body
import com.futebadosparcas.compose.resources.groups_hub_body
import com.futebadosparcas.compose.resources.groups_hub_title
import com.futebadosparcas.compose.resources.profile_hub_action_blocked
import com.futebadosparcas.compose.resources.profile_hub_action_blocked_body
import com.futebadosparcas.compose.resources.profile_hub_action_setup
import com.futebadosparcas.compose.resources.profile_hub_action_setup_body
import com.futebadosparcas.compose.resources.profile_hub_action_stats
import com.futebadosparcas.compose.resources.profile_hub_action_stats_body
import com.futebadosparcas.compose.resources.profile_hub_body
import com.futebadosparcas.compose.resources.profile_hub_title
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.platform.PlatformShareFactory
import com.futebadosparcas.platform.storage.PreferencesService
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import com.futebadosparcas.ui.core.BlockedPlayerData
import com.futebadosparcas.ui.core.BlockedPlayersScreen
import com.futebadosparcas.ui.core.GamesScreen
import com.futebadosparcas.ui.core.InvitePlayersScreen
import com.futebadosparcas.ui.core.InviteViewModel
import com.futebadosparcas.ui.core.BadgesRouteScreen
import com.futebadosparcas.ui.core.CashboxRouteScreen
import com.futebadosparcas.ui.core.LoginScreen
import com.futebadosparcas.ui.core.LoginState
import com.futebadosparcas.ui.core.LoginViewModel
import com.futebadosparcas.ui.core.LocationsRouteScreen
import com.futebadosparcas.ui.core.OwnerStats
import com.futebadosparcas.ui.core.OwnerStatsScreen
import com.futebadosparcas.ui.core.PermissionOnboardingScreen
import com.futebadosparcas.ui.core.PostGameReport
import com.futebadosparcas.ui.core.PostGameReportScreen
import com.futebadosparcas.ui.core.ProfileSetupScreen
import com.futebadosparcas.ui.core.RankingRouteScreen
import com.futebadosparcas.ui.core.WelcomeScreen
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.theme.MotionSpring
import com.futebadosparcas.ui.theme.rememberReduceMotion
import com.futebadosparcas.ui.whatsnew.WhatsNewPopupHost
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
import kotlinx.coroutines.launch
import org.koin.compose.KoinApplication
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import org.jetbrains.compose.resources.stringResource

@Composable
fun App() {
    KoinApplication(application = {
        modules(composeAppKoinModules)
    }) {
        AppContent()
    }
}

@Composable
private fun AppContent() {
    FutebaTheme {
        // #2673/#2691 — Surface de fundo desenha edge-to-edge (cor cobre toda a tela,
        // inclusive sob status bar / notch / home indicator), enquanto o conteúdo
        // interno respeita a safe-area via `WindowInsets.safeDrawing`.
        //
        // `safeDrawing` combina system bars + display cutout (notch/Dynamic Island), então
        // este único padding no scaffold raiz garante que nenhuma tela full-bleed coloque
        // conteúdo interativo/texto sob recortes da tela. As telas filhas herdam essa área
        // segura; backgrounds que devem sangrar até a borda usam a `Surface` externa.
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
            ) {
                AppNavigation()
                WhatsNewPopupHost()
            }
        }
    }
}

@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    val authRepository: AuthRepository? = runCatching { koinInject<AuthRepository>() }.getOrNull()
    val preferencesService: PreferencesService? = runCatching { koinInject<PreferencesService>() }.getOrNull()
    val platformShare = remember { runCatching { PlatformShareFactory.create() }.getOrNull() }
    val startDestination = if (authRepository?.isLoggedIn() == true) AppRoutes.HOME else AppRoutes.WELCOME
    val reduceMotion = rememberReduceMotion()
    val shareScope = rememberCoroutineScope()
    var selectedGameId by remember { mutableStateOf<String?>(null) }
    var selectedInviteGroupId by remember { mutableStateOf<String?>(null) }
    var selectedGroupId by remember { mutableStateOf<String?>(null) }
    var blockedPlayers by remember { mutableStateOf(emptyList<BlockedPlayerData>()) }

    LaunchedEffect(preferencesService) {
        blockedPlayers = loadBlockedPlayers(preferencesService)
    }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = {
            if (reduceMotion) {
                EnterTransition.None
            } else {
                fadeIn(animationSpec = MotionSpring.spatial(reduceMotion)) +
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = MotionSpring.spatial(reduceMotion)
                )
            }
        },
        exitTransition = {
            if (reduceMotion) {
                ExitTransition.None
            } else {
                fadeOut(animationSpec = MotionSpring.spatial(reduceMotion)) +
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = MotionSpring.spatial(reduceMotion)
                )
            }
        },
        popEnterTransition = {
            if (reduceMotion) {
                EnterTransition.None
            } else {
                fadeIn(animationSpec = MotionSpring.spatial(reduceMotion)) +
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = MotionSpring.spatial(reduceMotion)
                )
            }
        },
        popExitTransition = {
            if (reduceMotion) {
                ExitTransition.None
            } else {
                fadeOut(animationSpec = MotionSpring.spatial(reduceMotion)) +
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = MotionSpring.spatial(reduceMotion)
                )
            }
        }
    ) {
        // Welcome / Onboarding
        // Após o welcome, encaminha para o onboarding de permissões (#2671) e só
        // depois para o login — torna PermissionOnboardingScreen alcançável.
        composable(AppRoutes.WELCOME) {
            WelcomeScreen(
                onContinue = { navController.navigate(AppRoutes.PERMISSION_ONBOARDING) }
            )
        }

        // Onboarding de permissões (notificações, localização, câmera, microfone)
        composable(AppRoutes.PERMISSION_ONBOARDING) {
            PermissionOnboardingScreen(
                onComplete = {
                    navController.navigate(AppRoutes.LOGIN) {
                        popUpTo(AppRoutes.PERMISSION_ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        // Login
        composable(AppRoutes.LOGIN) {
            val vm: LoginViewModel? = runCatching { koinViewModel<LoginViewModel>() }.getOrNull()
            val uiState = vm?.loginState?.collectAsStateWithLifecycle()?.value ?: LoginState.Idle

            LaunchedEffect(uiState) {
                if (uiState is LoginState.Success) {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                }
            }

            LoginScreen(
                uiState = uiState,
                versionName = "",
                onGoogleSignInClick = { vm?.onGoogleSignInSuccess() },
                onEmailPasswordSignIn = { email, password -> vm?.signInWithEmailAndPassword(email, password) },
                onForgotPassword = { email -> vm?.sendPasswordResetEmail(email) },
                onNavigateToRegister = {
                    navController.navigate(AppRoutes.PROFILE_SETUP)
                },
                onNavigateToMain = {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        // Perfil setup (pós-registro / primeiro acesso)
        composable(AppRoutes.PROFILE_SETUP) {
            ProfileSetupScreen(
                onContinue = {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.PROFILE_SETUP) { inclusive = true }
                    }
                },
                onSkip = {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.PROFILE_SETUP) { inclusive = true }
                    }
                }
            )
        }

        // Home
        composable(AppRoutes.HOME) {
            HomeScreen(
                onOpenWhatsNew = { navController.navigate(AppRoutes.WHATS_NEW) },
                onNavigateToGames = { navController.navigate(AppRoutes.GAMES) },
                onNavigateToGroups = { navController.navigate(AppRoutes.GROUPS) },
                onNavigateToProfile = { navController.navigate(AppRoutes.PROFILE) },
                onOpenProfileSetup = { navController.navigate(AppRoutes.PROFILE_SETUP) }
            )
        }

        // Games
        composable(AppRoutes.GAMES) {
            GamesScreen(
                onGameClick = { gameId ->
                    selectedGameId = gameId
                    navController.navigate(AppRoutes.gameDetail(gameId))
                },
                onCreateGameClick = { navController.navigate(AppRoutes.GROUPS) }
            )
        }

        // Game detail — hub do organizador (#2671)
        // Enquanto a GameDetailScreen completa não é portada (épico #2670), esta rota
        // serve de ponto de entrada navegável para as telas reais já existentes em
        // ui/core/ (relatório pós-jogo, estatísticas, convite, bloqueados), eliminando
        // telas órfãs. Acessível via GamesScreen.onGameClick -> AppRoutes.gameDetail(id).
        composable(AppRoutes.GAME_DETAIL) {
            val gameId = selectedGameId
            GameDetailHub(
                onNavigateBack = { navController.popBackStack() },
                onOpenPostGameReport = { navController.navigate(AppRoutes.POST_GAME_REPORT) },
                onOpenOwnerStats = { navController.navigate(AppRoutes.OWNER_STATS) },
                onOpenInvitePlayers = {
                    if (gameId != null) {
                        // groupId real virá do jogo quando GameDetailScreen for portada;
                        // por ora usa o gameId selecionado como contexto de navegação.
                        selectedInviteGroupId = gameId
                        navController.navigate(AppRoutes.invitePlayers(gameId))
                    }
                },
                onOpenBlockedPlayers = { navController.navigate(AppRoutes.BLOCKED_PLAYERS) }
            )
        }

        // Relatório pós-jogo (tela real ui/core/PostGameReportScreen)
        composable(AppRoutes.POST_GAME_REPORT) {
            PostGameReportScreen(
                report = PostGameReport(
                    game = Game(),
                    confirmations = emptyList(),
                    teams = emptyList()
                ),
                onNavigateBack = { navController.popBackStack() },
                onShare = {
                    shareScope.launch {
                        platformShare?.share(
                            text = buildPostGameShareText(selectedGameId),
                            title = "Relatório pós-jogo"
                        )
                    }
                },
                onShareWhatsApp = {
                    shareScope.launch {
                        platformShare?.share(
                            text = buildPostGameShareText(selectedGameId),
                            title = "Compartilhar resultado"
                        )
                    }
                }
            )
        }

        // Estatísticas do organizador (tela real ui/core/OwnerStatsScreen)
        composable(AppRoutes.OWNER_STATS) {
            OwnerStatsScreen(
                stats = OwnerStats(),
                isLoading = false,
                onNavigateBack = { navController.popBackStack() },
                onGameClick = { gameId ->
                    selectedGameId = gameId
                    navController.navigate(AppRoutes.gameDetail(gameId))
                }
            )
        }

        // Convidar jogadores (tela real ui/core/InvitePlayersScreen)
        composable(AppRoutes.INVITE_PLAYERS) {
            val groupId = selectedInviteGroupId
            // InviteViewModel ainda não está registrado no Koin do composeApp
            // (depende de repositórios providos por plataforma). Renderiza a tela
            // apenas quando o VM estiver disponível; caso contrário, volta atrás
            // de forma graciosa (sem crash).
            val inviteVm: InviteViewModel? = runCatching { koinViewModel<InviteViewModel>() }.getOrNull()
            if (inviteVm != null && groupId != null) {
                InvitePlayersScreen(
                    viewModel = inviteVm,
                    groupId = groupId,
                    onNavigateBack = { navController.popBackStack() }
                )
            } else {
                LaunchedEffect(Unit) { navController.popBackStack() }
            }
        }

        // Jogadores bloqueados (tela real ui/core/BlockedPlayersScreen)
        composable(AppRoutes.BLOCKED_PLAYERS) {
            BlockedPlayersScreen(
                blockedPlayers = blockedPlayers,
                availablePlayers = emptyList(),
                onBlockPlayer = { userId, userName, reason ->
                    val updated = blockedPlayers + BlockedPlayerData(
                        userId = userId,
                        userName = userName,
                        reason = reason,
                        blockedAt = null
                    )
                    blockedPlayers = updated
                    persistBlockedPlayers(preferencesService, updated)
                },
                onUnblockPlayer = { userId ->
                    val updated = blockedPlayers.filterNot { it.userId == userId }
                    blockedPlayers = updated
                    persistBlockedPlayers(preferencesService, updated)
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // Groups
        composable(AppRoutes.GROUPS) {
            FeatureHubScreen(
                title = stringResource(Res.string.groups_hub_title),
                body = stringResource(Res.string.groups_hub_body),
                onNavigateBack = { navController.popBackStack() },
                actions = listOf(
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_games),
                        description = stringResource(Res.string.groups_hub_action_games_body),
                        icon = Icons.Filled.SportsSoccer,
                        onClick = { navController.navigate(AppRoutes.GAMES) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_blocked),
                        description = stringResource(Res.string.groups_hub_action_blocked_body),
                        icon = Icons.Filled.Block,
                        onClick = { navController.navigate(AppRoutes.BLOCKED_PLAYERS) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_whats_new),
                        description = stringResource(Res.string.groups_hub_action_whats_new_body),
                        icon = Icons.Filled.NewReleases,
                        onClick = { navController.navigate(AppRoutes.WHATS_NEW) }
                    )
                )
            )
        }

        // Group detail
        composable(AppRoutes.GROUP_DETAIL) {
            FeatureHubScreen(
                title = "Grupo",
                body = "Atalhos para jogos, caixa e ferramentas do grupo no composeApp.",
                onNavigateBack = { navController.popBackStack() },
                actions = listOf(
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_games),
                        description = stringResource(Res.string.groups_hub_action_games_body),
                        icon = Icons.Filled.SportsSoccer,
                        onClick = { navController.navigate(AppRoutes.GAMES) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_blocked),
                        description = stringResource(Res.string.groups_hub_action_blocked_body),
                        icon = Icons.Filled.Block,
                        onClick = { navController.navigate(AppRoutes.BLOCKED_PLAYERS) }
                    ),
                    FeatureHubAction(
                        label = "Caixa",
                        description = "Resumo financeiro e histórico das movimentações.",
                        icon = Icons.Filled.QueryStats,
                        onClick = {
                            selectedGroupId = selectedGroupId ?: selectedGameId
                            navController.navigate(AppRoutes.CASHBOX)
                        }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_whats_new),
                        description = stringResource(Res.string.groups_hub_action_whats_new_body),
                        icon = Icons.Filled.NewReleases,
                        onClick = { navController.navigate(AppRoutes.WHATS_NEW) }
                    )
                )
            )
        }

        // Profile
        composable(AppRoutes.PROFILE) {
            FeatureHubScreen(
                title = stringResource(Res.string.profile_hub_title),
                body = stringResource(Res.string.profile_hub_body),
                onNavigateBack = { navController.popBackStack() },
                actions = listOf(
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_setup),
                        description = stringResource(Res.string.profile_hub_action_setup_body),
                        icon = Icons.Filled.Person,
                        onClick = { navController.navigate(AppRoutes.PROFILE_SETUP) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_stats),
                        description = stringResource(Res.string.profile_hub_action_stats_body),
                        icon = Icons.Filled.QueryStats,
                        onClick = { navController.navigate(AppRoutes.OWNER_STATS) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_blocked),
                        description = stringResource(Res.string.profile_hub_action_blocked_body),
                        icon = Icons.Filled.Block,
                        onClick = { navController.navigate(AppRoutes.BLOCKED_PLAYERS) }
                    )
                )
            )
        }

        // Ranking
        composable(AppRoutes.RANKING) {
            RankingRouteScreen(onNavigateBack = { navController.popBackStack() })
        }

        // Badges
        composable(AppRoutes.BADGES) {
            BadgesRouteScreen(onNavigateBack = { navController.popBackStack() })
        }

        // Locations
        composable(AppRoutes.LOCATIONS) {
            LocationsRouteScreen(onNavigateBack = { navController.popBackStack() })
        }

        // Cashbox
        composable(AppRoutes.CASHBOX) {
            CashboxRouteScreen(
                groupId = selectedGroupId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // Novidades
        composable(AppRoutes.WHATS_NEW) {
            WhatsNewScreen(onBack = { navController.popBackStack() })
        }
    }
}

/**
 * Hub de detalhe do jogo / ferramentas do organizador (#2671).
 *
 * Ponto de entrada navegável que dá acesso às telas reais já existentes em
 * `ui/core/` (relatório pós-jogo, estatísticas do organizador, convite de
 * jogadores e jogadores bloqueados), tornando-as alcançáveis no simulador
 * enquanto a `GameDetailScreen` completa não é portada (épico #2670).
 *
 * Lista de ações como `OutlinedButton`s; cada uma navega para a respectiva tela.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GameDetailHub(
    onNavigateBack: () -> Unit,
    onOpenPostGameReport: () -> Unit,
    onOpenOwnerStats: () -> Unit,
    onOpenInvitePlayers: () -> Unit,
    onOpenBlockedPlayers: () -> Unit
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.game_detail_hub_title),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            val expandedLayout = maxWidth >= 840.dp
            val organizerActions = listOf(
                stringResource(Res.string.game_detail_post_game_report) to onOpenPostGameReport,
                stringResource(Res.string.game_detail_owner_stats) to onOpenOwnerStats,
                stringResource(Res.string.game_detail_invite_players) to onOpenInvitePlayers,
                stringResource(Res.string.game_detail_blocked_players) to onOpenBlockedPlayers
            )

            Column(
                modifier = Modifier.widthIn(max = 960.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
            Text(
                text = stringResource(Res.string.game_detail_organizer_tools),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() }
            )

                if (expandedLayout) {
                    organizerActions.chunked(2).forEach { rowActions ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowActions.forEach { (label, onClick) ->
                                OutlinedButton(
                                    onClick = onClick,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(label)
                                }
                            }
                            if (rowActions.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                } else {
                    organizerActions.forEach { (label, onClick) ->
                        OutlinedButton(
                            onClick = onClick,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(label)
                        }
                    }
                }
            }
        }
    }
}

private data class FeatureHubAction(
    val label: String,
    val description: String,
    val icon: ImageVector,
    val onClick: () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeatureHubScreen(
    title: String,
    body: String,
    onNavigateBack: () -> Unit,
    actions: List<FeatureHubAction>
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = title,
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(20.dp)
        ) {
            val expandedLayout = maxWidth >= 840.dp
            Column(
                modifier = Modifier.widthIn(max = 960.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = stringResource(Res.string.feature_hub_actions),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() }
            )

                if (expandedLayout) {
                    actions.chunked(2).forEach { rowActions ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowActions.forEach { action ->
                                FeatureHubActionButton(
                                    action = action,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            if (rowActions.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                } else {
                    actions.forEach { action ->
                        FeatureHubActionButton(action = action)
                    }
                }
            }
        }
    }
}

@Composable
private fun FeatureHubActionButton(
    action: FeatureHubAction,
    modifier: Modifier = Modifier
) {
    val actionContentDescription = stringResource(
        Res.string.feature_hub_action_content_description,
        action.label,
        action.description
    )
    OutlinedButton(
        onClick = action.onClick,
        modifier = modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = actionContentDescription
            }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = action.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = action.label,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = action.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private const val BLOCKED_PLAYERS_PREF_KEY = "compose_blocked_players"
private const val BLOCKED_PLAYER_ENTRY_SEPARATOR = "\u001E"
private const val BLOCKED_PLAYER_FIELD_SEPARATOR = "\u001F"

private fun buildPostGameShareText(gameId: String?): String {
    return buildString {
        append("Relatório pós-jogo")
        gameId?.takeIf { it.isNotBlank() }?.let {
            append(" • jogo ")
            append(it)
        }
        append("\nResumo compartilhado pelo composeApp do Futeba dos Parças.")
    }
}

private fun loadBlockedPlayers(preferencesService: PreferencesService?): List<BlockedPlayerData> {
    val raw = preferencesService?.getString(BLOCKED_PLAYERS_PREF_KEY, null).orEmpty()
    if (raw.isBlank()) return emptyList()

    return raw.split(BLOCKED_PLAYER_ENTRY_SEPARATOR)
        .mapNotNull { entry ->
            val fields = entry.split(BLOCKED_PLAYER_FIELD_SEPARATOR)
            if (fields.size < 3) return@mapNotNull null
            BlockedPlayerData(
                userId = fields[0],
                userName = fields[1],
                reason = fields[2],
                blockedAt = fields.getOrNull(3)?.toLongOrNull()
            )
        }
}

private fun persistBlockedPlayers(
    preferencesService: PreferencesService?,
    blockedPlayers: List<BlockedPlayerData>
) {
    if (preferencesService == null) return
    if (blockedPlayers.isEmpty()) {
        preferencesService.remove(BLOCKED_PLAYERS_PREF_KEY)
        return
    }

    val encoded = blockedPlayers.joinToString(BLOCKED_PLAYER_ENTRY_SEPARATOR) { player ->
        listOf(
            player.userId,
            player.userName,
            player.reason,
            player.blockedAt?.toString().orEmpty()
        ).joinToString(BLOCKED_PLAYER_FIELD_SEPARATOR) { value ->
            value
                .replace(BLOCKED_PLAYER_ENTRY_SEPARATOR, " ")
                .replace(BLOCKED_PLAYER_FIELD_SEPARATOR, " ")
                .replace("\n", " ")
        }
    }
    preferencesService.putString(BLOCKED_PLAYERS_PREF_KEY, encoded)
}
