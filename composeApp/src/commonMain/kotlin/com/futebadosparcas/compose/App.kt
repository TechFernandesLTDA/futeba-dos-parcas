package com.futebadosparcas.compose

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.futebadosparcas.compose.di.composeAppKoinModules
import com.futebadosparcas.compose.navigation.AppRoutes
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.UiStrings
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
import com.futebadosparcas.ui.whatsnew.WhatsNewPopupHost
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
import org.koin.compose.KoinApplication
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

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

    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = {
            fadeIn(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start)
        },
        exitTransition = {
            fadeOut(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Start)
        },
        popEnterTransition = {
            fadeIn(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.End)
        },
        popExitTransition = {
            fadeOut(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.End)
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
                onGameClick = { gameId -> navController.navigate("game/$gameId") },
                onCreateGameClick = { /* TODO: rota create_game */ }
            )
        }

        // Game detail — hub do organizador (#2671)
        // Enquanto a GameDetailScreen completa não é portada (épico #2670), esta rota
        // serve de ponto de entrada navegável para as telas reais já existentes em
        // ui/core/ (relatório pós-jogo, estatísticas, convite, bloqueados), eliminando
        // telas órfãs. Acessível via GamesScreen.onGameClick -> "game/{gameId}".
        composable(AppRoutes.GAME_DETAIL) { backStackEntry ->
            // `arguments?.getString()` é Android-only e quebra o target iOS do
            // composeApp. Enquanto o detalhe completo do jogo não é portado, este
            // hub não precisa do ID real para renderizar; mantemos um fallback
            // estável para a navegação das ferramentas auxiliares.
            val gameId = "compose-game"
            GameDetailHub(
                onNavigateBack = { navController.popBackStack() },
                onOpenPostGameReport = { navController.navigate(AppRoutes.POST_GAME_REPORT) },
                onOpenOwnerStats = { navController.navigate(AppRoutes.OWNER_STATS) },
                onOpenInvitePlayers = {
                    // groupId real virá do jogo quando GameDetailScreen for portada;
                    // por ora usa o gameId como contexto de navegação.
                    navController.navigate("invite_players/$gameId")
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
                onGameClick = { gameId -> navController.navigate("game/$gameId") }
            )
        }

        // Convidar jogadores (tela real ui/core/InvitePlayersScreen)
        composable(AppRoutes.INVITE_PLAYERS) { backStackEntry ->
            // Mesmo racional do hub de jogo acima: evita API Android-only enquanto
            // a navegação commonMain ainda está em transição para uma camada tipada.
            val groupId = "compose-group"
            // InviteViewModel ainda não está registrado no Koin do composeApp
            // (depende de repositórios providos por plataforma). Renderiza a tela
            // apenas quando o VM estiver disponível; caso contrário, volta atrás
            // de forma graciosa (sem crash).
            val inviteVm: InviteViewModel? = runCatching { koinViewModel<InviteViewModel>() }.getOrNull()
            if (inviteVm != null) {
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
                title = UiStrings.GROUPS_HUB_TITLE,
                body = UiStrings.GROUPS_HUB_BODY,
                primaryActionLabel = UiStrings.GROUPS_HUB_PRIMARY,
                secondaryActionLabel = UiStrings.GROUPS_HUB_SECONDARY,
                onNavigateBack = { navController.popBackStack() },
                onPrimaryAction = { navController.navigate(AppRoutes.GAMES) },
                onSecondaryAction = { navController.navigate(AppRoutes.WHATS_NEW) }
            )
        }

        // Group detail
        composable(AppRoutes.GROUP_DETAIL) {
            // TODO: extrair groupId dos argumentos e renderizar GroupDetailScreen
        }

        // Profile
        composable(AppRoutes.PROFILE) {
            FeatureHubScreen(
                title = UiStrings.PROFILE_HUB_TITLE,
                body = UiStrings.PROFILE_HUB_BODY,
                primaryActionLabel = UiStrings.PROFILE_HUB_PRIMARY,
                secondaryActionLabel = UiStrings.PROFILE_HUB_SECONDARY,
                onNavigateBack = { navController.popBackStack() },
                onPrimaryAction = { navController.navigate(AppRoutes.PROFILE_SETUP) },
                onSecondaryAction = { navController.navigate(AppRoutes.OWNER_STATS) }
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
                title = { Text(UiStrings.GAME_DETAIL_TITLE) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = UiStrings.CD_BACK
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
                text = UiStrings.GAME_DETAIL_ORGANIZER_TOOLS,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            OutlinedButton(
                onClick = onOpenPostGameReport,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(UiStrings.GAME_DETAIL_POST_GAME_REPORT)
            }

            OutlinedButton(
                onClick = onOpenOwnerStats,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(UiStrings.GAME_DETAIL_OWNER_STATS)
            }

            OutlinedButton(
                onClick = onOpenInvitePlayers,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(UiStrings.GAME_DETAIL_INVITE_PLAYERS)
            }

            OutlinedButton(
                onClick = onOpenBlockedPlayers,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(UiStrings.GAME_DETAIL_BLOCKED_PLAYERS)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeatureHubScreen(
    title: String,
    body: String,
    primaryActionLabel: String,
    secondaryActionLabel: String,
    onNavigateBack: () -> Unit,
    onPrimaryAction: () -> Unit,
    onSecondaryAction: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = UiStrings.CD_BACK
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
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(
                onClick = onPrimaryAction,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(primaryActionLabel)
            }
            OutlinedButton(
                onClick = onSecondaryAction,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(secondaryActionLabel)
            }
        }
    }
}
