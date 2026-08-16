package com.futebadosparcas.ui.main

import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import com.futebadosparcas.util.globalKeyboardShortcuts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Alignment
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.domain.gamification.BadgeAwarder
import com.futebadosparcas.domain.ranking.PostGameEventEmitter
import com.futebadosparcas.domain.usecase.notification.ObserveUnreadCountUseCase
import kotlinx.coroutines.flow.collectLatest
import com.futebadosparcas.ui.components.modern.AdaptiveNavigationScaffold
import com.futebadosparcas.ui.components.modern.NavDestination
import com.futebadosparcas.ui.navigation.AppNavHost
import com.futebadosparcas.ui.navigation.Screen
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.onboarding.OnboardingFlow
import com.futebadosparcas.ui.onboarding.PhoneVerificationScreen
import com.futebadosparcas.ui.onboarding.CpfVerificationScreen
import com.futebadosparcas.ui.onboarding.VerificationGateViewModel
import com.futebadosparcas.ui.onboarding.VerifiedState
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.DeepLinkHelper
import com.futebadosparcas.util.toNavigationRoute
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import org.koin.compose.viewmodel.koinViewModel
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Sports
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Sports
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * MainActivity versão Compose.
 * Substitui gradualmente a versão XML.
 */
class MainActivityCompose : AppCompatActivity() {

    private val badgeAwarder: BadgeAwarder by inject()
    private val firestore: FirebaseFirestore by inject()
    private val postGameEventEmitter: PostGameEventEmitter by inject()
    private val themeRepository: ThemeRepository by inject()
    private val observeUnreadCountUseCase: ObserveUnreadCountUseCase by inject()
    private val preferencesManager: PreferencesManager by inject()
    private val authRepository: com.futebadosparcas.data.repository.AuthRepository by inject()
    private val updateProfileUseCase: com.futebadosparcas.domain.usecase.user.UpdateProfileUseCase by inject()

    // Estado de deep link extraído de App Links ou de notificações FCM.
    // Guardado no nível da Activity para sobreviver à recomposição e ao onNewIntent.
    private val deepLinkTarget = mutableStateOf<String?>(null)

    // Post-game summary state — bridge entre observePostGameEvents (lifecycle) e Compose.
    private val pendingPostGameSummary = mutableStateOf<com.futebadosparcas.ui.statistics.PostGameSummary?>(null)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Atualiza o Intent da Activity para que getIntent() reflita o novo Intent.
        setIntent(intent)
        handleIntentExtras(intent)
    }

    /**
     * Extrai Android App Links e extras de notificação e define a rota interna.
     * Produtores conhecidos:
     *   - NotificationHelper: "gameId" (String), "openBadges" (Boolean)
     *   - FcmService: "gameId" (String), "notificationType" (String)
     */
    private fun handleIntentExtras(intent: Intent?) {
        val appLinkRoute = DeepLinkHelper().parse(intent).toNavigationRoute()
        val gameId = intent?.getStringExtra("gameId")
        val openBadges = intent?.getBooleanExtra("openBadges", false) ?: false
        val notificationType = intent?.getStringExtra("notificationType")

        deepLinkTarget.value = when {
            appLinkRoute != null -> appLinkRoute
            gameId != null -> "game_detail/$gameId"
            openBadges -> "badges"
            notificationType == "level_up" -> "evolution"
            else -> null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        super.onCreate(savedInstanceState)
        // Processa extras de notificação apenas em cold start (não em recreate por rotação).
        // onNewIntent cobre o caso hot start (app já em foreground).
        if (savedInstanceState == null) {
            handleIntentExtras(intent)
        }

        setContent {
            val themeConfig by themeRepository.themeConfig.collectAsStateWithLifecycle(
                initialValue = com.futebadosparcas.domain.model.AppThemeConfig()
            )

            val isDark = when (themeConfig.mode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> isSystemInDarkMode()
            }

            // Estado para controlar exibição do onboarding de permissões
            var showPermissionOnboarding by remember {
                mutableStateOf(!preferencesManager.isPermissionOnboardingCompleted())
            }

            SetupSystemBars(isDark)

            FutebaTheme(
                themeConfig = themeConfig,
                darkTheme = isDark
            ) {
                // Gate anti-bot pos-login (opcao b).
                // Spec: SPEC_BUGFIX_2026-05-17_C1_ANDROID_ANTIBOT_ENFORCEMENT.md (#1302)
                AntiBotGate(
                    showPermissionOnboarding = showPermissionOnboarding,
                    onPermissionOnboardingComplete = { showPermissionOnboarding = false },
                    themeConfig = themeConfig,
                    onThemeChange = { recreate() },
                    deepLinkTarget = deepLinkTarget.value,
                    onDeepLinkConsumed = { deepLinkTarget.value = null },
                )

                // Post-game dialog — exibe resumo de XP/level-up apos finalizacao de jogo (#2724)
                pendingPostGameSummary.value?.let { summary ->
                    com.futebadosparcas.ui.statistics.PostGameDialog(
                        summary = summary,
                        onDismiss = { pendingPostGameSummary.value = null }
                    )
                }
            }
        }

        observeGamificationEvents()
        observePostGameEvents()
        observeNotifications()
    }

    private fun observeGamificationEvents() {
        // Badge notifications now handled in MainScreen Compose with Snackbar
    }

    private fun observePostGameEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                postGameEventEmitter.postGameEvents.collect { summary ->
                    pendingPostGameSummary.value = summary
                }
            }
        }
    }

    private fun observeNotifications() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Notifications handled by BottomBar
            }
        }
    }

    private fun isSystemInDarkMode(): Boolean {
        val currentNightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return currentNightMode == Configuration.UI_MODE_NIGHT_YES
    }
}

