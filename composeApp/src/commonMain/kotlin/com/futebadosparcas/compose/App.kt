package com.futebadosparcas.compose

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.core.BlockedPlayersScreen
import com.futebadosparcas.ui.core.GamesScreen
import com.futebadosparcas.ui.core.InvitePlayersScreen
import com.futebadosparcas.ui.core.InviteViewModel
import com.futebadosparcas.ui.core.LoginScreen
import com.futebadosparcas.ui.core.LoginState
import com.futebadosparcas.ui.core.LoginViewModel
import com.futebadosparcas.ui.core.OwnerStats
import com.futebadosparcas.ui.core.OwnerStatsScreen
import com.futebadosparcas.ui.core.PermissionOnboardingScreen
import com.futebadosparcas.ui.core.PostGameReport
import com.futebadosparcas.ui.core.PostGameReportScreen
import com.futebadosparcas.ui.core.ProfileSetupScreen
import com.futebadosparcas.ui.core.WelcomeScreen
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.theme.rememberReduceMotion
import com.futebadosparcas.ui.whatsnew.WhatsNewPopupHost
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
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
    val startDestination = if (authRepository?.isLoggedIn() == true) AppRoutes.HOME else AppRoutes.WELCOME
    val reduceMotion = rememberReduceMotion()
    var selectedGameId by remember { mutableStateOf<String?>(null) }
    var selectedInviteGroupId by remember { mutableStateOf<String?>(null) }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = {
            if (reduceMotion) {
                EnterTransition.None
            } else {
                fadeIn(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
                slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start)
            }
        },
        exitTransition = {
            if (reduceMotion) {
                ExitTransition.None
            } else {
                fadeOut(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
                slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Start)
            }
        },
        popEnterTransition = {
            if (reduceMotion) {
                EnterTransition.None
            } else {
                fadeIn(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
                slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.End)
            }
        },
        popExitTransition = {
            if (reduceMotion) {
                ExitTransition.None
            } else {
                fadeOut(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
                slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.End)
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
                onCreateGameClick = { /* TODO: rota create_game */ }
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
                onShare = { /* TODO: compartilhar via plataforma (expect/actual) */ },
                onShareWhatsApp = { /* TODO: compartilhar via WhatsApp (expect/actual) */ }
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
                blockedPlayers = emptyList(),
                availablePlayers = emptyList(),
                onBlockPlayer = { _, _, _ -> /* TODO: persistir bloqueio via repositório */ },
                onUnblockPlayer = { /* TODO: persistir desbloqueio via repositório */ },
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
            // TODO: extrair groupId dos argumentos e renderizar GroupDetailScreen
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
            // TODO: RankingScreen(navController)
        }

        // Badges
        composable(AppRoutes.BADGES) {
            // TODO: BadgesScreen(navController)
        }

        // Locations
        composable(AppRoutes.LOCATIONS) {
            // TODO: LocationsScreen(navController)
        }

        // Cashbox
        composable(AppRoutes.CASHBOX) {
            // TODO: CashboxScreen(navController)
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
            TopAppBar(
                title = { Text(stringResource(Res.string.game_detail_hub_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(Res.string.game_detail_organizer_tools),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() }
            )

            OutlinedButton(
                onClick = onOpenPostGameReport,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(Res.string.game_detail_post_game_report))
            }

            OutlinedButton(
                onClick = onOpenOwnerStats,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(Res.string.game_detail_owner_stats))
            }

            OutlinedButton(
                onClick = onOpenInvitePlayers,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(Res.string.game_detail_invite_players))
            }

            OutlinedButton(
                onClick = onOpenBlockedPlayers,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(Res.string.game_detail_blocked_players))
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
            TopAppBar(
                title = { Text(title) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
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

            actions.forEach { action ->
                FeatureHubActionButton(action)
            }
        }
    }
}

@Composable
private fun FeatureHubActionButton(action: FeatureHubAction) {
    OutlinedButton(
        onClick = action.onClick,
        modifier = Modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = "${action.label}. ${action.description}"
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
