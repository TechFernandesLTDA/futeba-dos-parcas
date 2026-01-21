package com.futebadosparcas.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import androidx.hilt.navigation.compose.hiltViewModel
import com.futebadosparcas.R
import com.futebadosparcas.ui.about.AboutScreen
import com.futebadosparcas.ui.badges.BadgesScreen
import com.futebadosparcas.ui.statistics.EvolutionScreen
import com.futebadosparcas.ui.groups.CashboxScreen
import com.futebadosparcas.ui.games.CreateGameScreen
import com.futebadosparcas.ui.groups.CreateGroupScreen
import com.futebadosparcas.ui.developer.DeveloperScreen
import com.futebadosparcas.ui.profile.EditProfileScreen
import com.futebadosparcas.ui.locations.FieldOwnerDashboardScreen
import com.futebadosparcas.ui.games.GameDetailScreen
import com.futebadosparcas.ui.games.GamesScreen
import com.futebadosparcas.ui.groups.GroupDetailScreen
import com.futebadosparcas.ui.groups.GroupsScreen
import com.futebadosparcas.ui.home.HomeScreen
import com.futebadosparcas.ui.groups.InvitePlayersScreen
import com.futebadosparcas.ui.livegame.LiveGameScreen
import com.futebadosparcas.ui.locations.LocationDetailScreen
import com.futebadosparcas.ui.locations.LocationsMapScreen
import com.futebadosparcas.ui.locations.ManageLocationsScreen
import com.futebadosparcas.ui.game_experience.MVPVoteScreen
import com.futebadosparcas.ui.notifications.NotificationsScreen
import com.futebadosparcas.ui.players.PlayersScreen
import com.futebadosparcas.ui.preferences.PreferencesScreen
import com.futebadosparcas.ui.profile.ProfileScreen
import com.futebadosparcas.ui.settings.GamificationSettingsScreen
import com.futebadosparcas.ui.statistics.RankingScreen
import com.futebadosparcas.ui.schedules.SchedulesScreen
import com.futebadosparcas.ui.statistics.StatisticsScreen
import com.futebadosparcas.ui.tactical.TacticalBoardScreen
import com.futebadosparcas.ui.theme.ThemeSettingsScreen
import com.futebadosparcas.ui.admin.UserManagementScreen
import com.futebadosparcas.ui.league.LeagueScreen
import com.futebadosparcas.ui.profile.LevelJourneyScreen
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.util.PreferencesManager
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue

/**
 * Define todas as rotas da navegação do app.
 *
 * Root destinations aparecem no Bottom Navigation.
 * Demais destinos sao telas secundarias com TopBar e botao de voltar.
 */
