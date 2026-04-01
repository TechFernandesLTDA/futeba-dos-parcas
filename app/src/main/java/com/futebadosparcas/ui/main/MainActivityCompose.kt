package com.futebadosparcas.ui.main

import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import com.futebadosparcas.domain.repository.NotificationRepository
import kotlinx.coroutines.flow.collectLatest
import com.futebadosparcas.ui.adaptive.WindowSizeClass
import com.futebadosparcas.ui.adaptive.WindowWidthSizeClass
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.navigation.AppNavHost
import com.futebadosparcas.ui.navigation.Screen
import com.futebadosparcas.ui.theme.CoilConfig
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.onboarding.OnboardingFlow
import com.futebadosparcas.util.PreferencesManager
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Sports
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
    private val notificationRepository: NotificationRepository by inject()
    private val preferencesManager: PreferencesManager by inject()
    private val authRepository: com.futebadosparcas.data.repository.AuthRepository by inject()
    private val updateProfileUseCase: com.futebadosparcas.domain.usecase.user.UpdateProfileUseCase by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        super.onCreate(savedInstanceState)

        // Configurar cache de imagens
        CoilConfig.setupCoil(this)

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
                if (showPermissionOnboarding) {
                    OnboardingFlow(
                        preferencesManager = preferencesManager,
                        onComplete = {
                            showPermissionOnboarding = false
                        },
                        onProfileSetup = { profileData ->
                            // Salvar dados do perfil no Firestore
                            lifecycleScope.launch {
                                try {
                                    val currentUserId = authRepository.getCurrentUserId()
                                    if (currentUserId != null && (profileData.name.isNotBlank() || profileData.nickname != null || profileData.preferredPosition != null || profileData.preferredFieldTypes.isNotEmpty())) {
                                        val fieldTypes = profileData.preferredFieldTypes.mapNotNull {
                                            try { com.futebadosparcas.domain.model.FieldType.valueOf(it) } catch (e: Exception) { null }
                                        }
                                        val params = com.futebadosparcas.domain.usecase.user.UpdateProfileParams(
                                            userId = currentUserId,
                                            name = profileData.name.takeIf { it.isNotBlank() },
                                            nickname = profileData.nickname,
                                            primaryPosition = profileData.preferredPosition,
                                            preferredFieldTypes = fieldTypes.takeIf { it.isNotEmpty() }
                                        )
                                        updateProfileUseCase(params)
                                        com.futebadosparcas.util.AppLogger.d("Onboarding") { "Profile saved successfully" }
                                    }
                                } catch (e: Exception) {
                                    com.futebadosparcas.util.AppLogger.e("Onboarding", "Error saving profile: ${e.message}", e)
                                }
                            }
                        }
                    )
                } else {
                    MainScreen(
                        themeConfig = themeConfig,
                        onThemeChange = { recreate() },
                        badgeAwarder = badgeAwarder,
                        notificationRepository = notificationRepository
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
                postGameEventEmitter.postGameEvents.collect {
                    // Post game dialog handled by individual screens
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
 * Tela principal com navegação Compose adaptativa.
 *
 * - Compact (< 600dp): NavigationBar (bottom)
 * - Medium (600–839dp): NavigationRail (lateral)
 * - Expanded (>= 840dp): NavigationRail com labels visíveis (lateral)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    themeConfig: com.futebadosparcas.domain.model.AppThemeConfig,
    onThemeChange: () -> Unit,
    badgeAwarder: BadgeAwarder,
    notificationRepository: NotificationRepository
) {
    val context = LocalContext.current
    val navController = androidx.navigation.compose.rememberNavController()
    val navItems = rememberBottomNavItems()
    val windowSizeClass = rememberWindowSizeClass()

    // Entrada atual da pilha de navegação
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Exibe navegação apenas nas rotas raiz
    val showNavigation = currentDestination?.route in navItems.map { it.route }

    val snackbarHostState = remember { SnackbarHostState() }

    // Contagem de notificações não lidas
    val notificationCount by notificationRepository.getUnreadCountFlow()
        .collectAsStateWithLifecycle(initialValue = 0)

    // Exibe snackbar ao desbloquear badge
    LaunchedEffect(Unit) {
        badgeAwarder.newBadges.collectLatest { badge ->
            snackbarHostState.showSnackbar(
                message = "🏆 Nova conquista: ${badge.badgeId}",
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

    // Layout adaptativo: Rail lateral em Medium/Expanded, BottomBar em Compact
    if (windowSizeClass.widthSizeClass == WindowWidthSizeClass.COMPACT) {
        // Compact: Scaffold com NavigationBar no fundo
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                if (showNavigation) {
                    FutebaBottomBar(
                        items = navItems,
                        currentRoute = currentDestination?.route,
                        notificationCount = notificationCount,
                        onNavigate = onNavigate
                    )
                }
            }
        ) { innerPadding ->
            Box(modifier = Modifier.padding(innerPadding)) {
                AppNavHost(navController = navController)
            }
        }
    } else {
        // Medium/Expanded: NavigationRail lateral + Scaffold sem bottomBar
        Row(modifier = Modifier.fillMaxSize()) {
            if (showNavigation) {
                FutebaNavigationRail(
                    items = navItems,
                    currentRoute = currentDestination?.route,
                    notificationCount = notificationCount,
                    showLabels = windowSizeClass.widthSizeClass == WindowWidthSizeClass.EXPANDED,
                    onNavigate = onNavigate
                )
            }

            Scaffold(
                modifier = Modifier.weight(1f),
                snackbarHost = { SnackbarHost(snackbarHostState) }
            ) { innerPadding ->
                Box(modifier = Modifier.padding(innerPadding)) {
                    AppNavHost(navController = navController)
                }
            }
        }
    }
}

/**
 * NavigationBar para telas compactas (telefone portrait).
 */
@Composable
private fun FutebaBottomBar(
    items: List<BottomNavItem>,
    currentRoute: String?,
    notificationCount: Int,
    onNavigate: (String) -> Unit
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surfaceVariant,
        tonalElevation = 0.dp
    ) {
        items.forEach { item ->
            val selected = currentRoute == item.route
            val badge = if (item.route == Screen.Profile.route && notificationCount > 0) {
                notificationCount
            } else {
                null
            }

            NavigationBarItem(
                icon = {
                    BadgedBox(badge = {
                        if (badge != null) {
                            Badge { Text(text = badge.toString()) }
                        }
                    }) {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = item.label
                        )
                    }
                },
                label = { Text(item.label) },
                selected = selected,
                onClick = { onNavigate(item.route) },
                alwaysShowLabel = true
            )
        }
    }
}

/**
 * NavigationRail para telas médias e expandidas (tablet, landscape).
 *
 * Em Medium: ícones sem labels.
 * Em Expanded: ícones com labels.
 */
@Composable
private fun FutebaNavigationRail(
    items: List<BottomNavItem>,
    currentRoute: String?,
    notificationCount: Int,
    showLabels: Boolean,
    onNavigate: (String) -> Unit
) {
    NavigationRail(
        modifier = Modifier.fillMaxHeight(),
        containerColor = MaterialTheme.colorScheme.surfaceVariant,
        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
    ) {
        Spacer(modifier = Modifier.height(8.dp))

        items.forEach { item ->
            val selected = currentRoute == item.route
            val badge = if (item.route == Screen.Profile.route && notificationCount > 0) {
                notificationCount
            } else {
                null
            }

            NavigationRailItem(
                selected = selected,
                onClick = { onNavigate(item.route) },
                icon = {
                    BadgedBox(badge = {
                        if (badge != null) {
                            Badge { Text(text = badge.toString()) }
                        }
                    }) {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = if (!showLabels) item.label else null
                        )
                    }
                },
                label = if (showLabels) {
                    { Text(item.label) }
                } else null,
                alwaysShowLabel = showLabels
            )
        }
    }
}

