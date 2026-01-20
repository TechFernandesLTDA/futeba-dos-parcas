package com.futebadosparcas.domain.gamification

import com.futebadosparcas.domain.model.Statistics
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

/**
 * Testes unitários para MilestoneChecker.
 * Cobre verificação de milestones, categorias e XP.
 */
@DisplayName("MilestoneChecker Tests")
class MilestoneCheckerTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createStats(
        totalGoals: Int = 0,
        totalAssists: Int = 0,
        totalGames: Int = 0,
        totalWins: Int = 0,
        mvpCount: Int = 0,
        totalSaves: Int = 0,
        bestStreak: Int = 0
    ) = Statistics(
        id = "stats-1",
        userId = "user-1",
        totalGoals = totalGoals,
        totalAssists = totalAssists,
        totalGames = totalGames,
        totalWins = totalWins,
        mvpCount = mvpCount,
        totalSaves = totalSaves,
        bestStreak = bestStreak
    )

    // ==================== TESTES DE allMilestones ====================

    @Nested
    @DisplayName("allMilestones")
    inner class AllMilestonesTests {

        @Test
        @DisplayName("Deve conter milestones de gols")
        fun `should contain goal milestones`() {
            val goalMilestones = MilestoneChecker.allMilestones.filter {
                it.category == MilestoneCategory.GOALS
            }
            assertTrue(goalMilestones.isNotEmpty())
            assertTrue(goalMilestones.any { it.id == "first_goal" })
            assertTrue(goalMilestones.any { it.id == "goals_10" })
            assertTrue(goalMilestones.any { it.id == "goals_50" })
            assertTrue(goalMilestones.any { it.id == "goals_100" })
        }

        @Test
        @DisplayName("Deve conter milestones de assistências")
        fun `should contain assist milestones`() {
            val assistMilestones = MilestoneChecker.allMilestones.filter {
                it.category == MilestoneCategory.ASSISTS
            }
            assertTrue(assistMilestones.isNotEmpty())
            assertTrue(assistMilestones.any { it.id == "first_assist" })
        }

        @Test
        @DisplayName("Deve conter milestones de jogos")
        fun `should contain games milestones`() {
            val gameMilestones = MilestoneChecker.allMilestones.filter {
                it.category == MilestoneCategory.GAMES
            }
            assertTrue(gameMilestones.isNotEmpty())
            assertTrue(gameMilestones.any { it.id == "games_1" })
            assertTrue(gameMilestones.any { it.id == "games_100" })
        }

        @Test
        @DisplayName("Todos os milestones devem ter ID único")
        fun `all milestones should have unique IDs`() {
            val ids = MilestoneChecker.allMilestones.map { it.id }
            assertEquals(ids.size, ids.distinct().size)
        }

        @Test
        @DisplayName("Todos os milestones devem ter XP reward positivo")
        fun `all milestones should have positive xp reward`() {
            MilestoneChecker.allMilestones.forEach { milestone ->
                assertTrue(milestone.xpReward > 0, "Milestone ${milestone.id} deveria ter XP positivo")
            }
        }

        @Test
        @DisplayName("Todos os milestones devem ter emoji")
        fun `all milestones should have emoji`() {
            MilestoneChecker.allMilestones.forEach { milestone ->
                assertTrue(milestone.emoji.isNotEmpty(), "Milestone ${milestone.id} deveria ter emoji")
            }
        }
    }

    // ==================== TESTES DE checkAll ====================

    @Nested
    @DisplayName("checkAll")
    inner class CheckAllTests {

        @Test
        @DisplayName("Stats zeradas não devem desbloquear nenhum milestone")
        fun `zero stats should not unlock any milestone`() {
            val stats = createStats()
            val results = MilestoneChecker.checkAll(stats, emptyList())

            val unlockedCount = results.count { it.unlocked }
            assertEquals(0, unlockedCount)
        }

        @Test
        @DisplayName("1 gol deve desbloquear first_goal")
        fun `1 goal should unlock first_goal`() {
            val stats = createStats(totalGoals = 1)
            val results = MilestoneChecker.checkAll(stats, emptyList())

            val firstGoal = results.find { it.milestone.id == "first_goal" }
            assertNotNull(firstGoal)
            assertTrue(firstGoal!!.unlocked)
            assertTrue(firstGoal.isNewUnlock)
        }

        @Test
        @DisplayName("Milestone já alcançado não deve ser novo")
        fun `already achieved milestone should not be new`() {
            val stats = createStats(totalGoals = 1)
            val results = MilestoneChecker.checkAll(stats, listOf("first_goal"))

            val firstGoal = results.find { it.milestone.id == "first_goal" }
            assertNotNull(firstGoal)
            assertTrue(firstGoal!!.unlocked)
            assertTrue(firstGoal.previouslyUnlocked)
            assertFalse(firstGoal.isNewUnlock)
        }

        @Test
        @DisplayName("10 gols deve desbloquear first_goal e goals_10")
        fun `10 goals should unlock first_goal and goals_10`() {
            val stats = createStats(totalGoals = 10)
            val results = MilestoneChecker.checkAll(stats, emptyList())

            val goalMilestones = results.filter {
                it.milestone.category == MilestoneCategory.GOALS && it.unlocked
            }
            assertTrue(goalMilestones.any { it.milestone.id == "first_goal" })
            assertTrue(goalMilestones.any { it.milestone.id == "goals_10" })
        }

        @Test
        @DisplayName("Retorna resultado para todos os milestones")
        fun `should return result for all milestones`() {
            val stats = createStats()
            val results = MilestoneChecker.checkAll(stats, emptyList())

            assertEquals(MilestoneChecker.allMilestones.size, results.size)
        }
    }

    // ==================== TESTES DE getNewUnlocks ====================

    @Nested
    @DisplayName("getNewUnlocks")
    inner class GetNewUnlocksTests {

        @Test
        @DisplayName("Stats zeradas não devem ter novos unlocks")
        fun `zero stats should have no new unlocks`() {
            val stats = createStats()
            val newUnlocks = MilestoneChecker.getNewUnlocks(stats, emptyList())

            assertTrue(newUnlocks.isEmpty())
        }

        @Test
        @DisplayName("1 gol com lista vazia deve retornar first_goal")
        fun `1 goal with empty list should return first_goal`() {
            val stats = createStats(totalGoals = 1)
            val newUnlocks = MilestoneChecker.getNewUnlocks(stats, emptyList())

            assertEquals(1, newUnlocks.size)
            assertEquals("first_goal", newUnlocks[0].id)
        }

        @Test
        @DisplayName("1 gol com first_goal já alcançado não deve retornar nada")
        fun `1 goal with first_goal already achieved should return nothing`() {
            val stats = createStats(totalGoals = 1)
            val newUnlocks = MilestoneChecker.getNewUnlocks(stats, listOf("first_goal"))

            assertTrue(newUnlocks.isEmpty())
        }

        @Test
        @DisplayName("Múltiplos milestones novos")
        fun `multiple new milestones`() {
            val stats = createStats(
                totalGoals = 1,
                totalAssists = 1,
                totalGames = 1,
                totalWins = 1
            )
            val newUnlocks = MilestoneChecker.getNewUnlocks(stats, emptyList())

            assertTrue(newUnlocks.size >= 4)
            assertTrue(newUnlocks.any { it.id == "first_goal" })
            assertTrue(newUnlocks.any { it.id == "first_assist" })
            assertTrue(newUnlocks.any { it.id == "games_1" })
            assertTrue(newUnlocks.any { it.id == "wins_1" })
        }
    }

    // ==================== TESTES DE calculateNewMilestonesXp ====================

    @Nested
    @DisplayName("calculateNewMilestonesXp")
    inner class CalculateNewMilestonesXpTests {

        @Test
        @DisplayName("Stats zeradas devem retornar 0 XP")
        fun `zero stats should return 0 XP`() {
            val stats = createStats()
            val xp = MilestoneChecker.calculateNewMilestonesXp(stats, emptyList())

            assertEquals(0, xp)
        }

        @Test
        @DisplayName("1 gol deve retornar 50 XP (first_goal)")
        fun `1 goal should return 50 XP`() {
            val stats = createStats(totalGoals = 1)
            val xp = MilestoneChecker.calculateNewMilestonesXp(stats, emptyList())

            assertEquals(50, xp)
        }

        @Test
        @DisplayName("Múltiplos milestones devem somar XP")
        fun `multiple milestones should sum XP`() {
            val stats = createStats(
                totalGoals = 1,  // 50 XP
                totalGames = 1   // 25 XP
            )
            val xp = MilestoneChecker.calculateNewMilestonesXp(stats, emptyList())

            // first_goal (50) + games_1 (25) = 75
            assertEquals(75, xp)
        }

        @Test
        @DisplayName("Milestones já alcançados não devem somar XP")
        fun `already achieved milestones should not add XP`() {
            val stats = createStats(totalGoals = 1, totalGames = 1)
            val xp = MilestoneChecker.calculateNewMilestonesXp(
                stats,
                listOf("first_goal")
            )

            // Apenas games_1 (25) - first_goal já alcançado
            assertEquals(25, xp)
        }

        @Test
        @DisplayName("Jogador completo deve ter XP alto")
        fun `complete player should have high XP`() {
            val stats = createStats(
                totalGoals = 100,
                totalAssists = 50,
                totalGames = 100,
                totalWins = 50,
                mvpCount = 10,
                totalSaves = 50,
                bestStreak = 10
            )
            val xp = MilestoneChecker.calculateNewMilestonesXp(stats, emptyList())

            // Muitos milestones desbloqueados
            assertTrue(xp >= 2000)
        }
    }

    // ==================== TESTES DE getMilestoneById ====================

    @Nested
    @DisplayName("getMilestoneById")
    inner class GetMilestoneByIdTests {

        @Test
        @DisplayName("Deve encontrar first_goal")
        fun `should find first_goal`() {
            val milestone = MilestoneChecker.getMilestoneById("first_goal")

            assertNotNull(milestone)
            assertEquals("first_goal", milestone?.id)
            assertEquals("Primeiro Gol", milestone?.name)
        }

        @Test
        @DisplayName("ID inexistente deve retornar null")
        fun `non-existent ID should return null`() {
            val milestone = MilestoneChecker.getMilestoneById("non_existent")

            assertNull(milestone)
        }

        @Test
        @DisplayName("ID vazio deve retornar null")
        fun `empty ID should return null`() {
            val milestone = MilestoneChecker.getMilestoneById("")

            assertNull(milestone)
        }

        @ParameterizedTest
        @CsvSource(
            "first_goal, GOALS",
            "first_assist, ASSISTS",
            "games_1, GAMES",
            "wins_1, WINS",
            "mvp_1, MVP",
            "saves_10, SAVES",
            "streak_3, STREAK"
        )
        @DisplayName("Cada milestone deve ter a categoria correta")
        fun `each milestone should have correct category`(id: String, expectedCategory: MilestoneCategory) {
            val milestone = MilestoneChecker.getMilestoneById(id)

            assertNotNull(milestone)
            assertEquals(expectedCategory, milestone?.category)
        }
    }

    // ==================== TESTES DE getMilestonesByCategory ====================

    @Nested
    @DisplayName("getMilestonesByCategory")
    inner class GetMilestonesByCategoryTests {

        @Test
        @DisplayName("Categoria GOALS deve ter 4 milestones")
        fun `GOALS category should have 4 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.GOALS)

            assertEquals(4, milestones.size)
        }

        @Test
        @DisplayName("Categoria ASSISTS deve ter 3 milestones")
        fun `ASSISTS category should have 3 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.ASSISTS)

            assertEquals(3, milestones.size)
        }

        @Test
        @DisplayName("Categoria GAMES deve ter 4 milestones")
        fun `GAMES category should have 4 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.GAMES)

            assertEquals(4, milestones.size)
        }

        @Test
        @DisplayName("Categoria WINS deve ter 3 milestones")
        fun `WINS category should have 3 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.WINS)

            assertEquals(3, milestones.size)
        }

        @Test
        @DisplayName("Categoria MVP deve ter 3 milestones")
        fun `MVP category should have 3 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.MVP)

            assertEquals(3, milestones.size)
        }

        @Test
        @DisplayName("Categoria SAVES deve ter 2 milestones")
        fun `SAVES category should have 2 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.SAVES)

            assertEquals(2, milestones.size)
        }

        @Test
        @DisplayName("Categoria STREAK deve ter 3 milestones")
        fun `STREAK category should have 3 milestones`() {
            val milestones = MilestoneChecker.getMilestonesByCategory(MilestoneCategory.STREAK)

            assertEquals(3, milestones.size)
        }

        @Test
        @DisplayName("Todas as categorias devem ter milestones")
        fun `all categories should have milestones`() {
            MilestoneCategory.entries.forEach { category ->
                val milestones = MilestoneChecker.getMilestonesByCategory(category)
                assertTrue(milestones.isNotEmpty(), "Categoria $category deveria ter milestones")
            }
        }
    }

    // ==================== TESTES DE CONDIÇÕES DE MILESTONES ====================

    @Nested
    @DisplayName("Milestone Conditions")
    inner class MilestoneConditionsTests {

        @Test
        @DisplayName("goals_100 requer exatamente 100 gols")
        fun `goals_100 requires exactly 100 goals`() {
            val stats99 = createStats(totalGoals = 99)
            val stats100 = createStats(totalGoals = 100)

            val milestone = MilestoneChecker.getMilestoneById("goals_100")!!

            assertFalse(milestone.checkCondition(stats99))
            assertTrue(milestone.checkCondition(stats100))
        }

        @Test
        @DisplayName("streak_10 requer melhor streak de 10")
        fun `streak_10 requires best streak of 10`() {
            val stats9 = createStats(bestStreak = 9)
            val stats10 = createStats(bestStreak = 10)

            val milestone = MilestoneChecker.getMilestoneById("streak_10")!!

            assertFalse(milestone.checkCondition(stats9))
            assertTrue(milestone.checkCondition(stats10))
        }

        @Test
        @DisplayName("saves_50 requer 50 defesas")
        fun `saves_50 requires 50 saves`() {
            val stats49 = createStats(totalSaves = 49)
            val stats50 = createStats(totalSaves = 50)

            val milestone = MilestoneChecker.getMilestoneById("saves_50")!!

            assertFalse(milestone.checkCondition(stats49))
            assertTrue(milestone.checkCondition(stats50))
        }
    }
}