sealed class Screen(
    val route: String,
    val isRoot: Boolean = false, // Root destinations aparecem no bottom nav
    val titleResId: Int? = null  // String resource para titulo da TopBar
) {
    // ==================== ROOT DESTINATIONS (Bottom Navigation) ====================
    data object Home : Screen("home", isRoot = true)
    data object Games : Screen("games", isRoot = true)
    data object Players : Screen("players", isRoot = true)
    data object League : Screen("league", isRoot = true) // Liga como principal (antes era Statistics)
    data object Profile : Screen("profile", isRoot = true)

    // ==================== SECONDARY DESTINATIONS ====================

    // Statistics & Rankings (Statistics agora é secundário, acessível via League)
    data object Statistics : Screen("statistics", titleResId = R.string.nav_statistics)
    data object Ranking : Screen("ranking", titleResId = R.string.fragment_statistics_text_1)
    data object Evolution : Screen("evolution", titleResId = R.string.fragment_statistics_text_2)
    data object Badges : Screen("badges", titleResId = R.string.badges_title)

    // Game management
    data object GameDetail : Screen("game_detail/{gameId}", titleResId = R.string.game_detail) {
        fun createRoute(gameId: String) = "game_detail/$gameId"
    }
    data object CreateGame : Screen("create_game", titleResId = R.string.create_game)
    data object LiveGame : Screen("live_game/{gameId}", titleResId = R.string.live_game) {
        fun createRoute(gameId: String) = "live_game/$gameId"
    }
    data object MVPVote : Screen("mvp_vote/{gameId}", titleResId = R.string.mvp_vote) {
        fun createRoute(gameId: String) = "mvp_vote/$gameId"
    }
    data object TacticalBoard : Screen("tactical_board", titleResId = R.string.tactical_board)

    // Group management
    data object Groups : Screen("groups", titleResId = R.string.groups)
    data object GroupDetail : Screen("group_detail/{groupId}", titleResId = R.string.group_detail) {
        fun createRoute(groupId: String) = "group_detail/$groupId"
    }
    data object CreateGroup : Screen("create_group", titleResId = R.string.create_group)
    data object InvitePlayers : Screen("invite_players/{groupId}", titleResId = R.string.invite_players) {
        fun createRoute(groupId: String) = "invite_players/$groupId"
    }
    data object Cashbox : Screen("cashbox/{groupId}", titleResId = R.string.cashbox) {
        fun createRoute(groupId: String) = "cashbox/$groupId"
    }

    // Locations
    data object LocationsMap : Screen("locations_map", titleResId = R.string.location_map_title)
    data object LocationDetail : Screen("location_detail", titleResId = R.string.location_detail)
    data object ManageLocations : Screen("manage_locations", titleResId = R.string.manage_locations)
    data object FieldOwnerDashboard : Screen("field_owner_dashboard", titleResId = R.string.field_owner_dashboard)

    // Profile & Settings
    data object EditProfile : Screen("edit_profile", titleResId = R.string.edit_profile)
    data object Preferences : Screen("preferences", titleResId = R.string.preferences)
    data object ThemeSettings : Screen("theme_settings", titleResId = R.string.theme_settings)
    data object GamificationSettings : Screen("gamification_settings", titleResId = R.string.gamification_settings)
    data object Developer : Screen("developer", titleResId = R.string.developer)
    data object LevelJourney : Screen("level_journey", titleResId = R.string.level_journey)
    data object About : Screen("about", titleResId = R.string.about)
    data object Schedules : Screen("schedules", titleResId = R.string.schedules)

    // Notifications
    data object Notifications : Screen("notifications", titleResId = R.string.notifications)

    // Admin
    data object UserManagement : Screen("user_management", titleResId = R.string.admin_manage_users)
}

/**
 * Factory functions para rotas com parametros (usado em navegação)
 */
object Routes {
    fun gameDetail(gameId: String) = Screen.GameDetail.createRoute(gameId)
    fun liveGame(gameId: String) = Screen.LiveGame.createRoute(gameId)
    fun mvpVote(gameId: String) = Screen.MVPVote.createRoute(gameId)
    fun groupDetail(groupId: String) = Screen.GroupDetail.createRoute(groupId)
    fun invitePlayers(groupId: String) = Screen.InvitePlayers.createRoute(groupId)
    fun cashbox(groupId: String) = Screen.Cashbox.createRoute(groupId)
}

/**
 * NavHost principal do app com todas as Screens conectadas.
 */
