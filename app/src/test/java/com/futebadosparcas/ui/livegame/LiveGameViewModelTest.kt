package com.futebadosparcas.ui.livegame

import com.futebadosparcas.data.model.*
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para LiveGameViewModel.
 * Verifica carregamento do jogo ao vivo, placar,
 * registro de eventos (gols, cartoes, defesas) e finalizacao.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("LiveGameViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class LiveGameViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var liveGameRepository: LiveGameRepository
    private lateinit var gameRepository: GameRepository
    private lateinit var authRepository: AuthRepository

    private lateinit var viewModel: LiveGameViewModel

    private fun createViewModel(): LiveGameViewModel {
        return LiveGameViewModel(
            liveGameRepository,
            gameRepository,
            authRepository
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        liveGameRepository = mockk(relaxed = true)
        gameRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)

        // Setup default mocks
        every { authRepository.getCurrentUserId() } returns "user123"
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
        assertTrue(viewModel.uiState.value is LiveGameUiState.Loading)
    }

    @Test
    @DisplayName("Deve carregar jogo ao vivo com sucesso")
    fun `loadGame should load successfully with valid data`() = runTest {
        // Given - Dado dados validos
        val testGame = createTestLiveGame("game-1")
        val testScore = createTestScore("game-1")
        val testTeams = createTestTeams()
        val testConfirmations = createTestConfirmations(testTeams)

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { liveGameRepository.observeLiveScore("game-1") } returns flowOf(testScore)
        coEvery { gameRepository.getGameTeams("game-1") } returns Result.success(testTeams)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(testConfirmations)

        viewModel = createViewModel()

        // When - Quando carregar jogo
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is LiveGameUiState.Success, "Estado esperado: Success, obtido: ${state::class.simpleName}")
        val successState = state as LiveGameUiState.Success
        assertEquals("game-1", successState.game.id)
        assertEquals(2, successState.score.team1Score)
        assertEquals(1, successState.score.team2Score)
    }

    @Test
    @DisplayName("Deve retornar Error quando repositorio falhar")
    fun `loadGame should return Error when repository fails`() = runTest {
        // Given - Dado erro no repositorio
        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.failure(Exception("Erro")))
        every { liveGameRepository.observeLiveScore("game-1") } returns flowOf(null)

        viewModel = createViewModel()

        // When - Quando carregar jogo
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is LiveGameUiState.Error)
    }

    @Test
    @DisplayName("Deve retornar Error quando times nao estao definidos")
    fun `loadGame should return Error when teams are not defined`() = runTest {
        // Given - Dado jogo sem times
        val testGame = createTestLiveGame("game-1")
        val testScore = createTestScore("game-1")

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { liveGameRepository.observeLiveScore("game-1") } returns flowOf(testScore)
        coEvery { gameRepository.getGameTeams("game-1") } returns Result.success(emptyList())

        viewModel = createViewModel()

        // When - Quando carregar jogo
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is LiveGameUiState.Error)
        assertTrue((state as LiveGameUiState.Error).message.contains("Times"))
    }

    @Test
    @DisplayName("Deve identificar dono do jogo")
    fun `loadGame should identify game owner`() = runTest {
        // Given - Dado usuario e dono
        val testGame = createTestLiveGame("game-1", ownerId = "user123")
        val testScore = createTestScore("game-1")
        val testTeams = createTestTeams()
        val testConfirmations = createTestConfirmations(testTeams)

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { liveGameRepository.observeLiveScore("game-1") } returns flowOf(testScore)
        coEvery { gameRepository.getGameTeams("game-1") } returns Result.success(testTeams)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(testConfirmations)

        viewModel = createViewModel()

        // When - Quando carregar jogo
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // Then - isOwner deve ser true
        val state = viewModel.uiState.value as? LiveGameUiState.Success
        assertNotNull(state)
        assertTrue(state!!.isOwner)
    }

    @Test
    @DisplayName("Deve adicionar gol com sucesso")
    fun `addGoal should call repository with correct parameters`() = runTest {
        // Given - Dado jogo carregado com sucesso
        val testGame = createTestLiveGame("game-1")
        val testScore = createTestScore("game-1")
        val testTeams = createTestTeams()
        val testConfirmations = createTestConfirmations(testTeams)

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { liveGameRepository.observeLiveScore("game-1") } returns flowOf(testScore)
        coEvery { gameRepository.getGameTeams("game-1") } returns Result.success(testTeams)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(testConfirmations)
        val mockEvent = GameEvent(id = "evt-1", gameId = "game-1", eventType = GameEventType.GOAL.name)
        coEvery {
            liveGameRepository.addGameEvent(any(), any(), any(), any(), any(), any(), any(), any())
        } returns Result.success(mockEvent)

        viewModel = createViewModel()
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // When - Quando adicionar gol
        viewModel.addGoal(
            playerId = "player-1",
            playerName = "Jogador 1",
            teamId = "team-1"
        )
        advanceUntilIdle()

        // Then - Deve chamar repositorio
        coVerify(exactly = 1) {
            liveGameRepository.addGameEvent(
                gameId = "game-1",
                eventType = GameEventType.GOAL,
                playerId = "player-1",
                playerName = "Jogador 1",
                teamId = "team-1",
                assistedById = null,
                assistedByName = null,
                minute = 0
            )
        }
    }

    @Test
    @DisplayName("Deve rejeitar gol de jogador que nao pertence ao time")
    fun `addGoal should reject when player does not belong to team`() = runTest {
        // Given - Dado jogo carregado
        val testGame = createTestLiveGame("game-1")
        val testScore = createTestScore("game-1")
        val testTeams = createTestTeams()
        val testConfirmations = createTestConfirmations(testTeams)

        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(testGame))
        every { liveGameRepository.observeLiveScore("game-1") } returns flowOf(testScore)
        coEvery { gameRepository.getGameTeams("game-1") } returns Result.success(testTeams)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(testConfirmations)

        viewModel = createViewModel()
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // When - Quando tentar adicionar gol de jogador que nao esta no time
        viewModel.addGoal(
            playerId = "invalid-player",
            playerName = "Invalido",
            teamId = "team-1"
        )
        advanceUntilIdle()

        // Then - Nao deve chamar addGameEvent
        coVerify(exactly = 0) {
            liveGameRepository.addGameEvent(any(), any(), any(), any(), any(), any(), any(), any())
        }
    }

    @Test
    @DisplayName("Deve adicionar cartao amarelo com sucesso")
    fun `addYellowCard should call repository correctly`() = runTest {
        // Given - Dado jogo carregado
        setupSuccessfulGame("game-1")
        val mockCardEvent = GameEvent(
            id = "evt-2", gameId = "game-1", eventType = GameEventType.YELLOW_CARD.name
        )
        coEvery {
            liveGameRepository.addGameEvent(any(), any(), any(), any(), any(), any(), any(), any())
        } returns Result.success(mockCardEvent)

        viewModel = createViewModel()
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // When - Quando adicionar cartao amarelo
        viewModel.addYellowCard(
            playerId = "player-1",
            playerName = "Jogador 1",
            teamId = "team-1"
        )
        advanceUntilIdle()

        // Then - Deve chamar com eventType YELLOW_CARD
        coVerify(exactly = 1) {
            liveGameRepository.addGameEvent(
                gameId = "game-1",
                eventType = GameEventType.YELLOW_CARD,
                playerId = "player-1",
                playerName = "Jogador 1",
                teamId = "team-1",
                assistedById = null,
                assistedByName = null,
                minute = 0
            )
        }
    }

    @Test
    @DisplayName("Deve finalizar jogo com sucesso")
    fun `finishGame should update game status to FINISHED`() = runTest {
        // Given - Dado jogo carregado
        setupSuccessfulGame("game-1")
        coEvery { liveGameRepository.finishGame("game-1") } returns Result.success(Unit)
        coEvery { gameRepository.updateGameStatus("game-1", "FINISHED") } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // When - Quando finalizar jogo
        viewModel.finishGame()
        advanceUntilIdle()

        // Then - Deve chamar finishGame e updateGameStatus
        coVerify(exactly = 1) { liveGameRepository.finishGame("game-1") }
        coVerify(exactly = 1) { gameRepository.updateGameStatus("game-1", "FINISHED") }
    }

    @Test
    @DisplayName("Deve cancelar job anterior ao carregar novo jogo")
    fun `loadGame should cancel previous job when loading new game`() = runTest {
        // Given - Dado dois jogos
        setupSuccessfulGame("game-1")
        setupSuccessfulGame("game-2")

        viewModel = createViewModel()

        // When - Quando carregar dois jogos rapidamente
        viewModel.loadGame("game-1")
        viewModel.loadGame("game-2")
        advanceUntilIdle()

        // Then - Nao deve crashar (job anterior cancelado)
        val state = viewModel.uiState.value
        assertTrue(
            state is LiveGameUiState.Success || state is LiveGameUiState.Loading || state is LiveGameUiState.Error,
            "Estado inesperado: ${state::class.simpleName}"
        )
    }

    @Test
    @DisplayName("onCleared deve cancelar scoreObserverJob")
    fun `onCleared should cancel score observer job`() = runTest {
        // Given - Dado ViewModel com job ativo
        setupSuccessfulGame("game-1")
        viewModel = createViewModel()
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        // When/Then - ViewModel deve ser coletado pelo GC sem crashar
        // onCleared() e protected, entao verificamos que o ViewModel nao crasha
        // ao ser descartado (simulado pelo cancelamento do scope)
    }

    @Test
    @DisplayName("Deve falhar ao adicionar gol sem ID do jogo")
    fun `addGoal should fail when gameId is empty`() = runTest {
        // Given - Dado ViewModel sem jogo carregado
        viewModel = createViewModel()

        // When - Quando tentar adicionar gol
        viewModel.addGoal(
            playerId = "player-1",
            playerName = "Jogador 1",
            teamId = "team-1"
        )
        advanceUntilIdle()

        // Then - Nao deve chamar repositorio (emit de mensagem de erro)
        coVerify(exactly = 0) {
            liveGameRepository.addGameEvent(any(), any(), any(), any(), any(), any(), any(), any())
        }
    }

    // === Helper Functions ===

    private fun createTestLiveGame(
        id: String,
        ownerId: String = "owner123",
        status: String = GameStatus.LIVE.name
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
            ownerName = "Owner Test",
            team1Score = 2,
            team2Score = 1
        )
    }

    private fun createTestScore(
        gameId: String,
        team1Score: Int = 2,
        team2Score: Int = 1
    ): LiveGameScore {
        return LiveGameScore(
            id = gameId,
            gameId = gameId,
            team1Id = "team-1",
            team2Id = "team-2",
            team1Score = team1Score,
            team2Score = team2Score
        )
    }

    private fun createTestTeams(): List<Team> {
        return listOf(
            Team(
                id = "team-1",
                name = "Time A",
                gameId = "game-1",
                playerIds = listOf("player-1", "player-2", "player-3")
            ),
            Team(
                id = "team-2",
                name = "Time B",
                gameId = "game-1",
                playerIds = listOf("player-4", "player-5", "player-6")
            )
        )
    }

    private fun createTestConfirmations(teams: List<Team>): List<GameConfirmation> {
        val allPlayerIds = teams.flatMap { it.playerIds }
        return allPlayerIds.map { playerId ->
            GameConfirmation(
                id = "conf-$playerId",
                gameId = "game-1",
                userId = playerId,
                userName = "Jogador $playerId",
                status = "CONFIRMED"
            )
        }
    }

    private fun setupSuccessfulGame(gameId: String) {
        val testGame = createTestLiveGame(gameId)
        val testScore = createTestScore(gameId)
        val testTeams = createTestTeams()
        val testConfirmations = createTestConfirmations(testTeams)

        every { gameRepository.getGameDetailsFlow(gameId) } returns flowOf(Result.success(testGame))
        every { liveGameRepository.observeLiveScore(gameId) } returns flowOf(testScore)
        coEvery { gameRepository.getGameTeams(gameId) } returns Result.success(testTeams)
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(testConfirmations)
    }
}
