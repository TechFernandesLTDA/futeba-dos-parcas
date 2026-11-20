package com.futebadosparcas.domain.review

import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine
import kotlin.coroutines.Continuation
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ReviewPolicyTest {
    @Test
    fun antesDoCriterioNaoPede() {
        assertFalse(ReviewPolicy.shouldAsk(alreadyAsked = false, successCount = 2))
    }

    @Test
    fun noCriterioPede() {
        assertTrue(ReviewPolicy.shouldAsk(alreadyAsked = false, successCount = 3))
    }

    @Test
    fun jaPediuNuncaMaisPede() {
        assertFalse(ReviewPolicy.shouldAsk(alreadyAsked = true, successCount = 10))
    }

    @Test
    fun anuncioEmTelaCheiaFluxoCriticoOuMomentoRuimBloqueiam() {
        assertFalse(ReviewPolicy.shouldAsk(false, 3, fullscreenAdJustShown = true))
        assertFalse(ReviewPolicy.shouldAsk(false, 3, inCriticalFlow = true))
        assertFalse(ReviewPolicy.shouldAsk(false, 3, positiveMoment = false))
    }
}

private class FakeReviewStore : ReviewStateStore {
    val bools = mutableMapOf<String, Boolean>()
    val ints = mutableMapOf<String, Int>()
    val strings = mutableMapOf<String, String>()
    override fun getBoolean(key: String) = bools[key] ?: false
    override fun putBoolean(key: String, value: Boolean) { bools[key] = value }
    override fun getInt(key: String) = ints[key] ?: 0
    override fun putInt(key: String, value: Int) { ints[key] = value }
    override fun getString(key: String) = strings[key]
    override fun putString(key: String, value: String) { strings[key] = value }
}

/** Os fakes nunca suspendem, então a corrotina termina na hora (sem coroutines-test). */
private fun <T> runNow(block: suspend () -> T): T {
    var out: Result<T>? = null
    block.startCoroutine(Continuation(EmptyCoroutineContext) { out = it })
    return out!!.getOrThrow()
}

class ReviewPromptCoordinatorTest {
    private var calls = 0
    private var attempt = true
    private val store = FakeReviewStore()
    private val coordinator = ReviewPromptCoordinator(store) { calls++; attempt }

    private fun moment(id: String, positive: Boolean = true) =
        runNow { coordinator.onSuccessMoment(id, positiveMoment = positive) }

    @Test
    fun antesDoTerceiroJogoNaoPede() {
        assertFalse(moment("g1"))
        assertFalse(moment("g2"))
        assertEquals(0, calls)
    }

    @Test
    fun noTerceiroJogoPedeUmaVezENuncaMais() {
        moment("g1"); moment("g2")
        assertTrue(moment("g3"))
        assertEquals(1, calls)
        assertTrue(store.getBoolean(ReviewConfig.PREF_ASKED))
        assertFalse(moment("g4"))
        assertFalse(moment("g5"))
        assertEquals(1, calls)
    }

    @Test
    fun mesmoJogoNaoContaDuasVezes() {
        moment("g1"); moment("g1"); moment("g1")
        assertEquals(1, store.getInt(ReviewConfig.PREF_SUCCESS_COUNT))
    }

    @Test
    fun semTentativaRealNaoMarcaEPedeNoProximoSucesso() {
        attempt = false
        moment("g1"); moment("g2")
        assertFalse(moment("g3"))
        assertFalse(store.getBoolean(ReviewConfig.PREF_ASKED))
        attempt = true
        assertTrue(moment("g4"))
        assertTrue(store.getBoolean(ReviewConfig.PREF_ASKED))
    }

    @Test
    fun falhaDoLancadorEEngolidaENaoMarca() {
        val c = ReviewPromptCoordinator(store) { error("boom") }
        repeat(3) { runNow { c.onSuccessMoment("g$it") } }
        assertFalse(store.getBoolean(ReviewConfig.PREF_ASKED))
    }

    @Test
    fun momentoRuimConta_masNaoPede() {
        moment("g1"); moment("g2")
        assertFalse(moment("g3", positive = false))
        assertEquals(0, calls)
        assertTrue(moment("g4"))
    }
}
