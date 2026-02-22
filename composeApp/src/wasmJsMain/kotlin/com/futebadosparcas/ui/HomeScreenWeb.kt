package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.offset
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.navigation.WebRoute
import com.futebadosparcas.navigation.WebRouter
import com.futebadosparcas.navigation.rememberWebRouterState
import com.futebadosparcas.ui.gamification.LevelJourneyScreen
import com.futebadosparcas.ui.gamification.BadgesScreen
import com.futebadosparcas.ui.gamification.XpHistoryScreen
import com.futebadosparcas.ui.settings.SettingsTab
import com.futebadosparcas.ui.tactical.TacticalBoardScreen
import kotlinx.coroutines.launch

private sealed class GamificationScreen {
    object None : GamificationScreen()
    object LevelJourney : GamificationScreen()
    object Badges : GamificationScreen()
    object XpHistory : GamificationScreen()
    object Settings : GamificationScreen()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreenWeb(
    onLogout: () -> Unit = {}
) {
    val currentRoute by rememberWebRouterState()
    val scope = rememberCoroutineScope()
    var unreadNotificationsCount by remember { mutableIntStateOf(0) }
    var gamificationScreen by remember { mutableStateOf<GamificationScreen>(GamificationScreen.None) }
    val isAdmin = FirebaseManager.getCurrentUserRole() == "ADMIN"

    val handleLogout: () -> Unit = {
        scope.launch {
            FirebaseManager.signOut()
            onLogout()
        }
    }

    val navigateToGroupDetail: (String) -> Unit = { groupId ->
        WebRouter.navigateToGroup(groupId)
    }

    val navigateToGameDetail: (String) -> Unit = { gameId ->
        WebRouter.navigateToGame(gameId)
    }

    val navigateToLocationDetail: (String) -> Unit = { locationId ->
        WebRouter.navigateToLocation(locationId)
    }

    val navigateBack: () -> Unit = {
        if (gamificationScreen != GamificationScreen.None) {
            gamificationScreen = GamificationScreen.None
        } else {
            WebRouter.goBack()
        }
    }

    fun loadUnreadCount() {
        scope.launch {
            unreadNotificationsCount = FirebaseManager.getUnreadNotificationsCount()
        }
    }

    LaunchedEffect(Unit) {
        val route = WebRouter.getCurrentRoute()
        if (route is WebRoute.Invite) {
            // TODO: Processar convite
        }
        loadUnreadCount()
    }

    LaunchedEffect(currentRoute) {
        if (currentRoute is WebRoute.Notifications) {
            loadUnreadCount()
        }
        gamificationScreen = GamificationScreen.None
    }

    val isGamificationScreen = gamificationScreen != GamificationScreen.None

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when {
                            gamificationScreen == GamificationScreen.LevelJourney -> "Jornada de Níveis"
                            gamificationScreen == GamificationScreen.Badges -> "Badges"
                            gamificationScreen == GamificationScreen.XpHistory -> "Histórico de XP"
                            gamificationScreen == GamificationScreen.Settings -> "Configurações"
                            currentRoute is WebRoute.GameDetail -> "Detalhes do Jogo"
                            currentRoute is WebRoute.GroupDetail -> "Detalhes do Grupo"
                            currentRoute is WebRoute.Invite -> "Convite"
                            currentRoute is WebRoute.TacticalBoard -> "Quadro Tático"
                            currentRoute is WebRoute.Admin -> "Painel Admin"
                            currentRoute is WebRoute.AdminUsers -> "Gerenciar Usuários"
                            currentRoute is WebRoute.AdminReports -> "Denúncias"
                            else -> "Futeba dos Parças - ${getPlatformName()}"
                        }
                    )
                },
                navigationIcon = {
                    if (currentRoute.isDetailScreen || isGamificationScreen) {
                        IconButton(onClick = navigateBack) {
                            Text("←", style = MaterialTheme.typography.titleLarge)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        bottomBar = {
            if (!currentRoute.isDetailScreen && !isGamificationScreen) {
                NavigationBar {
                    NavigationBarItem(
                        icon = { Text("🏠") },
                        label = { Text("Início") },
                        selected = currentRoute is WebRoute.Home,
                        onClick = { WebRouter.navigateToTab(0) }
                    )
                    NavigationBarItem(
                        icon = { Text("📅") },
                        label = { Text("Agenda") },
                        selected = currentRoute is WebRoute.Schedules,
                        onClick = { WebRouter.navigate(WebRoute.Schedules) }
                    )
                    NavigationBarItem(
                        icon = { Text("⚽") },
                        label = { Text("Jogos") },
                        selected = currentRoute is WebRoute.Games || currentRoute is WebRoute.GameDetail,
                        onClick = { WebRouter.navigateToTab(1) }
                    )
                    NavigationBarItem(
                        icon = { Text("👥") },
                        label = { Text("Grupos") },
                        selected = currentRoute is WebRoute.Groups || currentRoute is WebRoute.GroupDetail,
                        onClick = { WebRouter.navigateToTab(2) }
                    )
                    NavigationBarItem(
                        icon = { Text("👤") },
                        label = { Text("Jogadores") },
                        selected = currentRoute is WebRoute.Players || currentRoute is WebRoute.PlayerDetail,
                        onClick = { WebRouter.navigate(WebRoute.Players) }
                    )
                    NavigationBarItem(
                        icon = { Text("📍") },
                        label = { Text("Locais") },
                        selected = currentRoute is WebRoute.Locations || currentRoute is WebRoute.LocationDetail,
                        onClick = { WebRouter.navigateToTab(4) }
                    )
                    NavigationBarItem(
                        icon = { Text("🏆") },
                        label = { Text("Ranking") },
                        selected = currentRoute is WebRoute.Rankings || currentRoute is WebRoute.LeagueDetail || currentRoute is WebRoute.StatisticsDetail,
                        onClick = { WebRouter.navigateToTab(5) }
                    )
                    NavigationBarItem(
                        icon = {
                            Box {
                                Text("🔔")
                                if (unreadNotificationsCount > 0) {
                                    val pulseAnimation = rememberInfiniteTransition(label = "pulse")
                                    val pulseScale by pulseAnimation.animateFloat(
                                        initialValue = 1f,
                                        targetValue = 1.2f,
                                        animationSpec = infiniteRepeatable(
                                            animation = tween(800, easing = FastOutSlowInEasing),
                                            repeatMode = RepeatMode.Reverse
                                        ),
                                        label = "badgePulse"
                                    )

                                    Surface(
                                        shape = CircleShape,
                                        color = MaterialTheme.colorScheme.error,
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .offset(x = 6.dp, y = (-6).dp)
                                            .defaultMinSize(minWidth = 18.dp, minHeight = 18.dp)
                                            .graphicsLayer { scaleX = pulseScale; scaleY = pulseScale }
                                    ) {
                                        Box(
                                            contentAlignment = Alignment.Center,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        ) {
                                            Text(
                                                text = if (unreadNotificationsCount > 99) "99+" else unreadNotificationsCount.toString(),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onError,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        },
                        label = { Text("Alertas") },
                        selected = currentRoute is WebRoute.Notifications,
                        onClick = { WebRouter.navigateToTab(6) }
                    )
                    NavigationBarItem(
                        icon = { Text("👤") },
                        label = { Text("Perfil") },
                        selected = currentRoute is WebRoute.Profile,
                        onClick = { WebRouter.navigateToTab(7) }
                    )
                    if (isAdmin) {
                        NavigationBarItem(
                            icon = { Text("👑") },
                            label = { Text("Admin") },
                            selected = currentRoute is WebRoute.Admin || currentRoute is WebRoute.AdminUsers || currentRoute is WebRoute.AdminReports,
                            onClick = { WebRouter.navigateToTab(8) }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (gamificationScreen) {
                GamificationScreen.LevelJourney -> {
                    LevelJourneyScreen(
                        currentLevel = 12,
                        totalXP = 2450L,
                        onNavigateBack = { gamificationScreen = GamificationScreen.None }
                    )
                }
                GamificationScreen.Badges -> {
                    BadgesScreen(
                        unlockedBadges = emptyList(),
                        onNavigateBack = { gamificationScreen = GamificationScreen.None }
                    )
                }
                GamificationScreen.XpHistory -> {
                    XpHistoryScreen(
                        totalXP = 2450L,
                        onNavigateBack = { gamificationScreen = GamificationScreen.None }
                    )
                }
                GamificationScreen.Settings -> {
                    SettingsTab(
                        onBackClick = { gamificationScreen = GamificationScreen.None },
                        onDeleteAccountClick = handleLogout
                    )
                }
                GamificationScreen.None -> {
                    when (val route = currentRoute) {
                        is WebRoute.Home -> HomeScreen()
                        is WebRoute.Schedules -> SchedulesTab(
                            onGameClick = navigateToGameDetail
                        )
                        is WebRoute.Games -> GamesTab(
                            onGameClick = navigateToGameDetail
                        )
                        is WebRoute.GameDetail -> GameDetailScreenWeb(
                            gameId = route.gameId,
                            onBackClick = navigateBack
                        )
                        is WebRoute.Groups -> GroupsTab(
                            onGroupClick = navigateToGroupDetail
                        )
                        is WebRoute.GroupDetail -> GroupDetailScreen(
                            groupId = route.groupId,
                            onBackClick = navigateBack
                        )
                        is WebRoute.Players -> PlayersTab(
                            onPlayerClick = { playerId -> WebRouter.navigateToPlayer(playerId) }
                        )
                        is WebRoute.PlayerDetail -> PlayerDetailScreen(
                            playerId = route.playerId,
                            onBackClick = navigateBack
                        )
                        is WebRoute.Locations -> LocationsTab(
                            onLocationClick = navigateToLocationDetail
                        )
                        is WebRoute.LocationDetail -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("📍", style = MaterialTheme.typography.displayLarge)
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Text("Detalhes do local", style = MaterialTheme.typography.titleMedium)
                                    Text("ID: ${route.locationId}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                        is WebRoute.Rankings -> RankingTab(
                            onLeagueClick = { WebRouter.navigateToLeague() },
                            onPlayerClick = { userId -> WebRouter.navigateToStatistics(userId) }
                        )
                        is WebRoute.LeagueDetail -> LeagueDetailScreen(
                            seasonId = route.seasonId,
                            onBackClick = navigateBack,
                            onPlayerClick = { userId -> WebRouter.navigateToStatistics(userId) }
                        )
                        is WebRoute.StatisticsDetail -> StatisticsDetailScreen(
                            userId = route.userId,
                            groupId = route.groupId,
                            onBackClick = navigateBack
                        )
                        is WebRoute.Notifications -> NotificationsTab(
                            onNotificationClick = {
                                loadUnreadCount()
                            }
                        )
                        is WebRoute.Profile -> ProfileTab(
                            onLogoutClick = handleLogout,
                            onNavigateToLevelJourney = { gamificationScreen = GamificationScreen.LevelJourney },
                            onNavigateToBadges = { gamificationScreen = GamificationScreen.Badges },
                            onNavigateToXpHistory = { gamificationScreen = GamificationScreen.XpHistory },
                            onNavigateToSettings = { gamificationScreen = GamificationScreen.Settings },
                            onNavigateToDeveloperTools = { WebRouter.navigateToDeveloperTools() }
                        )
                        is WebRoute.Invite -> InviteScreenWeb(
                            code = route.code,
                            onBackClick = navigateBack
                        )
                        is WebRoute.TacticalBoard -> TacticalBoardScreen(
                            team1Name = "Time A",
                            team2Name = "Time B",
                            playersTeam1 = emptyList(),
                            playersTeam2 = emptyList(),
                            onBackClick = navigateBack
                        )
                        is WebRoute.DeveloperTools -> DeveloperToolsScreen(
                            onNavigateBack = navigateBack
                        )
                        is WebRoute.Admin -> AdminTab(
                            onNavigateToUsers = { WebRouter.navigate(WebRoute.AdminUsers) },
                            onNavigateToReports = { WebRouter.navigate(WebRoute.AdminReports) }
                        )
                        is WebRoute.AdminUsers -> UserManagementScreen(
                            onBackClick = navigateBack
                        )
                        is WebRoute.AdminReports -> ReportsScreen(
                            onBackClick = navigateBack
                        )
                    }
                }
            }
        }
    }
}
