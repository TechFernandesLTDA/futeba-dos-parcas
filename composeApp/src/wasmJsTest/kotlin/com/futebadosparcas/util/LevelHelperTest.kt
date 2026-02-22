package com.futebadosparcas.util

import com.futebadosparcas.domain.model.LevelTable
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LevelHelperTest {

    @Test
    fun `getLevelFromXP returns 0 for zero XP`() {
        assertEquals(0, WebLevelHelper.getLevelFromXP(0L))
    }

    @Test
    fun `getLevelFromXP returns 1 for 100 XP`() {
        assertEquals(1, WebLevelHelper.getLevelFromXP(100L))
    }

    @Test
    fun `getLevelFromXP returns 1 for 150 XP`() {
        assertEquals(1, WebLevelHelper.getLevelFromXP(150L))
    }

    @Test
    fun `getLevelFromXP returns 0 for 50 XP`() {
        assertEquals(0, WebLevelHelper.getLevelFromXP(50L))
    }

    @Test
    fun `getLevelFromXP returns 2 for 350 XP`() {
        assertEquals(2, WebLevelHelper.getLevelFromXP(350L))
    }

    @Test
    fun `getLevelFromXP returns 5 for 3850 XP`() {
        assertEquals(5, WebLevelHelper.getLevelFromXP(3850L))
    }

    @Test
    fun `getLevelFromXP returns 10 for 52850 XP`() {
        assertEquals(10, WebLevelHelper.getLevelFromXP(52850L))
    }

    @Test
    fun `getLevelFromXP returns 20 for 528500 XP`() {
        assertEquals(20, WebLevelHelper.getLevelFromXP(528500L))
    }

    @Test
    fun `getLevelFromXP returns max level for very high XP`() {
        assertEquals(20, WebLevelHelper.getLevelFromXP(1000000L))
    }

    @Test
    fun `getXPForLevel returns 0 for level 0`() {
        assertEquals(0L, WebLevelHelper.getXPForLevel(0))
    }

    @Test
    fun `getXPForLevel returns 100 for level 1`() {
        assertEquals(100L, WebLevelHelper.getXPForLevel(1))
    }

    @Test
    fun `getXPForLevel returns 350 for level 2`() {
        assertEquals(350L, WebLevelHelper.getXPForLevel(2))
    }

    @Test
    fun `getXPForLevel returns 52850 for level 10`() {
        assertEquals(52850L, WebLevelHelper.getXPForLevel(10))
    }

    @Test
    fun `getXPForLevel returns 528500 for level 20`() {
        assertEquals(528500L, WebLevelHelper.getXPForLevel(20))
    }

    @Test
    fun `getXPForLevel returns 0 for non-existent level`() {
        assertEquals(0L, WebLevelHelper.getXPForLevel(99))
    }

    @Test
    fun `getLevelTitle returns correct name for level 0`() {
        assertEquals("Novato", WebLevelHelper.getLevelTitle(0))
    }

    @Test
    fun `getLevelTitle returns correct name for level 1`() {
        assertEquals("Iniciante", WebLevelHelper.getLevelTitle(1))
    }

    @Test
    fun `getLevelTitle returns correct name for level 5`() {
        assertEquals("Habilidoso", WebLevelHelper.getLevelTitle(5))
    }

    @Test
    fun `getLevelTitle returns correct name for level 10`() {
        assertEquals("Imortal", WebLevelHelper.getLevelTitle(10))
    }

    @Test
    fun `getLevelTitle returns correct name for level 20`() {
        assertEquals("Pelé", WebLevelHelper.getLevelTitle(20))
    }

    @Test
    fun `getLevelPhrase returns non-empty for level 0`() {
        assertTrue(WebLevelHelper.getLevelPhrase(0).isNotEmpty())
    }

    @Test
    fun `getLevelPhrase returns correct phrase for level 1`() {
        assertEquals("O começo da sua lendária caminhada no futebol.", WebLevelHelper.getLevelPhrase(1))
    }

    @Test
    fun `getProgressPercentage returns 0 for zero XP`() {
        assertEquals(0, WebLevelHelper.getProgressPercentage(0L))
    }

    @Test
    fun `getProgressPercentage returns 50 for middle of level 1`() {
        val level1Start = WebLevelHelper.getXPForLevel(1)
        val level2Start = WebLevelHelper.getXPForLevel(2)
        val midPoint = level1Start + (level2Start - level1Start) / 2
        assertEquals(50, WebLevelHelper.getProgressPercentage(midPoint))
    }

    @Test
    fun `getProgressPercentage returns 100 for max level XP`() {
        assertEquals(100, WebLevelHelper.getProgressPercentage(528500L))
    }

    @Test
    fun `isMaxLevel returns false for level 0`() {
        assertFalse(WebLevelHelper.isMaxLevel(0))
    }

    @Test
    fun `isMaxLevel returns false for level 10`() {
        assertFalse(WebLevelHelper.isMaxLevel(10))
    }

    @Test
    fun `isMaxLevel returns true for level 20`() {
        assertTrue(WebLevelHelper.isMaxLevel(20))
    }

    @Test
    fun `isMaxLevel returns true for level above max`() {
        assertTrue(WebLevelHelper.isMaxLevel(99))
    }

    @Test
    fun `getMaxLevel returns 20`() {
        assertEquals(20, WebLevelHelper.getMaxLevel())
    }

    @Test
    fun `getLevelEmoji returns seedling for level below 5`() {
        assertEquals("🌱", WebLevelHelper.getLevelEmoji(0))
        assertEquals("🌱", WebLevelHelper.getLevelEmoji(4))
    }

    @Test
    fun `getLevelEmoji returns sparkles for level 5-9`() {
        assertEquals("✨", WebLevelHelper.getLevelEmoji(5))
        assertEquals("✨", WebLevelHelper.getLevelEmoji(9))
    }

    @Test
    fun `getLevelEmoji returns star for level 10-19`() {
        assertEquals("🌟", WebLevelHelper.getLevelEmoji(10))
        assertEquals("🌟", WebLevelHelper.getLevelEmoji(19))
    }

    @Test
    fun `getLevelEmoji returns dizzy for level 20-29`() {
        assertEquals("💫", WebLevelHelper.getLevelEmoji(20))
        assertEquals("💫", WebLevelHelper.getLevelEmoji(29))
    }

    @Test
    fun `getLevelEmoji returns star2 for level 30-39`() {
        assertEquals("⭐", WebLevelHelper.getLevelEmoji(30))
        assertEquals("⭐", WebLevelHelper.getLevelEmoji(39))
    }

    @Test
    fun `getLevelEmoji returns trophy for level 40-49`() {
        assertEquals("🏆", WebLevelHelper.getLevelEmoji(40))
        assertEquals("🏆", WebLevelHelper.getLevelEmoji(49))
    }

    @Test
    fun `getLevelEmoji returns crown for level 50+`() {
        assertEquals("👑", WebLevelHelper.getLevelEmoji(50))
        assertEquals("👑", WebLevelHelper.getLevelEmoji(100))
    }

    @Test
    fun `getLevelColorHex returns blue for level below 10`() {
        assertEquals("#1976D2", WebLevelHelper.getLevelColorHex(0))
        assertEquals("#1976D2", WebLevelHelper.getLevelColorHex(9))
    }

    @Test
    fun `getLevelColorHex returns green for level 10-19`() {
        assertEquals("#4CAF50", WebLevelHelper.getLevelColorHex(10))
        assertEquals("#4CAF50", WebLevelHelper.getLevelColorHex(19))
    }

    @Test
    fun `getLevelColorHex returns lightBlue for level 20-29`() {
        assertEquals("#2196F3", WebLevelHelper.getLevelColorHex(20))
        assertEquals("#2196F3", WebLevelHelper.getLevelColorHex(29))
    }

    @Test
    fun `getLevelColorHex returns purple for level 30-49`() {
        assertEquals("#9C27B0", WebLevelHelper.getLevelColorHex(30))
        assertEquals("#9C27B0", WebLevelHelper.getLevelColorHex(49))
    }

    @Test
    fun `getLevelColorHex returns gold for level 50+`() {
        assertEquals("#FFD700", WebLevelHelper.getLevelColorHex(50))
        assertEquals("#FFD700", WebLevelHelper.getLevelColorHex(100))
    }

    @Test
    fun `getProgressInCurrentLevel returns correct values for level 0`() {
        val (progress, needed) = WebLevelHelper.getProgressInCurrentLevel(50L)
        assertEquals(50L, progress)
        assertEquals(100L, needed)
    }

    @Test
    fun `getProgressInCurrentLevel returns correct values for level 1 start`() {
        val (progress, needed) = WebLevelHelper.getProgressInCurrentLevel(100L)
        assertEquals(0L, progress)
        assertEquals(250L, needed)
    }

    @Test
    fun `getProgressInCurrentLevel returns correct values for mid level 1`() {
        val (progress, needed) = WebLevelHelper.getProgressInCurrentLevel(225L)
        assertEquals(125L, progress)
        assertEquals(250L, needed)
    }

    @Test
    fun `LevelTable integration - consistent results between WebLevelHelper and LevelTable`() {
        for (xp in listOf(0L, 100L, 350L, 1000L, 5000L, 50000L, 100000L, 500000L)) {
            assertEquals(
                LevelTable.getLevelForXp(xp),
                WebLevelHelper.getLevelFromXP(xp),
                "Mismatch at XP=$xp"
            )
        }
    }
}