@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    startDestination: String = Screen.Home.route
) {
    val context = LocalContext.current
    val hapticManager = remember { HapticManager(context) }
    val preferencesManager = remember { PreferencesManager(context) }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
        enterTransition = {
            fadeIn(animationSpec = tween(300)) +
            slideIntoContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.Start,
                animationSpec = tween(300)
            )
        },
        exitTransition = {
            fadeOut(animationSpec = tween(300)) +
            slideOutOfContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.Start,
                animationSpec = tween(300)
            )
        },
        popEnterTransition = {
            fadeIn(animationSpec = tween(300)) +
            slideIntoContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.End,
                animationSpec = tween(300)
            )
        },
        popExitTransition = {
            fadeOut(animationSpec = tween(300)) +
            slideOutOfContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.End,
                animationSpec = tween(300)
            )
        }
    ) {
        // ==================== ROOT DESTINATIONS (Bottom Nav) ====================

        composable(Screen.Home.route) {
            val viewModel: com.futebadosparcas.ui.home.HomeViewModel = hiltViewModel()
            HomeScreen(
                viewModel = viewModel,
                onGameClick = { gameId ->
                    navController.navigate(Screen.GameDetail.createRoute(gameId))
                },
                onConfirmGame = { gameId ->
                    navController.navigate(Screen.GameDetail.createRoute(gameId))
                },
                onProfileClick = {
                    navController.navigate(Screen.Profile.route)
                },
                onSettingsClick = {
                    navController.navigate(Screen.Preferences.route)
                },
                onNotificationsClick = {
                    navController.navigate(Screen.Notifications.route)
                },
                onGroupsClick = {
                    navController.navigate(Screen.Groups.route)
                },
                onMapClick = {
                    navController.navigate(Screen.LocationsMap.route)
                },
                onLevelJourneyClick = {
                    navController.navigate(Screen.LevelJourney.route)
                },
                onCreateGameClick = {
                    navController.navigate(Screen.CreateGame.route)
                },
                onJoinGroupClick = {
                    navController.navigate(Screen.Groups.route)
                }
            )
        }

        composable(Screen.Games.route) {
            val viewModel: com.futebadosparcas.ui.games.GamesViewModel = hiltViewModel()
            GamesScreen(
                viewModel = viewModel,
                onGameClick = { gameId ->
                    navController.navigate(Screen.GameDetail.createRoute(gameId))
                },
                onCreateGameClick = {
                    navController.navigate(Screen.CreateGame.route)
                },
                onNotificationsClick = {
                    navController.navigate(Screen.Notifications.route)
                },
                onGroupsClick = {
                    navController.navigate(Screen.Groups.route)
                },
                onMapClick = {
                    navController.navigate(Screen.LocationsMap.route)
                }
            )
        }

        composable(Screen.Players.route) {
            val viewModel: com.futebadosparcas.ui.players.PlayersViewModel = hiltViewModel()
            PlayersScreen(
                viewModel = viewModel,
                onPlayerClick = { /* Navegação para detalhe do jogador */ },
                onNavigateNotifications = {
                    navController.navigate(Screen.Notifications.route)
                },
                onNavigateGroups = {
                    navController.navigate(Screen.Groups.route)
                },
                onNavigateMap = {
                    navController.navigate(Screen.LocationsMap.route)
                }
            )
        }

        composable(Screen.League.route) {
            val viewModel: com.futebadosparcas.ui.league.LeagueViewModel = hiltViewModel()
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()
            val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()
            val availableSeasons by viewModel.availableSeasons.collectAsStateWithLifecycle()
            val selectedSeason by viewModel.selectedSeason.collectAsStateWithLifecycle()

            LeagueScreen(
                uiState = uiState,
                unreadCount = unreadCount,
                availableSeasons = availableSeasons,
                selectedSeason = selectedSeason,
                onBack = { navController.popBackStack() },
                onDivisionSelected = { viewModel.filterByDivision(it) },
                onSeasonSelected = { viewModel.selectSeason(it) },
                onRefresh = { selectedSeason?.let { viewModel.selectSeason(it) } },
                onNavigateNotifications = { navController.navigate(Screen.Notifications.route) },
                onNavigateGroups = { navController.navigate(Screen.Groups.route) },
                onNavigateMap = { navController.navigate(Screen.LocationsMap.route) }
            )
        }

        composable(Screen.Statistics.route) {
            val viewModel: com.futebadosparcas.ui.statistics.StatisticsViewModel = hiltViewModel()
            StatisticsScreen(
                viewModel = viewModel,
                onNavigateToRanking = {
                    navController.navigate(Screen.Ranking.route)
                },
                onNavigateToEvolution = {
                    navController.navigate(Screen.Evolution.route)
                },
                onNavigateToLeague = {
                    navController.navigate(Screen.League.route)
                }
            )
        }

        composable(Screen.Profile.route) {
            val viewModel: com.futebadosparcas.ui.profile.ProfileViewModel = hiltViewModel()
            ProfileScreen(
                viewModel = viewModel,
                onEditProfileClick = {
                    navController.navigate(Screen.EditProfile.route)
                },
                onSettingsClick = {
                    navController.navigate(Screen.Preferences.route)
                },
                onNotificationsClick = {
                    navController.navigate(Screen.Notifications.route)
                },
                onAboutClick = {
                    navController.navigate(Screen.About.route)
                },
                onSchedulesClick = {
                    navController.navigate(Screen.Schedules.route)
                },
                onLevelJourneyClick = {
                    navController.navigate(Screen.LevelJourney.route)
                },
                onUserManagementClick = {
                    navController.navigate(Screen.UserManagement.route)
                },
                onMyLocationsClick = {
                    navController.navigate(Screen.LocationsMap.route)
                },
                onManageLocationsClick = {
                    navController.navigate(Screen.ManageLocations.route)
                },
                onGamificationSettingsClick = {
                    navController.navigate(Screen.GamificationSettings.route)
                },
                onDeveloperMenuClick = {
                    navController.navigate(Screen.Developer.route)
                },
                onLogoutClick = {
                    viewModel.logout()
                    // O fluxo de navegação vai detectar o logout e redirecionar para login
                    // via MainActivity que observa o estado de autenticação
                }
            )
        }

        // ==================== SECONDARY DESTINATIONS ====================

        composable(Screen.Ranking.route) {
            val viewModel: com.futebadosparcas.ui.statistics.RankingViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.Ranking.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                RankingScreen(
                    viewModel = viewModel
                )
            }
        }

        composable(Screen.Evolution.route) {
            val viewModel: com.futebadosparcas.ui.statistics.RankingViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.Evolution.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                EvolutionScreen(
                    viewModel = viewModel
                )
            }
        }

        composable(Screen.Badges.route) {
            val viewModel: com.futebadosparcas.ui.badges.BadgesViewModel = hiltViewModel()
            // BadgesScreen tem sua própria TopBar no Scaffold
            BadgesScreen(
                viewModel = viewModel
            )
        }

        // ==================== GAME MANAGEMENT ====================

        composable(
            route = Screen.GameDetail.route,
            arguments = listOf(navArgument("gameId") { type = NavType.StringType })
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: ""
            val viewModel: com.futebadosparcas.ui.games.GameDetailViewModel = hiltViewModel()
            // GameDetailScreen tem TopBar customizada com ações - não usa SecondaryScreenWrapper
            GameDetailScreen(
                viewModel = viewModel,
                gameId = gameId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToCreateGame = { editGameId ->
                    navController.navigate(Screen.CreateGame.route)
                },
                onNavigateToMvpVote = {
                    navController.navigate(Screen.MVPVote.createRoute(gameId))
                },
                onNavigateToTacticalBoard = {
                    navController.navigate(Screen.TacticalBoard.route)
                }
            )
        }

        composable(Screen.CreateGame.route) {
            val viewModel: com.futebadosparcas.ui.games.CreateGameViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.CreateGame.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                CreateGameScreen(
                    gameId = null,
                    viewModel = viewModel,
                    hapticManager = hapticManager,
                    onNavigateBack = { navController.popBackStack() },
                    onGameCreated = { newGameId ->
                        navController.navigate(Screen.GameDetail.createRoute(newGameId)) {
                            popUpTo(Screen.Games.route)
                        }
                    }
                )
            }
        }

        composable(
            route = Screen.LiveGame.route,
            arguments = listOf(navArgument("gameId") { type = NavType.StringType })
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: ""
            val viewModel: com.futebadosparcas.ui.livegame.LiveGameViewModel = hiltViewModel()
            val statsViewModel: com.futebadosparcas.ui.livegame.LiveStatsViewModel = hiltViewModel()
            val eventsViewModel: com.futebadosparcas.ui.livegame.LiveEventsViewModel = hiltViewModel()
            // LiveGameScreen tem TopBar customizada com ações - não usa SecondaryScreenWrapper
            LiveGameScreen(
                viewModel = viewModel,
                statsViewModel = statsViewModel,
                eventsViewModel = eventsViewModel,
                gameId = gameId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToVote = {
                    navController.navigate(Screen.MVPVote.createRoute(gameId))
                }
            )
        }

        composable(
            route = Screen.MVPVote.route,
            arguments = listOf(navArgument("gameId") { type = NavType.StringType })
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: ""
            val viewModel: com.futebadosparcas.ui.game_experience.MVPVoteViewModel = hiltViewModel()
            // MVPVoteScreen tem sua própria TopBar no Scaffold
            MVPVoteScreen(
                viewModel = viewModel,
                gameId = gameId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.TacticalBoard.route) {
            // TacticalBoardScreen tem sua própria TopBar no Scaffold
            TacticalBoardScreen(
                onBackClick = { navController.popBackStack() }
            )
        }

        // ==================== GROUP MANAGEMENT ====================

        composable(Screen.Groups.route) {
            val viewModel: com.futebadosparcas.ui.groups.GroupsViewModel = hiltViewModel()
            // GroupsScreen tem sua própria TopBar no Scaffold
            GroupsScreen(
                viewModel = viewModel,
                onGroupClick = { groupId ->
                    navController.navigate(Screen.GroupDetail.createRoute(groupId))
                },
                onCreateGroupClick = {
                    navController.navigate(Screen.CreateGroup.route)
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.GroupDetail.route,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
            val viewModel: com.futebadosparcas.ui.groups.GroupDetailViewModel = hiltViewModel()
            // GroupDetailScreen tem TopBar customizada com ações - não usa SecondaryScreenWrapper
            GroupDetailScreen(
                viewModel = viewModel,
                groupId = groupId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToInvite = {
                    navController.navigate(Screen.InvitePlayers.createRoute(groupId))
                },
                onNavigateToCashbox = {
                    navController.navigate(Screen.Cashbox.createRoute(groupId))
                },
                onNavigateToCreateGame = {
                    navController.navigate(Screen.CreateGame.route)
                }
            )
        }

        composable(Screen.CreateGroup.route) {
            val viewModel: com.futebadosparcas.ui.groups.GroupsViewModel = hiltViewModel()
            // CreateGroupScreen tem TopBar customizada com ícone Close - não usa SecondaryScreenWrapper
            CreateGroupScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() },
                onGroupCreated = { newGroupId ->
                    navController.navigate(Screen.GroupDetail.createRoute(newGroupId)) {
                        popUpTo(Screen.Groups.route)
                    }
                }
            )
        }

        composable(
            route = Screen.InvitePlayers.route,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
            val viewModel: com.futebadosparcas.ui.groups.InviteViewModel = hiltViewModel()
            // InvitePlayersScreen tem sua própria TopBar no Scaffold
            InvitePlayersScreen(
                viewModel = viewModel,
                groupId = groupId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Cashbox.route,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
            val viewModel: com.futebadosparcas.ui.groups.CashboxViewModel = hiltViewModel()
            // CashboxScreen tem TopBar customizada com filtros/relatórios - não usa SecondaryScreenWrapper
            CashboxScreen(
                viewModel = viewModel,
                groupId = groupId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ==================== LOCATIONS ====================

        composable(Screen.LocationsMap.route) {
            val viewModel: com.futebadosparcas.ui.locations.LocationsMapViewModel = hiltViewModel()
            LocationsMapScreen(
                viewModel = viewModel,
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.LocationDetail.route) {
            val viewModel: com.futebadosparcas.ui.locations.LocationDetailViewModel = hiltViewModel()
            // LocationDetailScreen tem sua própria TopBar no Scaffold
            LocationDetailScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.ManageLocations.route) {
            val viewModel: com.futebadosparcas.ui.locations.ManageLocationsViewModel = hiltViewModel()
            // ManageLocationsScreen tem sua própria TopBar no Scaffold
            ManageLocationsScreen(
                viewModel = viewModel,
                onLocationClick = { locationId ->
                    navController.navigate(Screen.LocationDetail.route)
                },
                onCreateLocationClick = {
                    navController.navigate(Screen.LocationDetail.route)
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.FieldOwnerDashboard.route) {
            val viewModel: com.futebadosparcas.ui.locations.FieldOwnerDashboardViewModel = hiltViewModel()
            // FieldOwnerDashboardScreen tem sua própria TopBar no Scaffold
            FieldOwnerDashboardScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToLocation = { locationId ->
                    navController.navigate(Screen.LocationDetail.route)
                },
                onNavigateToAddLocation = {
                    navController.navigate(Screen.LocationDetail.route)
                }
            )
        }

        // ==================== PROFILE & SETTINGS ====================

        composable(Screen.EditProfile.route) {
            val viewModel: com.futebadosparcas.ui.profile.ProfileViewModel = hiltViewModel()
            // EditProfileScreen tem sua própria TopBar no Scaffold
            EditProfileScreen(
                viewModel = viewModel,
                preferencesManager = preferencesManager,
                onBackClick = { navController.popBackStack() },
                onProfileUpdated = {
                    // Navegar de volta para a tela de perfil após salvar
                    navController.popBackStack()
                }
            )
        }

        composable(Screen.Preferences.route) {
            val preferencesViewModel: com.futebadosparcas.ui.preferences.PreferencesViewModel = hiltViewModel()
            val themeViewModel: com.futebadosparcas.ui.theme.ThemeViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.Preferences.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                PreferencesScreen(
                    preferencesViewModel = preferencesViewModel,
                    themeViewModel = themeViewModel,
                    preferencesManager = preferencesManager,
                    onNavigateToThemeSettings = {
                        navController.navigate(Screen.ThemeSettings.route)
                    },
                    onNavigateToDeveloper = {
                        navController.navigate(Screen.Developer.route)
                    }
                )
            }
        }

        composable(Screen.Developer.route) {
            val viewModel: com.futebadosparcas.ui.developer.DeveloperViewModel = hiltViewModel()
            // DeveloperScreen NÃO tem TopBar própria - precisa do wrapper
            SecondaryScreenWrapper(
                titleResId = Screen.Developer.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                DeveloperScreen(viewModel = viewModel)
            }
        }

        composable(Screen.ThemeSettings.route) {
            val viewModel: com.futebadosparcas.ui.theme.ThemeViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.ThemeSettings.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                ThemeSettingsScreen(
                    viewModel = viewModel,
                    onBackClick = { navController.popBackStack() }
                )
            }
        }

        composable(Screen.GamificationSettings.route) {
            val viewModel: com.futebadosparcas.ui.settings.SettingsViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.GamificationSettings.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                GamificationSettingsScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
        }

        composable(Screen.LevelJourney.route) {
            val viewModel: com.futebadosparcas.ui.profile.ProfileViewModel = hiltViewModel()
            // LevelJourneyScreen tem sua própria TopBar no Scaffold
            LevelJourneyScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.About.route) {
            // AboutScreen tem sua própria navegação - não usa SecondaryScreenWrapper
            SecondaryScreenWrapper(
                titleResId = Screen.About.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                AboutScreen(onNavigateBack = { navController.popBackStack() })
            }
        }

        composable(Screen.Schedules.route) {
            val viewModel: com.futebadosparcas.ui.schedules.SchedulesViewModel = hiltViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.Schedules.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                SchedulesScreen(viewModel = viewModel)
            }
        }

        // ==================== NOTIFICATIONS ====================

        composable(Screen.Notifications.route) {
            val viewModel: com.futebadosparcas.ui.notifications.NotificationsViewModel = hiltViewModel()
            // NotificationsScreen tem TopBar customizada com badge e menu - não usa SecondaryScreenWrapper
            NotificationsScreen(
                viewModel = viewModel,
                onNotificationClick = { notification ->
                    when (notification.referenceType) {
                        "game" -> notification.referenceId?.let { gameId ->
                            navController.navigate(Screen.GameDetail.createRoute(gameId))
                        }
                        "group" -> notification.referenceId?.let { groupId ->
                            navController.navigate(Screen.GroupDetail.createRoute(groupId))
                        }
                        else -> {}
                    }
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        // ==================== ADMIN ====================

        composable(Screen.UserManagement.route) {
            val viewModel: com.futebadosparcas.ui.admin.UserManagementViewModel = hiltViewModel()
            // UserManagementScreen tem TopBar customizada - não usa SecondaryScreenWrapper
            UserManagementScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}

/**
 * Wrapper para telas secundárias com TopBar e botão de voltar.
 * Usado para telas que não são root destinations do Bottom Nav.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SecondaryScreenWrapper(
    titleResId: Int?,
    onNavigateBack: () -> Unit,
    content: @Composable () -> Unit
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    titleResId?.let { resId ->
                        Text(stringResource(resId))
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            content()
        }
    }
}

/**
 * Placeholder screen para telas que ainda não foram extraídas dos Fragments.
 */
@Composable
private fun PlaceholderScreen(name: String) {
    androidx.compose.material3.Text(
        text = "Screen: $name\n(Em desenvolvimento)",
        style = androidx.compose.material3.MaterialTheme.typography.bodyLarge
    )
}
