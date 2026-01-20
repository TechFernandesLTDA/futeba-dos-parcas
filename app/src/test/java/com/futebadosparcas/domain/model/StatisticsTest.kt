package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

/**
 * Testes unitários para Statistics.
 * Cobre cálculos de taxa de vitória, médias e participação.
 */
@DisplayName("Statistics Tests")
class StatisticsTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createStats(
        totalGames: Int = 0,
        totalGoals: Int = 0,
        totalAssists: Int = 0,
        totalWins: Int = 0
    ) = Statistics(
        id = "stats-1",
        userId = "user-1",
        totalGames = totalGames,
        totalGoals = totalGoals,
        totalAssists = totalAssists,
        totalWins = totalWins
    )

    // ==================== TESTES DE getWinRate ====================

    @Nested
    @DisplayName("getWinRate")
    inner class GetWinRateTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            val stats = createStats(totalGames = 0)
            assertEquals(0f, stats.getWinRate())
        }

        @Test
        @DisplayName("100% vitórias deve retornar 1.0")
        fun `100 percent wins should return 1`() {
            val stats = createStats(totalGames = 10, totalWins = 10)
            assertEquals(1.0f, stats.getWinRate())
        }

        @Test
        @DisplayName("50% vitórias deve retornar 0.5")
        fun `50 percent wins should return 0_5`() {
            val stats = createStats(totalGames = 10, totalWins = 5)
            assertEquals(0.5f, stats.getWinRate())
        }

        @Test
        @DisplayName("0 vitórias deve retornar 0")
        fun `zero wins should return 0`() {
            val stats = createStats(totalGames = 10, totalWins = 0)
            assertEquals(0f, stats.getWinRate())
        }

        @ParameterizedTest
        @CsvSource(
            "10, 3, 0.3",
            "10, 7, 0.7",
            "4, 1, 0.25",
            "100, 75, 0.75"
        )
        @DisplayName("Win rate deve ser calculada corretamente")
        fun `win rate should be calculated correctly`(games: Int, wins: Int, expected: Float) {
            val stats = createStats(totalGames = games, totalWins = wins)
            assertEquals(expected, stats.getWinRate(), 0.001f)
        }
    }

    // ==================== TESTES DE getGoalsPerGame ====================

    @Nested
    @DisplayName("getGoalsPerGame")
    inner class GetGoalsPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            val stats = createStats(totalGames = 0, totalGoals = 10)
            assertEquals(0f, stats.getGoalsPerGame())
        }

        @Test
        @DisplayName("1 gol por jogo")
        fun `one goal per game`() {
            val stats = createStats(totalGames = 10, totalGoals = 10)
            assertEquals(1.0f, stats.getGoalsPerGame())
        }

        @Test
        @DisplayName("2 gols por jogo")
        fun `two goals per game`() {
            val stats = createStats(totalGames = 10, totalGoals = 20)
            assertEquals(2.0f, stats.getGoalsPerGame())
        }

        @Test
        @DisplayName("0 gols deve retornar 0")
        fun `zero goals should return 0`() {
            val stats = createStats(totalGames = 10, totalGoals = 0)
            assertEquals(0f, stats.getGoalsPerGame())
        }

        @ParameterizedTest
        @CsvSource(
            "10, 5, 0.5",
            "4, 3, 0.75",
            "100, 150, 1.5"
        )
        @DisplayName("Goals per game deve ser calculado corretamente")
        fun `goals per game should be calculated correctly`(games: Int, goals: Int, expected: Float) {
            val stats = createStats(totalGames = games, totalGoals = goals)
            assertEquals(expected, stats.getGoalsPerGame(), 0.001f)
        }
    }

    // ==================== TESTES DE getAssistsPerGame ====================

    @Nested
    @DisplayName("getAssistsPerGame")
    inner class GetAssistsPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            val stats = createStats(totalGames = 0, totalAssists = 10)
            assertEquals(0f, stats.getAssistsPerGame())
        }

        @Test
        @DisplayName("1 assistência por jogo")
        fun `one assist per game`() {
            val stats = createStats(totalGames = 10, totalAssists = 10)
            assertEquals(1.0f, stats.getAssistsPerGame())
        }

        @ParameterizedTest
        @CsvSource(
            "10, 5, 0.5",
            "4, 2, 0.5",
            "100, 80, 0.8"
        )
        @DisplayName("Assists per game deve ser calculado corretamente")
        fun `assists per game should be calculated correctly`(games: Int, assists: Int, expected: Float) {
            val stats = createStats(totalGames = games, totalAssists = assists)
            assertEquals(expected, stats.getAssistsPerGame(), 0.001f)
        }
    }

    // ==================== TESTES DE getGoalParticipation ====================

    @Nested
    @DisplayName("getGoalParticipation")
    inner class GetGoalParticipationTests {

        @Test
        @DisplayName("Gols + Assistências")
        fun `goals plus assists`() {
            val stats = createStats(totalGoals = 10, totalAssists = 5)
            assertEquals(15, stats.getGoalParticipation())
        }

        @Test
        @DisplayName("Apenas gols")
        fun `only goals`() {
            val stats = createStats(totalGoals = 10, totalAssists = 0)
            assertEquals(10, stats.getGoalParticipation())
        }

        @Test
        @DisplayName("Apenas assistências")
        fun `only assists`() {
            val stats = createStats(totalGoals = 0, totalAssists = 10)
            assertEquals(10, stats.getGoalParticipation())
        }

        @Test
        @DisplayName("Zero participação")
        fun `zero participation`() {
            val stats = createStats(totalGoals = 0, totalAssists = 0)
            assertEquals(0, stats.getGoalParticipation())
        }
    }

    // ==================== TESTES DE getGoalParticipationPerGame ====================

    @Nested
    @DisplayName("getGoalParticipationPerGame")
    inner class GetGoalParticipationPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            val stats = createStats(totalGames = 0, totalGoals = 10, totalAssists = 5)
            assertEquals(0f, stats.getGoalParticipationPerGame())
        }

        @Test
        @DisplayName("1 participação por jogo")
        fun `one participation per game`() {
            val stats = createStats(totalGames = 10, totalGoals = 5, totalAssists = 5)
            assertEquals(1.0f, stats.getGoalParticipationPerGame())
        }

        @ParameterizedTest
        @CsvSource(
            "10, 5, 3, 0.8",
            "4, 2, 2, 1.0",
            "100, 50, 30, 0.8"
        )
        @DisplayName("Goal participation per game deve ser calculado corretamente")
        fun `goal participation per game should be calculated correctly`(
            games: Int,
            goals: Int,
            assists: Int,
            expected: Float
        ) {
            val stats = createStats(totalGames = games, totalGoals = goals, totalAssists = assists)
            assertEquals(expected, stats.getGoalParticipationPerGame(), 0.001f)
        }
    }

    // ==================== TESTES DE DATA CLASS ====================

    @Nested
    @DisplayName("Data Class Properties")
    inner class DataClassPropertiesTests {

        @Test
        @DisplayName("Default values devem ser corretos")
        fun `default values should be correct`() {
            val stats = Statistics()

            assertEquals("", stats.id)
            assertEquals("", stats.userId)
            assertEquals(0, stats.totalGames)
            assertEquals(0, stats.totalGoals)
            assertEquals(0, stats.totalAssists)
            assertEquals(0, stats.totalSaves)
            assertEquals(0, stats.totalWins)
            assertEquals(0, stats.totalDraws)
            assertEquals(0, stats.totalLosses)
            assertEquals(0, stats.mvpCount)
            assertEquals(0, stats.bestGkCount)
            assertEquals(0, stats.worstPlayerCount)
            assertEquals(0, stats.currentStreak)
            assertEquals(0, stats.bestStreak)
            assertEquals(0, stats.yellowCards)
            assertEquals(0, stats.redCards)
            assertNull(stats.lastGameDate)
            assertNull(stats.updatedAt)
        }

        @Test
        @DisplayName("Copy deve funcionar corretamente")
        fun `copy should work correctly`() {
            val original = createStats(totalGames = 10, totalGoals = 5)
            val copied = original.copy(totalGoals = 10)

            assertEquals(10, original.totalGames)
            assertEquals(5, original.totalGoals)
            assertEquals(10, copied.totalGames)
            assertEquals(10, copied.totalGoals)
        }

        @Test
        @DisplayName("Equals deve funcionar corretamente")
        fun `equals should work correctly`() {
            val stats1 = createStats(totalGames = 10, totalGoals = 5)
            val stats2 = createStats(totalGames = 10, totalGoals = 5)
            val stats3 = createStats(totalGames = 10, totalGoals = 6)

            assertEquals(stats1, stats2)
            assertNotEquals(stats1, stats3)
        }
    }
}
