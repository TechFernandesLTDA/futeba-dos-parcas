package com.futebadosparcas.compose

import com.futebadosparcas.compose.di.koinInjectOrNull
import com.futebadosparcas.compose.di.koinViewModelOrNull
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.savedstate.read
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.di.composeAppKoinModules
import com.futebadosparcas.compose.navigation.AppRoutes
import com.futebadosparcas.compose.resources.cancel
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.delete_account_title
import com.futebadosparcas.compose.resources.delete_account_unavailable_env
import com.futebadosparcas.compose.resources.game_detail_action_team_formation
import com.futebadosparcas.compose.resources.game_detail_fallback_title
import com.futebadosparcas.compose.resources.route_post_game_share_text
import com.futebadosparcas.compose.resources.game_detail_action_voting
import com.futebadosparcas.compose.resources.group_detail_action_cashbox
import com.futebadosparcas.compose.resources.group_detail_action_cashbox_body
import com.futebadosparcas.compose.resources.group_detail_body
import com.futebadosparcas.compose.resources.group_detail_title
import com.futebadosparcas.compose.resources.logout_confirm_action
import com.futebadosparcas.compose.resources.logout_confirm_body
import com.futebadosparcas.compose.resources.logout_confirm_title
import com.futebadosparcas.compose.resources.ok
import com.futebadosparcas.compose.resources.export_my_data_error_generic
import com.futebadosparcas.compose.resources.export_my_data_error_rate_limited
import com.futebadosparcas.compose.resources.export_my_data_error_title
import com.futebadosparcas.compose.resources.export_my_data_error_too_large
import com.futebadosparcas.compose.resources.export_my_data_loading
import com.futebadosparcas.compose.resources.export_my_data_partial_body
import com.futebadosparcas.compose.resources.export_my_data_partial_title
import com.futebadosparcas.compose.resources.export_my_data_success_body
import com.futebadosparcas.compose.resources.export_my_data_success_title
import com.futebadosparcas.compose.resources.export_my_data_unavailable_env
import com.futebadosparcas.compose.resources.profile_hub_action_delete_account
import com.futebadosparcas.compose.resources.profile_hub_action_delete_account_body
import com.futebadosparcas.compose.resources.profile_hub_action_export_data
import com.futebadosparcas.compose.resources.profile_hub_action_export_data_body
import com.futebadosparcas.compose.resources.profile_hub_action_logout
import com.futebadosparcas.compose.resources.profile_hub_action_logout_body
import com.futebadosparcas.compose.resources.route_confirmations_load_error
import com.futebadosparcas.compose.resources.route_game_detail_title
import com.futebadosparcas.compose.resources.route_game_load_error
import com.futebadosparcas.compose.resources.route_game_unavailable_env
import com.futebadosparcas.compose.resources.route_invite_players_missing_group
import com.futebadosparcas.compose.resources.route_invite_players_title
import com.futebadosparcas.compose.resources.route_invite_players_unavailable
import com.futebadosparcas.compose.resources.route_missing_game_id
import com.futebadosparcas.compose.resources.route_mvp_voting_title
import com.futebadosparcas.compose.resources.route_mvp_voting_unavailable
import com.futebadosparcas.compose.resources.route_owner_stats_missing
import com.futebadosparcas.compose.resources.route_owner_stats_title
import com.futebadosparcas.compose.resources.route_owner_stats_unavailable
import com.futebadosparcas.compose.resources.route_post_game_report_title
import com.futebadosparcas.compose.resources.auth_create_account
import com.futebadosparcas.compose.resources.route_register_unavailable_env
import com.futebadosparcas.compose.resources.route_post_game_share_title
import com.futebadosparcas.compose.resources.route_team_formation_title
import com.futebadosparcas.compose.resources.route_teams_load_error
import com.futebadosparcas.compose.resources.route_teams_loaded_readonly
import com.futebadosparcas.compose.resources.route_unavailable_back
import com.futebadosparcas.compose.resources.route_unavailable_retry
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
import com.futebadosparcas.compose.resources.profile_hub_action_theme
import com.futebadosparcas.compose.resources.profile_hub_action_theme_body
import com.futebadosparcas.compose.resources.profile_hub_body
import com.futebadosparcas.compose.resources.profile_hub_title
import com.futebadosparcas.compose.resources.theme_settings
import com.futebadosparcas.compose.resources.theme_settings_unavailable_body
import com.futebadosparcas.domain.model.ConfirmationStatus
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.GameWaitlist
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.model.UserGroup
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.model.WaitlistStatus
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.PlatformShareFactory
import com.futebadosparcas.platform.storage.PreferencesService
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.account.DeleteAccountScreen
import com.futebadosparcas.ui.account.DeleteAccountViewModel
import com.futebadosparcas.ui.account.ExportMyDataError
import com.futebadosparcas.ui.account.ExportMyDataUiState
import com.futebadosparcas.ui.account.ExportMyDataViewModel
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import com.futebadosparcas.ui.auth.RegisterScreen
import com.futebadosparcas.ui.auth.RegisterViewModel
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
import com.futebadosparcas.ui.core.PermissionOnboardingScreen
import com.futebadosparcas.ui.core.PostGameReport
import com.futebadosparcas.ui.core.PostGameReportScreen
import com.futebadosparcas.ui.core.ProfileSetupScreen
import com.futebadosparcas.ui.core.RankingRouteScreen
import com.futebadosparcas.ui.core.WelcomeScreen
import com.futebadosparcas.ui.settings.SharedUiThemeDefaults
import com.futebadosparcas.ui.settings.ThemeSettingsScreen
import com.futebadosparcas.ui.settings.ThemeSettingsViewModel
import com.futebadosparcas.ui.settings.applyPlatformThemeMode
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.theme.MotionSpring
import com.futebadosparcas.ui.theme.rememberReduceMotion
import com.futebadosparcas.ui.whatsnew.WhatsNewPopupHost
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import org.koin.compose.KoinApplication
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import org.jetbrains.compose.resources.getString
import org.jetbrains.compose.resources.stringResource

/**
 * Ponte multiplataforma para Universal Links / Deep Links (#4426).
 * O shell iOS (`FutebaApp.swift` -> `MainViewController.kt`) publica URLs recebidas em
 * `.onOpenURL`, e `AppNavigation` consome e navega para `/game/{id}` ou `/invite/{code}`.
 */
object ComposeDeepLinkBridge {
    private val _pendingUrl = MutableStateFlow<String?>(null)
    val pendingUrl = _pendingUrl

    fun onOpenUrl(url: String) {
        val trimmed = url.trim()
        if (trimmed.isNotEmpty()) {
            _pendingUrl.value = trimmed
        }
    }

