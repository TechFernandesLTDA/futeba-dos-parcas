package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.LeagueDivision
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

/**
 * Testes unitários para LeagueRatingCalculator.
 * Cobre cálculos de rating da liga, divisões e pontos de temporada.
 */
@DisplayName("LeagueRatingCalculator Tests")
class LeagueRatingCalculatorTest {

    // ==================== TESTES DE calculate ====================

    @Nested
    @DisplayName("calculate")
    inner class CalculateTests {

        @Test
        @DisplayName("Lista vazia deve retornar rating 0")
        fun `empty list should return 0 rating`() {
            val rating = LeagueRatingCalculator.calculate(emptyList())
            assertEquals(0.0, rating, 0.001)
        }

        @Test
        @DisplayName("Jogador com jogo perfeito deve ter rating alto")
        fun `player with perfect game should have high rating`() {
            val games = listOf(
                RecentGameData(
                    gameId = "1",
                    xpEarned = 200,
                    won = true,
                    drew = false,
                    goalDiff = 3,
                    wasMvp = true
                )
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // PPJ: 200/200 * 100 * 0.4 = 40
            // WR: 100% * 0.3 = 30
            // GD: (3+3)/6 * 100 * 0.2 = 20
            // MVP: 100/50 = 2 -> cap 1.0 * 100 * 0.1 = 10
            // Total: 100
            assertEquals(100.0, rating, 0.001)
        }

        @Test
        @DisplayName("Jogador com jogo péssimo deve ter rating baixo")
        fun `player with bad game should have low rating`() {
            val games = listOf(
                RecentGameData(
                    gameId = "1",
                    xpEarned = 10,
                    won = false,
                    drew = false,
                    goalDiff = -3,
                    wasMvp = false
                )
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // PPJ: 10/200 * 100 * 0.4 = 2
            // WR: 0% * 0.3 = 0
            // GD: 0/6 * 100 * 0.2 = 0
            // MVP: 0 * 0.1 = 0
            // Total: ~2
            assertTrue(rating < 10.0)
        }

        @Test
        @DisplayName("Jogador médio deve ter rating em torno de 50")
        fun `average player should have rating around 50`() {
            val games = listOf(
                RecentGameData(gameId = "1", xpEarned = 100, won = true, goalDiff = 1, wasMvp = false),
                RecentGameData(gameId = "2", xpEarned = 100, won = false, goalDiff = -1, wasMvp = false),
                RecentGameData(gameId = "3", xpEarned = 100, won = false, drew = true, goalDiff = 0, wasMvp = false),
                RecentGameData(gameId = "4", xpEarned = 100, won = true, goalDiff = 2, wasMvp = true)
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // Deve estar entre 30-70
            assertTrue(rating in 30.0..70.0)
        }

        @Test
        @DisplayName("XP acima de 200 deve ser capeado para cálculo")
        fun `xp above 200 should be capped for calculation`() {
            val games = listOf(
                RecentGameData(gameId = "1", xpEarned = 500, won = true, goalDiff = 3, wasMvp = true)
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // PPJ capeado em 100
            assertEquals(100.0, rating, 0.001)
        }

        @Test
        @DisplayName("Goal difference extremo negativo deve retornar 0 para GD score")
        fun `extreme negative goal diff should return 0 for GD score`() {
            val games = listOf(
                RecentGameData(gameId = "1", xpEarned = 100, won = false, goalDiff = -10, wasMvp = false)
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // GD: (-10+3)/6 = negativo, capeado em 0
            // Rating deve ser baixo mas não negativo
            assertTrue(rating >= 0.0)
        }

        @Test
        @DisplayName("MVP em todos os jogos deve maximizar MVP score")
        fun `mvp in all games should maximize mvp score`() {
            val games = listOf(
                RecentGameData(gameId = "1", xpEarned = 100, won = true, goalDiff = 0, wasMvp = true),
                RecentGameData(gameId = "2", xpEarned = 100, won = true, goalDiff = 0, wasMvp = true)
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // MVP rate: 100% -> cap 100 * 0.1 = 10
            // Rating inclui os 10 pontos de MVP
            assertTrue(rating > 50.0)
        }

        @Test
        @DisplayName("Empate deve contar como não-vitória para WR")
        fun `draw should count as non-win for WR`() {
            val games = listOf(
                RecentGameData(gameId = "1", xpEarned = 100, won = false, drew = true, goalDiff = 0, wasMvp = false)
            )
            val rating = LeagueRatingCalculator.calculate(games)

            // WR: 0% (empate não é vitória)
            assertTrue(rating < 50.0)
        }
    }

    // ==================== TESTES DE getDivisionForRating ====================

    @Nested
    @DisplayName("getDivisionForRating")
    inner class GetDivisionForRatingTests {

        @ParameterizedTest
        @CsvSource(
            "0.0, BRONZE",
            "15.0, BRONZE",
            "29.99, BRONZE",
            "30.0, PRATA",
            "45.0, PRATA",
            "49.99, PRATA",
            "50.0, OURO",
            "60.0, OURO",
            "69.99, OURO",
            "70.0, DIAMANTE",
            "85.0, DIAMANTE",
            "100.0, DIAMANTE"
        )
        @DisplayName("Rating deve corresponder à divisão correta")
        fun `rating should correspond to correct division`(rating: Double, expectedDivision: LeagueDivision) {
            val division = LeagueRatingCalculator.getDivisionForRating(rating)
            assertEquals(expectedDivision, division)
        }

        @Test
        @DisplayName("Rating negativo deve retornar Bronze")
        fun `negative rating should return Bronze`() {
            val division = LeagueRatingCalculator.getDivisionForRating(-10.0)
            assertEquals(LeagueDivision.BRONZE, division)
        }
    }

    // ==================== TESTES DE getNextDivisionThreshold ====================

    @Nested
    @DisplayName("getNextDivisionThreshold")
    inner class GetNextDivisionThresholdTests {

        @Test
        @DisplayName("Bronze deve ter threshold 30 para próxima divisão")
        fun `bronze should have threshold 30 for next division`() {
            val threshold = LeagueRatingCalculator.getNextDivisionThreshold(LeagueDivision.BRONZE)
            assertEquals(30.0, threshold, 0.001)
        }

        @Test
        @DisplayName("Prata deve ter threshold 50 para próxima divisão")
        fun `prata should have threshold 50 for next division`() {
            val threshold = LeagueRatingCalculator.getNextDivisionThreshold(LeagueDivision.PRATA)
            assertEquals(50.0, threshold, 0.001)
        }

        @Test
        @DisplayName("Ouro deve ter threshold 70 para próxima divisão")
        fun `ouro should have threshold 70 for next division`() {
            val threshold = LeagueRatingCalculator.getNextDivisionThreshold(LeagueDivision.OURO)
            assertEquals(70.0, threshold, 0.001)
        }

        @Test
        @DisplayName("Diamante deve ter threshold 100 (já é o máximo)")
        fun `diamante should have threshold 100`() {
            val threshold = LeagueRatingCalculator.getNextDivisionThreshold(LeagueDivision.DIAMANTE)
            assertEquals(100.0, threshold, 0.001)
        }
    }

    // ==================== TESTES DE getPreviousDivisionThreshold ====================

    @Nested
    @DisplayName("getPreviousDivisionThreshold")
    inner class GetPreviousDivisionThresholdTests {

        @Test
        @DisplayName("Bronze deve ter threshold 0 (não pode cair mais)")
        fun `bronze should have threshold 0`() {
            val threshold = LeagueRatingCalculator.getPreviousDivisionThreshold(LeagueDivision.BRONZE)
            assertEquals(0.0, threshold, 0.001)
        }

        @Test
        @DisplayName("Prata deve ter threshold 0 para cair para Bronze")
        fun `prata should have threshold 0 to drop to bronze`() {
            val threshold = LeagueRatingCalculator.getPreviousDivisionThreshold(LeagueDivision.PRATA)
            assertEquals(0.0, threshold, 0.001)
        }

        @Test
        @DisplayName("Ouro deve ter threshold 30 para cair para Prata")
        fun `ouro should have threshold 30 to drop to prata`() {
            val threshold = LeagueRatingCalculator.getPreviousDivisionThreshold(LeagueDivision.OURO)
            assertEquals(30.0, threshold, 0.001)
        }

        @Test
        @DisplayName("Diamante deve ter threshold 50 para cair para Ouro")
        fun `diamante should have threshold 50 to drop to ouro`() {
            val threshold = LeagueRatingCalculator.getPreviousDivisionThreshold(LeagueDivision.DIAMANTE)
            assertEquals(50.0, threshold, 0.001)
        }
    }

    // ==================== TESTES DE calculateSeasonPoints ====================

    @Nested
    @DisplayName("calculateSeasonPoints")
    inner class CalculateSeasonPointsTests {

        @Test
        @DisplayName("0 jogos deve dar 0 pontos")
        fun `zero games should give 0 points`() {
            val points = LeagueRatingCalculator.calculateSeasonPoints(0, 0, 0)
            assertEquals(0, points)
        }

        @Test
        @DisplayName("Apenas vitórias: 3 pontos por vitória")
        fun `only wins should give 3 points per win`() {
            val points = LeagueRatingCalculator.calculateSeasonPoints(10, 0, 0)
            assertEquals(30, points)
        }

        @Test
        @DisplayName("Apenas empates: 1 ponto por empate")
        fun `only draws should give 1 point per draw`() {
            val points = LeagueRatingCalculator.calculateSeasonPoints(0, 10, 0)
            assertEquals(10, points)
        }

        @Test
        @DisplayName("Apenas derrotas: 0 pontos")
        fun `only losses should give 0 points`() {
            val points = LeagueRatingCalculator.calculateSeasonPoints(0, 0, 10)
            assertEquals(0, points)
        }

        @Test
        @DisplayName("Combinação de resultados")
        fun `combination of results`() {
            val points = LeagueRatingCalculator.calculateSeasonPoints(5, 3, 2)
            // 5*3 + 3*1 + 2*0 = 15 + 3 + 0 = 18
            assertEquals(18, points)
        }

        @Test
        @DisplayName("Temporada completa (38 jogos)")
        fun `full season calculation`() {
            val points = LeagueRatingCalculator.calculateSeasonPoints(20, 10, 8)
            // 20*3 + 10*1 = 60 + 10 = 70
            assertEquals(70, points)
        }
    }
}
