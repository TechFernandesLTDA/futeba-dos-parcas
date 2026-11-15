package com.futebadosparcas.ui.core

import com.futebadosparcas.domain.model.Statistics
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PlayerStatsSummaryTest {

    @Test
    fun semJogos_estadoVazioSemDivisaoPorZero() {
        val summary = buildPlayerStatsSummary(Statistics(userId = "u1"))

        assertTrue(summary.isEmpty)
        assertEquals(0, summary.winRatePercent)
        assertEquals(0.0, summary.goalsPerGame)
    }

    @Test
    fun aproveitamento_contaVitoriaTresEmpateUm() {
        // 2 vitórias (6) + 1 empate (1) em 4 jogos (12 pontos possíveis) = 58%
        val summary = buildPlayerStatsSummary(
            Statistics(totalGames = 4, totalGoals = 6, totalWins = 2, totalDraws = 1, totalLosses = 1)
        )

        assertEquals(58, summary.winRatePercent)
        assertEquals(1.5, summary.goalsPerGame)
    }

    @Test
    fun formatOneDecimal_usaVirgula() {
        assertEquals("1,5", formatOneDecimal(1.5))
        assertEquals("0,0", formatOneDecimal(0.0))
        assertEquals("2,3", formatOneDecimal(2.333))
    }
}
