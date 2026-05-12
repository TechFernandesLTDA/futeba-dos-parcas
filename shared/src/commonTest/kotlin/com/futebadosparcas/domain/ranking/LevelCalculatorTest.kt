package com.futebadosparcas.domain.ranking

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Testes compartilhados para LevelCalculator — tabela de niveis de gamificacao.
 * Executam em Android (JVM) e iOS (Native).
 */
class LevelCalculatorTest {

    // ---- getLevelFromXp ----

    @Test
    fun getLevelFromXp_xpZero_retornaLevel1() {
        assertEquals(1, LevelCalculator.getLevelFromXp(0L))
    }

    @Test
    fun getLevelFromXp_xp99_retornaLevel1() {
        // Nivel 2 comeca em 100 XP; 99 ainda e nivel 1
        assertEquals(1, LevelCalculator.getLevelFromXp(99L))
    }

    @Test
    fun getLevelFromXp_xp100_retornaLevel2() {
        assertEquals(2, LevelCalculator.getLevelFromXp(100L))
    }

    @Test
    fun getLevelFromXp_xp350_retornaLevel3() {
        assertEquals(3, LevelCalculator.getLevelFromXp(350L))
    }

    @Test
    fun getLevelFromXp_xp750_retornaLevel4() {
        assertEquals(4, LevelCalculator.getLevelFromXp(750L))
    }

    @Test
    fun getLevelFromXp_xpMaximo_retornaLevel10() {
        // 8800 XP ou mais -> nivel 10 (Imortal)
        assertEquals(10, LevelCalculator.getLevelFromXp(8800L))
        assertEquals(10, LevelCalculator.getLevelFromXp(99999L))
    }

    // ---- getLevelInfo ----

    @Test
    fun getLevelInfo_level1_titulo_eIniciante() {
        val info = LevelCalculator.getLevelInfo(1)
        assertEquals("Iniciante", info.title)
    }

    @Test
    fun getLevelInfo_level10_titulo_eImortal() {
        val info = LevelCalculator.getLevelInfo(10)
        assertEquals("Imortal", info.title)
    }

    @Test
    fun getLevelInfo_level1_xpRequired_eZero() {
        val info = LevelCalculator.getLevelInfo(1)
        assertEquals(0L, info.xpRequired)
    }

    @Test
    fun getLevelInfo_level1_xpForNextLevel_e100() {
        val info = LevelCalculator.getLevelInfo(1)
        assertEquals(100L, info.xpForNextLevel)
    }

    // ---- getProgressToNextLevel ----

    @Test
    fun getProgressToNextLevel_xpZero_retorna0() {
        val progress = LevelCalculator.getProgressToNextLevel(0L)
        assertEquals(0f, progress)
    }

    @Test
    fun getProgressToNextLevel_xp50_retornaMeioCaminho() {
        // Nivel 1: 0 -> 100 XP. Em 50 XP, progresso = 50%
        val progress = LevelCalculator.getProgressToNextLevel(50L)
        assertEquals(0.5f, progress)
    }

    @Test
    fun getProgressToNextLevel_nivelMaximo_retorna1() {
        // Nivel 10 = maximo; progresso e 100%
        val progress = LevelCalculator.getProgressToNextLevel(8800L)
        assertEquals(1f, progress)
    }

    @Test
    fun getProgressToNextLevel_sempreEntre0e1() {
        // Propriedade invariante: progresso sempre entre 0 e 1
        val values = listOf(0L, 50L, 100L, 500L, 1000L, 5000L, 9000L)
        for (xp in values) {
            val p = LevelCalculator.getProgressToNextLevel(xp)
            assertTrue(p in 0f..1f, "Progresso fora do intervalo para XP=$xp: $p")
        }
    }

    // ---- getLevelInfoFromXp ----

    @Test
    fun getLevelInfoFromXp_xp100_retornaInfoLevel2() {
        val info = LevelCalculator.getLevelInfoFromXp(100L)
        assertEquals(2, info.level)
    }

    @Test
    fun getLevelInfoFromXp_xp0_retornaInfoLevel1() {
        val info = LevelCalculator.getLevelInfoFromXp(0L)
        assertEquals(1, info.level)
    }
}
