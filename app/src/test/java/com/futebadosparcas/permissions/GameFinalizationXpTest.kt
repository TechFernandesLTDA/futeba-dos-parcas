package com.futebadosparcas.permissions

import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.ranking.GameProcessingResult
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.ranking.PlayerGameData
import com.futebadosparcas.domain.ranking.PlayerProcessingResult
import com.futebadosparcas.domain.ranking.XPCalculator
import com.futebadosparcas.domain.usecase.game.FinishGameParams
import com.futebadosparcas.domain.usecase.game.FinishGameUseCase
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * XP quando o jogo é finalizado: só jogo processado concede XP, uma vez (sem dobrar
 * ao reprocessar), e os tetos por jogo (gols, total de performance e bônus de MVP fora do teto).
 */
@ExtendWith(MockLogExtension::class)
class GameFinalizationXpTest {

    private lateinit var matchFinalizationService: MatchFinalizationService
    private lateinit var useCase: FinishGameUseCase

    @BeforeEach
    fun setUp() {
        matchFinalizationService = mockk()
        useCase = FinishGameUseCase(matchFinalizationService)
    }

    @Test
    fun finishGame_processadoComSucesso_devolveXpPorJogador() = runTest {
        coEvery { matchFinalizationService.processGame("game-1") } returns GameProcessingResult(
            gameId = "game-1",
            success = true,
            playersProcessed = listOf(
                PlayerProcessingResult(userId = "a", xpEarned = 60),
                PlayerProcessingResult(userId = "b", xpEarned = 10)
            )
        )

        val resultado = useCase(FinishGameParams("game-1")).getOrThrow()

        assertTrue(resultado.success)
        assertEquals(mapOf("a" to 60L, "b" to 10L), resultado.xpAwarded)
    }

    @Test
    fun finishGame_jogoJaProcessado_nao_concedeXpDeNovo() = runTest {
        // "Jogo ja processado" é tratado como sucesso sem novo XP: não há reprocessamento.
        coEvery { matchFinalizationService.processGame("game-1") } returns GameProcessingResult(
            gameId = "game-1",
            success = false,
            error = "Jogo ja processado"
        )

        val resultado = useCase(FinishGameParams("game-1"))

        assertTrue(resultado.isSuccess)
        assertTrue(resultado.getOrThrow().xpAwarded.isEmpty())
    }

    @Test
    fun finishGame_erroDeProcessamento_falhaEMostraMotivo() = runTest {
        coEvery { matchFinalizationService.processGame("game-1") } returns GameProcessingResult(
            gameId = "game-1",
            success = false,
            error = "Jogo nao esta finalizado"
        )

        val resultado = useCase(FinishGameParams("game-1"))

        assertEquals("Jogo nao esta finalizado", resultado.exceptionOrNull()?.message)
        coVerify(exactly = 1) { matchFinalizationService.processGame("game-1") }
    }

    @Test
    fun xpCalculator_golsAcimaDoTetoDeQuinze_naoAumentaXp() {
        val com15 = XPCalculator.calculate(jogador(goals = 15))
        val com40 = XPCalculator.calculate(jogador(goals = 40))

        assertEquals(com15.totalXp, com40.totalXp)
    }

    @Test
    fun xpCalculator_performanceAcimaDeQuinhentos_respeitaTetoDoJogo() {
        val semMvp = XPCalculator.calculate(jogador(goals = 40, assists = 30, saves = 60))
        val comMvp = XPCalculator.calculate(jogador(goals = 40, assists = 30, saves = 60, isMvp = true))

        assertEquals(500L, semMvp.totalXp)
        assertEquals(550L, comMvp.totalXp)
    }

    private fun jogador(
        goals: Int = 0,
        assists: Int = 0,
        saves: Int = 0,
        isMvp: Boolean = false
    ) = PlayerGameData(
        playerId = "p-1",
        position = PlayerPosition.LINE,
        goals = goals,
        assists = assists,
        saves = saves,
        yellowCards = 0,
        redCards = 0,
        isMvp = isMvp,
        isWorstPlayer = false,
        hasBestGoal = false,
        teamId = "time-a",
        teamWon = false,
        teamDrew = false
    )
}
