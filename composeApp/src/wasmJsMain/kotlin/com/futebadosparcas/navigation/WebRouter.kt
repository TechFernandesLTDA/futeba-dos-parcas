package com.futebadosparcas.navigation

import androidx.compose.runtime.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed class WebRoute {
    object Home : WebRoute()
    object Games : WebRoute()
    data class GameDetail(val gameId: String) : WebRoute()
    object Schedules : WebRoute()
    object Groups : WebRoute()
    data class GroupDetail(val groupId: String) : WebRoute()
    object Players : WebRoute()
    data class PlayerDetail(val playerId: String) : WebRoute()
    object Locations : WebRoute()
    data class LocationDetail(val locationId: String) : WebRoute()
    object Rankings : WebRoute()
    data class LeagueDetail(val seasonId: String? = null) : WebRoute()
    data class StatisticsDetail(val userId: String, val groupId: String? = null) : WebRoute()
    object Notifications : WebRoute()
    object Profile : WebRoute()
    object DeveloperTools : WebRoute()
    data class Invite(val code: String) : WebRoute()
    data class TacticalBoard(val gameId: String? = null) : WebRoute()
    data class TeamFormation(val gameId: String) : WebRoute()
    object Admin : WebRoute()
    object AdminUsers : WebRoute()
    object AdminReports : WebRoute()

    val path: String
        get() = when (this) {
            is Home -> "/"
            is Games -> "/games"
            is GameDetail -> "/games/$gameId"
            is Schedules -> "/schedules"
            is Groups -> "/groups"
            is GroupDetail -> "/groups/$groupId"
            is Players -> "/players"
            is PlayerDetail -> "/players/$playerId"
            is Locations -> "/locations"
            is LocationDetail -> "/locations/$locationId"
            is Rankings -> "/rankings"
            is LeagueDetail -> "/rankings/league${seasonId?.let { "/$it" } ?: ""}"
            is StatisticsDetail -> "/stats/$userId${groupId?.let { "/group/$it" } ?: ""}"
            is Notifications -> "/notifications"
            is Profile -> "/profile"
            is DeveloperTools -> "/dev-tools"
            is Invite -> "/invite/$code"
            is TacticalBoard -> "/tactical${gameId?.let { "/game/$it" } ?: ""}"
            is TeamFormation -> "/team-formation/$gameId"
            is Admin -> "/admin"
            is AdminUsers -> "/admin/users"
            is AdminReports -> "/admin/reports"
        }

    val tabIndex: Int
        get() = when (this) {
            is Home -> 0
            is Games, is GameDetail, is Schedules -> 1
            is Groups, is GroupDetail -> 2
            is Players, is PlayerDetail -> 3
            is Locations, is LocationDetail -> 4
            is Rankings, is LeagueDetail, is StatisticsDetail -> 5
            is Notifications -> 6
            is Profile, is DeveloperTools -> 7
            is Admin, is AdminUsers, is AdminReports -> 8
            is Invite -> 0
            is TacticalBoard -> 1
            is TeamFormation -> 1
        }

    val isDetailScreen: Boolean
        get() = this is GameDetail || this is GroupDetail || this is LocationDetail || 
                this is LeagueDetail || this is StatisticsDetail || this is Invite || 
                this is TacticalBoard || this is DeveloperTools || this is PlayerDetail ||
                this is AdminUsers || this is AdminReports || this is TeamFormation

    val title: String
        get() = when (this) {
            is Home -> "Início"
            is Games -> "Jogos"
            is GameDetail -> "Detalhes do Jogo"
            is Schedules -> "Agendamentos"
            is Groups -> "Grupos"
            is GroupDetail -> "Detalhes do Grupo"
            is Players -> "Jogadores"
            is PlayerDetail -> "Jogador"
            is Locations -> "Campos"
            is LocationDetail -> "Detalhes do Local"
            is Rankings -> "Rankings"
            is LeagueDetail -> "Liga"
            is StatisticsDetail -> "Estatísticas"
            is Notifications -> "Notificações"
            is Profile -> "Perfil"
            is DeveloperTools -> "Developer Tools"
            is Invite -> "Convite"
            is TacticalBoard -> "Quadro Tático"
            is TeamFormation -> "Formação de Times"
            is Admin -> "Admin"
            is AdminUsers -> "Gerenciar Usuários"
            is AdminReports -> "Denúncias"
        }
}

object WebRouter {
    private val _currentRoute = MutableStateFlow<WebRoute>(parseRoute(jsGetPathname()))
    val currentRoute: StateFlow<WebRoute> = _currentRoute.asStateFlow()

    private val routeHistory = mutableListOf<WebRoute>()

    init {
        jsInitPopStateListener { newPath ->
            val route = parseRoute(newPath)
            _currentRoute.value = route
            if (routeHistory.isEmpty() || routeHistory.last() != route) {
                routeHistory.add(route)
            }
        }
        routeHistory.add(_currentRoute.value)
    }

    fun navigate(route: WebRoute, replace: Boolean = false) {
        if (route == _currentRoute.value && !replace) return

        if (replace) {
            jsReplaceState(0, "", route.path)
            if (routeHistory.isNotEmpty()) {
                routeHistory[routeHistory.lastIndex] = route
            } else {
                routeHistory.add(route)
            }
        } else {
            jsPushState(0, "", route.path)
            routeHistory.add(route)
        }
        _currentRoute.value = route
    }

