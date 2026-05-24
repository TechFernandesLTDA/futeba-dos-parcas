package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.domain.ranking.GameProcessingResult
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.ranking.PlayerProcessingResult
import com.futebadosparcas.domain.model.GameResult
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@DisplayName("FinishGameUseCase Tests")
@ExtendWith(MockLogExtension::class)
class FinishGameUseCaseTest {

    private lateinit var matchFinalizationService: MatchFinalizationService
    private lateinit var useCase: FinishGameUseCase

    @BeforeEach
    fun setup() {
        matchFinalizationService = mockk(relaxed = true)
        useCase = FinishGameUseCase(matchFinalizationService)
    }

    @Nested
    @DisplayName("execute")
    inner class ExecuteTests {

        @Test
        @DisplayName("Finaliza jogo com sucesso e retorna resultado")
        fun `finishes game successfully and returns result`() = runTest {
            val playerResults = listOf(
                PlayerProcessingResult("user-1", 100L, mapOf("GOAL" to 50, "ASSIST" to 50), 2, true, emptyList(), GameResult.WIN),
                PlayerProcessingResult("user-2", 50L, mapOf("ASSIST" to 50), 1, false, emptyList(), GameResult.WIN)
            )
            val processingResult = GameProcessingResult("game-1", true, playerResults)
            coEvery { matchFinalizationService.processGame("game-1") } returns processingResult

            val result = useCase(FinishGameParams("game-1"))

            assertTrue(result.isSuccess)
            val finishResult = result.getOrNull()
            assertEquals("game-1", finishResult?.gameId)
            assertEquals(2, finishResult?.playersProcessed)
            assertTrue(finishResult?.levelUps?.contains("user-1") == true)
        }

        @Test
        @DisplayName("Processa XP corretamente para cada jogador")
        fun `processes XP correctly for each player`() = runTest {
            val playerResults = listOf(
                PlayerProcessingResult("user-1", 100L, mapOf("GOAL" to 100), 2, true, emptyList(), GameResult.WIN),
                PlayerProcessingResult("user-2", 50L, mapOf("ASSIST" to 50), 1, false, emptyList(), GameResult.WIN)
            )
            val processingResult = GameProcessingResult("game-1", true, playerResults)
            coEvery { matchFinalizationService.processGame("game-1") } returns processingResult

            val result = useCase(FinishGameParams("game-1"))

            assertTrue(result.isSuccess)
            val finishResult = result.getOrNull()
            assertEquals(100L, finishResult?.xpAwarded?.get("user-1"))
            assertEquals(50L, finishResult?.xpAwarded?.get("user-2"))
        }

        @Test
        @DisplayName("Falha do servico propaga erro")
        fun `service failure propagates error`() = runTest {
            val processingResult = GameProcessingResult("game-1", false, emptyList(), "Erro interno")
            coEvery { matchFinalizationService.processGame("game-1") } returns processingResult

            val result = useCase(FinishGameParams("game-1"))

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Erro 'ja processado' nao propaga excecao")
        fun `already processed error does not propagate`() = runTest {
            val processingResult = GameProcessingResult("game-1", false, emptyList(), "Jogo ja processado")
            coEvery { matchFinalizationService.processGame("game-1") } returns processingResult

            val result = useCase(FinishGameParams("game-1"))

            assertTrue(result.isSuccess)
        }

        @Test
        @DisplayName("Jogo sem jogadores retorna zero processados")
        fun `game with no players returns zero processed`() = runTest {
            val processingResult = GameProcessingResult("game-1", true, emptyList())
            coEvery { matchFinalizationService.processGame("game-1") } returns processingResult

            val result = useCase(FinishGameParams("game-1"))

            assertTrue(result.isSuccess)
            assertEquals(0, result.getOrNull()?.playersProcessed)
            assertTrue(result.getOrNull()?.xpAwarded?.isEmpty() == true)
        }
    }
}