@Composable
private fun SetupSystemBars(isDark: Boolean) {
    val view = LocalView.current
    val window = (view.context as? androidx.activity.ComponentActivity)?.window

    val surfaceColor = MaterialTheme.colorScheme.surface

    LaunchedEffect(isDark, surfaceColor) {
        window?.let {
            it.statusBarColor = Color.Transparent.toArgb()
            it.navigationBarColor = surfaceColor.toArgb()

            WindowInsetsControllerCompat(window, view).apply {
                isAppearanceLightStatusBars = !isDark
                isAppearanceLightNavigationBars = !isDark
            }
        }
    }
}

/**
 * Gate anti-bot pos-login (Opcao b, spec #1302).
 *
 * Executa ANTES do onboarding de permissoes e do app principal:
 *   Unknown     => loading (CircularProgressIndicator)
 *   Unverified  => fluxo phone-verify → CPF (phone pulado se ja vinculado, atalho #1024)
 *   Failed      => tela de erro com botao de retry (sem loop automatico)
 *   Verified    => fluxo normal (onboarding de permissoes ou MainScreen)
 *
 * Prevencao de loop:
 * - check() usa getIdToken(false) — token cacheado, sem roundtrip de rede.
 * - recheckAfterVerify() usa getIdToken(true) e e chamado UMA vez pelo onSuccess do CPF.
 * - Se recheckAfterVerify() retornar ainda nao-verificado => Failed (nao re-roteia).
 */
