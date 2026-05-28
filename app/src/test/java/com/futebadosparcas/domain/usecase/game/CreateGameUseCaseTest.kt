package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@DisplayName("CreateGameUseCase Tests")
@ExtendWith(MockLogExtension::class)
class CreateGameUseCaseTest {

    private lateinit var gameRepository: GameRepository
    private lateinit var useCase: CreateGameUseCase

    private val validParams = CreateGameParams(
        date = "2026-06-15",
        time = "20:00",
        ownerId = "user-1",
        ownerName = "Joao",
        maxPlayers = 14,
        locationId = "loc-1",
        locationName = "Quadra do Parque",
        dailyPrice = 200.0
    )

    @BeforeEach
    fun setup() {
        gameRepository = mockk(relaxed = true)
        useCase = CreateGameUseCase(gameRepository)
    }

    @Nested
    @DisplayName("execute")
    inner class ExecuteTests {

        @Test
        @DisplayName("Cria jogo com parametros validos")
        fun `creates game with valid params`() = runTest {
            val expectedGame = Game(
                date = "2026-06-15", time = "20:00", status = "SCHEDULED",
                ownerId = "user-1", ownerName = "Joao", maxPlayers = 14,
                locationId = "loc-1", locationName = "Quadra do Parque",
                dailyPrice = 200.0
            )
            coEvery { gameRepository.createGame(any()) } returns Result.success(expectedGame)

            val result = useCase(validParams)

            assertTrue(result.isSuccess)
            val game = result.getOrNull()
            assertNotNull(game)
            assertEquals("2026-06-15", game?.date)
            assertEquals("SCHEDULED", game?.status)
        }

        @Test
        @DisplayName("Owner ID em branco retorna falha")
        fun `blank owner id returns failure`() = runTest {
            val params = validParams.copy(ownerId = "")

            val result = useCase(params)

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Owner name em branco retorna falha")
        fun `blank owner name returns failure`() = runTest {
            val params = validParams.copy(ownerName = "")

            val result = useCase(params)

            assertTrue(result.isFailure)
        }

        @ParameterizedTest
        @CsvSource("0", "1", "101", "200")
        @DisplayName("Numero de jogadores invalido retorna falha")
        fun `invalid player count returns failure`(maxPlayers: Int) = runTest {
            val params = validParams.copy(maxPlayers = maxPlayers)

            val result = useCase(params)

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Preco negativo retorna falha")
        fun `negative price returns failure`() = runTest {
            val params = validParams.copy(dailyPrice = -10.0)

            val result = useCase(params)

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Erro do repositorio propaga falha")
        fun `repository error propagates failure`() = runTest {
            coEvery { gameRepository.createGame(any()) } returns Result.failure(RuntimeException("Erro ao salvar"))

            val result = useCase(validParams)

            assertTrue(result.isFailure)
            assertEquals("Erro ao salvar", result.exceptionOrNull()?.message)
        }
    }
}
