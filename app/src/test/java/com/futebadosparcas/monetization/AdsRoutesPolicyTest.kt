package com.futebadosparcas.monetization

import com.futebadosparcas.domain.monetization.AdsPolicy
import com.futebadosparcas.ui.navigation.Screen
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Trava as rotas REAIS do Android: o banner só pode aparecer nas telas raiz da navegação.
 * Se alguém criar uma rota nova, ela nasce sem banner (lista de permissão).
 */
class AdsRoutesPolicyTest {

    @Test
    fun telasRaizPodemTerBanner() {
        listOf(Screen.Home, Screen.Games, Screen.Players, Screen.League, Screen.Profile)
            .forEach { assertTrue(AdsPolicy.isBannerRouteAllowed(it.route), it.route) }
    }

    @Test
    fun telasCriticasNuncaTemBanner() {
        listOf(
            Screen.Cashbox, Screen.LiveGame, Screen.MVPVote, Screen.GameDetail, Screen.CreateGame,
            Screen.FieldOwnerDashboard, Screen.ManageLocations, Screen.UserManagement,
            Screen.Developer, Screen.RemoveAds, Screen.Preferences, Screen.EditProfile,
            Screen.ConnectedAccounts, Screen.DirectConversation, Screen.GroupDetail,
            Screen.InvitePlayers, Screen.About, Screen.Notifications,
        ).forEach { assertFalse(AdsPolicy.isBannerRouteAllowed(it.route), it.route) }
    }
}
