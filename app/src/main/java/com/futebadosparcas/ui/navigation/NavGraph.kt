package com.futebadosparcas.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument

/**
 * NavGraph principal da aplicação usando Type-Safe Navigation
 *
 * @deprecated Este arquivo está OBSOLETO. Use AppNavGraph.kt em vez disso.
 * A migração para Compose está completa e AppNavGraph é o grafo de navegação ativo.
 *
 * Este arquivo será removido em uma versão futura.
 * TODO: Remover este arquivo após validação completa
 */
@Deprecated(
    message = "Use AppNavGraph.kt em vez disso. Este NavGraph está obsoleto.",
    replaceWith = ReplaceWith("AppNavGraph", "com.futebadosparcas.ui.navigation.AppNavGraph"),
    level = DeprecationLevel.WARNING
)
@Composable
fun FutebaNavGraph(
    navController: NavHostController,
    startDestination: String = NavDestinations.Home.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // ==========================================
        // MAIN SCREENS
        // ==========================================

        composable(NavDestinations.Home.route) {
            // TODO: Migrar HomeFragment para HomeScreen Compose
            // HomeScreen(navController = navController)
        }

        composable(NavDestinations.Games.route) {
            // TODO: Migrar GamesFragment para GamesScreen Compose
            // GamesScreen(navController = navController)
        }

        composable(NavDestinations.Players.route) {
            // TODO: Migrar PlayersFragment para PlayersScreen Compose
            // PlayersScreen(navController = navController)
        }

        composable(NavDestinations.League.route) {
            // TODO: Migrar LeagueFragment para LeagueScreen Compose
            // LeagueScreen(navController = navController)
        }

        composable(NavDestinations.Statistics.route) {
            // TODO: Migrar StatisticsFragment para StatisticsScreen Compose
            // StatisticsScreen(navController = navController)
        }

        composable(NavDestinations.Profile.route) {
            // TODO: Migrar ProfileFragment para ProfileScreen Compose
            // ProfileScreen(navController = navController)
        }

        // ==========================================
        // GAME SCREENS
        // ==========================================

        composable(
            route = NavDestinations.GameDetail.ROUTE,
            arguments = listOf(
                navArgument("gameId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: return@composable
            // TODO: Migrar GameDetailFragment para GameDetailScreen Compose
            // GameDetailScreen(
            //     gameId = gameId,
            //     navController = navController
            // )
        }

        composable(
            route = NavDestinations.CreateGame.ROUTE,
            arguments = listOf(
                navArgument("gameId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId")
            // TODO: Migrar CreateGameFragment para CreateGameScreen Compose
            // CreateGameScreen(
            //     gameId = gameId,
            //     navController = navController
            // )
        }

        composable(
            route = NavDestinations.LiveGame.ROUTE,
            arguments = listOf(
                navArgument("gameId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: return@composable
            // TODO: Migrar LiveGameFragment para LiveGameScreen Compose
            // LiveGameScreen(
            //     gameId = gameId,
            //     navController = navController
            // )
        }

        composable(
            route = NavDestinations.MvpVote.ROUTE,
            arguments = listOf(
                navArgument("gameId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: return@composable
            // TODO: Migrar MVPVoteFragment para MVPVoteScreen Compose
            // MVPVoteScreen(
            //     gameId = gameId,
            //     navController = navController
            // )
        }

        composable(NavDestinations.TacticalBoard.route) {
            // TODO: Migrar TacticalBoardFragment para TacticalBoardScreen Compose
            // TacticalBoardScreen(navController = navController)
        }

        // ==========================================
        // GROUPS
        // ==========================================

        composable(NavDestinations.Groups.route) {
            // TODO: Migrar GroupsFragment para GroupsScreen Compose
            // GroupsScreen(navController = navController)
        }

        composable(
            route = NavDestinations.GroupDetail.ROUTE,
            arguments = listOf(
                navArgument("groupId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: return@composable
            // TODO: Migrar GroupDetailFragment para GroupDetailScreen Compose
            // GroupDetailScreen(
            //     groupId = groupId,
            //     navController = navController
            // )
        }

        composable(NavDestinations.CreateGroup.route) {
            // TODO: Migrar CreateGroupFragment para CreateGroupScreen Compose
            // CreateGroupScreen(navController = navController)
        }

        composable(
            route = NavDestinations.InvitePlayers.ROUTE,
            arguments = listOf(
                navArgument("groupId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: return@composable
            // TODO: Migrar InvitePlayersFragment para InvitePlayersScreen Compose
            // InvitePlayersScreen(
            //     groupId = groupId,
            //     navController = navController
            // )
        }

        composable(
            route = NavDestinations.Cashbox.ROUTE,
            arguments = listOf(
                navArgument("groupId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId") ?: return@composable
            // TODO: Migrar CashboxFragment para CashboxScreen Compose
            // CashboxScreen(
            //     groupId = groupId,
            //     navController = navController
            // )
        }

        // ==========================================
        // PROFILE & SETTINGS
        // ==========================================

        composable(NavDestinations.EditProfile.route) {
            // TODO: Migrar EditProfileFragment para EditProfileScreen Compose
            // EditProfileScreen(navController = navController)
        }

        composable(NavDestinations.Preferences.route) {
            // TODO: Migrar PreferencesFragment para PreferencesScreen Compose
            // PreferencesScreen(navController = navController)
        }

        composable(NavDestinations.ThemeSettings.route) {
            // ThemeSettings já é Compose - mantém implementação existente
            // ThemeSettingsScreen(navController = navController)
        }

        composable(NavDestinations.Developer.route) {
            // TODO: Migrar DeveloperFragment para DeveloperScreen Compose
            // DeveloperScreen(navController = navController)
        }

        composable(NavDestinations.LevelJourney.route) {
            // TODO: Migrar LevelJourneyFragment para LevelJourneyScreen Compose
            // LevelJourneyScreen(navController = navController)
        }

        composable(NavDestinations.GamificationSettings.route) {
            // TODO: Migrar GamificationSettingsFragment para GamificationSettingsScreen Compose
            // GamificationSettingsScreen(navController = navController)
        }

        composable(NavDestinations.About.route) {
            // TODO: Migrar AboutFragment para AboutScreen Compose
            // AboutScreen(navController = navController)
        }

        // ==========================================
        // STATISTICS & RANKINGS
        // ==========================================

        composable(NavDestinations.Ranking.route) {
            // TODO: Migrar RankingFragment para RankingScreen Compose
            // RankingScreen(navController = navController)
        }

        composable(NavDestinations.Evolution.route) {
            // TODO: Migrar EvolutionFragment para EvolutionScreen Compose
            // EvolutionScreen(navController = navController)
        }

        composable(NavDestinations.Badges.route) {
            // TODO: Migrar BadgesFragment para BadgesScreen Compose
            // BadgesScreen(navController = navController)
        }

        // ==========================================
        // LOCATIONS
        // ==========================================

        composable(NavDestinations.LocationsMap.route) {
            // TODO: Migrar LocationsMapFragment para LocationsMapScreen Compose
            // LocationsMapScreen(navController = navController)
        }

        composable(NavDestinations.FieldOwnerDashboard.route) {
            // TODO: Migrar FieldOwnerDashboardFragment para FieldOwnerDashboardScreen Compose
            // FieldOwnerDashboardScreen(navController = navController)
        }

        composable(
            route = NavDestinations.LocationDetail.ROUTE,
            arguments = listOf(
                navArgument("locationId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val locationId = backStackEntry.arguments?.getString("locationId")
            // TODO: Migrar LocationDetailFragment para LocationDetailScreen Compose
            // LocationDetailScreen(
            //     locationId = locationId,
            //     navController = navController
            // )
        }

        composable(NavDestinations.ManageLocations.route) {
            // TODO: Migrar ManageLocationsFragment para ManageLocationsScreen Compose
            // ManageLocationsScreen(navController = navController)
        }

        // ==========================================
        // NOTIFICATIONS
        // ==========================================

        composable(NavDestinations.Notifications.route) {
            // TODO: Migrar NotificationsFragment para NotificationsScreen Compose
            // NotificationsScreen(navController = navController)
        }

        // ==========================================
        // ADMIN
        // ==========================================

        composable(NavDestinations.UserManagement.route) {
            // TODO: Migrar UserManagementFragment para UserManagementScreen Compose
            // UserManagementScreen(navController = navController)
        }

        // ==========================================
        // SCHEDULES
        // ==========================================

        composable(NavDestinations.Schedules.route) {
            // TODO: Migrar SchedulesFragment para SchedulesScreen Compose
            // SchedulesScreen(navController = navController)
        }
    }
}

/**
 * Rotas globais que podem ser acessadas de qualquer lugar
 */
object GlobalRoutes {
    const val NOTIFICATIONS = "global_notifications"
    const val GROUPS = "global_groups"
    const val MAP = "global_map"
}
