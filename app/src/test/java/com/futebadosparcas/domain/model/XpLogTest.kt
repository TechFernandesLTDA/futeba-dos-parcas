package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Testes unitários para XpLog.
 * Cobre logs de XP, level up detection e breakdown.
 */
@DisplayName("XpLog Tests")
class XpLogTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createXpLog(
        xpEarned: Long = 50,
        xpBefore: Long = 100,
        xpAfter: Long = 150,
        levelBefore: Int = 1,
        levelAfter: Int = 1
    ) = XpLog(
        id = "log-1",
        userId = "user-1",
        gameId = "game-1",
        xpEarned = xpEarned,
        xpBefore = xpBefore,
        xpAfter = xpAfter,
        levelBefore = levelBefore,
        levelAfter = levelAfter
    )

    // ==================== TESTES DE didLevelUp ====================

    @Nested
    @DisplayName("didLevelUp")
    inner class DidLevelUpTests {

        @Test
        @DisplayName("Level aumentou deve retornar true")
        fun `level increased should return true`() {
            val log = createXpLog(levelBefore = 1, levelAfter = 2)
            assertTrue(log.didLevelUp())
        }

        @Test
        @DisplayName("Level igual deve retornar false")
        fun `same level should return false`() {
            val log = createXpLog(levelBefore = 1, levelAfter = 1)
            assertFalse(log.didLevelUp())
        }

        @Test
        @DisplayName("Level diminuiu deve retornar false")
        fun `level decreased should return false`() {
            val log = createXpLog(levelBefore = 2, levelAfter = 1)
            assertFalse(log.didLevelUp())
        }

        @Test
        @DisplayName("Pulo de múltiplos níveis deve retornar true")
        fun `multiple level jump should return true`() {
            val log = createXpLog(levelBefore = 1, levelAfter = 5)
            assertTrue(log.didLevelUp())
        }
    }

    // ==================== TESTES DE DATA CLASS ====================

    @Nested
    @DisplayName("Data Class Properties")
    inner class DataClassPropertiesTests {

        @Test
        @DisplayName("Default values devem ser corretos")
        fun `default values should be correct`() {
            val log = XpLog()

            assertEquals("", log.id)
            assertEquals("", log.userId)
            assertEquals("", log.gameId)
            assertEquals(0L, log.xpEarned)
            assertEquals(0L, log.xpBefore)
            assertEquals(0L, log.xpAfter)
            assertEquals(1, log.levelBefore)
            assertEquals(1, log.levelAfter)
            assertEquals(0, log.xpParticipation)
            assertEquals(0, log.xpGoals)
            assertEquals(0, log.xpAssists)
            assertEquals(0, log.xpSaves)
            assertEquals(0, log.xpResult)
            assertEquals(0, log.xpMvp)
            assertEquals(0, log.xpMilestones)
            assertEquals(0, log.xpStreak)
            assertEquals(0, log.goals)
            assertEquals(0, log.assists)
            assertEquals(0, log.saves)
            assertFalse(log.wasMvp)
            assertEquals("", log.gameResult)
            assertTrue(log.milestonesUnlocked.isEmpty())
            assertNull(log.createdAt)
        }

        @Test
        @DisplayName("XP breakdown deve ser calculável")
        fun `xp breakdown should be calculable`() {
            val log = XpLog(
                xpParticipation = 10,
                xpGoals = 20,
                xpAssists = 7,
                xpResult = 20,
                xpMvp = 30,
                xpStreak = 20,
                xpMilestones = 50
            )

            val total = log.xpParticipation + log.xpGoals + log.xpAssists +
                    log.xpResult + log.xpMvp + log.xpStreak + log.xpMilestones

            assertEquals(157, total)
        }

        @Test
        @DisplayName("Copy deve funcionar corretamente")
        fun `copy should work correctly`() {
            val original = createXpLog(xpEarned = 100)
            val copied = original.copy(xpEarned = 200)

            assertEquals(100L, original.xpEarned)
            assertEquals(200L, copied.xpEarned)
        }

        @Test
        @DisplayName("Milestones unlocked devem ser lista imutável")
        fun `milestones unlocked should be immutable list`() {
            val log = XpLog(milestonesUnlocked = listOf("milestone_1", "milestone_2"))

            assertEquals(2, log.milestonesUnlocked.size)
            assertEquals("milestone_1", log.milestonesUnlocked[0])
            assertEquals("milestone_2", log.milestonesUnlocked[1])
        }
    }

    // ==================== TESTES DE CENÁRIOS ====================

    @Nested
    @DisplayName("Scenarios")
    inner class ScenarioTests {

        @Test
        @DisplayName("Jogo típico com MVP e level up")
        fun `typical game with MVP and level up`() {
            val log = XpLog(
                id = "log-1",
                userId = "user-1",
                gameId = "game-1",
                xpEarned = 150,
                xpBefore = 90,
                xpAfter = 240,
                levelBefore = 1,
                levelAfter = 2,
                xpParticipation = 10,
                xpGoals = 30,
                xpAssists = 14,
                xpResult = 20,
                xpMvp = 30,
                xpStreak = 20,
                xpMilestones = 26,
                goals = 3,
                assists = 2,
                wasMvp = true,
                gameResult = "WIN",
                milestonesUnlocked = listOf("first_goal", "hat_trick")
            )

            assertTrue(log.didLevelUp())
            assertTrue(log.wasMvp)
            assertEquals("WIN", log.gameResult)
            assertEquals(2, log.milestonesUnlocked.size)
        }

        @Test
        @DisplayName("Jogo sem pontuação (apenas presença)")
        fun `game with only presence`() {
            val log = XpLog(
                xpEarned = 10,
                xpBefore = 100,
                xpAfter = 110,
                levelBefore = 2,
                levelAfter = 2,
                xpParticipation = 10,
                gameResult = "LOSS"
            )

            assertFalse(log.didLevelUp())
            assertEquals(10L, log.xpEarned)
            assertEquals("LOSS", log.gameResult)
        }
    }
}
