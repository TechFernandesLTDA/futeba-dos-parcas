package com.futebadosparcas.domain.ranking

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LevelCalculatorTest {

    @Test
    fun getLevelFromXp_usaTabelaCanonicaComNivelZero() {
        assertEquals(0, LevelCalculator.getLevelFromXp(0L))
        assertEquals(0, LevelCalculator.getLevelFromXp(99L))
        assertEquals(1, LevelCalculator.getLevelFromXp(100L))
        assertEquals(2, LevelCalculator.getLevelFromXp(350L))
        assertEquals(20, LevelCalculator.getLevelFromXp(528500L))
        assertEquals(20, LevelCalculator.getLevelFromXp(999999L))
    }

    @Test
    fun getLevelInfo_retornaJanelaDeXpDaTabelaCanonica() {
        val level0 = LevelCalculator.getLevelInfo(0)
        assertEquals(0, level0.level)
        assertEquals("Novato", level0.title)
        assertEquals(0L, level0.xpRequired)
        assertEquals(100L, level0.xpForNextLevel)

        val maxLevel = LevelCalculator.getLevelInfo(20)
        assertEquals(20, maxLevel.level)
        assertEquals(528500L, maxLevel.xpRequired)
        assertEquals(0L, maxLevel.xpForNextLevel)
    }

    @Test
    fun progressoENextXp_respeitamNivelAtual() {
        assertEquals(0f, LevelCalculator.getProgressToNextLevel(0L))
        assertEquals(0.5f, LevelCalculator.getProgressToNextLevel(50L))
        assertEquals(1f, LevelCalculator.getProgressToNextLevel(528500L))

        assertEquals(100L, LevelCalculator.getXpForNextLevel(0L))
        assertEquals(50L, LevelCalculator.getXpForNextLevel(50L))
        assertEquals(0L, LevelCalculator.getXpForNextLevel(528500L))
    }

    @Test
    fun didLevelUp_detectaMudancaRealDeNivel() {
        assertTrue(LevelCalculator.didLevelUp(99L, 100L))
        assertFalse(LevelCalculator.didLevelUp(0L, 50L))
        assertFalse(LevelCalculator.didLevelUp(100L, 100L))
    }
}
