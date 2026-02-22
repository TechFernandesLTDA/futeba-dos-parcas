package com.futebadosparcas.navigation

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class WebRouterTest {

    @Test
    fun `WebRoute Home has correct path`() {
        assertEquals("/", WebRoute.Home.path)
    }

    @Test
    fun `WebRoute Home has correct tabIndex`() {
        assertEquals(0, WebRoute.Home.tabIndex)
    }

    @Test
    fun `WebRoute Home is not detail screen`() {
        assertFalse(WebRoute.Home.isDetailScreen)
    }

    @Test
    fun `WebRoute Home has correct title`() {
        assertEquals("Início", WebRoute.Home.title)
    }

    @Test
    fun `WebRoute Games has correct path`() {
        assertEquals("/games", WebRoute.Games.path)
    }

    @Test
    fun `WebRoute Games has correct tabIndex`() {
        assertEquals(1, WebRoute.Games.tabIndex)
    }

    @Test
    fun `WebRoute GameDetail has correct path with gameId`() {
        val route = WebRoute.GameDetail("game123")
        assertEquals("/games/game123", route.path)
    }

    @Test
    fun `WebRoute GameDetail is detail screen`() {
        assertTrue(WebRoute.GameDetail("game123").isDetailScreen)
    }

    @Test
    fun `WebRoute GameDetail has correct title`() {
        assertEquals("Detalhes do Jogo", WebRoute.GameDetail("game123").title)
    }

    @Test
    fun `WebRoute GroupDetail has correct path`() {
        val route = WebRoute.GroupDetail("group456")
        assertEquals("/groups/group456", route.path)
    }

    @Test
    fun `WebRoute GroupDetail is detail screen`() {
        assertTrue(WebRoute.GroupDetail("group456").isDetailScreen)
    }

    @Test
    fun `WebRoute Schedules has correct tabIndex as Games`() {
        assertEquals(1, WebRoute.Schedules.tabIndex)
    }

    @Test
    fun `WebRoute Schedules has correct path`() {
        assertEquals("/schedules", WebRoute.Schedules.path)
    }

    @Test
    fun `WebRoute Groups has correct path`() {
        assertEquals("/groups", WebRoute.Groups.path)
    }

    @Test
    fun `WebRoute Groups has correct tabIndex`() {
        assertEquals(2, WebRoute.Groups.tabIndex)
    }

    @Test
    fun `WebRoute Players has correct path`() {
        assertEquals("/players", WebRoute.Players.path)
    }

    @Test
    fun `WebRoute PlayerDetail has correct path`() {
        val route = WebRoute.PlayerDetail("player789")
        assertEquals("/players/player789", route.path)
    }

    @Test
    fun `WebRoute PlayerDetail is detail screen`() {
        assertTrue(WebRoute.PlayerDetail("player789").isDetailScreen)
    }

    @Test
    fun `WebRoute Locations has correct path`() {
        assertEquals("/locations", WebRoute.Locations.path)
    }

    @Test
    fun `WebRoute LocationDetail has correct path`() {
        val route = WebRoute.LocationDetail("loc123")
        assertEquals("/locations/loc123", route.path)
    }

    @Test
    fun `WebRoute Rankings has correct path`() {
        assertEquals("/rankings", WebRoute.Rankings.path)
    }

    @Test
    fun `WebRoute LeagueDetail without seasonId has correct path`() {
        val route = WebRoute.LeagueDetail(null)
        assertEquals("/rankings/league", route.path)
    }

    @Test
    fun `WebRoute LeagueDetail with seasonId has correct path`() {
        val route = WebRoute.LeagueDetail("season_2026_02")
        assertEquals("/rankings/league/season_2026_02", route.path)
    }

    @Test
    fun `WebRoute LeagueDetail is detail screen`() {
        assertTrue(WebRoute.LeagueDetail("season123").isDetailScreen)
    }

    @Test
    fun `WebRoute StatisticsDetail with groupId has correct path`() {
        val route = WebRoute.StatisticsDetail("user123", "group456")
        assertEquals("/stats/user123/group/group456", route.path)
    }

    @Test
    fun `WebRoute StatisticsDetail without groupId has correct path`() {
        val route = WebRoute.StatisticsDetail("user123", null)
        assertEquals("/stats/user123", route.path)
    }

    @Test
    fun `WebRoute Notifications has correct path`() {
        assertEquals("/notifications", WebRoute.Notifications.path)
    }

    @Test
    fun `WebRoute Profile has correct path`() {
        assertEquals("/profile", WebRoute.Profile.path)
    }

    @Test
    fun `WebRoute DeveloperTools has correct path`() {
        assertEquals("/dev-tools", WebRoute.DeveloperTools.path)
    }

    @Test
    fun `WebRoute DeveloperTools is detail screen`() {
        assertTrue(WebRoute.DeveloperTools.isDetailScreen)
    }

    @Test
    fun `WebRoute Invite has correct path`() {
        val route = WebRoute.Invite("ABC123")
        assertEquals("/invite/ABC123", route.path)
    }

    @Test
    fun `WebRoute Invite is detail screen`() {
        assertTrue(WebRoute.Invite("ABC123").isDetailScreen)
    }

    @Test
    fun `WebRoute TacticalBoard without gameId has correct path`() {
        val route = WebRoute.TacticalBoard(null)
        assertEquals("/tactical", route.path)
    }

    @Test
    fun `WebRoute TacticalBoard with gameId has correct path`() {
        val route = WebRoute.TacticalBoard("game123")
        assertEquals("/tactical/game/game123", route.path)
    }

    @Test
    fun `WebRoute TacticalBoard is detail screen`() {
        assertTrue(WebRoute.TacticalBoard("game123").isDetailScreen)
    }

    @Test
    fun `WebRoute Admin has correct path`() {
        assertEquals("/admin", WebRoute.Admin.path)
    }

    @Test
    fun `WebRoute AdminUsers has correct path`() {
        assertEquals("/admin/users", WebRoute.AdminUsers.path)
    }

    @Test
    fun `WebRoute AdminUsers is detail screen`() {
        assertTrue(WebRoute.AdminUsers.isDetailScreen)
    }

    @Test
    fun `WebRoute AdminReports has correct path`() {
        assertEquals("/admin/reports", WebRoute.AdminReports.path)
    }

    @Test
    fun `WebRoute AdminReports is detail screen`() {
        assertTrue(WebRoute.AdminReports.isDetailScreen)
    }

    @Test
    fun `WebRoute Invite has correct tabIndex as Home`() {
        assertEquals(0, WebRoute.Invite("ABC123").tabIndex)
    }

    @Test
    fun `WebRoute TacticalBoard has correct tabIndex as Games`() {
        assertEquals(1, WebRoute.TacticalBoard(null).tabIndex)
    }

    @Test
    fun `tabIndex consistency - all main tabs have distinct indices`() {
        val mainRoutes = listOf(
            WebRoute.Home,
            WebRoute.Games,
            WebRoute.Groups,
            WebRoute.Players,
            WebRoute.Locations,
            WebRoute.Rankings,
            WebRoute.Notifications,
            WebRoute.Profile
        )
        val indices = mainRoutes.map { it.tabIndex }
        assertEquals(mainRoutes.size, indices.toSet().size, "Each main route should have unique tabIndex")
    }
}
