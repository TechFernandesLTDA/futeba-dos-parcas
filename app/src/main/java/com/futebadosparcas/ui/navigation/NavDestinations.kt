package com.futebadosparcas.ui.navigation

import android.os.Bundle
import androidx.navigation.NavType
import kotlinx.parcelize.Parcelize
import android.os.Parcelable

/**
 * Type-Safe Navigation Destinations para Compose
 *
 * Define todas as rotas de navegação do app de forma tipada,
 * eliminando erros de navegação em tempo de compilação.
 *
 * Uso:
 * ```
 * navController.navigate(NavDestinations.GameDetail(gameId = "123"))
 * navController.navigate(NavDestinations.Home)
 * ```
 */
sealed class NavDestinations(val route: String) {

    // ==========================================
    // MAIN NAVIGATION (Bottom Nav / NavigationRail)
    // ==========================================

    data object Home : NavDestinations("home")

    data object Games : NavDestinations("games")

    data object Players : NavDestinations("players")

    data object League : NavDestinations("league")

    data object Statistics : NavDestinations("statistics")

    data object Profile : NavDestinations("profile")

    // ==========================================
    // GAME SCREENS
    // ==========================================

    data class GameDetail(val gameId: String) : NavDestinations("game_detail/{gameId}") {
        companion object {
            const val ROUTE = "game_detail/{gameId}"
            fun createRoute(gameId: String) = "game_detail/$gameId"
        }
    }

    data class CreateGame(val gameId: String? = null) : NavDestinations("create_game?gameId={gameId}") {
        companion object {
            const val ROUTE = "create_game?gameId={gameId}"
            fun createRoute(gameId: String? = null) = if (gameId != null) {
                "create_game?gameId=$gameId"
            } else {
                "create_game"
            }
        }
    }

    data class LiveGame(val gameId: String) : NavDestinations("live_game/{gameId}") {
        companion object {
            const val ROUTE = "live_game/{gameId}"
            fun createRoute(gameId: String) = "live_game/$gameId"
        }
    }

    data class MvpVote(val gameId: String) : NavDestinations("mvp_vote/{gameId}") {
        companion object {
            const val ROUTE = "mvp_vote/{gameId}"
            fun createRoute(gameId: String) = "mvp_vote/$gameId"
        }
    }

    data object TacticalBoard : NavDestinations("tactical_board")

    // ==========================================
    // GROUPS
    // ==========================================

    data object Groups : NavDestinations("groups")

    data class GroupDetail(val groupId: String) : NavDestinations("group_detail/{groupId}") {
        companion object {
            const val ROUTE = "group_detail/{groupId}"
            fun createRoute(groupId: String) = "group_detail/$groupId"
        }
    }

    data object CreateGroup : NavDestinations("create_group")

    data class InvitePlayers(val groupId: String) : NavDestinations("invite_players/{groupId}") {
        companion object {
            const val ROUTE = "invite_players/{groupId}"
            fun createRoute(groupId: String) = "invite_players/$groupId"
        }
    }

    data class Cashbox(val groupId: String) : NavDestinations("cashbox/{groupId}") {
        companion object {
            const val ROUTE = "cashbox/{groupId}"
            fun createRoute(groupId: String) = "cashbox/$groupId"
        }
    }

    // ==========================================
    // PROFILE & SETTINGS
    // ==========================================

    data object EditProfile : NavDestinations("edit_profile")

    data object Preferences : NavDestinations("preferences")

    data object ThemeSettings : NavDestinations("theme_settings")

    data object Developer : NavDestinations("developer")

    data object LevelJourney : NavDestinations("level_journey")

    data object GamificationSettings : NavDestinations("gamification_settings")

    data object About : NavDestinations("about")

    // ==========================================
    // STATISTICS & RANKINGS
    // ==========================================

    data object Ranking : NavDestinations("ranking")

    data object Evolution : NavDestinations("evolution")

    data object Badges : NavDestinations("badges")

    // ==========================================
    // LOCATIONS
    // ==========================================

    data object LocationsMap : NavDestinations("locations_map")

    data object FieldOwnerDashboard : NavDestinations("field_owner_dashboard")

    data class LocationDetail(val locationId: String? = null) : NavDestinations("location_detail?locationId={locationId}") {
        companion object {
            const val ROUTE = "location_detail?locationId={locationId}"
            fun createRoute(locationId: String? = null) = if (locationId != null) {
                "location_detail?locationId=$locationId"
            } else {
                "location_detail"
            }
        }
    }

    data object ManageLocations : NavDestinations("manage_locations")

    // ==========================================
    // NOTIFICATIONS
    // ==========================================

    data object Notifications : NavDestinations("notifications")

    // ==========================================
    // ADMIN
    // ==========================================

    data object UserManagement : NavDestinations("user_management")

    // ==========================================
    // SCHEDULES
    // ==========================================

    data object Schedules : NavDestinations("schedules")
}

/**
 * Extension para navegação tipada com NavController
 */
fun androidx.navigation.NavController.navigateSafe(
    destination: NavDestinations,
    builder: androidx.navigation.NavOptionsBuilder.() -> Unit = {}
) {
    val route = when (destination) {
        is NavDestinations.GameDetail -> NavDestinations.GameDetail.createRoute(destination.gameId)
        is NavDestinations.CreateGame -> NavDestinations.CreateGame.createRoute(destination.gameId)
        is NavDestinations.LiveGame -> NavDestinations.LiveGame.createRoute(destination.gameId)
        is NavDestinations.MvpVote -> NavDestinations.MvpVote.createRoute(destination.gameId)
        is NavDestinations.GroupDetail -> NavDestinations.GroupDetail.createRoute(destination.groupId)
        is NavDestinations.InvitePlayers -> NavDestinations.InvitePlayers.createRoute(destination.groupId)
        is NavDestinations.Cashbox -> NavDestinations.Cashbox.createRoute(destination.groupId)
        is NavDestinations.LocationDetail -> NavDestinations.LocationDetail.createRoute(destination.locationId)
        else -> destination.route
    }

    navigate(route) {
        builder()
    }
}

/**
 * Pop back stack até um destino específico
 */
fun androidx.navigation.NavController.popBackStackSafe(
    destination: NavDestinations,
    inclusive: Boolean = false
): Boolean {
    return popBackStack(destination.route, inclusive)
}
