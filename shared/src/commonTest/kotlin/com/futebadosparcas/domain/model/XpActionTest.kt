package com.futebadosparcas.domain.model

import com.futebadosparcas.domain.ranking.XpBreakdown
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class XpActionTest {

    @Test
    fun valoresBaseRebalanceados_seguemContratoPublico() {
        assertEquals(25, XpAction.GOAL.defaultXp)
        assertEquals(20, XpAction.ASSIST.defaultXp)
        assertEquals(15, XpAction.SAVE.defaultXp)
        assertEquals(30, XpAction.WIN.defaultXp)
        assertEquals(50, XpAction.MVP.defaultXp)
    }

    @Test
    fun novosBonus_temLabelsDeExibicaoEValoresContratados() {
        assertEquals(15, XpAction.TOP_SCORER.defaultXp)
        assertEquals("Artilheiro do Jogo 🎯", XpAction.TOP_SCORER.displayName)
        assertEquals(30, XpAction.HAT_TRICK.defaultXp)
        assertEquals(20, XpAction.GOALKEEPER_GOAL.defaultXp)
        assertEquals(5, XpAction.FAIR_PLAY.defaultXp)
        assertEquals(50, XpAction.MONTHLY_STREAK_3.defaultXp)
        assertEquals(100, XpAction.MONTHLY_STREAK_6.defaultXp)
        assertEquals(250, XpAction.MONTHLY_STREAK_12.defaultXp)
        assertEquals(2, XpAction.EVENT_RECORDER.defaultXp)
        assertTrue(XpAction.values().contains(XpAction.WAITLIST_PROMOTED))
    }

    @Test
    fun logDoServidor_expoeSomenteBonusPresentes() {
        val log = XpLog(
            xpTopScorer = 15,
            xpComeback = 20,
            xpWaitlistPromoted = 10
        )

        assertEquals(
            mapOf(
                XpAction.TOP_SCORER to 15,
                XpAction.COMEBACK_30D to 20,
                XpAction.WAITLIST_PROMOTED to 10
            ),
            log.bonusBreakdown()
        )
    }

    @Test
    fun breakdown_posJogo_exibeBonusSemRecalcularElegibilidade() {
        val breakdown = XpBreakdown(
            participation = 10,
            topScorer = 15,
            recorder = 20,
            waitlistPromoted = 10
        )

        assertEquals(55, breakdown.total)
        assertEquals(
            mapOf(
                "Participacao" to 10L,
                "Artilheiro do Jogo 🎯" to 15L,
                "Mesa Oficial 📝" to 20L,
                "Veio da Waitlist 🎟️" to 10L
            ),
            breakdown.toDisplayMap()
        )
    }
}
