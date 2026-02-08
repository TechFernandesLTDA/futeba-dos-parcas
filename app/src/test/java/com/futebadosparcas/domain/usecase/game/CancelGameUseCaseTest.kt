package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para CancelGameUseCase.
 * Verifica validacoes de permissao, status e cancelamento de jogos.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("CancelGameUseCase Tests")
@ExtendWith(MockLogExtension::class)
class CancelGameUseCaseTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var useCase: CancelGameUseCase

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk()
        useCase = CancelGameUseCase(gameRepository)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ========== Cancelamento com Sucesso ==========

    @Test
    @DisplayName("Deve cancelar jogo SCHEDULED com sucesso")
    fun invoke_scheduledGame_cancelsSuccessfully() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.SCHEDULED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)
        coEvery { gameRepository.updateGame(any()) } returns Result.success(Unit)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { gameRepository.updateGame(any()) }
    }

    @Test
    @DisplayName("Deve cancelar jogo CONFIRMED com sucesso")
    fun invoke_confirmedGame_cancelsSuccessfully() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.CONFIRMED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)
        coEvery { gameRepository.updateGame(any()) } returns Result.success(Unit)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isSuccess)
    }

    @Test
    @DisplayName("Deve atualizar status para CANCELLED")
    fun invoke_validGame_setsStatusCancelled() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.SCHEDULED)
        val gameSlot = slot<Game>()
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)
        coEvery { gameRepository.updateGame(capture(gameSlot)) } returns Result.success(Unit)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        useCase(params)

        // Then
        assertEquals(GameStatus.CANCELLED.name, gameSlot.captured.status)
    }

    // ========== Validacao de Parametros ==========

    @Test
    @DisplayName("Deve falhar quando gameId esta vazio")
    fun invoke_emptyGameId_fails() = runTest {
        // Given
        val params = CancelGameParams(gameId = "", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("jogo") == true ||
                   result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    @DisplayName("Deve falhar quando gameId esta em branco")
    fun invoke_blankGameId_fails() = runTest {
        // Given
        val params = CancelGameParams(gameId = "   ", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando cancelledById esta vazio")
    fun invoke_emptyCancelledById_fails() = runTest {
        // Given
        val params = CancelGameParams(gameId = "game1", cancelledById = "")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    // ========== Validacao de Permissao ==========

    @Test
    @DisplayName("Deve falhar quando usuario nao e o dono do jogo")
    fun invoke_notOwner_failsWithPermissionError() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.SCHEDULED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)

        val params = CancelGameParams(gameId = "game1", cancelledById = "other-user")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("dono") == true)
    }

    // ========== Validacao de Status ==========

    @Test
    @DisplayName("Deve falhar ao cancelar jogo LIVE")
    fun invoke_liveGame_failsWithStatusError() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.LIVE)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("SCHEDULED") == true ||
                   result.exceptionOrNull()?.message?.contains("CONFIRMED") == true)
    }

    @Test
    @DisplayName("Deve falhar ao cancelar jogo FINISHED")
    fun invoke_finishedGame_failsWithStatusError() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.FINISHED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar ao cancelar jogo ja CANCELLED")
    fun invoke_alreadyCancelled_failsWithStatusError() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.CANCELLED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    // ========== Falha do Repositorio ==========

    @Test
    @DisplayName("Deve falhar quando getGameDetails retorna erro")
    fun invoke_getGameDetailsFails_propagatesError() = runTest {
        // Given
        coEvery { gameRepository.getGameDetails("game1") } returns
            Result.failure(Exception("Game not found"))

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando updateGame retorna erro")
    fun invoke_updateGameFails_propagatesError() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.SCHEDULED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)
        coEvery { gameRepository.updateGame(any()) } returns
            Result.failure(Exception("Permission denied"))

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    // ========== Edge Cases ==========

    @Test
    @DisplayName("Deve lidar com status invalido graciosamente")
    fun invoke_invalidStatus_treatsAsScheduled() = runTest {
        // Given - Jogo com status invalido (default sera SCHEDULED)
        val game = Game(
            id = "game1",
            ownerId = "owner1",
            ownerName = "Owner",
            status = "INVALID_STATUS"
        )
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)
        coEvery { gameRepository.updateGame(any()) } returns Result.success(Unit)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1")

        // When
        val result = useCase(params)

        // Then - Status invalido e tratado como SCHEDULED (permitido cancelar)
        assertTrue(result.isSuccess)
    }

    @Test
    @DisplayName("Deve funcionar com motivo de cancelamento null")
    fun invoke_nullReason_succeedsNormally() = runTest {
        // Given
        val game = createGame("game1", "owner1", GameStatus.SCHEDULED)
        coEvery { gameRepository.getGameDetails("game1") } returns Result.success(game)
        coEvery { gameRepository.updateGame(any()) } returns Result.success(Unit)

        val params = CancelGameParams(gameId = "game1", cancelledById = "owner1", reason = null)

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isSuccess)
    }

    // ========== Helpers ==========

    private fun createGame(
        id: String,
        ownerId: String,
        status: GameStatus
    ) = Game(
        id = id,
        ownerId = ownerId,
        ownerName = "Owner Name",
        status = status.name,
        date = "2026-03-01",
        time = "20:00",
        maxPlayers = 14
    )
}