@Composable
private fun AntiBotGate(
    showPermissionOnboarding: Boolean,
    onPermissionOnboardingComplete: () -> Unit,
    themeConfig: com.futebadosparcas.domain.model.AppThemeConfig,
    onThemeChange: () -> Unit,
    deepLinkTarget: String?,
    onDeepLinkConsumed: () -> Unit,
    verificationGateViewModel: VerificationGateViewModel = koinViewModel(),
    preferencesManager: PreferencesManager = org.koin.compose.koinInject(),
    authRepository: com.futebadosparcas.data.repository.AuthRepository = org.koin.compose.koinInject(),
    updateProfileUseCase: com.futebadosparcas.domain.usecase.user.UpdateProfileUseCase = org.koin.compose.koinInject(),
    badgeAwarder: BadgeAwarder = org.koin.compose.koinInject(),
    observeUnreadCountUseCase: ObserveUnreadCountUseCase = org.koin.compose.koinInject(),
) {
    val gateState by verificationGateViewModel.state.collectAsStateWithLifecycle()

    // Dispara verificacao inicial uma unica vez por composicao.
    LaunchedEffect(Unit) {
        verificationGateViewModel.check()
    }

    when (val state = gateState) {
        is VerifiedState.Unknown -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        is VerifiedState.Unverified -> {
            // Atalho #1024: pula telefone se usuario ja tem numero vinculado.
            if (state.hasPhone) {
                CpfVerificationScreen(
                    onSuccess = { verificationGateViewModel.recheckAfterVerify() },
                )
            } else {
                var showCpf by remember { mutableStateOf(false) }
                if (showCpf) {
                    CpfVerificationScreen(
                        onSuccess = { verificationGateViewModel.recheckAfterVerify() },
                    )
                } else {
                    PhoneVerificationScreen(onSuccess = { showCpf = true })
                }
            }
        }

        is VerifiedState.Failed -> {
            // Falha irrecuperavel — exibe mensagem e botao de retry sem loop automatico.
            // postVerify=true => falha veio de recheckAfterVerify (pos-fluxo CPF):
            //   retry chama recheckAfterVerify() para re-tentar so o refresh forcado,
            //   sem re-rodar phone/CPF/setUserVerified (evita perpetuar janela transiente).
            // postVerify=false => falha veio de check (pre-fluxo, sessao invalida):
            //   retry chama check() normalmente.
            Box(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = {
                            if (state.postVerify) {
                                verificationGateViewModel.recheckAfterVerify()
                            } else {
                                verificationGateViewModel.check()
                            }
                        },
                    ) {
                        Text(stringResource(R.string.retry))
                    }
                }
            }
        }

        is VerifiedState.Verified -> {
            val scope = androidx.compose.runtime.rememberCoroutineScope()

            // ProfileGate: verifica claim profileComplete apos gate anti-bot.
            // Spec: feat-2026-05-21-profile-complete-gate.md (#1485 PR-D)
            val profileComplete by authRepository.profileComplete.collectAsStateWithLifecycle()

            LaunchedEffect(state) {
                authRepository.checkProfileComplete()
            }

            com.futebadosparcas.ui.components.gate.ProfileGate(
                isProfileComplete = profileComplete,
                onRefreshProfileComplete = {
                    scope.launch { authRepository.refreshProfileComplete() }
                },
            ) {
                if (showPermissionOnboarding) {
                    OnboardingFlow(
                        preferencesManager = preferencesManager,
                        onComplete = onPermissionOnboardingComplete,
                        onProfileSetup = { profileData ->
                            scope.launch {
                                runCatching {
                                    val uid = authRepository.getCurrentUserId() ?: return@runCatching
                                    if (profileData.name.isBlank() &&
                                        profileData.nickname == null &&
                                        profileData.preferredPosition == null &&
                                        profileData.preferredFieldTypes.isEmpty()
                                    ) return@runCatching
                                    val fieldTypes = profileData.preferredFieldTypes.mapNotNull {
                                        try {
                                            com.futebadosparcas.domain.model.FieldType.valueOf(it)
                                        } catch (_: Exception) {
                                            null
                                        }
                                    }
                                    val params = com.futebadosparcas.domain.usecase.user.UpdateProfileParams(
                                        userId = uid,
                                        name = profileData.name.takeIf { it.isNotBlank() },
                                        nickname = profileData.nickname,
                                        primaryPosition = profileData.preferredPosition,
                                        preferredFieldTypes = fieldTypes.takeIf { it.isNotEmpty() },
                                    )
                                    updateProfileUseCase(params)
                                    com.futebadosparcas.util.AppLogger.d("Onboarding") { "Perfil salvo com sucesso" }
                                }.onFailure { e ->
                                    com.futebadosparcas.util.AppLogger.e(
                                        "Onboarding",
                                        "Erro ao salvar perfil: ${e.message}",
                                        e,
                                    )
                                }
                            }
                        },
                    )
                } else {
                    MainScreen(
                        themeConfig = themeConfig,
                        onThemeChange = onThemeChange,
                        badgeAwarder = badgeAwarder,
                        observeUnreadCountUseCase = observeUnreadCountUseCase,
                        deepLinkTarget = deepLinkTarget,
                        onDeepLinkConsumed = onDeepLinkConsumed,
                    )
                }
            }
        }
    }
}

