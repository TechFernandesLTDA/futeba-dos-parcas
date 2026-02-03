package com.futebadosparcas.data.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

/**
 * Testes unitarios para UserStatistics (propriedades computadas)
 * e PerformanceRatingCalculator.
 */
@DisplayName("UserStatistics & PerformanceRatingCalculator Tests")
class UserStatisticsTest {

    // ==================== HELPER ====================

    private fun createStats(
        totalGames: Int = 0,
        totalGoals: Int = 0,
        totalAssists: Int = 0,
        totalSaves: Int = 0,
        totalYellowCards: Int = 0,
        totalRedCards: Int = 0,
        bestPlayerCount: Int = 0,
        worstPlayerCount: Int = 0,
        gamesWon: Int = 0,
        gamesLost: Int = 0,
        gamesDraw: Int = 0,
        gamesInvited: Int = 0,
        gamesAttended: Int = 0
    ) = UserStatistics(
        id = "test-user",
        totalGames = totalGames,
        totalGoals = totalGoals,
        totalAssists = totalAssists,
        totalSaves = totalSaves,
        totalYellowCards = totalYellowCards,
        totalRedCards = totalRedCards,
        bestPlayerCount = bestPlayerCount,
        worstPlayerCount = worstPlayerCount,
        gamesWon = gamesWon,
        gamesLost = gamesLost,
        gamesDraw = gamesDraw,
        gamesInvited = gamesInvited,
        gamesAttended = gamesAttended
    )

    // ==================== TESTES DE presenceRate ====================

    @Nested
    @DisplayName("presenceRate")
    inner class PresenceRateTests {

        @Test
        @DisplayName("Sem jogos convidados e sem jogos totais deve retornar 0")
        fun `no invited and no total games should return 0`() {
            val stats = createStats(totalGames = 0, gamesInvited = 0)
            assertEquals(0.0, stats.presenceRate, 0.001)
        }

        @Test
        @DisplayName("Presenca 100% via convites")
        fun `100 percent presence via invites`() {
            val stats = createStats(totalGames = 10, gamesInvited = 10, gamesAttended = 10)
            assertEquals(1.0, stats.presenceRate, 0.001)
        }

        @Test
        @DisplayName("Presenca 50% via convites")
        fun `50 percent presence via invites`() {
            val stats = createStats(totalGames = 5, gamesInvited = 10, gamesAttended = 5)
            assertEquals(0.5, stats.presenceRate, 0.001)
        }

        @Test
        @DisplayName("Fallback sem dados de convites: jogos > 0 retorna 1.0")
        fun `fallback without invite data and games returns 1`() {
            val stats = createStats(totalGames = 10, gamesInvited = 0, gamesAttended = 0)
            assertEquals(1.0, stats.presenceRate, 0.001)
        }

        @Test
        @DisplayName("Presenca nunca ultrapassa 1.0 (coerceIn)")
        fun `presence rate should not exceed 1_0`() {
            val stats = createStats(gamesInvited = 5, gamesAttended = 10)
            assertEquals(1.0, stats.presenceRate, 0.001)
        }

        @Test
        @DisplayName("Presenca nunca fica negativa (coerceIn)")
        fun `presence rate should not be negative`() {
            val stats = createStats(gamesInvited = 10, gamesAttended = 0)
            assertEquals(0.0, stats.presenceRate, 0.001)
        }
    }

    // ==================== TESTES DE winRate ====================

