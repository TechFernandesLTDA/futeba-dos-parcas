package com.futebadosparcas.ui.navigation.routes

/**
 * Rotas de navegação centralizadas do app.
 *
 * Todas as rotas são definidas aqui como sealed classes para type-safety.
 * Use o companion object em cada rota para criar rotas com parâmetros.
 *
 * Uso:
 * ```
 * navController.navigate(AppRoutes.Home)
 * navController.navigate(AppRoutes.GameDetail.createRoute("gameId123"))
 * ```
 */
sealed class AppRoutes(
    val route: String,
    val isRootDestination: Boolean = false, // Aparece no Bottom Nav
    val showsTopBar: Boolean = true,        // Mostra a TopBar com back button
    val titleResId: Int? = null             // String resource para título da TopBar
) {

    // ==========================================
    // ROOT DESTINATIONS (Bottom Navigation)
    // ==========================================

    data object Home : AppRoutes(
        route = "home",
        isRootDestination = true,
        showsTopBar = false
    )

    data object Games : AppRoutes(
        route = "games",
        isRootDestination = true,
        showsTopBar = false
    )

    data object Players : AppRoutes(
        route = "players",
        isRootDestination = true,
        showsTopBar = false
    )

    data object Statistics : AppRoutes(
        route = "statistics",
        isRootDestination = true,
        showsTopBar = false
    )

    data object Profile : AppRoutes(
        route = "profile",
        isRootDestination = true,
        showsTopBar = false
    )

    // ==========================================
    // GAME SCREENS
    // ==========================================

    data object GameDetail : AppRoutes(
        route = "game_detail/{gameId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(gameId: String) = "game_detail/$gameId"
    }

    data object CreateGame : AppRoutes(
        route = "create_game",
        isRootDestination = false,
        showsTopBar = true
    )

    data object LiveGame : AppRoutes(
        route = "live_game/{gameId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(gameId: String) = "live_game/$gameId"
    }

    data object MVPVote : AppRoutes(
        route = "mvp_vote/{gameId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(gameId: String) = "mvp_vote/$gameId"
    }

    data object TacticalBoard : AppRoutes(
        route = "tactical_board",
        isRootDestination = false,
        showsTopBar = true
    )

    // ==========================================
    // GROUPS
    // ==========================================

    data object Groups : AppRoutes(
        route = "groups",
        isRootDestination = false,
        showsTopBar = true
    )

    data object GroupDetail : AppRoutes(
        route = "group_detail/{groupId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(groupId: String) = "group_detail/$groupId"
    }

    data object CreateGroup : AppRoutes(
        route = "create_group",
        isRootDestination = false,
        showsTopBar = true
    )

    data object InvitePlayers : AppRoutes(
        route = "invite_players/{groupId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(groupId: String) = "invite_players/$groupId"
    }

    data object Cashbox : AppRoutes(
        route = "cashbox/{groupId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(groupId: String) = "cashbox/$groupId"
    }

    // ==========================================
    // STATISTICS & RANKING
    // ==========================================

    data object Ranking : AppRoutes(
        route = "ranking",
        isRootDestination = false,
        showsTopBar = true
    )

    data object Evolution : AppRoutes(
        route = "evolution",
        isRootDestination = false,
        showsTopBar = true
    )

    data object Badges : AppRoutes(
        route = "badges",
        isRootDestination = false,
        showsTopBar = true
    )

    // ==========================================
    // LOCATIONS
    // ==========================================

    data object LocationsMap : AppRoutes(
        route = "locations_map",
        isRootDestination = false,
        showsTopBar = true
    )

    data object LocationDetail : AppRoutes(
        route = "location_detail/{locationId}",
        isRootDestination = false,
        showsTopBar = true
    ) {
        fun createRoute(locationId: String) = "location_detail/$locationId"
    }

    data object ManageLocations : AppRoutes(
        route = "manage_locations",
        isRootDestination = false,
        showsTopBar = true
    )

    data object FieldOwnerDashboard : AppRoutes(
        route = "field_owner_dashboard",
        isRootDestination = false,
        showsTopBar = true
    )

    // ==========================================
    // PROFILE & SETTINGS
    // ==========================================

    data object EditProfile : AppRoutes(
        route = "edit_profile",
        isRootDestination = false,
        showsTopBar = true
    )

    data object Preferences : AppRoutes(
        route = "preferences",
        isRootDestination = false,
        showsTopBar = true
    )

    data object ThemeSettings : AppRoutes(
        route = "theme_settings",
        isRootDestination = false,
        showsTopBar = true
    )

    data object GamificationSettings : AppRoutes(
        route = "gamification_settings",
        isRootDestination = false,
        showsTopBar = true
    )

    data object Developer : AppRoutes(
        route = "developer",
        isRootDestination = false,
        showsTopBar = true
    )

    data object LevelJourney : AppRoutes(
        route = "level_journey",
        isRootDestination = false,
        showsTopBar = true
    )

    data object About : AppRoutes(
        route = "about",
        isRootDestination = false,
        showsTopBar = true
    )

    data object Schedules : AppRoutes(
        route = "schedules",
        isRootDestination = false,
        showsTopBar = true
    )

    // ==========================================
    // NOTIFICATIONS
    // ==========================================

    data object Notifications : AppRoutes(
        route = "notifications",
        isRootDestination = false,
        showsTopBar = true
    )

    // ==========================================
    // ADMIN
    // ==========================================

    data object UserManagement : AppRoutes(
        route = "user_management",
        isRootDestination = false,
        showsTopBar = true
    )

    // ==========================================
    // LEAGUE
    // ==========================================

    data object League : AppRoutes(
        route = "league",
        isRootDestination = true,  // League é root destination (bottom nav)
        showsTopBar = true
    )
}

/**
 * Lista de todas as rotas root (Bottom Nav)
 * Nota: League substituiu Statistics como root destination
 */
val rootRoutes: List<AppRoutes> = listOf(
    AppRoutes.Home,
    AppRoutes.Games,
    AppRoutes.Players,
    AppRoutes.League,  // Corrigido: League é root, não Statistics
    AppRoutes.Profile
)

/**
 * Verifica se uma rota é uma rota root (deve mostrar Bottom Nav)
 */
fun isRootRoute(route: String?): Boolean {
    return rootRoutes.any { it.route == route }
}

/**
 * Verifica se uma rota deve mostrar TopBar com back button
 */
fun shouldShowTopBar(route: String?): Boolean {
    if (route == null) return false
    // Root destinations não mostram TopBar (têm Bottom Bar)
    if (isRootRoute(route)) return false
    return true
}
