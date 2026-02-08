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
 * Testes unitarios para CreateGameUseCase.
 * Verifica validacoes de parametros, criacao do jogo e propagacao de erros.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("CreateGameUseCase Tests")
@ExtendWith(MockLogExtension::class)
class CreateGameUseCaseTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var useCase: CreateGameUseCase

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk()
        useCase = CreateGameUseCase(gameRepository)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ========== Criacao com Sucesso ==========

    @Test
    @DisplayName("Deve criar jogo com parametros validos")
    fun invoke_validParams_createsGameSuccessfully() = runTest {
        // Given
        val params = createValidParams()
        val createdGame = Game(
            id = "game-new",
            date = params.date,
            time = params.time,
            status = GameStatus.SCHEDULED.name,
            maxPlayers = params.maxPlayers,
            ownerId = params.ownerId,
            ownerName = params.ownerName
        )
        coEvery { gameRepository.createGame(any()) } returns Result.success(createdGame)

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isSuccess)
        assertEquals("game-new", result.getOrNull()?.id)
        coVerify(exactly = 1) { gameRepository.createGame(any()) }
    }

    @Test
    @DisplayName("Deve passar o jogo com status SCHEDULED para o repositorio")
    fun invoke_validParams_setsStatusScheduled() = runTest {
        // Given
        val params = createValidParams()
        val gameSlot = slot<Game>()
        coEvery { gameRepository.createGame(capture(gameSlot)) } returns
            Result.success(Game(id = "g1", status = GameStatus.SCHEDULED.name))

        // When
        useCase(params)

        // Then
        assertEquals(GameStatus.SCHEDULED.name, gameSlot.captured.status)
    }

    @Test
    @DisplayName("Deve passar campos opcionais corretamente")
    fun invoke_withOptionalFields_passesFieldsCorrectly() = runTest {
        // Given
        val params = CreateGameParams(
            date = "2026-03-01",
            time = "20:00",
            endTime = "22:00",
            ownerId = "owner1",
            ownerName = "Joao",
            maxPlayers = 20,
            maxGoalkeepers = 4,
            locationId = "loc1",
            locationName = "Arena Fut",
            locationAddress = "Rua X, 123",
            gameType = "Futsal",
            dailyPrice = 25.0,
            isPublic = false,
            groupId = "grp1",
            groupName = "Os Amigos"
        )
        val gameSlot = slot<Game>()
        coEvery { gameRepository.createGame(capture(gameSlot)) } returns
            Result.success(Game(id = "g1"))

        // When
        useCase(params)

        // Then
        val game = gameSlot.captured
        assertEquals("22:00", game.endTime)
        assertEquals(20, game.maxPlayers)
        assertEquals("loc1", game.locationId)
        assertEquals("Arena Fut", game.locationName)
        assertEquals("Futsal", game.gameType)
        assertEquals(25.0, game.dailyPrice)
        assertFalse(game.isPublic)
        assertEquals("grp1", game.groupId)
        assertEquals("Os Amigos", game.groupName)
    }

    // ========== Validacoes ==========

    @Test
    @DisplayName("Deve falhar quando numero de jogadores e menor que 2")
    fun invoke_playerCountBelowMinimum_fails() = runTest {
        // Given
        val params = createValidParams(maxPlayers = 1)

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("jogadores") == true ||
                   result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    @DisplayName("Deve falhar quando numero de jogadores excede 100")
    fun invoke_playerCountAboveMaximum_fails() = runTest {
        // Given
        val params = createValidParams(maxPlayers = 101)

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando preco e negativo")
    fun invoke_negativePrice_fails() = runTest {
        // Given
        val params = createValidParams(dailyPrice = -10.0)

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando preco excede limite")
    fun invoke_priceAboveLimit_fails() = runTest {
        // Given
        val params = createValidParams(dailyPrice = 15000.0)

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando ownerId esta vazio")
    fun invoke_emptyOwnerId_fails() = runTest {
        // Given
        val params = createValidParams(ownerId = "")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando ownerId esta em branco")
    fun invoke_blankOwnerId_fails() = runTest {
        // Given
        val params = createValidParams(ownerId = "   ")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando ownerName esta vazio")
    fun invoke_emptyOwnerName_fails() = runTest {
        // Given
        val params = createValidParams(ownerName = "")

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve aceitar preco null sem erro")
    fun invoke_nullPrice_succeeds() = runTest {
        // Given
        val params = createValidParams(dailyPrice = null)
        coEvery { gameRepository.createGame(any()) } returns Result.success(Game(id = "g1"))

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isSuccess)
    }

    @Test
    @DisplayName("Deve aceitar preco zero sem erro")
    fun invoke_zeroPrice_succeeds() = runTest {
        // Given
        val params = createValidParams(dailyPrice = 0.0)
        coEvery { gameRepository.createGame(any()) } returns Result.success(Game(id = "g1"))

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isSuccess)
    }

    // ========== Falha do Repositorio ==========

    @Test
    @DisplayName("Deve propagar falha do repositorio")
    fun invoke_repositoryFailure_propagatesError() = runTest {
        // Given
        val params = createValidParams()
        coEvery { gameRepository.createGame(any()) } returns
            Result.failure(Exception("Firestore quota exceeded"))

        // When
        val result = useCase(params)

        // Then
        assertTrue(result.isFailure)
    }

    // ========== Helpers ==========

    private fun createValidParams(
        maxPlayers: Int = 14,
        dailyPrice: Double? = 50.0,
        ownerId: String = "owner1",
        ownerName: String = "Joao Silva"
    ) = CreateGameParams(
        date = "2026-03-01",
        time = "20:00",
        ownerId = ownerId,
        ownerName = ownerName,
        maxPlayers = maxPlayers,
        dailyPrice = dailyPrice,
        locationName = "Arena Teste"
    )
}