/**
 * Dados dos itens do Bottom Navigation.
 */
data class BottomNavItem(
    val route: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val label: String,
    val screen: Screen
)

@Composable
private fun rememberBottomNavItems(): List<BottomNavItem> {
    val homeLabel = stringResource(R.string.nav_home)
    val gamesLabel = stringResource(R.string.nav_games)
    val playersLabel = stringResource(R.string.nav_players)
    val leagueLabel = stringResource(R.string.league)
    val profileLabel = stringResource(R.string.nav_profile)

    return remember {
        listOf(
            BottomNavItem(
                route = Screen.Home.route,
                icon = Icons.Filled.Home,
                label = homeLabel,
                screen = Screen.Home
            ),
            BottomNavItem(
                route = Screen.Games.route,
                icon = Icons.Filled.Sports,
                label = gamesLabel,
                screen = Screen.Games
            ),
            BottomNavItem(
                route = Screen.Players.route,
                icon = Icons.Filled.People,
                label = playersLabel,
                screen = Screen.Players
            ),
            BottomNavItem(
                route = Screen.League.route,
                icon = Icons.Filled.EmojiEvents,
                label = leagueLabel,
                screen = Screen.League
            ),
            BottomNavItem(
                route = Screen.Profile.route,
                icon = Icons.Filled.Person,
                label = profileLabel,
                screen = Screen.Profile
            )
        )
    }
}
