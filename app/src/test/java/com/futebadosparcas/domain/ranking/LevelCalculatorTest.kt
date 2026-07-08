package com.futebadosparcas.domain.ranking

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@DisplayName("LevelCalculator")
class LevelCalculatorTest {

    @ParameterizedTest
    @CsvSource(
        "0, 0",
        "99, 0",
        "100, 1",
        "349, 1",
        "350, 2",
        "849, 2",
        "850, 3",
        "528499, 19",
        "528500, 20",
        "999999, 20"
    )
    fun `xp should return canonical level`(xp: Long, expectedLevel: Int) {
        assertEquals(expectedLevel, LevelCalculator.getLevelFromXp(xp))
    }

    @Test
    fun `negative xp should return level zero`() {
        assertEquals(0, LevelCalculator.getLevelFromXp(-100))
    }

    @Test
    fun `level info should use canonical table`() {
        val level0 = LevelCalculator.getLevelInfo(0)
        assertEquals(0, level0.level)
        assertEquals("Novato", level0.title)
        assertEquals(0L, level0.xpRequired)
        assertEquals(100L, level0.xpForNextLevel)

        val level20 = LevelCalculator.getLevelInfo(20)
        assertEquals(20, level20.level)
        assertEquals(528500L, level20.xpRequired)
        assertEquals(0L, level20.xpForNextLevel)
    }

    @Test
    fun `progress and next xp should respect current level window`() {
        assertEquals(0f, LevelCalculator.getProgressToNextLevel(0))
        assertEquals(0.5f, LevelCalculator.getProgressToNextLevel(50))
        assertEquals(1f, LevelCalculator.getProgressToNextLevel(528500))

        assertEquals(100L, LevelCalculator.getXpForNextLevel(0))
        assertEquals(50L, LevelCalculator.getXpForNextLevel(50))
        assertEquals(0L, LevelCalculator.getXpForNextLevel(528500))
    }

    @Test
    fun `didLevelUp should detect only real level changes`() {
        assertTrue(LevelCalculator.didLevelUp(99, 100))
        assertFalse(LevelCalculator.didLevelUp(0, 50))
        assertFalse(LevelCalculator.didLevelUp(100, 100))
    }

    @Test
    fun `all levels should expose zero through twenty`() {
        val levels = LevelCalculator.getAllLevels()
        assertEquals(21, levels.size)
        assertEquals(0, levels.first().level)
        assertEquals(20, levels.last().level)
    }
}
