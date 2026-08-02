package com.futebadosparcas.util

import com.futebadosparcas.ui.navigation.Screen
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class DeepLinkHelperTest {
    private val helper = DeepLinkHelper()

    @Test
    fun `verified web paths map to native destinations`() {
        val game = helper.parse("https://futebadosparcas.web.app/game/game-123")
        val checkIn = helper.parse("https://futebadosparcas.web.app/checkin/game-123/token-456")
        val groupInvite = helper.parse("https://futebadosparcas.web.app/join/ABC123")
        val friendInvite = helper.parse("https://futebadosparcas.web.app/invite/REF123")

        assertEquals(Screen.GameDetail.createRoute("game-123"), game.toNavigationRoute())
        assertEquals(Screen.GameDetail.createRoute("game-123"), checkIn.toNavigationRoute())
        assertEquals(Screen.Groups.route, groupInvite.toNavigationRoute())
        assertEquals(Screen.Home.route, friendInvite.toNavigationRoute())
    }

    @Test
    fun `legacy custom scheme remains supported`() {
        assertEquals(DeepLink.Game("game-123"), helper.parse("futebadosparcas://game/game-123"))
        assertEquals(DeepLink.Group("group-123"), helper.parse("futebadosparcas://group/group-123"))
    }

    @Test
    fun `new br domain web paths map to native destinations`() {
        val game = helper.parse("https://futebadosparcas.com.br/game/game-123")
        val checkIn = helper.parse("https://futebadosparcas.com.br/checkin/game-123/token-456")
        val groupInvite = helper.parse("https://futebadosparcas.com.br/join/ABC123")
        val friendInvite = helper.parse("https://futebadosparcas.com.br/invite/REF123")

        assertEquals(Screen.GameDetail.createRoute("game-123"), game.toNavigationRoute())
        assertEquals(Screen.GameDetail.createRoute("game-123"), checkIn.toNavigationRoute())
        assertEquals(Screen.Groups.route, groupInvite.toNavigationRoute())
        assertEquals(Screen.Home.route, friendInvite.toNavigationRoute())
    }

    @Test
    fun `untrusted hosts and incomplete check-in links are rejected`() {
        assertTrue(helper.parse("https://example.com/game/game-123") is DeepLink.Invalid)
        assertTrue(helper.parse("https://futebadosparcas.web.app/checkin/game-123") is DeepLink.Invalid)
        assertTrue(helper.parse("https://futebadosparcas.com.br/checkin/game-123") is DeepLink.Invalid)
    }
}
