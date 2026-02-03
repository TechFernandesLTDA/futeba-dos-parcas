package com.futebadosparcas.domain

import com.futebadosparcas.domain.usecase.CalculateLevelUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertFalse

/**
 * Testes compartilhados para CalculateLevelUseCase.
 * Executam em Android (JVM) e iOS (Native).
 */
class CalculateLevelUseCaseTest {

    private val useCase = CalculateLevelUseCase()

    @Test
    fun nivel1_comZeroXp() {
        assertEquals(1, useCase.calculateLevel(0))
    }

    @Test
    fun nivelAumenta_comMaisXp() {
        val level0 = useCase.calculateLevel(0)
        val level100 = useCase.calculateLevel(100)
        val level1000 = useCase.calculateLevel(1000)
        assertTrue(level0 <= level100)
        assertTrue(level100 <= level1000)
    }

    @Test
    fun progressoEhEntreZeroEUm() {
        val progress = useCase.calculateLevelProgress(50)
        assertTrue(progress in 0.0..1.0)
    }

    @Test
    fun didLevelUp_retornaTrueQuandoSubeDeNivel() {
        val xpForLevel2 = useCase.getXpForLevel(2)
        // Subir de nivel 1 para nivel 2
        assertTrue(useCase.didLevelUp(0, xpForLevel2))
    }

    @Test
    fun didLevelUp_retornaFalseQuandoNaoSobe() {
        // Mesma faixa de XP
        assertFalse(useCase.didLevelUp(0, 1))
    }

    @Test
    fun getLevelGain_calculaCorretamente() {
        val xpForLevel3 = useCase.getXpForLevel(3)
        val gain = useCase.getLevelGain(0, xpForLevel3)
        assertTrue(gain >= 2) // Subiu pelo menos 2 niveis (1 -> 3)
    }

    @Test
    fun getLevelInfo_retornaInformacoesCompletas() {
        val info = useCase.getLevelInfo(500)
        assertTrue(info.currentLevel >= 1)
        assertEquals(500L, info.currentXp)
        assertTrue(info.progressPercentage in 0.0..1.0)
        assertTrue(info.levelTitle.isNotEmpty())
    }

    @Test
    fun getProgressInt_retornaEntreZeroECem() {
        val info = useCase.getLevelInfo(50)
        assertTrue(info.getProgressInt() in 0..100)
    }

    @Test
    fun getAllLevels_retornaListaNaoVazia() {
        val levels = useCase.getAllLevels()
        assertTrue(levels.isNotEmpty())
    }

    @Test
    fun getLevelTitle_retornaStringNaoVazia() {
        val title = useCase.getLevelTitle(1)
        assertTrue(title.isNotEmpty())
    }
}
