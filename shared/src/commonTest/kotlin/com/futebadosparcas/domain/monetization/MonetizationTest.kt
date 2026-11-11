package com.futebadosparcas.domain.monetization

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class FakeStore : AdsStateStore {
    val map = mutableMapOf<String, Boolean>()
    override fun getBoolean(key: String) = map[key] ?: false
    override fun putBoolean(key: String, value: Boolean) { map[key] = value }
}

class AdsPolicyTest {
    @Test
    fun rotasRaizPermitidas() {
        listOf("home", "games", "players", "league", "groups", "ranking", "profile")
            .forEach { assertTrue(AdsPolicy.isBannerRouteAllowed(it), it) }
    }

    @Test
    fun telasCriticasNuncaTemBanner() {
        listOf(
            "cashbox/abc", "cashbox", "payment", "pix_receipt", "login", "register", "welcome",
            "onboarding/phone", "onboarding/cpf", "profile_setup", "live_game/1", "game/123",
            "game_detail/1", "create_game", "field_owner_dashboard", "owner_stats/9",
            "manage_locations", "user_management", "delete_account", "developer",
            "mvp_vote/1", "post_game_report/1", "not_found", "splash", "about", "",
        ).forEach { assertFalse(AdsPolicy.isBannerRouteAllowed(it), it) }
        assertFalse(AdsPolicy.isBannerRouteAllowed(null))
    }

    @Test
    fun rotaComQueryUsaSoOCaminho() {
        assertTrue(AdsPolicy.isBannerRouteAllowed("games?tab=1"))
        assertFalse(AdsPolicy.isBannerRouteAllowed("cashbox?x=home"))
    }
}

class AdsGateTest {
    @Test
    fun assinanteNuncaVeAnuncioNemIniciaSdk() {
        assertFalse(AdsGate.shouldStartAds(adsFree = true, firstWinReached = true, unitConfigured = true))
        assertFalse(AdsGate.shouldShowBanner(true, true, true, true, "home"))
    }

    @Test
    fun semPrimeiraVitoriaNaoIniciaNada() {
        assertFalse(AdsGate.shouldStartAds(adsFree = false, firstWinReached = false, unitConfigured = true))
        assertFalse(AdsGate.shouldShowBanner(false, false, true, true, "home"))
    }

    @Test
    fun semUnidadeConfiguradaNaoHaAnuncio() {
        assertFalse(AdsGate.shouldStartAds(adsFree = false, firstWinReached = true, unitConfigured = false))
    }

    @Test
    fun bannerExigeConsentimentoETelaPermitida() {
        assertTrue(AdsGate.shouldShowBanner(false, true, true, true, "home"))
        assertFalse(AdsGate.shouldShowBanner(false, true, true, false, "home"))
        assertFalse(AdsGate.shouldShowBanner(false, true, true, true, "cashbox/1"))
    }

    @Test
    fun recusaDoAttForcaNaoPersonalizadoQuandoPersonalizadoLiberado() {
        assertTrue(AdsGate.requestNonPersonalized(false, personalizedAllowed = true))
        assertFalse(AdsGate.requestNonPersonalized(true, personalizedAllowed = true))
        assertFalse(AdsGate.requestNonPersonalized(null, personalizedAllowed = true))
    }

    @Test
    fun menoresDe18PodemUsarOApp_entaoNuncaHaAnuncioPersonalizado() {
        assertFalse(MonetizationConfig.ALLOW_PERSONALIZED_ADS)
        assertTrue(AdsGate.requestNonPersonalized(true))
        assertTrue(AdsGate.requestNonPersonalized(null))
        assertTrue(AdsGate.requestNonPersonalized(false))
    }
}

class AdsFreeEntitlementTest {
    private val pid = MonetizationConfig.PRODUCT_ID_SEM_ANUNCIOS_ANUAL
    private fun p(state: StorePurchaseState, suspended: Boolean = false, id: String = pid, ack: Boolean = true) =
        StorePurchase(id, state, suspended, ack)

    @Test
    fun assinaturaPagaLibera() {
        assertEquals(
            EntitlementDecision.GRANT,
            AdsFreeEntitlement.decide(StoreAnswer.Answered(listOf(p(StorePurchaseState.PURCHASED)))),
        )
    }

    @Test
    fun lojaIndisponivelNuncaRevoga() {
        assertEquals(EntitlementDecision.KEEP, AdsFreeEntitlement.decide(StoreAnswer.Unavailable))
    }

    @Test
    fun lojaRespondeuSemNadaRevoga() {
        assertEquals(EntitlementDecision.REVOKE, AdsFreeEntitlement.decide(StoreAnswer.Answered(emptyList())))
        assertEquals(
            EntitlementDecision.REVOKE,
            AdsFreeEntitlement.decide(StoreAnswer.Answered(listOf(p(StorePurchaseState.PURCHASED, id = "outro")))),
        )
    }

    @Test
    fun pendenteOuDesconhecidoMantem() {
        assertEquals(
            EntitlementDecision.KEEP,
            AdsFreeEntitlement.decide(StoreAnswer.Answered(listOf(p(StorePurchaseState.PENDING)))),
        )
        assertEquals(
            EntitlementDecision.KEEP,
            AdsFreeEntitlement.decide(StoreAnswer.Answered(listOf(p(StorePurchaseState.UNKNOWN)))),
        )
    }

    @Test
    fun pagamentoSuspensoRevoga() {
        assertEquals(
            EntitlementDecision.REVOKE,
            AdsFreeEntitlement.decide(StoreAnswer.Answered(listOf(p(StorePurchaseState.PURCHASED, suspended = true)))),
        )
    }

    @Test
    fun confirmarCompraPagaNaoConfirmada() {
        assertTrue(AdsFreeEntitlement.needsAcknowledge(p(StorePurchaseState.PURCHASED, ack = false)))
        assertFalse(AdsFreeEntitlement.needsAcknowledge(p(StorePurchaseState.PURCHASED, ack = true)))
        assertFalse(AdsFreeEntitlement.needsAcknowledge(p(StorePurchaseState.PENDING, ack = false)))
    }
}

class AdsStateTest {
    @Test
    fun primeiraVitoriaEIdempotenteELiberacaoPersiste() {
        val state = AdsState(FakeStore())
        assertFalse(state.firstWinReached)
        state.markFirstWin(); state.markFirstWin()
        assertTrue(state.firstWinReached)

        assertFalse(state.adsFree)
        state.apply(EntitlementDecision.GRANT)
        assertTrue(state.adsFree)
        state.apply(EntitlementDecision.KEEP)
        assertTrue(state.adsFree)
        state.apply(EntitlementDecision.REVOKE)
        assertFalse(state.adsFree)
    }
}