    fun consumePendingUrl(): String? {
        val current = _pendingUrl.value
        _pendingUrl.value = null
        return current
    }
}

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
    // #4086 — iOS nunca renderizava dark: `FutebaTheme` era chamado sem `themeConfig` e o
    // default de `AppThemeConfig.mode` é LIGHT, tornando o ramo SYSTEM inalcançável.
    //
    // #4097 — a config agora é coletada de `ThemeRepository.themeConfig` (iOS: NSUserDefaults
    // via `ThemeRepositoryImpl` em shared/iosMain), como faz `app/.../ui/theme/Theme.kt`.
    // SYSTEM continua sendo o DEFAULT (instalação nova / antes da primeira emissão /
    // repositório ausente), não mais o único valor: o usuário escolhe na rota
    // `AppRoutes.THEME_SETTINGS` (hub de Perfil).
    val themeRepository: ThemeRepository? = koinInjectOrNull<ThemeRepository>()
    val themeConfigFlow = remember(themeRepository) {
        themeRepository?.themeConfig ?: flowOf(SharedUiThemeDefaults.config)
    }
    val themeConfig by themeConfigFlow.collectAsStateWithLifecycle(
        initialValue = SharedUiThemeDefaults.config
    )

    // Sincroniza o chrome nativo (status bar no iOS) com o modo escolhido — sem isso,
    // forçar ESCURO com o sistema claro deixaria os glifos da status bar sem contraste.
    LaunchedEffect(themeConfig.mode) {
        applyPlatformThemeMode(themeConfig.mode)
    }

    FutebaTheme(themeConfig = themeConfig) {
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
    val authRepository: AuthRepository? = koinInjectOrNull<AuthRepository>()
    val preferencesService: PreferencesService? = koinInjectOrNull<PreferencesService>()
    val platformShare = remember { runCatching { PlatformShareFactory.create() }.getOrNull() }
    val startDestination = if (authRepository?.isLoggedIn() == true) AppRoutes.HOME else AppRoutes.WELCOME
    val reduceMotion = rememberReduceMotion()
    val shareScope = rememberCoroutineScope()
    var selectedGameId by remember { mutableStateOf<String?>(null) }
    var selectedGroupId by remember { mutableStateOf<String?>(null) }
    var blockedPlayers by remember { mutableStateOf(emptyList<BlockedPlayerData>()) }
    val pendingDeepLinkUrl by ComposeDeepLinkBridge.pendingUrl.collectAsStateWithLifecycle()

    LaunchedEffect(preferencesService) {
        blockedPlayers = loadBlockedPlayers(preferencesService)
    }

    LaunchedEffect(pendingDeepLinkUrl) {
        val url = pendingDeepLinkUrl ?: return@LaunchedEffect
        val targetRoute = AppRoutes.resolveDeepLink(url)
        ComposeDeepLinkBridge.consumePendingUrl()
        if (targetRoute != null) {
            navController.navigate(targetRoute) {
                launchSingleTop = true
            }
        }
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
            val vm: LoginViewModel? = koinViewModelOrNull<LoginViewModel>()
            val uiState = vm?.loginState?.collectAsStateWithLifecycle()?.value ?: LoginState.Idle
            val passwordResetMessage = vm?.passwordResetMessage?.collectAsStateWithLifecycle()?.value

            LaunchedEffect(uiState) {
                if (uiState is LoginState.Success) {
                    navController.navigateToHomeClearingBackStack()
                }
            }

            LoginScreen(
                uiState = uiState,
                versionName = "",
                // G7 (B9): sem Client ID Google nativo configurado no iOS, avisa claramente
                // em vez de disparar ação silenciosa falsa.
                onGoogleSignInClick = { vm?.onGoogleSignInUnavailable() },
                onEmailPasswordSignIn = { email, password -> vm?.signInWithEmailAndPassword(email, password) },
                onForgotPassword = { email -> vm?.sendPasswordResetEmail(email) },
                // #4424: "Criar conta" abre o cadastro, não o setup de perfil.
                onNavigateToRegister = {
                    navController.navigate(AppRoutes.REGISTER) { launchSingleTop = true }
                },
                onNavigateToMain = { navController.navigateToHomeClearingBackStack() },
                passwordResetMessage = passwordResetMessage
            )
        }

        // Cadastro por e-mail e senha (#4424). A conta é criada no Firebase Auth e o
        // documento do usuário vem da Cloud Function onUserCreated; em seguida o usuário
        // completa o perfil (PROFILE_SETUP) sem poder voltar para o cadastro/login.
        composable(AppRoutes.REGISTER) {
            var retryKey by remember { mutableIntStateOf(0) }
            key(retryKey) {
                val registerVm = koinViewModelOrNull<RegisterViewModel>()
                if (registerVm != null) {
                    val registerState by registerVm.registerState.collectAsStateWithLifecycle()
                    RegisterScreen(
                        uiState = registerState,
                        onRegisterWithEmail = { email, password, name ->
                            registerVm.registerWithEmailAndPassword(email, password, name)
                        },
                        onNavigateToLogin = { navController.popBackStack() },
                        // Chamado pelo RegisterScreen quando o estado vira Success.
                        onNavigateToMain = {
                            navController.navigate(AppRoutes.PROFILE_SETUP) {
                                popUpTo(navController.graph.id) { inclusive = true }
                                launchSingleTop = true
                            }
                        }
                    )
                } else {
                    UnavailableRouteScreen(
                        title = stringResource(Res.string.auth_create_account),
                        message = stringResource(Res.string.route_register_unavailable_env),
                        onRetry = { retryKey += 1 },
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }

        // Perfil setup (pós-registro / primeiro acesso)
        composable(AppRoutes.PROFILE_SETUP) {
            ProfileSetupScreen(
                onContinue = { navController.leaveProfileSetup() },
                onSkip = { navController.leaveProfileSetup() }
            )
        }

        // Home
        // #4425: toda ida a uma aba (Início, Jogos, Grupos, Perfil) usa
        // `navigateToTopLevel`, inclusive pelos atalhos do conteúdo, para trocar de aba
        // em vez de empilhar telas.
        composable(AppRoutes.HOME) {
            HomeScreen(
                onOpenWhatsNew = { navController.navigate(AppRoutes.WHATS_NEW) },
                onNavigateToGames = { navController.navigateToTopLevel(AppRoutes.GAMES) },
                onNavigateToGroups = { navController.navigateToTopLevel(AppRoutes.GROUPS) },
                onNavigateToProfile = { navController.navigateToTopLevel(AppRoutes.PROFILE) },
                onOpenProfileSetup = { navController.navigate(AppRoutes.PROFILE_SETUP) },
                onNavigateToRanking = { navController.navigate(AppRoutes.RANKING) },
                onNavigateToBadges = { navController.navigate(AppRoutes.BADGES) },
                onNavigateToLocations = { navController.navigate(AppRoutes.LOCATIONS) }
            )
        }

        // Games
        composable(AppRoutes.GAMES) {
            GamesScreen(
                onGameClick = { gameId ->
                    selectedGameId = gameId
                    navController.navigate(AppRoutes.gameDetail(gameId))
                },
                onCreateGameClick = { navController.navigate(AppRoutes.CREATE_GAME) }
            )
        }

        // Criar Jogo (#4437 — G4)
        composable(AppRoutes.CREATE_GAME) {
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            CreateGameRoute(
                dataSource = dataSource,
                currentUserId = authRepository?.getCurrentUserId() ?: dataSource?.getCurrentUserId(),
                selectedGroupId = selectedGroupId,
                onNavigateBack = { navController.popBackStack() },
                onGameCreated = { createdGame ->
                    selectedGameId = createdGame.id
                    navController.navigate(AppRoutes.gameDetail(createdGame.id)) {
                        popUpTo(AppRoutes.CREATE_GAME) { inclusive = true }
                    }
                }
            )
        }

        composable(AppRoutes.GAME_DETAIL) { entry ->
            val gameId = entry.arguments?.read { getStringOrNull("gameId") }
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            val currentUserId = authRepository?.getCurrentUserId() ?: dataSource?.getCurrentUserId()
            LaunchedEffect(gameId) { selectedGameId = gameId }
            GameDetailRoute(
                gameId = gameId,
                dataSource = dataSource,
                currentUserId = currentUserId,
                onNavigateBack = { navController.popBackStack() },
                onOpenPostGameReport = { game ->
                    navController.navigate(AppRoutes.postGameReport(game.id))
                },
                onOpenOwnerStats = { game ->
                    navController.navigate(AppRoutes.ownerStats(game.ownerId))
                },
                onOpenTeamFormation = { game ->
                    navController.navigate(AppRoutes.teamFormation(game.id))
                },
                onOpenVoting = { game ->
                    navController.navigate(AppRoutes.mvpVoting(game.id))
                },
                onOpenInvitePlayers = { game ->
                    val groupId = game.groupId
                    if (!groupId.isNullOrBlank()) {
                        navController.navigate(AppRoutes.invitePlayers(groupId))
                    }
                },
                onOpenBlockedPlayers = { navController.navigate(AppRoutes.BLOCKED_PLAYERS) }
            )
        }

        composable(AppRoutes.POST_GAME_REPORT) { entry ->
            val gameId = entry.arguments?.read { getStringOrNull("gameId") }
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            val shareTitle = stringResource(Res.string.route_post_game_share_title)
            val shareText = stringResource(Res.string.route_post_game_share_text)
            PostGameReportRoute(
                gameId = gameId,
                dataSource = dataSource,
                onNavigateBack = { navController.popBackStack() },
                onShare = {
                    shareScope.launch {
                        platformShare?.share(
                            text = shareText,
                            title = shareTitle
                        )
                    }
                }
            )
        }

        composable(AppRoutes.OWNER_STATS) { entry ->
            val ownerId = entry.arguments?.read { getStringOrNull("ownerId") }
            var retryKey by remember { mutableIntStateOf(0) }
            key(retryKey) {
                UnavailableRouteScreen(
                    title = stringResource(Res.string.route_owner_stats_title),
                    message = if (ownerId.isNullOrBlank()) {
                        stringResource(Res.string.route_owner_stats_missing)
                    } else {
                        stringResource(Res.string.route_owner_stats_unavailable)
                    },
                    onRetry = { retryKey += 1 },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }

        composable(AppRoutes.TEAM_FORMATION) { entry ->
            val gameId = entry.arguments?.read { getStringOrNull("gameId") }
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            TeamFormationRoute(
                gameId = gameId,
                dataSource = dataSource,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(AppRoutes.MVP_VOTING) { entry ->
            val gameId = entry.arguments?.read { getStringOrNull("gameId") }
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            val currentUserId = authRepository?.getCurrentUserId() ?: dataSource?.getCurrentUserId()
            MvpVotingRoute(
                gameId = gameId,
                dataSource = dataSource,
                currentUserId = currentUserId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(AppRoutes.INVITE_PLAYERS) { entry ->
            val groupId = entry.arguments?.read { getStringOrNull("groupId") }
            var retryKey by remember { mutableIntStateOf(0) }
            key(retryKey) {
                val inviteVm = koinViewModelOrNull<InviteViewModel>()
                if (inviteVm != null && !groupId.isNullOrBlank()) {
                    InvitePlayersScreen(
                        viewModel = inviteVm,
                        groupId = groupId,
                        onNavigateBack = { navController.popBackStack() }
                    )
                } else {
                    UnavailableRouteScreen(
                        title = stringResource(Res.string.route_invite_players_title),
                        message = if (groupId.isNullOrBlank()) {
                            stringResource(Res.string.route_invite_players_missing_group)
                        } else {
                            stringResource(Res.string.route_invite_players_unavailable)
                        },
                        onRetry = { retryKey += 1 },
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }

        // Jogadores bloqueados e denúncia com efeito no servidor (#4423 — G1)
        composable(AppRoutes.BLOCKED_PLAYERS) {
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            var availablePlayers by remember { mutableStateOf(emptyList<GameConfirmation>()) }
            var moderationFeedback by remember { mutableStateOf<String?>(null) }

            LaunchedEffect(selectedGameId, dataSource) {
                val gId = selectedGameId
                if (!gId.isNullOrBlank() && dataSource != null) {
                    availablePlayers = dataSource.getGameConfirmations(gId).getOrDefault(emptyList())
                }
            }

            BlockedPlayersScreen(
                blockedPlayers = blockedPlayers,
                availablePlayers = availablePlayers,
                feedbackMessage = moderationFeedback,
                onBlockPlayer = { userId, userName, reason ->
                    val updated = blockedPlayers.filterNot { it.userId == userId } + BlockedPlayerData(
                        userId = userId,
                        userName = userName,
                        reason = reason,
                        blockedAt = null
                    )
                    blockedPlayers = updated
                    persistBlockedPlayers(preferencesService, updated)
                    shareScope.launch {
                        val currentUid = authRepository?.getCurrentUserId()
                            ?: dataSource?.getCurrentUserId().orEmpty()
                        val serverResult = dataSource?.blockUserOnServer(
                            userId = currentUid,
                            targetUserId = userId,
                            userName = userName,
                            reason = reason
                        )
                        moderationFeedback = if (serverResult?.isSuccess == true) {
                            "Jogador bloqueado e sincronizado com o servidor."
                        } else {
                            "Jogador bloqueado localmente."
                        }
                    }
                },
                onUnblockPlayer = { userId ->
                    val updated = blockedPlayers.filterNot { it.userId == userId }
                    blockedPlayers = updated
                    persistBlockedPlayers(preferencesService, updated)
                    shareScope.launch {
                        val currentUid = authRepository?.getCurrentUserId()
                            ?: dataSource?.getCurrentUserId().orEmpty()
                        dataSource?.unblockUserOnServer(
                            userId = currentUid,
                            targetUserId = userId
                        )
                        moderationFeedback = "Bloqueio removido."
                    }
                },
                onReportPlayer = { targetUserId, targetUserName, reason ->
                    val updated = blockedPlayers.filterNot { it.userId == targetUserId } + BlockedPlayerData(
                        userId = targetUserId,
                        userName = targetUserName,
                        reason = "Denúncia: $reason",
                        blockedAt = null
                    )
                    blockedPlayers = updated
                    persistBlockedPlayers(preferencesService, updated)
                    shareScope.launch {
                        val currentUid = authRepository?.getCurrentUserId()
                            ?: dataSource?.getCurrentUserId().orEmpty()
                        val reportResult = dataSource?.submitPlayerReport(
                            reporterId = currentUid,
                            targetUserId = targetUserId,
                            targetUserName = targetUserName,
                            reason = reason,
                            gameId = selectedGameId,
                            groupId = selectedGroupId
                        )
                        moderationFeedback = if (reportResult?.isSuccess == true) {
                            "Denúncia registrada no servidor e jogador bloqueado."
                        } else {
                            "Denúncia registrada localmente e jogador bloqueado."
                        }
                    }
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // Groups (B12 — lista de grupos e entrada para GROUP_DETAIL)
        composable(AppRoutes.GROUPS) {
            val dataSource = koinInjectOrNull<FirebaseDataSource>()
            val currentUserId = authRepository?.getCurrentUserId() ?: dataSource?.getCurrentUserId()
            var userGroups by remember { mutableStateOf(emptyList<UserGroup>()) }

            LaunchedEffect(currentUserId, dataSource) {
                if (!currentUserId.isNullOrBlank() && dataSource != null) {
                    dataSource.getUserGroupsFlow(currentUserId).collect { result ->
                        userGroups = result.getOrDefault(emptyList())
                        if (selectedGroupId.isNullOrBlank()) {
                            selectedGroupId = userGroups.firstOrNull()?.groupId
                        }
                    }
                }
            }

            val groupActions = userGroups.map { group ->
                FeatureHubAction(
                    label = group.groupName.ifBlank { "Grupo" },
                    description = "Abrir painel do grupo (${group.role})",
                    icon = Icons.Filled.Group,
                    onClick = {
                        selectedGroupId = group.groupId
                        navController.navigate(AppRoutes.groupDetail(group.groupId))
                    }
                )
            }

            val defaultGroupTargetId = selectedGroupId?.takeIf { it.isNotBlank() }
                ?: userGroups.firstOrNull()?.groupId
                ?: "meu_grupo"

            FeatureHubScreen(
                title = stringResource(Res.string.groups_hub_title),
                body = stringResource(Res.string.groups_hub_body),
                onNavigateBack = { navController.popBackStack() },
                actions = groupActions + listOf(
                    FeatureHubAction(
                        label = stringResource(Res.string.group_detail_title),
                        description = stringResource(Res.string.group_detail_body),
                        icon = Icons.Filled.Group,
                        onClick = {
                            selectedGroupId = defaultGroupTargetId
                            navController.navigate(AppRoutes.groupDetail(defaultGroupTargetId))
                        }
                    ),
                    FeatureHubAction(
                        label = "Criar Jogo",
                        description = "Agendar nova partida para o grupo",
                        icon = Icons.Filled.Add,
                        onClick = { navController.navigate(AppRoutes.CREATE_GAME) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_games),
                        description = stringResource(Res.string.groups_hub_action_games_body),
                        icon = Icons.Filled.SportsSoccer,
                        onClick = { navController.navigateToTopLevel(AppRoutes.GAMES) }
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

        // Group detail (B12 — recebe selectedGroupId / routeGroupId, NUNCA selectedGameId)
        composable(AppRoutes.GROUP_DETAIL) { entry ->
            val routeGroupId = entry.arguments?.read { getStringOrNull("groupId") }
            val effectiveGroupId = routeGroupId?.takeIf { it.isNotBlank() } ?: selectedGroupId
            LaunchedEffect(routeGroupId) {
                if (!routeGroupId.isNullOrBlank()) {
                    selectedGroupId = routeGroupId
                }
            }
            FeatureHubScreen(
                title = stringResource(Res.string.group_detail_title),
                body = stringResource(Res.string.group_detail_body),
                onNavigateBack = { navController.popBackStack() },
                actions = listOf(
                    FeatureHubAction(
                        label = "Criar Jogo",
                        description = "Agendar partida neste grupo",
                        icon = Icons.Filled.Add,
                        onClick = {
                            selectedGroupId = effectiveGroupId
                            navController.navigate(AppRoutes.CREATE_GAME)
                        }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.groups_hub_action_games),
                        description = stringResource(Res.string.groups_hub_action_games_body),
                        icon = Icons.Filled.SportsSoccer,
                        onClick = { navController.navigateToTopLevel(AppRoutes.GAMES) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.group_detail_action_cashbox),
                        description = stringResource(Res.string.group_detail_action_cashbox_body),
                        icon = Icons.Filled.QueryStats,
                        onClick = {
                            selectedGroupId = effectiveGroupId
                            navController.navigate(AppRoutes.CASHBOX)
                        }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.game_detail_invite_players),
                        description = "Convidar jogadores para o grupo",
                        icon = Icons.Filled.Person,
                        onClick = {
                            val targetGroup = effectiveGroupId
                            if (!targetGroup.isNullOrBlank()) {
                                selectedGroupId = targetGroup
                                navController.navigate(AppRoutes.invitePlayers(targetGroup))
                            }
                        }
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

        // Profile (B12 — inclui pontos de entrada para Ranking, Badges e Locais)
        composable(AppRoutes.PROFILE) {
            var showLogoutDialog by remember { mutableStateOf(false) }
            var showExportUnavailableDialog by remember { mutableStateOf(false) }
            val logoutScope = rememberCoroutineScope()
            val exportVm = koinViewModelOrNull<ExportMyDataViewModel>()
            val exportState by (exportVm?.uiState ?: remember { MutableStateFlow<ExportMyDataUiState>(ExportMyDataUiState.Idle) })
                .collectAsStateWithLifecycle()

            if (showLogoutDialog) {
                LogoutConfirmationDialog(
                    onDismiss = { showLogoutDialog = false },
                    onConfirm = {
                        showLogoutDialog = false
                        logoutScope.launch {
                            runCatching { authRepository?.logout() }
                            navController.navigateToStartClearingBackStack()
                        }
                    }
                )
            }
            if (showExportUnavailableDialog) {
                AlertDialog(
                    onDismissRequest = { showExportUnavailableDialog = false },
                    title = { Text(stringResource(Res.string.export_my_data_error_title)) },
                    text = { Text(stringResource(Res.string.export_my_data_unavailable_env)) },
                    confirmButton = {
                        TextButton(onClick = { showExportUnavailableDialog = false }) {
                            Text(stringResource(Res.string.ok))
                        }
                    }
                )
            }
            ExportMyDataStatusDialog(
                state = exportState,
                onDismiss = { exportVm?.dismissResult() }
            )
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
                        label = "Ranking",
                        description = "Classificação da temporada, artilharia e XP",
                        icon = Icons.Filled.EmojiEvents,
                        onClick = { navController.navigate(AppRoutes.RANKING) }
                    ),
                    FeatureHubAction(
                        label = "Conquistas",
                        description = "Medalhas e marcos desbloqueados",
                        icon = Icons.Filled.MilitaryTech,
                        onClick = { navController.navigate(AppRoutes.BADGES) }
                    ),
                    FeatureHubAction(
                        label = "Locais",
                        description = "Quadras e campos das peladas",
                        icon = Icons.Filled.LocationOn,
                        onClick = { navController.navigate(AppRoutes.LOCATIONS) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_stats),
                        description = stringResource(Res.string.profile_hub_action_stats_body),
                        icon = Icons.Filled.QueryStats,
                        onClick = {
                            authRepository?.getCurrentUserId()?.let { ownerId ->
                                navController.navigate(AppRoutes.ownerStats(ownerId))
                            }
                        }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_blocked),
                        description = stringResource(Res.string.profile_hub_action_blocked_body),
                        icon = Icons.Filled.Block,
                        onClick = { navController.navigate(AppRoutes.BLOCKED_PLAYERS) }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_theme),
                        description = stringResource(Res.string.profile_hub_action_theme_body),
                        icon = Icons.Filled.Palette,
                        onClick = { navController.navigate(AppRoutes.THEME_SETTINGS) }
                    ),
                    // Conta (#4401 / #4483): exportar dados (LGPD), sair e excluir ficam no fim do hub.
                    FeatureHubAction(
                        label = if (exportState is ExportMyDataUiState.Loading) {
                            stringResource(Res.string.export_my_data_loading)
                        } else {
                            stringResource(Res.string.profile_hub_action_export_data)
                        },
                        description = stringResource(Res.string.profile_hub_action_export_data_body),
                        icon = Icons.Filled.Download,
                        onClick = {
                            if (exportVm != null) {
                                exportVm.startExport()
                            } else {
                                showExportUnavailableDialog = true
                            }
                        }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_logout),
                        description = stringResource(Res.string.profile_hub_action_logout_body),
                        icon = Icons.AutoMirrored.Filled.Logout,
                        onClick = { showLogoutDialog = true }
                    ),
                    FeatureHubAction(
                        label = stringResource(Res.string.profile_hub_action_delete_account),
                        description = stringResource(Res.string.profile_hub_action_delete_account_body),
                        icon = Icons.Filled.DeleteForever,
                        destructive = true,
                        onClick = { navController.navigate(AppRoutes.DELETE_ACCOUNT) }
                    )
                )
            )
        }

        // Exclusão de conta (#4391/#4401): confirmação dupla e logout ao final.
        composable(AppRoutes.DELETE_ACCOUNT) {
            var retryKey by remember { mutableIntStateOf(0) }
            key(retryKey) {
                val deleteVm = koinViewModelOrNull<DeleteAccountViewModel>()
                if (deleteVm != null) {
                    DeleteAccountScreen(
                        viewModel = deleteVm,
                        onNavigateBack = { navController.popBackStack() },
                        onAccountDeleted = { navController.navigateToStartClearingBackStack() },
                        onSignedOutForReauthentication = {
                            navController.navigate(AppRoutes.LOGIN) {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        }
                    )
                } else {
                    UnavailableRouteScreen(
                        title = stringResource(Res.string.delete_account_title),
                        message = stringResource(Res.string.delete_account_unavailable_env),
                        onRetry = { retryKey += 1 },
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
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

        // Tema (#4097) — Claro / Escuro / Sistema + alto contraste; persiste em NSUserDefaults.
        composable(AppRoutes.THEME_SETTINGS) {
            var retryKey by remember { mutableIntStateOf(0) }
            key(retryKey) {
                val themeVm = koinViewModelOrNull<ThemeSettingsViewModel>()
                if (themeVm != null) {
                    ThemeSettingsScreen(
                        viewModel = themeVm,
                        onNavigateBack = { navController.popBackStack() }
                    )
                } else {
                    UnavailableRouteScreen(
                        title = stringResource(Res.string.theme_settings),
                        message = stringResource(Res.string.theme_settings_unavailable_body),
                        onRetry = { retryKey += 1 },
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}

private sealed interface RealtimeRouteState<out T> {
    data object Loading : RealtimeRouteState<Nothing>
    data class Success<T>(val data: T) : RealtimeRouteState<T>
    data class Error(val message: String) : RealtimeRouteState<Nothing>
}

@Composable
private fun GameDetailRoute(
    gameId: String?,
    dataSource: FirebaseDataSource?,
    currentUserId: String?,
    onNavigateBack: () -> Unit,
    onOpenPostGameReport: (Game) -> Unit,
    onOpenOwnerStats: (Game) -> Unit,
    onOpenTeamFormation: (Game) -> Unit,
    onOpenVoting: (Game) -> Unit,
    onOpenInvitePlayers: (Game) -> Unit,
    onOpenBlockedPlayers: () -> Unit
) {
    var retryKey by remember { mutableIntStateOf(0) }
    var state by remember(gameId, dataSource, retryKey) {
        mutableStateOf<RealtimeRouteState<Game>>(RealtimeRouteState.Loading)
    }
    var confirmations by remember(gameId, dataSource, retryKey) {
        mutableStateOf<List<GameConfirmation>>(emptyList())
    }
    var waitlistEntries by remember(gameId, dataSource, retryKey) {
        mutableStateOf<List<GameWaitlist>>(emptyList())
    }
    var actionInProgress by remember { mutableStateOf(false) }
    var actionFeedback by remember { mutableStateOf<String?>(null) }
    val actionScope = rememberCoroutineScope()

    LaunchedEffect(gameId, dataSource, retryKey) {
        if (gameId.isNullOrBlank()) {
            state = RealtimeRouteState.Error(getString(Res.string.route_missing_game_id))
            return@LaunchedEffect
        }
        if (dataSource == null) {
            state = RealtimeRouteState.Error(getString(Res.string.route_game_unavailable_env))
            return@LaunchedEffect
        }
        launch {
            dataSource.getGameConfirmationsFlow(gameId).collect { result ->
                if (result.isSuccess) {
                    confirmations = result.getOrDefault(emptyList())
                }
            }
        }
        launch {
            dataSource.getGameWaitlistFlow(gameId).collect { result ->
                if (result.isSuccess) {
                    waitlistEntries = result.getOrDefault(emptyList())
                }
            }
        }
        dataSource.getGameByIdFlow(gameId).collect { result ->
            state = if (result.isSuccess) {
                RealtimeRouteState.Success(result.getOrThrow())
            } else {
                // Mensagem amigável: o texto técnico da exceção não vai para a tela.
                RealtimeRouteState.Error(getString(Res.string.route_game_load_error))
            }
        }
    }

    when (val current = state) {
        RealtimeRouteState.Loading -> RouteLoadingScreen(
            title = stringResource(Res.string.route_game_detail_title),
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Error -> UnavailableRouteScreen(
            title = stringResource(Res.string.route_game_detail_title),
            message = current.message,
            onRetry = { retryKey += 1 },
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Success -> GameDetailHub(
            game = current.data,
            confirmations = confirmations,
            waitlistEntries = waitlistEntries,
            currentUserId = currentUserId,
            actionInProgress = actionInProgress,
            actionFeedback = actionFeedback,
            onConfirmPresence = { position ->
                val uid = currentUserId ?: dataSource?.getCurrentUserId()
                if (uid.isNullOrBlank() || dataSource == null) {
                    actionFeedback = "Faça login para confirmar presença."
                } else {
                    actionInProgress = true
                    actionFeedback = null
                    actionScope.launch {
                        val user = dataSource.getCurrentUser().getOrNull()
                        val result = dataSource.confirmPresence(
                            gameId = current.data.id,
                            userId = uid,
                            userName = user?.name?.ifBlank { "Jogador" } ?: "Jogador",
                            userPhoto = user?.photoUrl,
                            position = position,
                            isCasualPlayer = false
                        )
                        actionInProgress = false
                        actionFeedback = if (result.isSuccess) {
                            "Presença confirmada com sucesso!"
                        } else {
                            result.exceptionOrNull()?.message ?: "Não foi possível confirmar presença."
                        }
                    }
                }
            },
            onCancelPresence = {
                val uid = currentUserId ?: dataSource?.getCurrentUserId()
                if (uid.isNullOrBlank() || dataSource == null) {
                    actionFeedback = "Faça login para cancelar presença."
                } else {
                    actionInProgress = true
                    actionFeedback = null
                    actionScope.launch {
                        val result = dataSource.cancelConfirmation(current.data.id, uid)
                        actionInProgress = false
                        actionFeedback = if (result.isSuccess) {
                            "Presença cancelada."
                        } else {
                            result.exceptionOrNull()?.message ?: "Não foi possível cancelar presença."
                        }
                    }
                }
            },
            onJoinWaitlist = { position ->
                if (dataSource == null) {
                    actionFeedback = "Serviço indisponível."
                } else {
                    actionInProgress = true
                    actionFeedback = null
                    actionScope.launch {
                        val result = dataSource.joinWaitlist(current.data.id, position)
                        actionInProgress = false
                        actionFeedback = if (result.isSuccess) {
                            val pos = result.getOrNull()?.queuePosition ?: 1
                            "Você entrou na lista de espera (posição #$pos)."
                        } else {
                            result.exceptionOrNull()?.message ?: "Não foi possível entrar na lista de espera."
                        }
                    }
                }
            },
            onLeaveWaitlist = {
                val uid = currentUserId ?: dataSource?.getCurrentUserId()
                if (uid.isNullOrBlank() || dataSource == null) {
                    actionFeedback = "Serviço indisponível."
                } else {
                    actionInProgress = true
                    actionFeedback = null
                    actionScope.launch {
                        val result = dataSource.leaveWaitlist(current.data.id, uid)
                        actionInProgress = false
                        actionFeedback = if (result.isSuccess) {
                            "Você saiu da lista de espera."
                        } else {
                            result.exceptionOrNull()?.message ?: "Não foi possível sair da lista de espera."
                        }
                    }
                }
            },
            onNavigateBack = onNavigateBack,
            onOpenPostGameReport = { onOpenPostGameReport(current.data) },
            onOpenOwnerStats = if (current.data.ownerId.isBlank()) null else {
                { onOpenOwnerStats(current.data) }
            },
            onOpenTeamFormation = { onOpenTeamFormation(current.data) },
            onOpenVoting = { onOpenVoting(current.data) },
            onOpenInvitePlayers = if (current.data.groupId.isNullOrBlank()) null else {
                { onOpenInvitePlayers(current.data) }
            },
            onOpenBlockedPlayers = onOpenBlockedPlayers
        )
    }
}

@Composable
private fun PostGameReportRoute(
    gameId: String?,
    dataSource: FirebaseDataSource?,
    onNavigateBack: () -> Unit,
    onShare: () -> Unit
) {
    var retryKey by remember { mutableIntStateOf(0) }
    var state by remember(gameId, dataSource, retryKey) {
        mutableStateOf<RealtimeRouteState<PostGameReport>>(RealtimeRouteState.Loading)
    }

    LaunchedEffect(gameId, dataSource, retryKey) {
        if (gameId.isNullOrBlank()) {
            state = RealtimeRouteState.Error(getString(Res.string.route_missing_game_id))
            return@LaunchedEffect
        }
        if (dataSource == null) {
            state = RealtimeRouteState.Error(getString(Res.string.route_game_unavailable_env))
            return@LaunchedEffect
        }
        val game = dataSource.getGameById(gameId).getOrNull() ?: run {
            state = RealtimeRouteState.Error(getString(Res.string.route_game_load_error))
            return@LaunchedEffect
        }
        val confirmations = dataSource.getGameConfirmations(gameId).getOrNull() ?: run {
            state = RealtimeRouteState.Error(getString(Res.string.route_confirmations_load_error))
            return@LaunchedEffect
        }
        val teams = dataSource.getGameTeams(gameId).getOrNull() ?: run {
            state = RealtimeRouteState.Error(getString(Res.string.route_teams_load_error))
            return@LaunchedEffect
        }
        state = RealtimeRouteState.Success(
            buildPostGameReport(game, confirmations, teams)
        )
    }

    when (val current = state) {
        RealtimeRouteState.Loading -> RouteLoadingScreen(
            title = stringResource(Res.string.route_post_game_report_title),
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Error -> UnavailableRouteScreen(
            title = stringResource(Res.string.route_post_game_report_title),
            message = current.message,
            onRetry = { retryKey += 1 },
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Success -> PostGameReportScreen(
            report = current.data,
            onNavigateBack = onNavigateBack,
            onShare = onShare,
            onShareWhatsApp = onShare
        )
    }
}

private fun buildPostGameReport(
    game: Game,
    confirmations: List<GameConfirmation>,
    teams: List<Team>
): PostGameReport {
    val topScorers = confirmations
        .filter { it.goals > 0 }
        .sortedByDescending { it.goals }
        .map { it to it.goals }
    val topAssists = confirmations
        .filter { it.assists > 0 }
        .sortedByDescending { it.assists }
        .map { it to it.assists }
    return PostGameReport(
        game = game,
        confirmations = confirmations,
        teams = teams,
        mvpPlayer = confirmations.firstOrNull { it.userId == game.mvpId },
        totalGoals = confirmations.sumOf { it.goals },
        topScorers = topScorers,
        topAssists = topAssists,
        yellowCards = confirmations.sumOf { it.yellowCards },
        redCards = confirmations.sumOf { it.redCards }
    )
}

@Composable
private fun TeamFormationRoute(
    gameId: String?,
    dataSource: FirebaseDataSource?,
    onNavigateBack: () -> Unit
) {
    var retryKey by remember { mutableIntStateOf(0) }
    var state by remember(gameId, dataSource, retryKey) {
        mutableStateOf<RealtimeRouteState<List<Team>>>(RealtimeRouteState.Loading)
    }
    LaunchedEffect(gameId, dataSource, retryKey) {
        if (gameId.isNullOrBlank()) {
            state = RealtimeRouteState.Error(getString(Res.string.route_missing_game_id))
            return@LaunchedEffect
        }
        if (dataSource == null) {
            state = RealtimeRouteState.Error(getString(Res.string.route_game_unavailable_env))
            return@LaunchedEffect
        }
        dataSource.getGameTeamsFlow(gameId).collect { result ->
            state = if (result.isSuccess) {
                RealtimeRouteState.Success(result.getOrThrow())
            } else {
                RealtimeRouteState.Error(getString(Res.string.route_teams_load_error))
            }
        }
    }

    when (val current = state) {
        RealtimeRouteState.Loading -> RouteLoadingScreen(
            title = stringResource(Res.string.route_team_formation_title),
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Error -> UnavailableRouteScreen(
            title = stringResource(Res.string.route_team_formation_title),
            message = current.message,
            onRetry = { retryKey += 1 },
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Success -> UnavailableRouteScreen(
            title = stringResource(Res.string.route_team_formation_title),
            message = stringResource(Res.string.route_teams_loaded_readonly, current.data.size),
            onRetry = { retryKey += 1 },
            onNavigateBack = onNavigateBack
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RouteLoadingScreen(title: String, onNavigateBack: () -> Unit) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = title,
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier.fillMaxSize().padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun UnavailableRouteScreen(
    title: String,
    message: String,
    onRetry: () -> Unit,
    onNavigateBack: () -> Unit
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = title,
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
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
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // O ID interno (jogo/grupo) não aparece mais na tela: é dado técnico, não ajuda
            // o usuário e expunha identificadores do Firestore (#4401).
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
            )
            Spacer(modifier = Modifier.padding(top = 16.dp))
            // FlowRow: com Dynamic Type grande os dois botões quebram linha em vez de cortar.
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = onRetry) {
                    Text(stringResource(Res.string.route_unavailable_retry))
                }
                OutlinedButton(onClick = onNavigateBack) {
                    Text(stringResource(Res.string.route_unavailable_back))
                }
            }
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
    game: Game,
    confirmations: List<GameConfirmation>,
    waitlistEntries: List<GameWaitlist>,
    currentUserId: String?,
    actionInProgress: Boolean,
    actionFeedback: String?,
    onConfirmPresence: (String) -> Unit,
    onCancelPresence: () -> Unit,
    onJoinWaitlist: (String) -> Unit,
    onLeaveWaitlist: () -> Unit,
    onNavigateBack: () -> Unit,
    onOpenPostGameReport: () -> Unit,
    onOpenOwnerStats: (() -> Unit)?,
    onOpenTeamFormation: () -> Unit,
    onOpenVoting: () -> Unit,
    onOpenInvitePlayers: (() -> Unit)?,
    onOpenBlockedPlayers: () -> Unit
) {
    var selectedPosition by remember { mutableStateOf("FIELD") }
    val confirmedPlayers = remember(confirmations) {
        confirmations.filter { it.status == ConfirmationStatus.CONFIRMED.name }
    }
    val confirmedCount = maxOf(game.playersCount, confirmedPlayers.size)
    val isGameFull = game.maxPlayers > 0 && confirmedCount >= game.maxPlayers
    val isUserConfirmed = !currentUserId.isNullOrBlank() &&
        confirmedPlayers.any { it.userId == currentUserId }
    val userWaitlistEntry = remember(waitlistEntries, currentUserId) {
        if (currentUserId.isNullOrBlank()) null
        else waitlistEntries.firstOrNull {
            it.userId == currentUserId &&
                (it.status == WaitlistStatus.WAITING.name || it.status == WaitlistStatus.NOTIFIED.name)
        }
    }

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
                Triple(stringResource(Res.string.game_detail_post_game_report), onOpenPostGameReport, true),
                Triple(
                    stringResource(Res.string.game_detail_owner_stats),
                    onOpenOwnerStats ?: {},
                    onOpenOwnerStats != null
                ),
                Triple(stringResource(Res.string.game_detail_action_team_formation), onOpenTeamFormation, true),
                Triple(stringResource(Res.string.game_detail_action_voting), onOpenVoting, true),
                Triple(
                    stringResource(Res.string.game_detail_invite_players),
                    onOpenInvitePlayers ?: {},
                    onOpenInvitePlayers != null
                ),
                Triple(stringResource(Res.string.game_detail_blocked_players), onOpenBlockedPlayers, true)
            )

            Column(
                modifier = Modifier.widthIn(max = 960.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = game.locationName.ifBlank { stringResource(Res.string.game_detail_fallback_title) },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.semantics { heading() }
                )
                Text(
                    text = listOf(game.date, game.time, game.status)
                        .filter { it.isNotBlank() }
                        .joinToString(" • "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Card de Confirmação de Presença e Lista de Espera (#4434 / #4435 — G2 & G3)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Presença ($confirmedCount / ${game.maxPlayers})",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            if (waitlistEntries.isNotEmpty()) {
                                Text(
                                    text = "Fila de espera: ${waitlistEntries.size}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.tertiary
                                )
                            }
                        }

                        if (!isUserConfirmed && userWaitlistEntry == null && !game.isFinished() && !game.isCancelled()) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Posição:",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                FilterChip(
                                    selected = selectedPosition == "FIELD",
                                    onClick = { selectedPosition = "FIELD" },
                                    label = { Text("Linha") }
                                )
                                FilterChip(
                                    selected = selectedPosition == "GOALKEEPER",
                                    onClick = { selectedPosition = "GOALKEEPER" },
                                    label = { Text("Goleiro") }
                                )
                            }
                        }

                        when {
                            game.isFinished() -> {
                                Text(
                                    text = "Partida encerrada. Vote no Craque da Partida (MVP) e Bola Murcha!",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Button(
                                    onClick = onOpenVoting,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Votar MVP e Bola Murcha")
                                }
                            }
                            isUserConfirmed -> {
                                Text(
                                    text = "Sua presença está confirmada neste jogo.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                OutlinedButton(
                                    onClick = onCancelPresence,
                                    enabled = !actionInProgress,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    if (actionInProgress) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.width(18.dp),
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                    }
                                    Text("Cancelar Presença")
                                }
                            }
                            userWaitlistEntry != null -> {
                                val queuePos = userWaitlistEntry.queuePosition.coerceAtLeast(1)
                                Text(
                                    text = "Você está na lista de espera (posição #$queuePos).",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.tertiary
                                )
                                OutlinedButton(
                                    onClick = onLeaveWaitlist,
                                    enabled = !actionInProgress,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Sair da lista de espera")
                                }
                            }
                            isGameFull -> {
                                Text(
                                    text = "Jogo lotado ($confirmedCount/${game.maxPlayers}). Entre na lista de espera para ser avisado se abrir vaga.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Button(
                                    onClick = { onJoinWaitlist(selectedPosition) },
                                    enabled = !actionInProgress,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    if (actionInProgress) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.width(18.dp),
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                    }
                                    Text("Entrar na lista de espera")
                                }
                            }
                            else -> {
                                Button(
                                    onClick = { onConfirmPresence(selectedPosition) },
                                    enabled = !actionInProgress,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    if (actionInProgress) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.width(18.dp),
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                    }
                                    Text("Confirmar Presença")
                                }
                            }
                        }

                        if (!actionFeedback.isNullOrBlank()) {
                            Text(
                                text = actionFeedback,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                HorizontalDivider()

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
                            rowActions.forEach { (label, onClick, enabled) ->
                                OutlinedButton(
                                    onClick = onClick,
                                    enabled = enabled,
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
                    organizerActions.forEach { (label, onClick, enabled) ->
                        OutlinedButton(
                            onClick = onClick,
                            enabled = enabled,
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

/**
 * Rota para criação de jogo (#4437 — G4) no `composeApp`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateGameRoute(
    dataSource: FirebaseDataSource?,
    currentUserId: String?,
    selectedGroupId: String?,
    onNavigateBack: () -> Unit,
    onGameCreated: (Game) -> Unit
) {
    var locationName by remember { mutableStateOf("") }
    var locationAddress by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("2026-11-10") }
    var time by remember { mutableStateOf("20:00") }
    var endTime by remember { mutableStateOf("21:30") }
    var maxPlayersText by remember { mutableStateOf("14") }
    var dailyPriceText by remember { mutableStateOf("20.0") }
    var gameType by remember { mutableStateOf("Society") }
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = "Criar Jogo",
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
                .padding(20.dp)
                .widthIn(max = 680.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Agendar Nova Pelada",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() }
            )

            OutlinedTextField(
                value = locationName,
                onValueChange = { locationName = it },
                label = { Text("Local / Nome da quadra") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = locationAddress,
                onValueChange = { locationAddress = it },
                label = { Text("Endereço (opcional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = date,
                    onValueChange = { date = it },
                    label = { Text("Data (AAAA-MM-DD)") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = time,
                    onValueChange = { time = it },
                    label = { Text("Início (HH:MM)") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = endTime,
                    onValueChange = { endTime = it },
                    label = { Text("Término (HH:MM)") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = maxPlayersText,
                    onValueChange = { maxPlayersText = it },
                    label = { Text("Máx. jogadores") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = dailyPriceText,
                onValueChange = { dailyPriceText = it },
                label = { Text("Valor por jogador (R$)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                listOf("Society", "Futsal", "Campo").forEach { type ->
                    FilterChip(
                        selected = gameType == type,
                        onClick = { gameType = type },
                        label = { Text(type) }
                    )
                }
            }

            if (!errorMessage.isNullOrBlank()) {
                Text(
                    text = errorMessage.orEmpty(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Button(
                onClick = {
                    val trimmedLocation = locationName.trim()
                    val trimmedDate = date.trim()
                    val trimmedTime = time.trim()
                    val maxPlayers = maxPlayersText.trim().toIntOrNull() ?: 0
                    val dailyPrice = dailyPriceText.trim().replace(',', '.').toDoubleOrNull() ?: -1.0

                    when {
                        trimmedLocation.isEmpty() -> {
                            errorMessage = "Informe o nome do local."
                        }
                        trimmedDate.isEmpty() || trimmedTime.isEmpty() -> {
                            errorMessage = "Informe a data e o horário do jogo."
                        }
                        maxPlayers < Game.MIN_PLAYERS || maxPlayers > Game.MAX_PLAYERS -> {
                            errorMessage = "O limite de jogadores deve estar entre ${Game.MIN_PLAYERS} e ${Game.MAX_PLAYERS}."
                        }
                        dailyPrice < 0.0 -> {
                            errorMessage = "Informe um valor válido por jogador."
                        }
                        dataSource == null -> {
                            errorMessage = "Serviço Firebase indisponível neste ambiente."
                        }
                        else -> {
                            isSaving = true
                            errorMessage = null
                            scope.launch {
                                val user = dataSource.getCurrentUser().getOrNull()
                                val ownerId = currentUserId ?: user?.id.orEmpty()
                                val newGame = Game(
                                    date = trimmedDate,
                                    time = trimmedTime,
                                    endTime = endTime.trim(),
                                    status = GameStatus.SCHEDULED.name,
                                    maxPlayers = maxPlayers,
                                    dailyPrice = dailyPrice,
                                    locationName = trimmedLocation,
                                    locationAddress = locationAddress.trim(),
                                    gameType = gameType,
                                    ownerId = ownerId,
                                    ownerName = user?.name.orEmpty(),
                                    groupId = selectedGroupId
                                )
                                val result = dataSource.createGame(newGame)
                                isSaving = false
                                result.fold(
                                    onSuccess = { created -> onGameCreated(created) },
                                    onFailure = { err ->
                                        errorMessage = err.message ?: "Erro ao criar jogo."
                                    }
                                )
                            }
                        }
                    }
                },
                enabled = !isSaving && locationName.isNotBlank() && date.isNotBlank() && time.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.width(18.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Salvar e Publicar Jogo")
            }
        }
    }
}

/**
 * Rota de votação pós-jogo (MVP e Bola Murcha — #4436 G5) no `composeApp`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MvpVotingRoute(
    gameId: String?,
    dataSource: FirebaseDataSource?,
    currentUserId: String?,
    onNavigateBack: () -> Unit
) {
    var retryKey by remember { mutableIntStateOf(0) }
    var gameState by remember(gameId, dataSource, retryKey) {
        mutableStateOf<RealtimeRouteState<Pair<Game, List<GameConfirmation>>>>(RealtimeRouteState.Loading)
    }
    var selectedMvpPlayerId by remember { mutableStateOf<String?>(null) }
    var selectedWorstPlayerId by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var feedbackMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(gameId, dataSource, retryKey) {
        if (gameId.isNullOrBlank()) {
            gameState = RealtimeRouteState.Error(getString(Res.string.route_missing_game_id))
            return@LaunchedEffect
        }
        if (dataSource == null) {
            gameState = RealtimeRouteState.Error(getString(Res.string.route_game_unavailable_env))
            return@LaunchedEffect
        }
        val game = dataSource.getGameById(gameId).getOrNull() ?: run {
            gameState = RealtimeRouteState.Error(getString(Res.string.route_game_load_error))
            return@LaunchedEffect
        }
        val confirmations = dataSource.getGameConfirmations(gameId).getOrDefault(emptyList())
        gameState = RealtimeRouteState.Success(game to confirmations)
    }

    when (val current = gameState) {
        RealtimeRouteState.Loading -> RouteLoadingScreen(
            title = stringResource(Res.string.route_mvp_voting_title),
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Error -> UnavailableRouteScreen(
            title = stringResource(Res.string.route_mvp_voting_title),
            message = current.message,
            onRetry = { retryKey += 1 },
            onNavigateBack = onNavigateBack
        )
        is RealtimeRouteState.Success -> {
            val (game, confirmations) = current.data
            val confirmedPlayers = confirmations.filter {
                it.status == ConfirmationStatus.CONFIRMED.name
            }
            val isFinished = game.status == GameStatus.FINISHED.name

            Scaffold(
                topBar = {
                    AdaptiveTopBar(
                        title = stringResource(Res.string.route_mvp_voting_title),
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
                        .padding(20.dp)
                        .widthIn(max = 720.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = game.locationName.ifBlank { stringResource(Res.string.game_detail_fallback_title) },
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )

                    if (!isFinished) {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.secondaryContainer
                            )
                        ) {
                            Text(
                                text = "A votação oficial de MVP e Bola Murcha fica disponível quando o jogo está finalizado (status FINISHED). Status atual: ${game.status}.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }

                    if (confirmedPlayers.isEmpty()) {
                        Text(
                            text = "Nenhum jogador confirmado encontrado para votação nesta partida.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            text = "${VoteCategory.MVP.emoji} ${VoteCategory.MVP.displayName} (MVP)",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        confirmedPlayers.forEach { player ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = selectedMvpPlayerId == player.userId,
                                    onClick = { selectedMvpPlayerId = player.userId }
                                )
                                Text(
                                    text = player.getDisplayName(),
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            }
                        }

                        HorizontalDivider()

                        Text(
                            text = "${VoteCategory.WORST.emoji} ${VoteCategory.WORST.displayName}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        confirmedPlayers.forEach { player ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = selectedWorstPlayerId == player.userId,
                                    onClick = { selectedWorstPlayerId = player.userId }
                                )
                                Text(
                                    text = player.getDisplayName(),
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            }
                        }

                        if (!feedbackMessage.isNullOrBlank()) {
                            Text(
                                text = feedbackMessage.orEmpty(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Button(
                            onClick = {
                                val voterId = currentUserId ?: dataSource?.getCurrentUserId().orEmpty()
                                if (voterId.isBlank() || dataSource == null) {
                                    feedbackMessage = "Faça login para registrar seu voto."
                                    return@Button
                                }
                                isSubmitting = true
                                feedbackMessage = null
                                scope.launch {
                                    val results = mutableListOf<Result<Unit>>()
                                    selectedMvpPlayerId?.let { mvpId ->
                                        results += dataSource.submitMvpVoteViaCallable(
                                            MVPVote(
                                                id = MVPVote.generateId(game.id, voterId, VoteCategory.MVP),
                                                gameId = game.id,
                                                voterId = voterId,
                                                votedPlayerId = mvpId,
                                                category = VoteCategory.MVP
                                            )
                                        )
                                    }
                                    selectedWorstPlayerId?.let { worstId ->
                                        results += dataSource.submitMvpVoteViaCallable(
                                            MVPVote(
                                                id = MVPVote.generateId(game.id, voterId, VoteCategory.WORST),
                                                gameId = game.id,
                                                voterId = voterId,
                                                votedPlayerId = worstId,
                                                category = VoteCategory.WORST
                                            )
                                        )
                                    }
                                    isSubmitting = false
                                    feedbackMessage = if (results.isNotEmpty() && results.all { it.isSuccess }) {
                                        "Votos registrados com sucesso!"
                                    } else {
                                        results.firstOrNull { it.isFailure }?.exceptionOrNull()?.message
                                            ?: "Não foi possível registrar os votos."
                                    }
                                }
                            },
                            enabled = !isSubmitting && isFinished &&
                                (selectedMvpPlayerId != null || selectedWorstPlayerId != null),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.width(18.dp),
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Confirmar Votos")
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
    /** Ação destrutiva (ex.: excluir conta): ícone e rótulo em `colorScheme.error`. */
    val destructive: Boolean = false,
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
                tint = if (action.destructive) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.primary
                }
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
                    color = if (action.destructive) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    }
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

/**
 * Troca de aba (#4425): Início, Jogos, Grupos e Perfil se comportam como abas, não como
 * telas empilhadas. Desempilha até o HOME guardando o estado da aba atual, não duplica a
 * aba de destino e restaura o estado salvo dela. Assim o gesto de voltar sai da aba para
 * o Início, em vez de percorrer todas as abas tocadas.
 *
 * O `popUpTo` usa HOME, e não `graph.findStartDestination()`: o destino inicial muda
 * (WELCOME quando não há sessão), e desempilhar até ele levaria as abas para o welcome.
 */
private fun NavHostController.navigateToTopLevel(route: String) {
    navigate(route) {
        popUpTo(AppRoutes.HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/**
 * Entra no Início limpando a pilha de autenticação (#4425): depois do login, voltar não
 * deve reabrir welcome/onboarding/login, que ficavam embaixo do HOME.
 */
private fun NavHostController.navigateToHomeClearingBackStack() {
    navigate(AppRoutes.HOME) {
        popUpTo(graph.id) { inclusive = true }
        launchSingleTop = true
    }
}

/**
 * Sai do setup de perfil (#4425). Aberto a partir do Início ou do Perfil, volta para a
 * tela de origem; navegar para HOME ali empilhava um segundo Início. Logo após o
 * cadastro (#4424) não há tela anterior, então entra no Início limpando a pilha.
 */
private fun NavHostController.leaveProfileSetup() {
    if (previousBackStackEntry != null) {
        popBackStack()
    } else {
        navigateToHomeClearingBackStack()
    }
}

/**
 * Volta ao início do app (welcome) limpando toda a pilha: usado após o logout e após a
 * exclusão de conta, para o gesto de voltar não reabrir telas de uma sessão encerrada.
 */
private fun NavHostController.navigateToStartClearingBackStack() {
    navigate(AppRoutes.WELCOME) {
        popUpTo(graph.id) { inclusive = true }
        launchSingleTop = true
    }
}

@Composable
private fun LogoutConfirmationDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(Res.string.logout_confirm_title)) },
        text = { Text(stringResource(Res.string.logout_confirm_body)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(Res.string.logout_confirm_action))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.cancel)) }
        }
    )
}

@Composable
private fun ExportMyDataStatusDialog(
    state: ExportMyDataUiState,
    onDismiss: () -> Unit
) {
    val (title, body) = when (state) {
        ExportMyDataUiState.Idle, ExportMyDataUiState.Loading -> return
        is ExportMyDataUiState.Success -> if (state.partial) {
            stringResource(Res.string.export_my_data_partial_title) to
                stringResource(Res.string.export_my_data_partial_body)
        } else {
            stringResource(Res.string.export_my_data_success_title) to
                stringResource(Res.string.export_my_data_success_body)
        }
        is ExportMyDataUiState.Error -> stringResource(Res.string.export_my_data_error_title) to when (state.reason) {
            ExportMyDataError.RATE_LIMITED -> stringResource(Res.string.export_my_data_error_rate_limited)
            ExportMyDataError.TOO_LARGE -> stringResource(Res.string.export_my_data_error_too_large)
            ExportMyDataError.GENERIC -> stringResource(Res.string.export_my_data_error_generic)
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(body) },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.ok))
            }
        }
    )
}

private const val BLOCKED_PLAYERS_PREF_KEY = "compose_blocked_players"
private const val BLOCKED_PLAYER_ENTRY_SEPARATOR = "\u001E"
private const val BLOCKED_PLAYER_FIELD_SEPARATOR = "\u001F"

internal fun decodeBlockedPlayers(raw: String): List<BlockedPlayerData> {
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

internal fun encodeBlockedPlayers(blockedPlayers: List<BlockedPlayerData>): String {
    if (blockedPlayers.isEmpty()) return ""
    return blockedPlayers.joinToString(BLOCKED_PLAYER_ENTRY_SEPARATOR) { player ->
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
}

internal fun loadBlockedPlayers(preferencesService: PreferencesService?): List<BlockedPlayerData> {
    val raw = preferencesService?.getString(BLOCKED_PLAYERS_PREF_KEY, null).orEmpty()
    return decodeBlockedPlayers(raw)
}

internal fun persistBlockedPlayers(
    preferencesService: PreferencesService?,
    blockedPlayers: List<BlockedPlayerData>
) {
    if (preferencesService == null) return
    if (blockedPlayers.isEmpty()) {
        preferencesService.remove(BLOCKED_PLAYERS_PREF_KEY)
        return
    }
    preferencesService.putString(BLOCKED_PLAYERS_PREF_KEY, encodeBlockedPlayers(blockedPlayers))
}
