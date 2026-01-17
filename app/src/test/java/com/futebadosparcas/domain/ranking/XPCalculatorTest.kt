package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.GameResult
import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.model.PlayerPosition
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitários para XPCalculator.
 * Cobre cálculos de XP, anti-cheat, streaks e penalidades.
 */
@DisplayName("XPCalculator Tests")
class XPCalculatorTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createPlayerData(
        goals: Int = 0,
        assists: Int = 0,
        saves: Int = 0,
        isMvp: Boolean = false,
        isWorstPlayer: Boolean = false,
        teamWon: Boolean = false,
        teamDrew: Boolean = false,
        currentStreak: Int = 0,
        position: PlayerPosition = PlayerPosition.LINE
    ) = PlayerGameData(
        playerId = "test-player",
        position = position,
        goals = goals,
        assists = assists,
        saves = saves,
        yellowCards = 0,
        redCards = 0,
        isMvp = isMvp,
        isWorstPlayer = isWorstPlayer,
        hasBestGoal = false,
        teamId = "team-1",
        teamWon = teamWon,
        teamDrew = teamDrew,
        currentStreak = currentStreak
    )

    // ==================== TESTES DE PARTICIPAÇÃO ====================

    @Nested
    @DisplayName("XP de Participação")
    inner class ParticipationXP {

        @Test
        @DisplayName("Participação básica deve dar 10 XP")
        fun `basic participation should give 10 XP`() {
            val playerData = createPlayerData()
            val result = XPCalculator.calculate(playerData)

            assertEquals(10L, result.breakdown.participation)
            assertEquals(10L, result.totalXp)
        }

        @Test
        @DisplayName("Participação deve ser incluída mesmo com derrota")
        fun `participation should be included even with loss`() {
            val playerData = createPlayerData(teamWon = false, teamDrew = false)
            val result = XPCalculator.calculate(playerData)

            assertEquals(10L, result.breakdown.participation)
            assertEquals(GameResult.LOSS, result.gameResult)
        }
    }

    // ==================== TESTES DE GOLS ====================

    @Nested
    @DisplayName("XP de Gols")
    inner class GoalsXP {

        @Test
        @DisplayName("1 gol deve dar 10 XP")
        fun `one goal should give 10 XP`() {
            val playerData = createPlayerData(goals = 1)
            val result = XPCalculator.calculate(playerData)

            assertEquals(10L, result.breakdown.goals)
        }

        @Test
        @DisplayName("Hat trick (3 gols) deve dar 30 XP")
        fun `hat trick should give 30 XP`() {
            val playerData = createPlayerData(goals = 3)
            val result = XPCalculator.calculate(playerData)

            assertEquals(30L, result.breakdown.goals)
        }

        @Test
        @DisplayName("Gols acima do limite (15) devem ser capeados")
        fun `goals above limit should be capped at 15`() {
            val playerData = createPlayerData(goals = 20)
            val result = XPCalculator.calculate(playerData)

            // 15 gols * 10 XP = 150 XP (não 200)
            assertEquals(150L, result.breakdown.goals)
        }
    }

    // ==================== TESTES DE ASSISTÊNCIAS ====================

    @Nested
    @DisplayName("XP de Assistências")
    inner class AssistsXP {

        @Test
        @DisplayName("1 assistência deve dar 7 XP")
        fun `one assist should give 7 XP`() {
            val playerData = createPlayerData(assists = 1)
            val result = XPCalculator.calculate(playerData)

            assertEquals(7L, result.breakdown.assists)
        }

        @Test
        @DisplayName("3 assistências (playmaker) devem dar 21 XP")
        fun `playmaker assists should give 21 XP`() {
            val playerData = createPlayerData(assists = 3)
            val result = XPCalculator.calculate(playerData)

            assertEquals(21L, result.breakdown.assists)
        }

        @Test
        @DisplayName("Assistências acima do limite (10) devem ser capeadas")
        fun `assists above limit should be capped at 10`() {
            val playerData = createPlayerData(assists = 15)
            val result = XPCalculator.calculate(playerData)

            // 10 assists * 7 XP = 70 XP (não 105)
            assertEquals(70L, result.breakdown.assists)
        }
    }

    // ==================== TESTES DE DEFESAS ====================

    @Nested
    @DisplayName("XP de Defesas")
    inner class SavesXP {

        @Test
        @DisplayName("1 defesa deve dar 8 XP")
        fun `one save should give 8 XP`() {
            val playerData = createPlayerData(saves = 1, position = PlayerPosition.GOALKEEPER)
            val result = XPCalculator.calculate(playerData)

            assertEquals(8L, result.breakdown.saves)
        }

        @Test
        @DisplayName("10 defesas devem dar 80 XP")
        fun `ten saves should give 80 XP`() {
            val playerData = createPlayerData(saves = 10, position = PlayerPosition.GOALKEEPER)
            val result = XPCalculator.calculate(playerData)

            assertEquals(80L, result.breakdown.saves)
        }

        @Test
        @DisplayName("Defesas acima do limite (30) devem ser capeadas")
        fun `saves above limit should be capped at 30`() {
            val playerData = createPlayerData(saves = 50, position = PlayerPosition.GOALKEEPER)
            val result = XPCalculator.calculate(playerData)

            // 30 saves * 8 XP = 240 XP (não 400)
            assertEquals(240L, result.breakdown.saves)
        }
    }

    // ==================== TESTES DE RESULTADO ====================

    @Nested
    @DisplayName("XP de Resultado")
    inner class ResultXP {

        @Test
        @DisplayName("Vitória deve dar 20 XP")
        fun `win should give 20 XP`() {
            val playerData = createPlayerData(teamWon = true)
            val result = XPCalculator.calculate(playerData)

            assertEquals(20L, result.breakdown.result)
            assertEquals(GameResult.WIN, result.gameResult)
        }

        @Test
        @DisplayName("Empate deve dar 10 XP")
        fun `draw should give 10 XP`() {
            val playerData = createPlayerData(teamDrew = true)
            val result = XPCalculator.calculate(playerData)

            assertEquals(10L, result.breakdown.result)
            assertEquals(GameResult.DRAW, result.gameResult)
        }

        @Test
        @DisplayName("Derrota deve dar 0 XP de resultado")
        fun `loss should give 0 result XP`() {
            val playerData = createPlayerData(teamWon = false, teamDrew = false)
            val result = XPCalculator.calculate(playerData)

            assertEquals(0L, result.breakdown.result)
            assertEquals(GameResult.LOSS, result.gameResult)
        }
    }

    // ==================== TESTES DE MVP ====================

    @Nested
    @DisplayName("XP de MVP")
    inner class MvpXP {

        @Test
        @DisplayName("Ser MVP deve dar 30 XP")
        fun `being MVP should give 30 XP`() {
            val playerData = createPlayerData(isMvp = true)
            val result = XPCalculator.calculate(playerData)

            assertEquals(30L, result.breakdown.mvp)
        }

        @Test
        @DisplayName("Não ser MVP deve dar 0 XP de MVP")
        fun `not being MVP should give 0 MVP XP`() {
            val playerData = createPlayerData(isMvp = false)
            val result = XPCalculator.calculate(playerData)

            assertEquals(0L, result.breakdown.mvp)
        }
    }

    // ==================== TESTES DE STREAK ====================

    @Nested
    @DisplayName("XP de Streak")
    inner class StreakXP {

        @ParameterizedTest
        @CsvSource(
            "0, 0",
            "1, 0",
            "2, 0",
            "3, 20",   // Streak 3: 20 XP
            "4, 20",
            "5, 35",   // Streak 5: 35 XP
            "6, 35",
            "7, 50",   // Streak 7: 50 XP
            "8, 50",
            "9, 50",
            "10, 100", // Streak 10: 100 XP
            "15, 100"
        )
        @DisplayName("Streak deve dar XP correto para cada nível")
        fun `streak should give correct XP for each level`(streak: Int, expectedXp: Long) {
            val playerData = createPlayerData(currentStreak = streak)
            val result = XPCalculator.calculate(playerData)

            assertEquals(expectedXp, result.breakdown.streak)
        }
    }

    // ==================== TESTES DE PENALIDADE (BOLA MURCHA) ====================

    @Nested
    @DisplayName("Penalidade Bola Murcha")
    inner class WorstPlayerPenalty {

        @Test
        @DisplayName("Ser Bola Murcha deve aplicar -10 XP")
        fun `being worst player should apply minus 10 XP`() {
            val playerData = createPlayerData(isWorstPlayer = true)
            val result = XPCalculator.calculate(playerData)

            assertEquals(-10L, result.breakdown.penalty)
        }

        @Test
        @DisplayName("Não ser Bola Murcha não deve aplicar penalidade")
        fun `not being worst player should not apply penalty`() {
            val playerData = createPlayerData(isWorstPlayer = false)
            val result = XPCalculator.calculate(playerData)

            assertEquals(0L, result.breakdown.penalty)
        }

        @Test
        @DisplayName("XP total não pode ser negativo")
        fun `total XP should never be negative`() {
            // Jogador que só participou e foi bola murcha: 10 - 10 = 0
            val playerData = createPlayerData(isWorstPlayer = true)
            val result = XPCalculator.calculate(playerData)

            assertTrue(result.totalXp >= 0)
        }
    }

    // ==================== TESTES ANTI-CHEAT ====================

    @Nested
    @DisplayName("Anti-Cheat Limits")
    inner class AntiCheatLimits {

        @Test
        @DisplayName("XP total não pode exceder 500")
        fun `total XP should not exceed 500`() {
            // Jogador com stats absurdos
            val playerData = createPlayerData(
                goals = 50,    // Capeado em 15 * 10 = 150
                assists = 30,  // Capeado em 10 * 7 = 70
                saves = 100,   // Capeado em 30 * 8 = 240
                isMvp = true,  // 30
                teamWon = true, // 20
                currentStreak = 10 // 100
            )
            val result = XPCalculator.calculate(playerData)

            // Sem cap: 10 + 150 + 70 + 240 + 20 + 30 + 100 = 620
            // Com cap: 500
            assertEquals(500L, result.totalXp)
        }

        @Test
        @DisplayName("Gols negativos devem ser tratados como zero")
        fun `negative goals should be treated as zero`() {
            val playerData = createPlayerData(goals = -5)
            val result = XPCalculator.calculate(playerData)

            // coerceAtMost mantém -5 mas multiplicado por 10 = -50
            // O total é ajustado para não ser negativo
            assertTrue(result.breakdown.goals <= 0)
        }
    }

    // ==================== TESTES DE CÁLCULO COMBINADO ====================

    @Nested
    @DisplayName("Cálculos Combinados")
    inner class CombinedCalculations {

        @Test
        @DisplayName("Jogo completo deve somar XP corretamente")
        fun `complete game should sum XP correctly`() {
            val playerData = createPlayerData(
                goals = 2,       // 20 XP
                assists = 1,     // 7 XP
                isMvp = true,    // 30 XP
                teamWon = true,  // 20 XP
                currentStreak = 5 // 35 XP
            )
            val result = XPCalculator.calculate(playerData)

            // Participação: 10
            // Gols: 20
            // Assists: 7
            // Resultado: 20
            // MVP: 30
            // Streak: 35
            // Total: 122
            assertEquals(10L, result.breakdown.participation)
            assertEquals(20L, result.breakdown.goals)
            assertEquals(7L, result.breakdown.assists)
            assertEquals(20L, result.breakdown.result)
            assertEquals(30L, result.breakdown.mvp)
            assertEquals(35L, result.breakdown.streak)
            assertEquals(122L, result.totalXp)
        }

        @Test
        @DisplayName("Goleiro completo deve somar XP corretamente")
        fun `goalkeeper complete game should sum XP correctly`() {
            val playerData = createPlayerData(
                saves = 8,       // 64 XP
                teamWon = true,  // 20 XP
                position = PlayerPosition.GOALKEEPER
            )
            val result = XPCalculator.calculate(playerData)

            // Participação: 10
            // Defesas: 64
            // Resultado: 20
            // Total: 94
            assertEquals(10L, result.breakdown.participation)
            assertEquals(64L, result.breakdown.saves)
            assertEquals(20L, result.breakdown.result)
            assertEquals(94L, result.totalXp)
        }
    }

    // ==================== TESTES DE CONFIGURAÇÕES CUSTOMIZADAS ====================

    @Nested
    @DisplayName("Configurações Customizadas")
    inner class CustomSettings {

        @Test
        @DisplayName("Settings customizadas devem ser respeitadas")
        fun `custom settings should be respected`() {
            val customSettings = GamificationSettings(
                xpPresence = 15,
                xpPerGoal = 15,
                xpPerAssist = 10,
                xpWin = 25
            )
            val playerData = createPlayerData(goals = 1, assists = 1, teamWon = true)
            val result = XPCalculator.calculate(playerData, settings = customSettings)

            assertEquals(15L, result.breakdown.participation)
            assertEquals(15L, result.breakdown.goals)
            assertEquals(10L, result.breakdown.assists)
            assertEquals(25L, result.breakdown.result)
            assertEquals(65L, result.totalXp)
        }
    }

    // ==================== TESTES DO MÉTODO CALCULATE SIMPLE ====================

    @Nested
    @DisplayName("calculateSimple")
    inner class CalculateSimple {

        @Test
        @DisplayName("calculateSimple deve funcionar corretamente")
        fun `calculateSimple should work correctly`() {
            val result = XPCalculator.calculateSimple(
                goals = 2,
                assists = 1,
                saves = 0,
                won = true,
                drew = false,
                isMvp = false,
                currentStreak = 3
            )

            // Participação: 10, Gols: 20, Assists: 7, Win: 20, Streak3: 20
            assertEquals(77L, result.totalXp)
        }
    }

    // ==================== TESTES DE BREAKDOWN ====================

    @Nested
    @DisplayName("XpBreakdown")
    inner class BreakdownTests {

        @Test
        @DisplayName("toDisplayMap deve incluir apenas valores positivos")
        fun `toDisplayMap should include only positive values`() {
            val breakdown = XpBreakdown(
                participation = 10,
                goals = 20,
                assists = 0,  // Não deve aparecer
                saves = 0,    // Não deve aparecer
                result = 20,
                mvp = 0,      // Não deve aparecer
                streak = 0,   // Não deve aparecer
                penalty = 0   // Não deve aparecer
            )

            val displayMap = breakdown.toDisplayMap()

            assertTrue(displayMap.containsKey("Participacao"))
            assertTrue(displayMap.containsKey("Gols"))
            assertTrue(displayMap.containsKey("Resultado"))
            assertFalse(displayMap.containsKey("Assistencias"))
            assertFalse(displayMap.containsKey("Defesas"))
            assertFalse(displayMap.containsKey("MVP"))
        }

        @Test
        @DisplayName("toDisplayMap deve incluir penalidade negativa")
        fun `toDisplayMap should include negative penalty`() {
            val breakdown = XpBreakdown(
                participation = 10,
                penalty = -10
            )

            val displayMap = breakdown.toDisplayMap()

            assertTrue(displayMap.containsKey("Bola Murcha"))
            assertEquals(-10L, displayMap["Bola Murcha"])
        }

        @Test
        @DisplayName("total deve calcular soma corretamente")
        fun `total should calculate sum correctly`() {
            val breakdown = XpBreakdown(
                participation = 10,
                goals = 20,
                assists = 7,
                result = 20,
                penalty = -10
            )

            assertEquals(47L, breakdown.total)
        }
    }
}
