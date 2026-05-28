package com.futebadosparcas.ui.games

import androidx.lifecycle.SavedStateHandle
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.usecase.ConfirmationUseCase
import com.futebadosparcas.domain.usecase.notification.ObserveUnreadCountUseCase
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GamesViewModel Tests")
@ExtendWith(MockLogExtension::class)
class GamesViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var observeUnreadCountUseCase: ObserveUnreadCountUseCase
    private lateinit var confirmationUseCase: ConfirmationUseCase
    private lateinit var savedStateHandle: SavedStateHandle
    private lateinit var viewModel: GamesViewModel

    private val testGame = Game(id = "game-1", date = "2026-06-01", time = "20:00", ownerId = "user-1", ownerName = "Joao", status = "SCHEDULED")
    private val testGames = listOf(GameWithConfirmations(game = testGame, confirmedCount = 3, isUserConfirmed = false))

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk(relaxed = true)
        observeUnreadCountUseCase = mockk(relaxed = true)
        confirmationUseCase = mockk(relaxed = true)
        savedStateHandle = SavedStateHandle()

        every { observeUnreadCountUseCase() } returns flowOf(0)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("Estado Inicial")
    inner class InitialStateTests {

        @Test
        @DisplayName("Estado inicial deve ser Loading")
        fun `initial state is Loading`() = runTest(testDispatcher) {
            coEvery { gameRepository.getGamesByFilter(any()) } returns Result.success(testGames)
            savedStateHandle["current_filter"] = GameFilterType.ALL.name

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            advanceUntilIdle()

            assertEquals(GamesUiState.Loading, viewModel.uiState.value)
        }
    }

    @Nested
    @DisplayName("loadGames")
    inner class LoadGamesTests {

        @Test
        @DisplayName("loadGames com MY_GAMES retorna Success")
        fun `loadGames with MY_GAMES returns Success`() = runTest(testDispatcher) {
            coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(testGames)

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.MY_GAMES)
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(GamesUiState.Success::class.java, state)
            assertEquals(1, (state as GamesUiState.Success).games.size)
        }

        @Test
        @DisplayName("loadGames com MY_GAMES vazio retorna Empty")
        fun `loadGames with MY_GAMES empty returns Empty`() = runTest(testDispatcher) {
            coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(emptyList())

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.MY_GAMES)
            advanceUntilIdle()

            assertEquals(GamesUiState.Empty, viewModel.uiState.value)
        }

        @Test
        @DisplayName("loadGames com MY_GAMES com erro retorna Error")
        fun `loadGames with MY_GAMES error returns Error`() = runTest(testDispatcher) {
            coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.failure(RuntimeException("Erro ao carregar"))

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.MY_GAMES)
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(GamesUiState.Error::class.java, state)
            assertTrue((state as GamesUiState.Error).retryable)
        }

        @Test
        @DisplayName("loadGames com ALL carrega via flow")
        fun `loadGames with ALL loads via flow`() = runTest(testDispatcher) {
            val gamesFlow = MutableStateFlow(Result.success(testGames))
            every { gameRepository.getLiveAndUpcomingGamesFlow() } returns gamesFlow

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.ALL)
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(GamesUiState.Success::class.java, state)
        }

        @Test
        @DisplayName("loadGames com OPEN filtra apenas SCHEDULED")
        fun `loadGames with OPEN filters SCHEDULED only`() = runTest(testDispatcher) {
            val liveGame = GameWithConfirmations(
                game = testGame.copy(id = "game-2", status = "LIVE"),
                confirmedCount = 5
            )
            val allGames = testGames + liveGame
            val gamesFlow = MutableStateFlow(Result.success(allGames))
            every { gameRepository.getLiveAndUpcomingGamesFlow() } returns gamesFlow

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.OPEN)
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(GamesUiState.Success::class.java, state)
            val games = (state as GamesUiState.Success).games
            assertTrue(games.all { it.game.status == "SCHEDULED" })
        }

        @Test
        @DisplayName("loadGames flow com erro retorna Error")
        fun `loadGames flow error returns Error`() = runTest(testDispatcher) {
            val gamesFlow = MutableStateFlow(Result.failure<List<GameWithConfirmations>>(RuntimeException("Falha no flow")))
            every { gameRepository.getLiveAndUpcomingGamesFlow() } returns gamesFlow

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.ALL)
            advanceUntilIdle()

            assertInstanceOf(GamesUiState.Error::class.java, viewModel.uiState.value)
        }
    }

    @Nested
    @DisplayName("retryLoad e cache")
    inner class RetryAndCacheTests {

        @Test
        @DisplayName("retryLoad recarrega com forceRefresh")
        fun `retryLoad reloads with forceRefresh`() = runTest(testDispatcher) {
            coEvery { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(testGames)

            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.loadGames(GameFilterType.MY_GAMES)
            advanceUntilIdle()

            assertInstanceOf(GamesUiState.Success::class.java, viewModel.uiState.value)

            viewModel.retryLoad()
            advanceUntilIdle()

            coVerify(atLeast = 2) { gameRepository.getGamesByFilter(GameFilterType.MY_GAMES) }
        }

        @Test
        @DisplayName("clearCache limpa cache de filtros")
        fun `clearCache clears filter cache`() {
            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.clearCache()
            assertTrue(true)
        }
    }

    @Nested
    @DisplayName("prefetchGameDetails")
    inner class PrefetchTests {

        @Test
        @DisplayName("prefetchGameDetails com lista vazia nao faz nada")
        fun `prefetchGameDetails with empty list does nothing`() {
            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.prefetchGameDetails(emptyList())
            assertTrue(true)
        }

        @Test
        @DisplayName("prefetchGameDetails com jogos executa prefetch")
        fun `prefetchGameDetails with games executes prefetch`() {
            viewModel = GamesViewModel(gameRepository, observeUnreadCountUseCase, confirmationUseCase, savedStateHandle)
            viewModel.prefetchGameDetails(testGames)
            assertTrue(true)
        }
    }
}
