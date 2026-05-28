package com.futebadosparcas.ui.home

import androidx.lifecycle.SavedStateHandle
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.cache.SharedCacheService
import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.ActivityType
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserBadge
import com.futebadosparcas.domain.model.WeeklyChallenge
import com.futebadosparcas.domain.prefetch.PrefetchService
import com.futebadosparcas.domain.repository.ActivityRepository
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.ConnectivityMonitor
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
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
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("HomeViewModel Tests")
@ExtendWith(MockLogExtension::class)
class HomeViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var userRepository: UserRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var activityRepository: ActivityRepository
    private lateinit var gameConfirmationRepository: GameConfirmationRepository
    private lateinit var connectivityMonitor: ConnectivityMonitor
    private lateinit var savedStateHandle: SavedStateHandle
    private lateinit var sharedCache: SharedCacheService
    private lateinit var prefetchService: PrefetchService
    private lateinit var viewModel: HomeViewModel

    private val testUser = User(id = "user-1", name = "Joao", experiencePoints = 500, level = 3)
    private val testGame = Game(id = "game-1", date = "2026-06-01", time = "20:00", ownerId = "user-1", ownerName = "Joao")
    private val testGames = listOf(GameWithConfirmations(game = testGame, confirmedCount = 2))

    private fun setupMocksForSuccess() {
        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        every { gameRepository.getLiveAndUpcomingGamesFlow() } returns MutableStateFlow(Result.success(testGames))
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(mockk(relaxed = true))
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any(), any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        every { connectivityMonitor.isConnected } returns MutableStateFlow(true)
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk(relaxed = true)
        userRepository = mockk(relaxed = true)
        notificationRepository = mockk(relaxed = true)
        gamificationRepository = mockk(relaxed = true)
        statisticsRepository = mockk(relaxed = true)
        activityRepository = mockk(relaxed = true)
        gameConfirmationRepository = mockk(relaxed = true)
        connectivityMonitor = mockk(relaxed = true)
        savedStateHandle = SavedStateHandle()
        sharedCache = mockk(relaxed = true)
        prefetchService = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel() = HomeViewModel(
        gameRepository, userRepository, notificationRepository,
        gamificationRepository, statisticsRepository, activityRepository,
        gameConfirmationRepository, connectivityMonitor,
        savedStateHandle, sharedCache, prefetchService
    )

    @Nested
    @DisplayName("Estado Inicial")
    inner class InitialStateTests {

        @Test
        @DisplayName("Estado inicial deve ser Loading")
        fun `initial state is Loading`() {
            every { connectivityMonitor.isConnected } returns MutableStateFlow(true)
            every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)

            viewModel = createViewModel()
            assertInstanceOf(HomeUiState.Loading::class.java, viewModel.uiState.value)
        }

        @Test
        @DisplayName("isOnline inicialmente true")
        fun `initial isOnline is true`() {
            every { connectivityMonitor.isConnected } returns MutableStateFlow(true)
            every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
            coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
            every { gameRepository.getLiveAndUpcomingGamesFlow() } returns MutableStateFlow(Result.success(testGames))
            coEvery { gamificationRepository.getActiveSeason() } returns Result.success(null)
            coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
            coEvery { gamificationRepository.getRecentBadges(any(), any()) } returns Result.success(emptyList())

            viewModel = createViewModel()
            assertTrue(viewModel.isOnline.value)
        }

        @Test
        @DisplayName("isGridView inicialmente false")
        fun `initial isGridView is false`() {
            savedStateHandle["is_grid_view"] = false
            every { connectivityMonitor.isConnected } returns MutableStateFlow(true)
            every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)

            viewModel = createViewModel()
            assertFalse(viewModel.isGridView)
        }
    }

    @Nested
    @DisplayName("Fase 1 - Dados críticos")
    inner class Phase1Tests {

        @Test
        @DisplayName("Fase 1 carrega usuario e jogos com sucesso")
        fun `phase1 loads user and games successfully`() = runTest(testDispatcher) {
            setupMocksForSuccess()
            viewModel = createViewModel()
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(HomeUiState.Success::class.java, state)
            val success = state as HomeUiState.Success
            assertEquals(testUser, success.user)
            assertTrue(success.games.isNotEmpty())
        }

        @Test
        @DisplayName("Fase 1 com erro no usuario resulta em Error")
        fun `phase1 user error results in Error`() = runTest(testDispatcher) {
            coEvery { userRepository.getCurrentUser() } returns Result.failure(RuntimeException("Erro de rede"))
            every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
            every { connectivityMonitor.isConnected } returns MutableStateFlow(true)

            viewModel = createViewModel()
            advanceUntilIdle()

            assertInstanceOf(HomeUiState.Error::class.java, viewModel.uiState.value)
            assertInstanceOf(LoadingState.Error::class.java, viewModel.loadingState.value)
        }
    }

    @Nested
    @DisplayName("Fase 2 - Dados secundarios")
    inner class Phase2Tests {

        @Test
        @DisplayName("Fase 2 carrega activities e statistics")
        fun `phase2 loads activities and statistics`() = runTest(testDispatcher) {
            val activities = listOf(Activity(id = "act-1", type = ActivityType.GAME_FINISHED, userId = "user-1"))
            val stats = Statistics(id = "stats-1", userId = "user-1", totalGames = 10)

            setupMocksForSuccess()
            coEvery { activityRepository.getRecentActivities(10) } returns Result.success(activities)
            coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(stats)

            viewModel = createViewModel()
            advanceUntilIdle()

            val state = viewModel.uiState.value as HomeUiState.Success
            assertFalse(state.activities.isEmpty())
            assertNotNull(state.statistics)
        }
    }

    @Nested
    @DisplayName("toggleViewMode")
    inner class ToggleViewModeTests {

        @Test
        @DisplayName("toggleViewMode alterna isGridView")
        fun `toggleViewMode toggles isGridView`() = runTest(testDispatcher) {
            savedStateHandle["is_grid_view"] = false
            setupMocksForSuccess()

            viewModel = createViewModel()
            advanceUntilIdle()

            assertFalse(viewModel.isGridView)
            viewModel.toggleViewMode()
            assertTrue(viewModel.isGridView)
            viewModel.toggleViewMode()
            assertFalse(viewModel.isGridView)
        }
    }

    @Nested
    @DisplayName("retryLoad e observacao de notificacoes")
    inner class RetryAndNotificationsTests {

        @Test
        @DisplayName("retryLoad reinicia carregamento")
        fun `retryLoad restarts loading`() = runTest(testDispatcher) {
            coEvery { userRepository.getCurrentUser() } returns Result.failure(RuntimeException("Falha"))
            every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
            every { connectivityMonitor.isConnected } returns MutableStateFlow(true)

            viewModel = createViewModel()
            advanceUntilIdle()

            assertInstanceOf(HomeUiState.Error::class.java, viewModel.uiState.value)

            setupMocksForSuccess()

            viewModel.retryLoad()
            advanceUntilIdle()

            assertInstanceOf(HomeUiState.Success::class.java, viewModel.uiState.value)
        }

        @Test
        @DisplayName("observeUnreadCount atualiza contador")
        fun `observeUnreadCount updates counter`() = runTest(testDispatcher) {
            val unreadFlow = MutableStateFlow(5)
            setupMocksForSuccess()
            every { notificationRepository.getUnreadCountFlow() } returns unreadFlow

            viewModel = createViewModel()
            advanceUntilIdle()

            assertEquals(5, viewModel.unreadCount.value)
        }
    }
}
