package com.futebadosparcas.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionSpring
import com.futebadosparcas.ui.theme.rememberReduceMotion
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import com.futebadosparcas.ui.about.AboutScreen
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
import com.futebadosparcas.ui.badges.BadgesScreen
import com.futebadosparcas.ui.statistics.EvolutionScreen
import com.futebadosparcas.ui.groups.CashboxScreen
import com.futebadosparcas.ui.games.CreateGameScreen
import com.futebadosparcas.ui.groups.CreateGroupScreen
import com.futebadosparcas.ui.groups.DiscoverGroupsScreen
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
import com.futebadosparcas.ui.weekly.WeeklyRankingScreen
import com.futebadosparcas.ui.publicgames.PublicGamesScreen
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.util.PreferencesManager
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

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
    data object WeeklyRanking : Screen("weekly_ranking", titleResId = R.string.weekly_ranking)

    // Growth features
    data object PublicGames : Screen("public_games", titleResId = R.string.public_games)
    data object InviteFriend : Screen("invite_friend", titleResId = R.string.invite_friend)
    data object DreamTeam : Screen("dream_team", titleResId = R.string.dream_team)
    data object GroupChallenges : Screen("group_challenges/{groupId}", titleResId = R.string.group_challenges_title) {
        fun createRoute(groupId: String) = "group_challenges/$groupId"
    }

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
    data object DiscoverGroups : Screen("groups/discover", titleResId = R.string.discover_groups_title)
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
    data object LocationDetail : Screen("location_detail?locationId={locationId}", titleResId = R.string.location_detail) {
        fun createRoute(locationId: String? = null) =
            if (locationId != null) "location_detail?locationId=$locationId"
            else "location_detail"
    }
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
    data object WhatsNew : Screen("whats_new", titleResId = R.string.whats_new_title)
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
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    startDestination: String = Screen.Home.route
) {
    val context = LocalContext.current
    val hapticManager = remember { HapticManager(context) }
    val preferencesManager = remember { PreferencesManager(context) }

    // Lê preferência de reduced-motion do sistema via CompositionLocal provido pelo FutebaTheme.
    // Quando ativo, substitui slides com spring por fades simples (#2735).
    val reducedMotion = rememberReduceMotion()
    val fadeDuration = MotionDuration.getMedium(reducedMotion)

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
        enterTransition = {
            if (reducedMotion) {
                // Reduced-motion: fade simples sem slide
                if (fadeDuration == 0) EnterTransition.None
                else fadeIn(animationSpec = tween(fadeDuration))
            } else {
                fadeIn(animationSpec = MotionSpring.spatial(reducedMotion)) +
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = MotionSpring.spatial(reducedMotion)
                )
            }
        },
        exitTransition = {
            if (reducedMotion) {
                if (fadeDuration == 0) ExitTransition.None
                else fadeOut(animationSpec = tween(fadeDuration))
            } else {
                fadeOut(animationSpec = MotionSpring.spatial(reducedMotion)) +
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = MotionSpring.spatial(reducedMotion)
                )
            }
        },
        popEnterTransition = {
            if (reducedMotion) {
                if (fadeDuration == 0) EnterTransition.None
                else fadeIn(animationSpec = tween(fadeDuration))
            } else {
                fadeIn(animationSpec = MotionSpring.spatial(reducedMotion)) +
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = MotionSpring.spatial(reducedMotion)
                )
            }
        },
        popExitTransition = {
            if (reducedMotion) {
                if (fadeDuration == 0) ExitTransition.None
                else fadeOut(animationSpec = tween(fadeDuration))
            } else {
                fadeOut(animationSpec = MotionSpring.spatial(reducedMotion)) +
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = MotionSpring.spatial(reducedMotion)
                )
            }
        }
    ) {
        // ==================== ROOT DESTINATIONS (Bottom Nav) ====================

        composable(Screen.Home.route) {
            val viewModel: com.futebadosparcas.ui.home.HomeViewModel = koinViewModel()
            val onboardingViewModel: com.futebadosparcas.ui.onboarding.OnboardingViewModel = koinViewModel()
            HomeScreen(
                viewModel = viewModel,
                onboardingViewModel = onboardingViewModel,
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
                },
                onSeeAllGamesClick = {
                    navController.navigate(Screen.Games.route)
                }
            )
        }

        composable(Screen.Games.route) {
            val viewModel: com.futebadosparcas.ui.games.GamesViewModel = koinViewModel()
            GamesScreen(
                viewModel = viewModel,
                onGameClick = { gameId ->
                    navController.navigate(Screen.GameDetail.createRoute(gameId))
                },
                onCreateGameClick = {
                    navController.navigate(Screen.CreateGame.route)
                },
                onEditGameClick = {
                    navController.navigate(Screen.CreateGame.route)
                },
                onMvpVoteClick = { gameId ->
                    navController.navigate(Screen.MVPVote.createRoute(gameId))
                },
                onTacticalBoardClick = {
                    navController.navigate(Screen.TacticalBoard.route)
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
            val viewModel: com.futebadosparcas.ui.players.PlayersViewModel = koinViewModel()
            // O clique em jogador é tratado internamente pela PlayersScreen
            // via ModalBottomSheet (PlayerCardContent), sem callback externo.
            PlayersScreen(
                viewModel = viewModel,
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
            val viewModel: com.futebadosparcas.ui.league.LeagueViewModel = koinViewModel()
            val playerCardViewModel: com.futebadosparcas.ui.player.PlayerCardViewModel = koinViewModel()
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()
            val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()
            val availableSeasons by viewModel.availableSeasons.collectAsStateWithLifecycle()
            val selectedSeason by viewModel.selectedSeason.collectAsStateWithLifecycle()
            val selectedGender by viewModel.selectedGender.collectAsStateWithLifecycle()
            val playerCardUiState by playerCardViewModel.uiState.collectAsStateWithLifecycle()

            // Estado para ModalBottomSheet do jogador (fix #2260: migrado de Fragment)
            var selectedPlayerId by remember { mutableStateOf<String?>(null) }
            val playerSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            val sheetScope = rememberCoroutineScope()

            LeagueScreen(
                uiState = uiState,
                unreadCount = unreadCount,
                availableSeasons = availableSeasons,
                selectedSeason = selectedSeason,
                selectedGender = selectedGender,
                onBack = { navController.popBackStack() },
                onDivisionSelected = { viewModel.filterByDivision(it) },
                onSeasonSelected = { viewModel.selectSeason(it) },
                onGenderSelected = { viewModel.selectGender(it) },
                onRefresh = { selectedSeason?.let { viewModel.selectSeason(it) } },
                onNavigateNotifications = { navController.navigate(Screen.Notifications.route) },
                onNavigateGroups = { navController.navigate(Screen.Groups.route) },
                onNavigateMap = { navController.navigate(Screen.LocationsMap.route) },
                onPlayerClick = { userId ->
                    selectedPlayerId = userId
                    playerCardViewModel.loadPlayerData(userId)
                    sheetScope.launch { playerSheetState.show() }
                }
            )

            // ModalBottomSheet Compose — substitui PlayerCardBottomSheet Fragment (#2260)
            if (selectedPlayerId != null) {
                ModalBottomSheet(
                    onDismissRequest = { selectedPlayerId = null },
                    sheetState = playerSheetState,
                ) {
                    when (val state = playerCardUiState) {
                        is com.futebadosparcas.ui.player.PlayerCardUiState.Success -> {
                            com.futebadosparcas.ui.players.PlayerCardContent(
                                user = state.user,
                                stats = state.statistics,
                                onClose = {
                                    sheetScope.launch { playerSheetState.hide() }
                                        .invokeOnCompletion { selectedPlayerId = null }
                                },
                                onShare = {}
                            )
                        }
                        is com.futebadosparcas.ui.player.PlayerCardUiState.Loading -> {
                            androidx.compose.foundation.layout.Box(
                                modifier = androidx.compose.ui.Modifier
                                    .fillMaxWidth()
                                    .height(200.dp),
                                contentAlignment = androidx.compose.ui.Alignment.Center
                            ) {
                                androidx.compose.material3.CircularProgressIndicator()
                            }
                        }
                        is com.futebadosparcas.ui.player.PlayerCardUiState.Error -> {
                            selectedPlayerId = null
                        }
                    }
                }
            }
        }

        composable(Screen.Statistics.route) {
            val viewModel: com.futebadosparcas.ui.statistics.StatisticsViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.profile.ProfileViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.statistics.RankingViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.statistics.RankingViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.badges.BadgesViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.games.GameDetailViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.games.CreateGameViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.livegame.LiveGameViewModel = koinViewModel()
            val statsViewModel: com.futebadosparcas.ui.livegame.LiveStatsViewModel = koinViewModel()
            val eventsViewModel: com.futebadosparcas.ui.livegame.LiveEventsViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.game_experience.MVPVoteViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.groups.GroupsViewModel = koinViewModel()
            // GroupsScreen tem sua própria TopBar no Scaffold
            GroupsScreen(
                viewModel = viewModel,
                onGroupClick = { groupId ->
                    navController.navigate(Screen.GroupDetail.createRoute(groupId))
                },
                onCreateGroupClick = {
                    navController.navigate(Screen.CreateGroup.route)
                },
                onDiscoverGroupsClick = {
                    navController.navigate(Screen.DiscoverGroups.route)
                },
                onInvitePlayersClick = { groupId ->
                    navController.navigate(Screen.InvitePlayers.createRoute(groupId))
                },
                onCashboxClick = { groupId ->
                    navController.navigate(Screen.Cashbox.createRoute(groupId))
                },
                onCreateGameInGroupClick = {
                    navController.navigate(Screen.CreateGame.route)
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.DiscoverGroups.route) {
            val viewModel: com.futebadosparcas.ui.groups.DiscoverGroupsViewModel = koinViewModel()
            DiscoverGroupsScreen(
                viewModel = viewModel,
                onGroupClick = { groupId ->
                    navController.navigate(Screen.GroupDetail.createRoute(groupId))
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.GroupDetail.route,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
            val viewModel: com.futebadosparcas.ui.groups.GroupDetailViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.groups.GroupsViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.groups.InviteViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.groups.CashboxViewModel = koinViewModel()
            // CashboxScreen tem TopBar customizada com filtros/relatórios - não usa SecondaryScreenWrapper
            CashboxScreen(
                viewModel = viewModel,
                groupId = groupId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ==================== LOCATIONS ====================

        composable(Screen.LocationsMap.route) {
            val viewModel: com.futebadosparcas.ui.locations.LocationsMapViewModel = koinViewModel()
            LocationsMapScreen(
                viewModel = viewModel,
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.LocationDetail.route,
            arguments = listOf(navArgument("locationId") {
                type = NavType.StringType
                nullable = true
                defaultValue = null
            })
        ) { backStackEntry ->
            val locationId = backStackEntry.arguments?.getString("locationId")
            val viewModel: com.futebadosparcas.ui.locations.LocationDetailViewModel = koinViewModel()
            // Carrega o local existente se locationId foi fornecido
            LaunchedEffect(locationId) {
                if (locationId != null) {
                    viewModel.loadLocation(locationId)
                }
            }
            // LocationDetailScreen tem sua própria TopBar no Scaffold
            LocationDetailScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.ManageLocations.route) {
            val viewModel: com.futebadosparcas.ui.locations.ManageLocationsViewModel = koinViewModel()
            // ManageLocationsScreen tem sua própria TopBar no Scaffold
            ManageLocationsScreen(
                viewModel = viewModel,
                onLocationClick = { locationId ->
                    navController.navigate(Screen.LocationDetail.createRoute(locationId))
                },
                onCreateLocationClick = {
                    navController.navigate(Screen.LocationDetail.createRoute())
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.FieldOwnerDashboard.route) {
            val viewModel: com.futebadosparcas.ui.locations.FieldOwnerDashboardViewModel = koinViewModel()
            // FieldOwnerDashboardScreen tem sua própria TopBar no Scaffold
            FieldOwnerDashboardScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToLocation = { locationId ->
                    navController.navigate(Screen.LocationDetail.createRoute(locationId))
                },
                onNavigateToAddLocation = {
                    navController.navigate(Screen.LocationDetail.createRoute())
                }
            )
        }

        // ==================== PROFILE & SETTINGS ====================

        composable(Screen.EditProfile.route) {
            // FIX: Verificar se Profile está no back stack antes de tentar compartilhar ViewModel
            val parentEntry = remember(navController.currentBackStackEntry) {
                runCatching { navController.getBackStackEntry(Screen.Profile.route) }.getOrNull()
            }
            val viewModel: com.futebadosparcas.ui.profile.ProfileViewModel = if (parentEntry != null) {
                koinViewModel(viewModelStoreOwner = remember { parentEntry })
            } else {
                koinViewModel()
            }
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
            val preferencesViewModel: com.futebadosparcas.ui.preferences.PreferencesViewModel = koinViewModel()
            val themeViewModel: com.futebadosparcas.ui.theme.ThemeViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.developer.DeveloperViewModel = koinViewModel()
            // DeveloperScreen NÃO tem TopBar própria - precisa do wrapper
            SecondaryScreenWrapper(
                titleResId = Screen.Developer.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                DeveloperScreen(viewModel = viewModel)
            }
        }

        composable(Screen.ThemeSettings.route) {
            val viewModel: com.futebadosparcas.ui.theme.ThemeViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.settings.SettingsViewModel = koinViewModel()
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
            // FIX: Verificar se Profile está no back stack antes de tentar compartilhar ViewModel
            // O remember com NavBackStackEntry garante reavaliação durante recomposição
            val parentEntry = remember(navController.currentBackStackEntry) {
                runCatching { navController.getBackStackEntry(Screen.Profile.route) }.getOrNull()
            }
            val viewModel: com.futebadosparcas.ui.profile.ProfileViewModel = if (parentEntry != null) {
                koinViewModel(viewModelStoreOwner = remember { parentEntry })
            } else {
                // Profile não está no back stack - criar instância própria
                koinViewModel()
            }
            // LevelJourneyScreen tem sua própria TopBar no Scaffold
            LevelJourneyScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.About.route) {
            val context = LocalContext.current
            val androidAuthRepo: com.futebadosparcas.data.repository.AuthRepository = koinInject()
            var deleteAccountTrigger by remember { mutableStateOf(false) }

            LaunchedEffect(deleteAccountTrigger) {
                if (deleteAccountTrigger) {
                    val result = androidAuthRepo.deleteAccount()
                    if (result.isSuccess) {
                        val intent = android.content.Intent(context, com.futebadosparcas.ui.auth.LoginActivityCompose::class.java)
                        intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                        context.startActivity(intent)
                    }
                    deleteAccountTrigger = false
                }
            }

            SecondaryScreenWrapper(
                titleResId = Screen.About.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                AboutScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onDeleteAccount = { deleteAccountTrigger = true },
                    onNavigateToWhatsNew = { navController.navigate(Screen.WhatsNew.route) },
                    onLogout = {
                        androidAuthRepo.logout()
                        val intent = android.content.Intent(context, com.futebadosparcas.ui.auth.LoginActivityCompose::class.java)
                        intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                        context.startActivity(intent)
                    }
                )
            }
        }

        // Tela "Novidades" (spec feat-2026-05-22 — Fase E)
        composable(Screen.WhatsNew.route) {
            val viewModel: com.futebadosparcas.ui.whatsnew.WhatsNewViewModel = koinViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.WhatsNew.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                WhatsNewScreen(viewModel = viewModel)
            }
        }

        composable(Screen.Schedules.route) {
            val viewModel: com.futebadosparcas.ui.schedules.SchedulesViewModel = koinViewModel()
            SecondaryScreenWrapper(
                titleResId = Screen.Schedules.titleResId,
                onNavigateBack = { navController.popBackStack() }
            ) {
                SchedulesScreen(viewModel = viewModel)
            }
        }

        // ==================== NOTIFICATIONS ====================

        composable(Screen.Notifications.route) {
            val viewModel: com.futebadosparcas.ui.notifications.NotificationsViewModel = koinViewModel()
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
            val viewModel: com.futebadosparcas.ui.admin.UserManagementViewModel = koinViewModel()
            // UserManagementScreen tem TopBar customizada - não usa SecondaryScreenWrapper
            UserManagementScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // ==================== GROWTH FEATURES ====================

        composable(Screen.WeeklyRanking.route) {
            WeeklyRankingScreen(
                onPlayerClick = { /* profile detail not yet available on Android */ },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.PublicGames.route) {
            PublicGamesScreen(
                onBackClick = { navController.popBackStack() }
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
                // Usa surface/onSurface (não primary/onPrimary) para garantir
                // contraste WCAG AA do ícone de voltar com qualquer cor seed
                // customizada pelo usuário (#2187).
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
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
