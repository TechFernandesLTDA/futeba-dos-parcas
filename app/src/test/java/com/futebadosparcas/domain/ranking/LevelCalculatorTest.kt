package com.futebadosparcas.domain.ranking

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitários para LevelCalculator.
 * Cobre cálculos de nível, progresso e títulos.
 */
@DisplayName("LevelCalculator Tests")
class LevelCalculatorTest {

    // ==================== TESTES DE getLevelFromXp ====================

    @Nested
    @DisplayName("getLevelFromXp")
    inner class GetLevelFromXpTests {

        @ParameterizedTest
        @CsvSource(
            "0, 1",
            "99, 1",
            "100, 2",
            "349, 2",
            "350, 3",
            "749, 3",
            "750, 4",
            "1349, 4",
            "1350, 5",
            "2199, 5",
            "2200, 6",
            "3299, 6",
            "3300, 7",
            "4699, 7",
            "4700, 8",
            "6499, 8",
            "6500, 9",
            "8799, 9",
            "8800, 10",
            "10000, 10",
            "50000, 10"
        )
        @DisplayName("XP deve retornar nível correto")
        fun `xp should return correct level`(xp: Long, expectedLevel: Int) {
            val level = LevelCalculator.getLevelFromXp(xp)
            assertEquals(expectedLevel, level)
        }

        @Test
        @DisplayName("XP negativo deve retornar nível 1")
        fun `negative xp should return level 1`() {
            assertEquals(1, LevelCalculator.getLevelFromXp(-100))
        }
    }

    // ==================== TESTES DE getLevelInfo ====================

    @Nested
    @DisplayName("getLevelInfo")
    inner class GetLevelInfoTests {

        @Test
        @DisplayName("Nível 1 deve retornar informações corretas")
        fun `level 1 should return correct info`() {
            val info = LevelCalculator.getLevelInfo(1)

            assertEquals(1, info.level)
            assertEquals("Iniciante", info.title)
            assertEquals(0L, info.xpRequired)
            assertEquals(100L, info.xpForNextLevel)
        }

        @Test
        @DisplayName("Nível 5 deve retornar informações corretas")
        fun `level 5 should return correct info`() {
            val info = LevelCalculator.getLevelInfo(5)

            assertEquals(5, info.level)
            assertEquals("Experiente", info.title)
            assertEquals(1350L, info.xpRequired)
            assertEquals(850L, info.xpForNextLevel)
        }

        @Test
        @DisplayName("Nível 10 (máximo) deve retornar XP para próximo nível como 0")
        fun `level 10 should have 0 xp for next level`() {
            val info = LevelCalculator.getLevelInfo(10)

            assertEquals(10, info.level)
            assertEquals("Imortal", info.title)
            assertEquals(8800L, info.xpRequired)
            assertEquals(0L, info.xpForNextLevel)
        }

        @Test
        @DisplayName("Nível inválido deve retornar nível 1")
        fun `invalid level should return level 1`() {
            val info = LevelCalculator.getLevelInfo(0)
            assertEquals(1, info.level)
            assertEquals("Iniciante", info.title)
        }

        @Test
        @DisplayName("Nível acima de 10 deve retornar nível 1")
        fun `level above 10 should return level 1`() {
            val info = LevelCalculator.getLevelInfo(15)
            assertEquals(1, info.level)
        }
    }

    // ==================== TESTES DE getLevelInfoFromXp ====================

    @Nested
    @DisplayName("getLevelInfoFromXp")
    inner class GetLevelInfoFromXpTests {

        @Test
        @DisplayName("XP 0 deve retornar info do nível 1")
        fun `xp 0 should return level 1 info`() {
            val info = LevelCalculator.getLevelInfoFromXp(0)
            assertEquals(1, info.level)
            assertEquals("Iniciante", info.title)
        }

        @Test
        @DisplayName("XP 1500 deve retornar info do nível 5")
        fun `xp 1500 should return level 5 info`() {
            val info = LevelCalculator.getLevelInfoFromXp(1500)
            assertEquals(5, info.level)
            assertEquals("Experiente", info.title)
        }

        @Test
        @DisplayName("XP 9000 deve retornar info do nível 10")
        fun `xp 9000 should return level 10 info`() {
            val info = LevelCalculator.getLevelInfoFromXp(9000)
            assertEquals(10, info.level)
            assertEquals("Imortal", info.title)
        }
    }

    // ==================== TESTES DE getProgressToNextLevel ====================

    @Nested
    @DisplayName("getProgressToNextLevel")
    inner class GetProgressToNextLevelTests {

        @Test
        @DisplayName("XP 0 deve ter 0% de progresso")
        fun `xp 0 should have 0 percent progress`() {
            val progress = LevelCalculator.getProgressToNextLevel(0)
            assertEquals(0f, progress, 0.001f)
        }

        @Test
        @DisplayName("XP 50 deve ter 50% de progresso para nível 2")
        fun `xp 50 should have 50 percent progress to level 2`() {
            // Nível 1: 0-100 XP, próximo nível em 100
            // 50 XP = 50% de 100
            val progress = LevelCalculator.getProgressToNextLevel(50)
            assertEquals(0.5f, progress, 0.001f)
        }

        @Test
        @DisplayName("XP 99 deve ter quase 100% de progresso")
        fun `xp 99 should have almost 100 percent progress`() {
            val progress = LevelCalculator.getProgressToNextLevel(99)
            assertEquals(0.99f, progress, 0.001f)
        }

        @Test
        @DisplayName("XP no nível máximo deve ter 100% de progresso")
        fun `xp at max level should have 100 percent progress`() {
            val progress = LevelCalculator.getProgressToNextLevel(8800)
            assertEquals(1f, progress, 0.001f)
        }

        @Test
        @DisplayName("XP acima do máximo deve manter 100% de progresso")
        fun `xp above max should maintain 100 percent progress`() {
            val progress = LevelCalculator.getProgressToNextLevel(50000)
            assertEquals(1f, progress, 0.001f)
        }

        @Test
        @DisplayName("Progresso no meio do nível 5")
        fun `progress in middle of level 5`() {
            // Nível 5: 1350-2200 (850 XP range)
            // XP 1775 = 425 de 850 = ~50%
            val progress = LevelCalculator.getProgressToNextLevel(1775)
            assertEquals(0.5f, progress, 0.001f)
        }
    }

