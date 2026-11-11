package com.futebadosparcas.compose.monetization

import com.futebadosparcas.domain.monetization.AdsState
import com.futebadosparcas.domain.monetization.AdsStateStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private class MemoryStore : AdsStateStore {
    val map = mutableMapOf<String, Boolean>()
    override fun getBoolean(key: String) = map[key] ?: false
    override fun putBoolean(key: String, value: Boolean) { map[key] = value }
}

private class FakeAds(override val unitConfigured: Boolean = true, val att: Int = 1, val can: Boolean = true) : AdsBridge {
    var starts = 0
    override val privacyOptionsRequired = false
    override fun startAds(onResult: (Boolean, Int) -> Unit) { starts++; onResult(can, att) }
    override fun showPrivacyOptions(onClosed: () -> Unit) = onClosed()
}

private class FakeStore(var entitlement: StoreOutcome = StoreOutcome.NONE) : StoreBridge {
    override fun loadPriceLabel(callback: (String?) -> Unit) = callback("R$ 9,90")
    override fun purchase(callback: (StoreOutcome) -> Unit) = callback(StoreOutcome.ACTIVE)
    override fun restore(callback: (StoreOutcome) -> Unit) = callback(entitlement)
    override fun currentEntitlement(callback: (StoreOutcome) -> Unit) = callback(entitlement)
    override fun manageSubscriptions() = Unit
}

class MonetizationControllerTest {

    @Test
    fun antesDaPrimeiraVitoriaNadaInicia() {
        val ads = FakeAds()
        val c = MonetizationController(AdsState(MemoryStore()), ads, FakeStore())
        c.start()
        assertEquals(0, ads.starts)
        assertFalse(c.ui.value.canRequestAds)
    }

    @Test
    fun primeiraVitoriaIniciaUmaVezEHabilitaBanner() {
        val ads = FakeAds()
        val c = MonetizationController(AdsState(MemoryStore()), ads, FakeStore())
        c.start()
        c.onFirstWin(); c.onFirstWin()
        assertEquals(1, ads.starts)
        assertTrue(c.ui.value.canRequestAds)
        // Sempre não personalizado (contas de 13 a 17 anos), mesmo com o ATT autorizado.
        assertTrue(c.ui.value.nonPersonalized)
    }

    @Test
    fun attNegadoTambemNaoPersonalizado() {
        val ads = FakeAds(att = 0)
        val c = MonetizationController(AdsState(MemoryStore()), ads, FakeStore())
        c.onFirstWin()
        assertTrue(c.ui.value.nonPersonalized)
    }

    @Test
    fun assinanteNuncaIniciaSdkNemVeBanner() {
        val store = MemoryStore()
        val ads = FakeAds()
        val c = MonetizationController(AdsState(store), ads, FakeStore(StoreOutcome.ACTIVE))
        c.start()          // loja confirma assinatura
        c.onFirstWin()
        assertEquals(0, ads.starts)
        assertTrue(c.ui.value.adsFree)
        assertFalse(c.ui.value.canRequestAds)
    }

    @Test
    fun assinarDepoisDeIniciarEscondeOBanner() {
        val ads = FakeAds()
        val c = MonetizationController(AdsState(MemoryStore()), ads, FakeStore())
        c.onFirstWin()
        assertTrue(c.ui.value.canRequestAds)
        c.applyEntitlement(StoreOutcome.ACTIVE)
        assertFalse(c.ui.value.canRequestAds)
    }

    @Test
    fun semUnidadeConfiguradaNadaInicia() {
        val ads = FakeAds(unitConfigured = false)
        val c = MonetizationController(AdsState(MemoryStore()), ads, FakeStore())
        c.onFirstWin()
        assertEquals(0, ads.starts)
    }

    @Test
    fun lojaIndisponivelNuncaRevoga() {
        val state = AdsState(MemoryStore())
        val c = MonetizationController(state, FakeAds(), FakeStore())
        c.applyEntitlement(StoreOutcome.ACTIVE)
        assertTrue(state.adsFree)
        c.applyEntitlement(StoreOutcome.UNAVAILABLE)
        c.applyEntitlement(StoreOutcome.PENDING)
        assertTrue(state.adsFree)
        c.applyEntitlement(StoreOutcome.NONE)   // loja respondeu sem assinatura: vencida
        assertFalse(state.adsFree)
    }

    @Test
    fun telaCompraRestauraEMostraResultado() {
        val state = AdsState(MemoryStore())
        val store = FakeStore(StoreOutcome.NONE)
        val c = MonetizationController(state, FakeAds(), store)
        val p = RemoveAdsPresenter(c, store)
        p.loadPrice()
        assertEquals("R$ 9,90", p.price)
        p.restore()
        assertEquals(RemoveAdsMessage.NOTHING_TO_RESTORE, p.message)
        store.entitlement = StoreOutcome.ACTIVE
        p.restore()
        assertEquals(RemoveAdsMessage.RESTORED, p.message)
        assertTrue(state.adsFree)
    }
}
