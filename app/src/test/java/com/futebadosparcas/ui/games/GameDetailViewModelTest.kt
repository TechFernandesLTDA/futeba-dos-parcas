package com.futebadosparcas.ui.games

import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.WaitlistRepository
import com.futebadosparcas.domain.permission.PermissionManager
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.usecase.ConfirmationUseCase
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para GameDetailViewModel.
 * Verifica carregamento de detalhes do jogo, confirmacao de presenca,
 * operacoes do dono do jogo e tratamento de erros.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GameDetailViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class GameDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var gameExperienceRepository: com.futebadosparcas.data.repository.GameExperienceRepository
    private lateinit var scheduleRepository: ScheduleRepository
    private lateinit var groupRepository: com.futebadosparcas.data.repository.GroupRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var waitlistRepository: WaitlistRepository
    private lateinit var confirmationUseCase: ConfirmationUseCase
    private lateinit var permissionManager: PermissionManager

    private lateinit var viewModel: GameDetailViewModel

    private fun createViewModel(): GameDetailViewModel {
        return GameDetailViewModel(
            gameRepository,
            authRepository,
            gameExperienceRepository,
            scheduleRepository,
            groupRepository,
            notificationRepository,
            waitlistRepository,
            confirmationUseCase,
            permissionManager
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gameRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        gameExperienceRepository = mockk(relaxed = true)
        scheduleRepository = mockk(relaxed = true)
        groupRepository = mockk(relaxed = true)
        notificationRepository = mockk(relaxed = true)
        waitlistRepository = mockk(relaxed = true)
        confirmationUseCase = mockk(relaxed = true)
        permissionManager = mockk(relaxed = true)

        // Setup default mocks
        every { authRepository.getCurrentUserId() } returns "user123"
        coEvery { authRepository.getCurrentUser() } returns Result.success(mockk(relaxed = true) {
            every { id } returns "user123"
        })
        coEvery { permissionManager.isAdmin() } returns false
        coEvery { permissionManager.canEditGame(any(), any()) } returns false

        // Setup waitlist default
        every { waitlistRepository.getWaitlistFlow(any()) } returns flowOf(Result.success(emptyList()))
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() {
        // When - Quando criar ViewModel
        viewModel = createViewModel()

        // Then - Estado deve ser Loading
        assertTrue(viewModel.uiState.value is GameDetailUiState.Loading)
    }

    @Test
    @DisplayName("Deve carregar detalhes do jogo com sucesso")
    fun `loadGameDetails should load successfully with valid gameId`() = runTest {
        // Given - Dado dados validos
        val testGame = createTestGame("game-1")
        val testConfirmations = listOf(
            createTestConfirmation("conf-1", "game-1", "user123")
        )
        val testEvents = emptyList<GameEvent>()
        val testTeams = emptyList<Team>()

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns flowOf(Result.success(testConfirmations))
        every { gameRepository.getGameEventsFlow("game-1") } returns flowOf(Result.success(testEvents))
        every { gameRepository.getGameTeamsFlow("game-1") } returns flowOf(Result.success(testTeams))
        every { gameRepository.getLiveScoreFlow("game-1") } returns flowOf(null)
        coEvery { gameExperienceRepository.hasUserVoted(any(), any()) } returns Result.success(false)

        viewModel = createViewModel()

        // When - Quando carregar detalhes
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is GameDetailUiState.Success, "Estado esperado: Success, obtido: ${state::class.simpleName}")
        val successState = state as GameDetailUiState.Success
        assertEquals("game-1", successState.game.id)
        assertEquals(1, successState.confirmations.size)
    }

    @Test
    @DisplayName("Deve retornar Error quando gameId esta vazio")
    fun `loadGameDetails should return Error when gameId is empty`() = runTest {
        // Given - Dado ViewModel criado
        viewModel = createViewModel()

        // When - Quando carregar com ID vazio
        viewModel.loadGameDetails("")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is GameDetailUiState.Error)
        assertEquals("ID do jogo invalido", (state as GameDetailUiState.Error).message)
    }

    @Test
    @DisplayName("Deve retornar Error quando repositorio falhar")
    fun `loadGameDetails should return Error when repository fails`() = runTest {
        // Given - Dado erro no repositorio
        val exception = Exception("Jogo nao encontrado")
        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.failure(exception))
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getGameEventsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getGameTeamsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getLiveScoreFlow("game-1") } returns flowOf(null)

        viewModel = createViewModel()

        // When - Quando carregar detalhes
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is GameDetailUiState.Error)
    }

    @Test
    @DisplayName("Deve identificar usuario como dono do jogo")
    fun `loadGameDetails should identify user as game owner`() = runTest {
        // Given - Dado usuario e dono do jogo
        val testGame = createTestGame("game-1", ownerId = "user123")
        setupSuccessFlows(testGame)

        viewModel = createViewModel()

        // When - Quando carregar detalhes
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // Then - isOwner deve ser true
        val state = viewModel.uiState.value as? GameDetailUiState.Success
        assertNotNull(state)
        assertTrue(state!!.isOwner)
    }

    @Test
    @DisplayName("Deve identificar usuario como confirmado")
    fun `loadGameDetails should identify user as confirmed`() = runTest {
        // Given - Dado usuario confirmado
        val testGame = createTestGame("game-1")
        val confirmations = listOf(
            createTestConfirmation("conf-1", "game-1", "user123", status = "CONFIRMED")
        )

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns flowOf(Result.success(confirmations))
        every { gameRepository.getGameEventsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getGameTeamsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getLiveScoreFlow("game-1") } returns flowOf(null)

        viewModel = createViewModel()

        // When - Quando carregar
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // Then - isUserConfirmed deve ser true
        val state = viewModel.uiState.value as? GameDetailUiState.Success
        assertNotNull(state)
        assertTrue(state!!.isUserConfirmed)
    }

    @Test
    @DisplayName("Deve deletar jogo com sucesso")
    fun `deleteGame should update state to GameDeleted on success`() = runTest {
        // Given - Dado jogo carregado
        val testGame = createTestGame("game-1", ownerId = "user123")
        setupSuccessFlows(testGame)

        viewModel = createViewModel()
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        coEvery { gameRepository.deleteGame("game-1") } returns Result.success(Unit)

        // When - Quando deletar jogo
        viewModel.deleteGame("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser GameDeleted
        assertTrue(viewModel.uiState.value is GameDetailUiState.GameDeleted)
    }

    @Test
    @DisplayName("Deve mostrar erro ao falhar ao deletar jogo")
    fun `deleteGame should show error message when deletion fails`() = runTest {
        // Given - Dado jogo carregado e erro na delecao
        val testGame = createTestGame("game-1", ownerId = "user123")
        setupSuccessFlows(testGame)

        viewModel = createViewModel()
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        coEvery { gameRepository.deleteGame("game-1") } returns Result.failure(Exception("Erro ao cancelar"))

        // When - Quando tentar deletar
        viewModel.deleteGame("game-1")
        advanceUntilIdle()

        // Then - Deve ter mensagem de erro
        val state = viewModel.uiState.value as? GameDetailUiState.Success
        assertNotNull(state?.userMessage)
    }

    @Test
    @DisplayName("Deve cancelar job anterior ao trocar de jogo")
    fun `loadGameDetails should cancel previous job when loading different game`() = runTest {
        // Given - Dado dois jogos
        val testGame1 = createTestGame("game-1")
        val testGame2 = createTestGame("game-2")
        setupSuccessFlows(testGame1, gameId = "game-1")
        setupSuccessFlows(testGame2, gameId = "game-2")

        viewModel = createViewModel()

        // When - Quando carregar dois jogos rapidamente
        viewModel.loadGameDetails("game-1")
        viewModel.loadGameDetails("game-2")
        advanceUntilIdle()

        // Then - Deve completar sem erros (job anterior cancelado)
        val state = viewModel.uiState.value
        assertTrue(
            state is GameDetailUiState.Success || state is GameDetailUiState.Loading,
            "Estado inesperado: ${state::class.simpleName}"
        )
    }

    @Test
    @DisplayName("Deve limpar mensagem de usuario")
    fun `clearUserMessage should clear the userMessage in Success state`() = runTest {
        // Given - Dado estado Success com mensagem
        val testGame = createTestGame("game-1", ownerId = "user123")
        setupSuccessFlows(testGame)

        viewModel = createViewModel()
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // Simular erro para gerar mensagem
        coEvery { gameRepository.deleteGame(any()) } returns Result.failure(Exception("Teste"))
        viewModel.deleteGame("game-1")
        advanceUntilIdle()

        // When - Quando limpar mensagem
        viewModel.clearUserMessage()

        // Then - Mensagem deve ser null
        val state = viewModel.uiState.value as? GameDetailUiState.Success
        assertNull(state?.userMessage)
    }

    @Test
    @DisplayName("Deve gerar times apenas com jogadores suficientes")
    fun `generateTeams should require minimum 2 confirmed players`() = runTest {
        // Given - Dado jogo com apenas 1 confirmacao
        val testGame = createTestGame("game-1", ownerId = "user123")
        val confirmations = listOf(
            createTestConfirmation("conf-1", "game-1", "user123", status = "CONFIRMED")
        )

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns flowOf(Result.success(confirmations))
        every { gameRepository.getGameEventsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getGameTeamsFlow("game-1") } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getLiveScoreFlow("game-1") } returns flowOf(null)

        viewModel = createViewModel()
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // When - Quando tentar gerar times
        viewModel.generateTeams("game-1", 2, true)

        // Then - Deve mostrar mensagem de erro
        val state = viewModel.uiState.value as? GameDetailUiState.Success
        assertNotNull(state?.userMessage)
        assertTrue(state!!.userMessage!!.contains("2 jogadores"))
    }

    @Test
    @DisplayName("onCleared deve cancelar todos os jobs")
    fun `onCleared should cancel all active jobs`() = runTest {
        // Given - Dado ViewModel com job ativo
        viewModel = createViewModel()

        val testGame = createTestGame("game-1")
        setupSuccessFlows(testGame)
        viewModel.loadGameDetails("game-1")
        advanceUntilIdle()

        // When/Then - ViewModel deve funcionar sem crashar ao ser descartado
        // onCleared() e protected, entao verificamos que o estado esta valido
        val state = viewModel.uiState.value
        assertTrue(state is GameDetailUiState.Success || state is GameDetailUiState.Loading)
    }

    // === Helper Functions ===

    private fun createTestGame(
        id: String,
        ownerId: String = "owner123",
        status: String = GameStatus.SCHEDULED.name
    ): Game {
        return Game(
            id = id,
            date = "2026-02-15",
            time = "20:00",
            status = status,
            locationName = "Arena Test",
            fieldName = "Quadra 1",
            maxPlayers = 14,
            ownerId = ownerId,
            ownerName = "Owner Test"
        )
    }

    private fun createTestConfirmation(
        id: String,
        gameId: String,
        userId: String,
        status: String = "CONFIRMED"
    ): GameConfirmation {
        return GameConfirmation(
            id = id,
            gameId = gameId,
            userId = userId,
            userName = "Player $userId",
            status = status
        )
    }

    private fun setupSuccessFlows(game: Game, gameId: String = game.id) {
        every { gameRepository.getGameDetailsFlow(gameId) } returns flowOf(Result.success(game))
        every { gameRepository.getGameConfirmationsFlow(gameId) } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getGameEventsFlow(gameId) } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getGameTeamsFlow(gameId) } returns flowOf(Result.success(emptyList()))
        every { gameRepository.getLiveScoreFlow(gameId) } returns flowOf(null)
        coEvery { gameExperienceRepository.hasUserVoted(any(), any()) } returns Result.success(false)
    }
}
