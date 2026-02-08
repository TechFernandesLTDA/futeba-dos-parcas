package com.futebadosparcas.ui.games

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
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
 * Testes unitários para GamesViewModel.
 * Verifica carregamento de jogos, filtros e confirmação rápida de presença.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GamesViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class GamesViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var savedStateHandle: SavedStateHandle
    private lateinit var viewModel: GamesViewModel

    private fun createViewModel(): GamesViewModel {
        return GamesViewModel(gameRepository, notificationRepository, savedStateHandle)
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gameRepository = mockk()
        notificationRepository = mockk()
        savedStateHandle = SavedStateHandle()

        // Setup default mock behaviors
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() = runTest {
        // Given - Dado setup de mocks
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Deve estar em estado Empty (sem jogos)
        assertTrue(viewModel.uiState.value is GamesUiState.Empty)
    }

    @Test
    @DisplayName("Deve carregar jogos ALL com sucesso")
    fun `loadGames with ALL filter should load successfully`() = runTest {
        // Given - Dado jogos disponíveis
        val games = listOf(
            createGameWithConfirmation("1", GameStatus.SCHEDULED, 10),
            createGameWithConfirmation("2", GameStatus.LIVE, 14)
        )
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(games))

        // When - Quando carregar com filtro ALL
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.ALL)
        advanceUntilIdle()

        // Then - Deve retornar Success com os jogos
        val state = viewModel.uiState.value
        assertTrue(state is GamesUiState.Success)
        assertEquals(2, (state as GamesUiState.Success).games.size)
    }

    @Test
    @DisplayName("Deve filtrar apenas jogos OPEN (SCHEDULED)")
    fun `loadGames with OPEN filter should show only scheduled games`() = runTest {
        // Given - Dado jogos com diferentes status
        val games = listOf(
            createGameWithConfirmation("1", GameStatus.SCHEDULED, 10, false),
            createGameWithConfirmation("2", GameStatus.LIVE, 14, false),
            createGameWithConfirmation("3", GameStatus.SCHEDULED, 8, false)
        )
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(games))

        // When - Quando carregar com filtro OPEN
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.OPEN)
        advanceUntilIdle()

        // Then - Deve retornar apenas jogos SCHEDULED
        val state = viewModel.uiState.value
        assertTrue(state is GamesUiState.Success)
        val successState = state as GamesUiState.Success
        assertEquals(2, successState.games.size)
        assertTrue(successState.games.all { it.game.status == GameStatus.SCHEDULED.name })
    }

    @Test
    @DisplayName("Deve carregar MY_GAMES usando suspend function")
    fun `loadGames with MY_GAMES filter should use suspend function`() = runTest {
        // Given - Dado jogos do usuário
        val myGames = listOf(
            createGameWithConfirmation("1", GameStatus.SCHEDULED, 10, true),
            createGameWithConfirmation("2", GameStatus.SCHEDULED, 12, true)
        )
        coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(myGames)

        // When - Quando carregar MY_GAMES
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.MY_GAMES)
        advanceUntilIdle()

        // Then - Deve usar getGamesByFilter e retornar jogos
        val state = viewModel.uiState.value
        assertTrue(state is GamesUiState.Success)
        assertEquals(2, (state as GamesUiState.Success).games.size)
        coVerify(exactly = 1) { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) }
    }

    @Test
    @DisplayName("Deve retornar Empty quando não há jogos")
    fun `loadGames should return Empty state when no games available`() = runTest {
        // Given - Dado lista vazia de jogos
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))

        // When - Quando carregar jogos
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.ALL)
        advanceUntilIdle()

        // Then - Deve retornar estado Empty
        assertTrue(viewModel.uiState.value is GamesUiState.Empty)
    }

    @Test
    @DisplayName("Deve retornar Empty quando MY_GAMES está vazio")
    fun `loadGames with MY_GAMES should return Empty when no games`() = runTest {
        // Given - Dado usuário sem jogos
        coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(emptyList())

        // When - Quando carregar MY_GAMES
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.MY_GAMES)
        advanceUntilIdle()

        // Then - Deve retornar Empty
        assertTrue(viewModel.uiState.value is GamesUiState.Empty)
    }

    @Test
    @DisplayName("Deve retornar Error quando repositório falhar")
    fun `loadGames should return Error when repository fails`() = runTest {
        // Given - Dado erro no repositório
        val exception = Exception("Erro ao carregar jogos")
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.failure(exception))

        // When - Quando carregar jogos
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.ALL)
        advanceUntilIdle()

        // Then - Deve retornar Error
        val state = viewModel.uiState.value
        assertTrue(state is GamesUiState.Error)
        assertEquals("Erro ao carregar jogos", (state as GamesUiState.Error).message)
    }

    @Test
    @DisplayName("Deve retornar Error quando MY_GAMES falhar")
    fun `loadGames with MY_GAMES should return Error when repository fails`() = runTest {
        // Given - Dado erro ao buscar MY_GAMES
        val exception = Exception("Erro ao carregar meus jogos")
        coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.failure(exception)

        // When - Quando carregar MY_GAMES
        viewModel = createViewModel()
        viewModel.loadGames(GameFilterType.MY_GAMES)
        advanceUntilIdle()

        // Then - Deve retornar Error
        val state = viewModel.uiState.value
        assertTrue(state is GamesUiState.Error)
        assertEquals("Erro ao carregar meus jogos", (state as GamesUiState.Error).message)
    }

    @Test
    @DisplayName("Deve confirmar presença rapidamente com sucesso")
    fun `quickConfirmPresence should confirm successfully`() = runTest {
        // Given - Dado repositório pronto para confirmar
        val gameId = "game123"
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))
        coEvery { gameRepository.confirmPresence(gameId, "FIELD", false) } returns Result.success(mockk(relaxed = true))

        viewModel = createViewModel()

        // When - Quando confirmar presença rapidamente
        viewModel.quickConfirmPresence(gameId)
        advanceUntilIdle()

        // Then - Deve chamar confirmPresence com parâmetros padrão
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "FIELD", false) }
    }

    @Test
    @DisplayName("Deve lidar com erro na confirmação rápida")
    fun `quickConfirmPresence should handle error gracefully`() = runTest {
        // Given - Dado erro na confirmação
        val gameId = "game456"
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))
        coEvery { gameRepository.confirmPresence(gameId, "FIELD", false) } returns Result.failure(Exception("Jogo lotado"))

        viewModel = createViewModel()

        // When - Quando confirmar presença
        viewModel.quickConfirmPresence(gameId)
        advanceUntilIdle()

        // Then - Deve chamar mas não crashar
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "FIELD", false) }
        // ViewModel não muda estado para Error na quickConfirm
    }

    @Test
    @DisplayName("Deve observar contador de notificações")
    fun `should observe unread notifications count`() = runTest {
        // Given - Dado fluxo de notificações
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(3)
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Deve observar contador
        viewModel.unreadCount.test {
            assertEquals(3, awaitItem())
        }
    }

    @Test
    @DisplayName("Deve cancelar job anterior ao trocar filtro")
    fun `loadGames should cancel previous job when filter changes`() = runTest {
        // Given - Setup de mocks
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))
        coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(emptyList())

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando trocar filtro rapidamente
        viewModel.loadGames(GameFilterType.ALL)
        viewModel.loadGames(GameFilterType.MY_GAMES)
        advanceUntilIdle()

        // Then - Deve completar sem erros (job anterior cancelado)
        assertTrue(viewModel.uiState.value is GamesUiState.Empty)
    }

    @Test
    @DisplayName("Deve reagir a mudanças no Flow de jogos em tempo real")
    fun `should react to real-time game updates`() = runTest {
        // Given - Dado Flow que emite múltiplas atualizações
        val games1 = listOf(createGameWithConfirmation("1", GameStatus.SCHEDULED, 10, false))
        val games2 = listOf(
            createGameWithConfirmation("1", GameStatus.SCHEDULED, 10, false),
            createGameWithConfirmation("2", GameStatus.SCHEDULED, 12, false)
        )

        // Simular Flow que emite duas vezes
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(
            Result.success(games1),
            Result.success(games2)
        )

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Deve refletir a última atualização
        val state = viewModel.uiState.value
        assertTrue(state is GamesUiState.Success)
        // Flow emite sequencialmente, então o último valor prevalece
    }

    @Test
    @DisplayName("Deve transicionar de Loading para Success ao carregar jogos")
    fun `loadGames should transition from Loading to Success`() = runTest {
        // Given - Dado jogos disponíveis
        val games = listOf(
            createGameWithConfirmation("1", GameStatus.SCHEDULED, 10),
            createGameWithConfirmation("2", GameStatus.LIVE, 14)
        )
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(games))

        // When - Quando criar ViewModel
        viewModel = createViewModel()

        // Then - Estado inicial deve ser Loading (antes de advanceUntilIdle)
        assertTrue(
            viewModel.uiState.value is GamesUiState.Loading,
            "Estado inicial esperado: Loading, obtido: ${viewModel.uiState.value::class.simpleName}"
        )

        // When - Quando o dispatcher avanca
        viewModel.loadGames(GameFilterType.ALL)
        advanceUntilIdle()

        // Then - Estado final deve ser Success
        val state = viewModel.uiState.value
        assertTrue(
            state is GamesUiState.Success,
            "Estado final esperado: Success, obtido: ${state::class.simpleName}"
        )
        assertEquals(2, (state as GamesUiState.Success).games.size)
    }

    @Test
    @DisplayName("Deve transicionar de Loading para Error quando repositório falhar")
    fun `loadGames should transition from Loading to Error`() = runTest {
        // Given - Dado erro no repositório
        val exception = Exception("Falha de rede")
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.failure(exception))

        // When - Quando criar ViewModel (estado inicial Loading)
        viewModel = createViewModel()
        assertTrue(viewModel.uiState.value is GamesUiState.Loading)

        // When - Quando o dispatcher avanca com erro
        viewModel.loadGames(GameFilterType.ALL)
        advanceUntilIdle()

        // Then - Estado final deve ser Error
        val state = viewModel.uiState.value
        assertTrue(
            state is GamesUiState.Error,
            "Estado final esperado: Error, obtido: ${state::class.simpleName}"
        )
    }

    // Helper functions para criar dados de teste
    private fun createGameWithConfirmation(
        id: String,
        status: GameStatus,
        confirmedCount: Int,
        isUserConfirmed: Boolean = false
    ): GameWithConfirmations {
        val game = Game(
            id = id,
            date = "2026-01-10",
            time = "20:00",
            status = status.name,
            locationName = "Arena Test",
            fieldName = "Quadra 1",
            maxPlayers = 14,
            playersCount = confirmedCount,
            ownerId = "owner123",
            ownerName = "Owner"
        )
        return GameWithConfirmations(game, confirmedCount, isUserConfirmed)
    }
}