    // ==================== TESTES DE getXpForNextLevel ====================

    @Nested
    @DisplayName("getXpForNextLevel")
    inner class GetXpForNextLevelTests {

        @Test
        @DisplayName("XP 0 deve precisar de 100 para próximo nível")
        fun `xp 0 should need 100 for next level`() {
            val xpNeeded = LevelCalculator.getXpForNextLevel(0)
            assertEquals(100L, xpNeeded)
        }

        @Test
        @DisplayName("XP 50 deve precisar de 50 para próximo nível")
        fun `xp 50 should need 50 for next level`() {
            val xpNeeded = LevelCalculator.getXpForNextLevel(50)
            assertEquals(50L, xpNeeded)
        }

        @Test
        @DisplayName("XP 100 (nível 2) deve precisar de 250 para nível 3")
        fun `xp 100 should need 250 for level 3`() {
            val xpNeeded = LevelCalculator.getXpForNextLevel(100)
            assertEquals(250L, xpNeeded)
        }

        @Test
        @DisplayName("XP no nível máximo deve retornar 0")
        fun `xp at max level should return 0`() {
            val xpNeeded = LevelCalculator.getXpForNextLevel(8800)
            assertEquals(0L, xpNeeded)
        }

        @Test
        @DisplayName("XP acima do máximo deve retornar 0")
        fun `xp above max should return 0`() {
            val xpNeeded = LevelCalculator.getXpForNextLevel(50000)
            assertEquals(0L, xpNeeded)
        }
    }

    // ==================== TESTES DE didLevelUp ====================

    @Nested
    @DisplayName("didLevelUp")
    inner class DidLevelUpTests {

        @Test
        @DisplayName("XP aumentando de 99 para 100 deve indicar level up")
        fun `xp from 99 to 100 should indicate level up`() {
            assertTrue(LevelCalculator.didLevelUp(99, 100))
        }

        @Test
        @DisplayName("XP aumentando de 0 para 50 não deve indicar level up")
        fun `xp from 0 to 50 should not indicate level up`() {
            assertFalse(LevelCalculator.didLevelUp(0, 50))
        }

        @Test
        @DisplayName("XP aumentando de 0 para 350 deve indicar level up")
        fun `xp from 0 to 350 should indicate level up`() {
            // Pula do nível 1 para o nível 3
            assertTrue(LevelCalculator.didLevelUp(0, 350))
        }

        @Test
        @DisplayName("XP diminuindo não deve indicar level up")
        fun `decreasing xp should not indicate level up`() {
            assertFalse(LevelCalculator.didLevelUp(500, 100))
        }

        @Test
        @DisplayName("XP igual não deve indicar level up")
        fun `same xp should not indicate level up`() {
            assertFalse(LevelCalculator.didLevelUp(100, 100))
        }

        @Test
        @DisplayName("Subir para nível 10 deve indicar level up")
        fun `reaching level 10 should indicate level up`() {
            assertTrue(LevelCalculator.didLevelUp(8799, 8800))
        }
    }

    // ==================== TESTES DE getLevelTitle ====================

    @Nested
    @DisplayName("getLevelTitle")
    inner class GetLevelTitleTests {

        @ParameterizedTest
        @CsvSource(
            "1, Iniciante",
            "2, Amador",
            "3, Promissor",
            "4, Habilidoso",
            "5, Experiente",
            "6, Veterano",
            "7, Elite",
            "8, Craque",
            "9, Lenda",
            "10, Imortal"
        )
        @DisplayName("Nível deve ter título correto")
        fun `level should have correct title`(level: Int, expectedTitle: String) {
            val title = LevelCalculator.getLevelTitle(level)
            assertEquals(expectedTitle, title)
        }
    }

    // ==================== TESTES DE getAllLevels ====================

    @Nested
    @DisplayName("getAllLevels")
    inner class GetAllLevelsTests {

        @Test
        @DisplayName("Deve retornar exatamente 10 níveis")
        fun `should return exactly 10 levels`() {
            val levels = LevelCalculator.getAllLevels()
            assertEquals(10, levels.size)
        }

        @Test
        @DisplayName("Níveis devem estar ordenados por level")
        fun `levels should be sorted by level`() {
            val levels = LevelCalculator.getAllLevels()
            for (i in 0 until levels.size - 1) {
                assertTrue(levels[i].level < levels[i + 1].level)
            }
        }

        @Test
        @DisplayName("XP necessário deve ser crescente")
        fun `xp required should be increasing`() {
            val levels = LevelCalculator.getAllLevels()
            for (i in 0 until levels.size - 1) {
                assertTrue(levels[i].xpRequired < levels[i + 1].xpRequired)
            }
        }

        @Test
        @DisplayName("Primeiro nível deve ser 1 e último 10")
        fun `first level should be 1 and last 10`() {
            val levels = LevelCalculator.getAllLevels()
            assertEquals(1, levels.first().level)
            assertEquals(10, levels.last().level)
        }
    }
}
