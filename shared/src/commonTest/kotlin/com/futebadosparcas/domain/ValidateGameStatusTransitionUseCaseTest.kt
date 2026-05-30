package com.futebadosparcas.domain

import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.usecase.ValidateGameStatusTransitionUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para ValidateGameStatusTransitionUseCase.
 * Logica pura — executam em Android (JVM) e iOS (Native).
 *
 * Cobre o fluxo de estados do jogo:
 * SCHEDULED -> CONFIRMED -> LIVE -> FINISHED, com CANCELLED a partir de qualquer ativo.
 */
class ValidateGameStatusTransitionUseCaseTest {

    private val useCase = ValidateGameStatusTransitionUseCase

    @Test
    fun invoke_scheduledParaConfirmed_permitido() {
        assertTrue(useCase(GameStatus.SCHEDULED, GameStatus.CONFIRMED))
    }

    @Test
    fun invoke_confirmedParaLive_permitido() {
        assertTrue(useCase(GameStatus.CONFIRMED, GameStatus.LIVE))
    }

    @Test
    fun invoke_liveParaFinished_permitido() {
        assertTrue(useCase(GameStatus.LIVE, GameStatus.FINISHED))
    }

    @Test
    fun invoke_scheduledParaLive_bloqueado() {
        // Nao pode pular CONFIRMED.
        assertFalse(useCase(GameStatus.SCHEDULED, GameStatus.LIVE))
    }

    @Test
    fun invoke_scheduledParaFinished_bloqueado() {
        assertFalse(useCase(GameStatus.SCHEDULED, GameStatus.FINISHED))
    }

    @Test
    fun invoke_finishedParaQualquer_bloqueado() {
        // FINISHED e estado final.
        assertFalse(useCase(GameStatus.FINISHED, GameStatus.SCHEDULED))
        assertFalse(useCase(GameStatus.FINISHED, GameStatus.LIVE))
        assertFalse(useCase(GameStatus.FINISHED, GameStatus.CANCELLED))
    }

    @Test
    fun invoke_mesmoStatus_bloqueado() {
        // Transicao para o mesmo status nao e valida.
        assertFalse(useCase(GameStatus.LIVE, GameStatus.LIVE))
    }

    @Test
    fun canCancel_estadosAtivos_permitido() {
        assertTrue(useCase.canCancel(GameStatus.SCHEDULED))
        assertTrue(useCase.canCancel(GameStatus.CONFIRMED))
        assertTrue(useCase.canCancel(GameStatus.LIVE))
    }

    @Test
    fun canCancel_finished_bloqueado() {
        assertFalse(useCase.canCancel(GameStatus.FINISHED))
    }

    @Test
    fun canFinish_apenasDeLive() {
        assertTrue(useCase.canFinish(GameStatus.LIVE))
        assertFalse(useCase.canFinish(GameStatus.SCHEDULED))
        assertFalse(useCase.canFinish(GameStatus.CONFIRMED))
    }

    @Test
    fun canModifyPlayerList_apenasScheduledEConfirmed() {
        assertTrue(useCase.canModifyPlayerList(GameStatus.SCHEDULED))
        assertTrue(useCase.canModifyPlayerList(GameStatus.CONFIRMED))
        assertFalse(useCase.canModifyPlayerList(GameStatus.LIVE))
        assertFalse(useCase.canModifyPlayerList(GameStatus.FINISHED))
    }

    @Test
    fun isActive_finishedECancelled_inativos() {
        assertFalse(useCase.isActive(GameStatus.FINISHED))
        assertFalse(useCase.isActive(GameStatus.CANCELLED))
        assertTrue(useCase.isActive(GameStatus.SCHEDULED))
        assertTrue(useCase.isActive(GameStatus.LIVE))
    }

    @Test
    fun getAvailableTransitions_finished_vazio() {
        assertTrue(useCase.getAvailableTransitions(GameStatus.FINISHED).isEmpty())
    }

    @Test
    fun getAvailableTransitions_cancelled_apenasScheduled() {
        // Cancelado so pode ser reativado para SCHEDULED.
        assertEquals(setOf(GameStatus.SCHEDULED), useCase.getAvailableTransitions(GameStatus.CANCELLED))
    }
}