    @Nested
    @DisplayName("winRate")
    inner class WinRateTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            assertEquals(0.0, createStats().winRate, 0.001)
        }

        @ParameterizedTest
        @CsvSource(
            "10, 10, 1.0",
            "10, 5, 0.5",
            "10, 0, 0.0",
            "4, 1, 0.25",
            "3, 2, 0.6667"
        )
        @DisplayName("Win rate deve ser calculada corretamente")
        fun `win rate should be calculated correctly`(games: Int, wins: Int, expected: Double) {
            val stats = createStats(totalGames = games, gamesWon = wins)
            assertEquals(expected, stats.winRate, 0.001)
        }
    }

    // ==================== TESTES DE avgGoalsPerGame ====================

    @Nested
    @DisplayName("avgGoalsPerGame")
    inner class AvgGoalsPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            assertEquals(0.0, createStats(totalGoals = 10).avgGoalsPerGame, 0.001)
        }

        @ParameterizedTest
        @CsvSource(
            "10, 10, 1.0",
            "10, 5, 0.5",
            "10, 0, 0.0",
            "4, 6, 1.5",
            "100, 150, 1.5"
        )
        @DisplayName("Media de gols por jogo deve ser calculada corretamente")
        fun `avg goals per game should be correct`(games: Int, goals: Int, expected: Double) {
            val stats = createStats(totalGames = games, totalGoals = goals)
            assertEquals(expected, stats.avgGoalsPerGame, 0.001)
        }
    }

    // ==================== TESTES DE avgAssistsPerGame ====================

    @Nested
    @DisplayName("avgAssistsPerGame")
    inner class AvgAssistsPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            assertEquals(0.0, createStats(totalAssists = 10).avgAssistsPerGame, 0.001)
        }

        @ParameterizedTest
        @CsvSource(
            "10, 10, 1.0",
            "10, 3, 0.3",
            "4, 2, 0.5"
        )
        @DisplayName("Media de assistencias por jogo deve ser calculada corretamente")
        fun `avg assists per game should be correct`(games: Int, assists: Int, expected: Double) {
            val stats = createStats(totalGames = games, totalAssists = assists)
            assertEquals(expected, stats.avgAssistsPerGame, 0.001)
        }
    }

    // ==================== TESTES DE avgSavesPerGame ====================

    @Nested
    @DisplayName("avgSavesPerGame")
    inner class AvgSavesPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            assertEquals(0.0, createStats(totalSaves = 10).avgSavesPerGame, 0.001)
        }

        @ParameterizedTest
        @CsvSource(
            "10, 20, 2.0",
            "10, 5, 0.5",
            "5, 15, 3.0"
        )
        @DisplayName("Media de defesas por jogo deve ser calculada corretamente")
        fun `avg saves per game should be correct`(games: Int, saves: Int, expected: Double) {
            val stats = createStats(totalGames = games, totalSaves = saves)
            assertEquals(expected, stats.avgSavesPerGame, 0.001)
        }
    }

    // ==================== TESTES DE totalCards ====================

    @Nested
    @DisplayName("totalCards")
    inner class TotalCardsTests {

        @Test
        @DisplayName("Soma de amarelos e vermelhos")
        fun `should sum yellow and red cards`() {
            val stats = createStats(totalYellowCards = 5, totalRedCards = 2)
            assertEquals(7, stats.totalCards)
        }

        @Test
        @DisplayName("Sem cartoes deve retornar 0")
        fun `no cards should return 0`() {
            assertEquals(0, createStats().totalCards)
        }

        @Test
        @DisplayName("Apenas amarelos")
        fun `only yellow cards`() {
            val stats = createStats(totalYellowCards = 3)
            assertEquals(3, stats.totalCards)
        }

        @Test
        @DisplayName("Apenas vermelhos")
        fun `only red cards`() {
            val stats = createStats(totalRedCards = 1)
            assertEquals(1, stats.totalCards)
        }
    }

    // ==================== TESTES DE avgCardsPerGame ====================

    @Nested
    @DisplayName("avgCardsPerGame")
    inner class AvgCardsPerGameTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            val stats = createStats(totalYellowCards = 5, totalRedCards = 2)
            assertEquals(0.0, stats.avgCardsPerGame, 0.001)
        }

        @Test
        @DisplayName("Media de cartoes por jogo")
        fun `avg cards per game should be correct`() {
            val stats = createStats(totalGames = 10, totalYellowCards = 3, totalRedCards = 1)
            assertEquals(0.4, stats.avgCardsPerGame, 0.001)
        }
    }

    // ==================== TESTES DE mvpRate ====================

    @Nested
    @DisplayName("mvpRate")
    inner class MvpRateTests {

        @Test
        @DisplayName("0 jogos deve retornar 0")
        fun `zero games should return 0`() {
            assertEquals(0.0, createStats(bestPlayerCount = 5).mvpRate, 0.001)
        }

        @ParameterizedTest
        @CsvSource(
            "10, 10, 1.0",
            "10, 5, 0.5",
            "10, 0, 0.0",
            "20, 3, 0.15"
        )
        @DisplayName("Taxa de MVP deve ser calculada corretamente")
        fun `mvp rate should be correct`(games: Int, mvps: Int, expected: Double) {
            val stats = createStats(totalGames = games, bestPlayerCount = mvps)
            assertEquals(expected, stats.mvpRate, 0.001)
        }
    }

    // ==================== TESTES DE goalsBalance ====================

    @Nested
    @DisplayName("goalsBalance")
    inner class GoalsBalanceTests {

        @Test
        @DisplayName("Goals balance deve retornar total de gols")
        fun `goals balance should return total goals`() {
            val stats = createStats(totalGoals = 15)
            assertEquals(15, stats.goalsBalance)
        }
    }

    // ==================== TESTES DE PerformanceRatingCalculator ====================

    @Nested
    @DisplayName("PerformanceRatingCalculator")
    inner class PerformanceRatingCalculatorTests {

        @Nested
        @DisplayName("fromStats - Casos basicos")
        inner class FromStatsBasicTests {

            @Test
            @DisplayName("Jogador sem jogos deve ter ratings base")
            fun `player with no games should have base ratings`() {
                val stats = createStats(totalGames = 0)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(0.0, ratings.striker, 0.001)
                assertEquals(0.0, ratings.mid, 0.001)
                assertEquals(0.0, ratings.gk, 0.001)
                assertEquals(0, ratings.sampleSize)
                assertEquals(0.0, ratings.confidence, 0.001)
                // Defender: discipline=1.0 (sem cartoes), winRate=0.0
                // defenderScore = (0.0 * 0.6) + (1.0 * 0.4) = 0.4
                // defender = 0.4 * 5.0 = 2.0
                assertEquals(2.0, ratings.defender, 0.001)
            }

            @Test
            @DisplayName("Jogador com 20+ jogos deve ter confianca 1.0")
            fun `player with 20 plus games should have confidence 1`() {
                val stats = createStats(totalGames = 25, gamesWon = 10)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(1.0, ratings.confidence, 0.001)
                assertEquals(25, ratings.sampleSize)
            }

            @Test
            @DisplayName("Jogador com 10 jogos deve ter confianca 0.5")
            fun `player with 10 games should have confidence 0_5`() {
                val stats = createStats(totalGames = 10, gamesWon = 5)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(0.5, ratings.confidence, 0.001)
            }
        }

        @Nested
        @DisplayName("fromStats - Rating de atacante (striker)")
        inner class StrikerRatingTests {

            @Test
            @DisplayName("Maximo gols por jogo deve dar rating 5.0")
            fun `max goals per game should give rating 5`() {
                // MAX_GOALS_PER_GAME = 1.5
                // 15 gols em 10 jogos = 1.5 gols/jogo = rating 5.0
                val stats = createStats(totalGames = 10, totalGoals = 15)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(5.0, ratings.striker, 0.001)
            }

            @Test
            @DisplayName("Metade do maximo deve dar rating 2.5")
            fun `half of max should give rating 2_5`() {
                // 0.75 gols/jogo / 1.5 max * 5.0 = 2.5
                val stats = createStats(totalGames = 20, totalGoals = 15)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(2.5, ratings.striker, 0.001)
            }

            @Test
            @DisplayName("Acima do maximo deve ser limitado a 5.0")
            fun `above max should be capped at 5`() {
                // 3 gols/jogo > 1.5 max -> capped at 5.0
                val stats = createStats(totalGames = 10, totalGoals = 30)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(5.0, ratings.striker, 0.001)
            }
        }

        @Nested
        @DisplayName("fromStats - Rating de meio-campo (mid)")
        inner class MidRatingTests {

            @Test
            @DisplayName("Maximo assistencias por jogo deve dar rating 5.0")
            fun `max assists per game should give rating 5`() {
                // MAX_ASSISTS_PER_GAME = 1.2
                // 12 assists em 10 jogos = 1.2 assists/jogo = rating 5.0
                val stats = createStats(totalGames = 10, totalAssists = 12)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(5.0, ratings.mid, 0.001)
            }

            @Test
            @DisplayName("Sem assistencias deve dar rating 0")
            fun `no assists should give rating 0`() {
                val stats = createStats(totalGames = 10, totalAssists = 0)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(0.0, ratings.mid, 0.001)
            }
        }

        @Nested
        @DisplayName("fromStats - Rating de goleiro (gk)")
        inner class GkRatingTests {

            @Test
            @DisplayName("Maximo defesas por jogo deve dar rating 5.0")
            fun `max saves per game should give rating 5`() {
                // MAX_SAVES_PER_GAME = 4.0
                // 40 saves em 10 jogos = 4.0 saves/jogo = rating 5.0
                val stats = createStats(totalGames = 10, totalSaves = 40)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(5.0, ratings.gk, 0.001)
            }
        }

        @Nested
        @DisplayName("fromStats - Rating de defensor (defender)")
        inner class DefenderRatingTests {

            @Test
            @DisplayName("100% winRate e 0 cartoes deve dar rating maximo")
            fun `100 percent winrate and 0 cards should give max rating`() {
                // defenderScore = (winRate * 0.6) + (discipline * 0.4)
                // defenderScore = (1.0 * 0.6) + (1.0 * 0.4) = 1.0
                // defender = 1.0 * 5.0 = 5.0
                val stats = createStats(totalGames = 10, gamesWon = 10)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(5.0, ratings.defender, 0.001)
            }

            @Test
            @DisplayName("0% winRate e 0 cartoes deve dar rating baseado em disciplina")
            fun `0 percent winrate and 0 cards should give discipline based rating`() {
                // defenderScore = (0.0 * 0.6) + (1.0 * 0.4) = 0.4
                // defender = 0.4 * 5.0 = 2.0
                val stats = createStats(totalGames = 10, gamesWon = 0)
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(2.0, ratings.defender, 0.001)
            }

            @Test
            @DisplayName("Cartoes devem reduzir rating de defensor")
            fun `cards should reduce defender rating`() {
                // avgCardsPerGame = 1.0 (10 cartoes em 10 jogos)
                // discipline = (1.0 - (1.0 / 2.0)) = 0.5
                // defenderScore = (0.5 * 0.6) + (0.5 * 0.4) = 0.3 + 0.2 = 0.5
                // defender = 0.5 * 5.0 = 2.5
                val stats = createStats(
                    totalGames = 10,
                    gamesWon = 5,
                    totalYellowCards = 8,
                    totalRedCards = 2
                )
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(2.5, ratings.defender, 0.001)
            }

            @Test
            @DisplayName("Muitos cartoes devem resultar em disciplina 0")
            fun `many cards should result in 0 discipline`() {
                // avgCardsPerGame = 2.0+ (20 cartoes em 10 jogos)
                // discipline = (1.0 - (2.0 / 2.0)) = 0.0 (coerced)
                // defenderScore = (0.5 * 0.6) + (0.0 * 0.4) = 0.3
                // defender = 0.3 * 5.0 = 1.5
                val stats = createStats(
                    totalGames = 10,
                    gamesWon = 5,
                    totalYellowCards = 15,
                    totalRedCards = 5
                )
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(1.5, ratings.defender, 0.001)
            }
        }

        @Nested
        @DisplayName("fromStats - Jogador completo")
        inner class CompletePlayerTests {

            @Test
            @DisplayName("Jogador completo deve ter ratings proporcionais")
            fun `complete player should have proportional ratings`() {
                val stats = createStats(
                    totalGames = 20,
                    totalGoals = 15,   // 0.75 g/j -> 2.5 striker
                    totalAssists = 12, // 0.6 a/j -> 2.5 mid
                    totalSaves = 20,   // 1.0 s/j -> 1.25 gk
                    gamesWon = 10,     // 50% winrate
                    totalYellowCards = 2, // 0.1 c/j
                    totalRedCards = 0
                )
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertEquals(2.5, ratings.striker, 0.001)
                assertEquals(2.5, ratings.mid, 0.001)
                assertEquals(1.25, ratings.gk, 0.001)
                assertEquals(20, ratings.sampleSize)
                assertEquals(1.0, ratings.confidence, 0.001)

                // defender: discipline = (1.0 - (0.1 / 2.0)) = 0.95
                // defenderScore = (0.5 * 0.6) + (0.95 * 0.4) = 0.3 + 0.38 = 0.68
                // defender = 0.68 * 5.0 = 3.4
                assertEquals(3.4, ratings.defender, 0.001)
            }

            @Test
            @DisplayName("Todos ratings devem estar entre 0 e 5")
            fun `all ratings should be between 0 and 5`() {
                val stats = createStats(
                    totalGames = 5,
                    totalGoals = 100,
                    totalAssists = 100,
                    totalSaves = 100,
                    gamesWon = 5,
                    totalYellowCards = 100,
                    totalRedCards = 100
                )
                val ratings = PerformanceRatingCalculator.fromStats(stats)

                assertTrue(ratings.striker in 0.0..5.0)
                assertTrue(ratings.mid in 0.0..5.0)
                assertTrue(ratings.defender in 0.0..5.0)
                assertTrue(ratings.gk in 0.0..5.0)
            }

            @Test
            @DisplayName("Confianca deve estar entre 0 e 1")
            fun `confidence should be between 0 and 1`() {
                val lowConfidence = PerformanceRatingCalculator.fromStats(createStats(totalGames = 5))
                val highConfidence = PerformanceRatingCalculator.fromStats(createStats(totalGames = 50))

                assertTrue(lowConfidence.confidence in 0.0..1.0)
                assertTrue(highConfidence.confidence in 0.0..1.0)
            }
        }
    }
}
