package com.futebadosparcas.domain.monetization

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PlayOfferSelectionTest {
    private val base = PlayOfferCandidate("anual", offerId = null, offerToken = "tok-base", lastPhasePrice = "R$ 9,90")

    // Oferta criada no Console: 1º ano grátis, depois o preço cheio (última fase).
    private val gratis = PlayOfferCandidate("anual", offerId = "primeiro-ano-gratis", offerToken = "tok-promo", lastPhasePrice = "R$ 9,90")

    @Test
    fun vendeAOfertaBaseDoPlanoAnual() {
        assertEquals(ChosenPlayOffer("tok-base", "R$ 9,90"), PlayOfferSelection.choose(listOf(base)))
    }

    @Test
    fun comPromocaoNaListaContinuaNaBase() {
        assertEquals("tok-base", PlayOfferSelection.choose(listOf(gratis, base))?.offerToken)
        assertEquals("tok-base", PlayOfferSelection.choose(listOf(base, gratis))?.offerToken)
    }

    @Test
    fun soAPromocaoDaIndisponivelNuncaVendeAPromocaoPorEngano() {
        assertNull(PlayOfferSelection.choose(listOf(gratis)))
    }

    @Test
    fun outroPlanoBaseNaoServe() {
        assertNull(PlayOfferSelection.choose(listOf(base.copy(basePlanId = "mensal"))))
    }

    @Test
    fun semTokenOuSemPrecoDaIndisponivel() {
        assertNull(PlayOfferSelection.choose(listOf(base.copy(offerToken = ""))))
        assertNull(PlayOfferSelection.choose(listOf(base.copy(lastPhasePrice = null))))
        assertNull(PlayOfferSelection.choose(emptyList()))
    }
}