/**
 * Tela principal com navegação Compose adaptativa.
 *
 * - Compact (< 600dp): NavigationBar (bottom)
 * - Medium (600–839dp): NavigationRail (lateral)
 * - Expanded (>= 840dp): NavigationRail com labels visíveis (lateral)
 */
@Composable
fun MainScreen(
    themeConfig: com.futebadosparcas.domain.model.AppThemeConfig,
    onThemeChange: () -> Unit,
    badgeAwarder: BadgeAwarder,
    observeUnreadCountUseCase: ObserveUnreadCountUseCase,
    deepLinkTarget: String? = null,
    onDeepLinkConsumed: () -> Unit = {}
) {
    val context = LocalContext.current
    val navController = androidx.navigation.compose.rememberNavController()
    val navItems = rememberBottomNavItems()

    // Entrada atual da pilha de navegação
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Exibe navegação apenas nas rotas raiz
    val navRoutes = remember(navItems) { navItems.map { it.route } }
    val showNavigation = currentDestination?.route in navRoutes

    val snackbarHostState = remember { SnackbarHostState() }

    // Contagem de notificações não lidas
    val notificationCount by observeUnreadCountUseCase()
        .collectAsStateWithLifecycle(initialValue = 0)

    // Pop-up "Novidades" pós-atualização (spec feat-2026-05-22 — Fase E).
    // Instância scoped à Activity — não interfere com a Tela "Novidades".
    val whatsNewViewModel: com.futebadosparcas.ui.whatsnew.WhatsNewViewModel = koinViewModel()
    val whatsNewPopup by whatsNewViewModel.popupNote.collectAsStateWithLifecycle()

    // Verifica uma única vez se há nota não vista a exibir; nunca bloqueia o boot.
    LaunchedEffect(Unit) {
        whatsNewViewModel.checkForPopup()
    }

    // Navega para o destino de App Link ou notificação FCM.
    LaunchedEffect(deepLinkTarget) {
        deepLinkTarget?.let { route ->
            navController.navigate(route) {
                launchSingleTop = true
            }
            onDeepLinkConsumed()
        }
    }

    // Exibe snackbar ao desbloquear badge
    LaunchedEffect(Unit) {
        val vibrationHelper = com.futebadosparcas.util.VibrationHelper(context)
        badgeAwarder.newBadges.collectLatest { badge ->
            vibrationHelper.vibrateBadgeUnlocked()
            snackbarHostState.showSnackbar(
                message = context.getString(R.string.badge_unlocked_toast, badge.badgeId),
                duration = SnackbarDuration.Short
            )
        }
    }

    // Trata o botão voltar
    BackHandler(enabled = true) {
        if (currentDestination?.route != Screen.Home.route) {
            navController.popBackStack()
        } else {
            (context as? androidx.activity.ComponentActivity)?.finish()
        }
    }

    // Callback de navegação com single-top e save/restore state
    val onNavigate: (String) -> Unit = { route ->
        if (route != currentDestination?.route) {
            navController.navigate(route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    // #2191: integra atalhos de teclado globais (Chromebook/tablet com teclado/TV).
    // H=Home, G=Games, P=Peladas/Grupos, R=Ranking/League, U=Profile.
    val keyboardFocus = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(Unit) {
        runCatching { keyboardFocus.requestFocus() }
    }
    val keyboardShortcutsModifier = Modifier
        .focusRequester(keyboardFocus)
        .focusable()
        .globalKeyboardShortcuts(
            onNavigateHome = { onNavigate(Screen.Home.route) },
            onNavigateGames = { onNavigate(Screen.Games.route) },
            onNavigateGroups = { onNavigate(Screen.Groups.route) },
            onNavigateRankings = { onNavigate(Screen.Ranking.route) },
            onNavigateProfile = { onNavigate(Screen.Profile.route) }
        )

    // Converte navItems para NavDestination do componente canônico (#2190).
    // contentDescription null: o label visível já é lido pelo TalkBack — evita anúncio duplo (#2736/#2693).
    val navDestinations = remember(navItems) {
        navItems.map { item ->
            NavDestination(
                route = item.route,
                label = item.label,
                icon = item.icon,
                selectedIcon = item.selectedIcon,
                contentDescription = null
            )
        }
    }

    // Layout adaptativo via AdaptiveNavigationScaffold canônico (#2190).
    // NavigationSuiteScaffold seleciona automaticamente BottomBar/Rail/Drawer
    // conforme o window size class — sem lógica manual de if/else.
    AdaptiveNavigationScaffold(
        selectedDestination = currentDestination?.route ?: Screen.Home.route,
        onNavigate = { route ->
            if (showNavigation || route != currentDestination?.route) {
                onNavigate(route)
            }
        },
        destinations = if (showNavigation) navDestinations else emptyList(),
        modifier = Modifier
            .fillMaxSize()
            .then(keyboardShortcutsModifier)
    ) {
        // Snackbar overlay dentro do content — NavigationSuiteScaffold não expõe
        // slot de snackbar diretamente (#2189/#2190).
        Box(modifier = Modifier.fillMaxSize()) {
            AppNavHost(navController = navController)
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }

    // Pop-up "Novidades" — só aparece quando o usuário está numa tela raiz, para
    // não cobrir abruptamente um fluxo de detalhe. Se a verificação resolver fora
    // de uma raiz, o pop-up aguarda o retorno (ou reaparece no próximo boot).
    whatsNewPopup?.let { note ->
        if (showNavigation) {
            com.futebadosparcas.ui.whatsnew.WhatsNewBottomSheet(
                note = note,
                onDismiss = { whatsNewViewModel.dismissPopup() }
            )
        }
    }
}

// FutebaBottomBar e FutebaNavigationRail removidos (#2693):
// dead code substituído pelo AdaptiveNavigationScaffold canônico (#2190).

/**
 * Dados dos itens do Bottom Navigation.
 */
data class BottomNavItem(
    val route: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val selectedIcon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    val label: String,
    val screen: Screen
)

@Composable
private fun rememberBottomNavItems(): List<BottomNavItem> {
    // Alinhado ao canônico Web: [Home, Games, Groups, Ranking, Profile] — #2182
    val homeLabel = stringResource(R.string.nav_home)
    val gamesLabel = stringResource(R.string.nav_games)
    val groupsLabel = stringResource(R.string.nav_groups)
    val rankingLabel = stringResource(R.string.nav_ranking)
    val profileLabel = stringResource(R.string.nav_profile)

    return remember {
        listOf(
            BottomNavItem(
                route = Screen.Home.route,
                icon = Icons.Outlined.Home,
                selectedIcon = Icons.Filled.Home,
                label = homeLabel,
                screen = Screen.Home
            ),
            BottomNavItem(
                route = Screen.Games.route,
                icon = Icons.Outlined.Sports,
                selectedIcon = Icons.Filled.Sports,
                label = gamesLabel,
                screen = Screen.Games
            ),
            BottomNavItem(
                route = Screen.Groups.route,
                icon = Icons.Outlined.Groups,
                selectedIcon = Icons.Filled.Groups,
                label = groupsLabel,
                screen = Screen.Groups
            ),
            BottomNavItem(
                route = Screen.Ranking.route,
                icon = Icons.Outlined.EmojiEvents,
                selectedIcon = Icons.Filled.EmojiEvents,
                label = rankingLabel,
                screen = Screen.Ranking
            ),
            BottomNavItem(
                route = Screen.Profile.route,
                icon = Icons.Outlined.Person,
                selectedIcon = Icons.Filled.Person,
                label = profileLabel,
                screen = Screen.Profile
            )
        )
    }
}