    fun navigateTo(path: String) {
        val route = parseRoute(path)
        navigate(route)
    }

    fun goBack(): Boolean {
        if (routeHistory.size > 1) {
            routeHistory.removeAt(routeHistory.lastIndex)
            val previousRoute = routeHistory.last()
            jsReplaceState(0, "", previousRoute.path)
            _currentRoute.value = previousRoute
            return true
        }
        jsHistoryBack()
        return false
    }

    fun canGoBack(): Boolean = routeHistory.size > 1 || jsCanGoBack()

    fun getCurrentRoute(): WebRoute = _currentRoute.value

    fun navigateToGame(gameId: String) {
        navigate(WebRoute.GameDetail(gameId))
    }

    fun navigateToGroup(groupId: String) {
        navigate(WebRoute.GroupDetail(groupId))
    }

    fun navigateToLocation(locationId: String) {
        navigate(WebRoute.LocationDetail(locationId))
    }

    fun navigateToLeague(seasonId: String? = null) {
        navigate(WebRoute.LeagueDetail(seasonId))
    }

    fun navigateToStatistics(userId: String, groupId: String? = null) {
        navigate(WebRoute.StatisticsDetail(userId, groupId))
    }

    fun navigateToInvite(code: String) {
        navigate(WebRoute.Invite(code))
    }

    fun navigateToTacticalBoard(gameId: String? = null) {
        navigate(WebRoute.TacticalBoard(gameId))
    }

    fun navigateToTeamFormation(gameId: String) {
        navigate(WebRoute.TeamFormation(gameId))
    }

    fun navigateToPlayer(playerId: String) {
        navigate(WebRoute.PlayerDetail(playerId))
    }

    fun navigateToDeveloperTools() {
        navigate(WebRoute.DeveloperTools)
    }

    fun navigateToAdmin() {
        navigate(WebRoute.Admin)
    }

    fun navigateToAdminUsers() {
        navigate(WebRoute.AdminUsers)
    }

    fun navigateToAdminReports() {
        navigate(WebRoute.AdminReports)
    }

    fun navigateToTab(index: Int) {
        val route = when (index) {
            0 -> WebRoute.Home
            1 -> WebRoute.Games
            2 -> WebRoute.Groups
            3 -> WebRoute.Locations
            4 -> WebRoute.Rankings
            5 -> WebRoute.Notifications
            6 -> WebRoute.Profile
            7 -> WebRoute.Admin
            else -> WebRoute.Home
        }
        navigate(route, replace = _currentRoute.value.isDetailScreen)
    }

    private fun parseRoute(path: String): WebRoute {
        val cleanPath = path.removePrefix("/").removeSuffix("/")
        val segments = cleanPath.split("/").filter { it.isNotEmpty() }

        return when {
            segments.isEmpty() -> WebRoute.Home
            segments[0] == "schedules" -> WebRoute.Schedules
            segments[0] == "games" && segments.size == 1 -> WebRoute.Games
            segments[0] == "games" && segments.size == 2 -> WebRoute.GameDetail(segments[1])
            segments[0] == "groups" && segments.size == 1 -> WebRoute.Groups
            segments[0] == "groups" && segments.size == 2 -> WebRoute.GroupDetail(segments[1])
            segments[0] == "players" && segments.size == 1 -> WebRoute.Players
            segments[0] == "players" && segments.size == 2 -> WebRoute.PlayerDetail(segments[1])
            segments[0] == "locations" && segments.size == 1 -> WebRoute.Locations
            segments[0] == "locations" && segments.size == 2 -> WebRoute.LocationDetail(segments[1])
            segments[0] == "rankings" && segments.size == 1 -> WebRoute.Rankings
            segments[0] == "rankings" && segments.size >= 2 && segments[1] == "league" -> WebRoute.LeagueDetail(segments.getOrNull(2))
            segments[0] == "stats" && segments.size >= 2 -> WebRoute.StatisticsDetail(segments[1], segments.getOrNull(3))
            segments[0] == "notifications" -> WebRoute.Notifications
            segments[0] == "profile" -> WebRoute.Profile
            segments[0] == "dev-tools" -> WebRoute.DeveloperTools
            segments[0] == "invite" && segments.size == 2 -> WebRoute.Invite(segments[1])
            segments[0] == "tactical" -> {
                if (segments.size >= 3 && segments[1] == "game") {
                    WebRoute.TacticalBoard(segments[2])
                } else {
                    WebRoute.TacticalBoard()
                }
            }
            segments[0] == "team-formation" && segments.size == 2 -> WebRoute.TeamFormation(segments[1])
            segments[0] == "admin" && segments.size == 1 -> WebRoute.Admin
            segments[0] == "admin" && segments.size == 2 && segments[1] == "users" -> WebRoute.AdminUsers
            segments[0] == "admin" && segments.size == 2 && segments[1] == "reports" -> WebRoute.AdminReports
            else -> WebRoute.Home
        }
    }
}

@Composable
fun rememberWebRouterState(): State<WebRoute> {
    return WebRouter.currentRoute.collectAsState()
}
