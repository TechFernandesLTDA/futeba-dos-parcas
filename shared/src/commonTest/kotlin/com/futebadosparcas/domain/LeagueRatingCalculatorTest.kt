package com.futebadosparcas.domain

import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.ranking.LeagueRatingCalculator
import com.futebadosparcas.domain.ranking.RecentGameData
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Testes compartilhados para LeagueRatingCalculator (escala 0-100).
 * Logica pura — executam em Android (JVM) e iOS (Native).
 *
 * Formula: LR = (PPJ * 40%) + (WR * 30%) + (GD * 20%) + (MVP_Rate * 10%)
 */
class LeagueRatingCalculatorTest {

    // Tolerancia para comparacao de Double (evita flakiness por ponto flutuante).
    private val tolerance = 0.01

    @Test
    fun calculate_listaVazia_retornaZero() {
        assertEquals(0.0, LeagueRatingCalculator.calculate(emptyList()), tolerance)
    }

    @Test
    fun calculate_jogadorPerfeito_retornaCemOuQuaseCem() {
        // 500 XP (PPJ max), venceu, GD +3 (max), foi MVP em 50%+ -> rating maximo.
        val jogos = List(2) { index ->
            RecentGameData(
                gameId = "g$index",
                xpEarned = 500L,
                won = true,
                goalDiff = 3,
                wasMvp = index == 0 // 50% MVP rate = cap
            )
        }
        val rating = LeagueRatingCalculator.calculate(jogos)
        assertEquals(100.0, rating, tolerance)
    }

    @Test
    fun calculate_jogadorPessimo_retornaZeroOuQuaseZero() {
        // 0 XP, perdeu, GD -3 (min), sem MVP -> rating minimo.
        val jogos = listOf(
            RecentGameData(gameId = "g0", xpEarned = 0L, won = false, goalDiff = -3, wasMvp = false)
        )
        val rating = LeagueRatingCalculator.calculate(jogos)
        assertEquals(0.0, rating, tolerance)
    }

    @Test
    fun calculate_resultadoSempreEntreZeroECem() {
        val jogos = listOf(
            RecentGameData(xpEarned = 250L, won = true, goalDiff = 1, wasMvp = false),
            RecentGameData(xpEarned = 100L, won = false, goalDiff = -2, wasMvp = false),
            RecentGameData(xpEarned = 500L, won = true, goalDiff = 5, wasMvp = true)
        )
        val rating = LeagueRatingCalculator.calculate(jogos)
        assertTrue(rating in 0.0..100.0, "Rating deve estar entre 0 e 100, foi $rating")
    }

    @Test
    fun getDivisionForRating_thresholds() {
        assertEquals(LeagueDivision.BRONZE, LeagueRatingCalculator.getDivisionForRating(0.0))
        assertEquals(LeagueDivision.BRONZE, LeagueRatingCalculator.getDivisionForRating(29.0))
        assertEquals(LeagueDivision.PRATA, LeagueRatingCalculator.getDivisionForRating(30.0))
        assertEquals(LeagueDivision.OURO, LeagueRatingCalculator.getDivisionForRating(50.0))
        assertEquals(LeagueDivision.DIAMANTE, LeagueRatingCalculator.getDivisionForRating(70.0))
        assertEquals(LeagueDivision.DIAMANTE, LeagueRatingCalculator.getDivisionForRating(100.0))
    }

    @Test
    fun calculateSeasonPoints_vitoriaTresEmpateUm() {
        // 3 vitorias (9) + 2 empates (2) + 5 derrotas (0) = 11.
        assertEquals(11, LeagueRatingCalculator.calculateSeasonPoints(wins = 3, draws = 2, losses = 5))
    }

    @Test
    fun calculateSeasonPoints_semJogos_zero() {
        assertEquals(0, LeagueRatingCalculator.calculateSeasonPoints(0, 0, 0))
    }
}
