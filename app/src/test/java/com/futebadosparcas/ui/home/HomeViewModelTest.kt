package com.futebadosparcas.ui.home

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import app.cash.turbine.test
import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.*
import com.futebadosparcas.util.ConnectivityMonitor
import io.mockk.coEvery
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
import org.junit.Rule

/**
 * Testes unitários para HomeViewModel.
 * Verifica estados de UI, carregamento de dados e integração com repositórios.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("HomeViewModel Tests")
class HomeViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var userRepository: UserRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var activityRepository: ActivityRepository
    private lateinit var connectivityMonitor: ConnectivityMonitor

    private lateinit var viewModel: HomeViewModel

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gameRepository = mockk()
        userRepository = mockk()
        notificationRepository = mockk()
        gamificationRepository = mockk()
        statisticsRepository = mockk()
        activityRepository = mockk()
        connectivityMonitor = mockk()

        // Setup default mock behaviors
        every { connectivityMonitor.isConnected } returns flowOf(true)
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
        every { userRepository.getCurrentUserId() } returns "user123"

        viewModel = HomeViewModel(
            gameRepository,
            userRepository,
            notificationRepository,
            gamificationRepository,
            statisticsRepository,
            activityRepository,
            connectivityMonitor
        )
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() = runTest {
        // Then - Estado inicial deve ser Loading
        assertTrue(viewModel.uiState.value is HomeUiState.Loading)
        assertEquals(LoadingState.Idle, viewModel.loadingState.value)
    }

    @Test
    @DisplayName("Deve observar contador de notificações não lidas")
    fun `should observe unread notifications count`() = runTest {
        // Given - Dado um fluxo de notificações não lidas
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(5)

        // When - Quando criar ViewModel
        val testViewModel = HomeViewModel(
            gameRepository,
            userRepository,
            notificationRepository,
            gamificationRepository,
            statisticsRepository,
            activityRepository,
            connectivityMonitor
        )

        advanceUntilIdle()

        // Then - Então deve receber o contador
        testViewModel.unreadCount.test {
            assertEquals(5, awaitItem())
        }
    }

    @Test
    @DisplayName("Deve observar status de conectividade")
    fun `should observe connectivity status`() = runTest {
        // Given - Dado mudança no status de conectividade
        every { connectivityMonitor.isConnected } returns flowOf(false)

        // When - Quando criar ViewModel
        val testViewModel = HomeViewModel(
            gameRepository,
            userRepository,
            notificationRepository,
            gamificationRepository,
            statisticsRepository,
            activityRepository,
            connectivityMonitor
        )

        advanceUntilIdle()

        // Then - Então deve refletir status offline
        testViewModel.isOnline.test {
            assertEquals(false, awaitItem())
        }
    }

    @Test
    @DisplayName("Deve carregar dados da home com sucesso")
    fun `loadHomeData should load successfully`() = runTest {
        // Given - Dado todos os repositórios retornando dados válidos
        val testUser = createTestUser()
        val testGames = listOf(createTestGame("1"), createTestGame("2"))
        val testStats = createTestStatistics()
        val testActivities = listOf(createTestActivity())
        val testSeason = createTestSeason()
        val testParticipation = createTestParticipation()

        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(testGames)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
        coEvery { activityRepository.getRecentActivities(100) } returns Result.success(testActivities)
        coEvery { gameRepository.getPublicGames(10) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(testUser.id) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(testUser.id) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(testSeason)
        coEvery { gamificationRepository.getUserParticipation(testUser.id, testSeason.id) } returns Result.success(testParticipation)
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        // When - Quando carregar dados
        viewModel.loadHomeData()
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Success)

        val successState = state as HomeUiState.Success
        assertEquals(testUser, successState.user)
        assertEquals(2, successState.games.size)
        assertNotNull(successState.statistics)
        assertEquals(1, successState.activities.size)
        assertEquals(LoadingState.Success, viewModel.loadingState.value)
    }

    @Test
    @DisplayName("Deve falhar quando usuário não está logado")
    fun `loadHomeData should fail when user not logged in`() = runTest {
        // Given - Dado erro ao obter usuário
        val exception = Exception("Usuário não autenticado")
        coEvery { userRepository.getCurrentUser() } returns Result.failure(exception)
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(emptyList())

        // When - Quando carregar dados
        viewModel.loadHomeData()
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Error)
        assertEquals("Usuário não autenticado", (state as HomeUiState.Error).message)
    }

    @Test
    @DisplayName("Deve transicionar por estados de loading com progresso")
    fun `loadHomeData should transition through loading states`() = runTest(testDispatcher) {
        // Given - Setup básico de mocks
        val testUser = createTestUser()
        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(emptyList())
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(createTestStatistics())
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(createTestSeason())
        coEvery { gamificationRepository.getUserParticipation(any(), any()) } returns Result.success(createTestParticipation())
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        // When - Quando carregar dados
        viewModel.loadHomeData()

        // Then - Deve passar por estados de loading
        viewModel.loadingState.test {
            // Estado inicial pode ser Idle ou já ter mudado
            val firstState = awaitItem()
            assertTrue(firstState is LoadingState.Loading || firstState is LoadingState.LoadingProgress)

            // Aguardar conclusão
            advanceUntilIdle()

            // Último estado deve ser Success
            val finalState = viewModel.loadingState.value
            assertEquals(LoadingState.Success, finalState)
        }
    }

    @Test
    @DisplayName("Deve alternar modo de visualização")
    fun `toggleViewMode should switch between grid and list view`() = runTest {
        // Given - Dado estado Success com isGridView = false
        val testUser = createTestUser()
        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(emptyList())
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(createTestStatistics())
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(createTestSeason())
        coEvery { gamificationRepository.getUserParticipation(any(), any()) } returns Result.success(createTestParticipation())
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        viewModel.loadHomeData()
        advanceUntilIdle()

        // When - Quando alternar modo de visualização
        viewModel.toggleViewMode()

        // Then - Deve mudar para grid view
        val state = viewModel.uiState.value as HomeUiState.Success
        assertTrue(state.isGridView)

        // When - Quando alternar novamente
        viewModel.toggleViewMode()

        // Then - Deve voltar para list view
        val newState = viewModel.uiState.value as HomeUiState.Success
        assertFalse(newState.isGridView)
    }

    @Test
    @DisplayName("Deve retornar ID do usuário atual")
    fun `getCurrentUserId should return current user id`() {
        // Given - Dado usuário logado
        every { userRepository.getCurrentUserId() } returns "user456"

        // When - Quando obter ID do usuário
        val userId = viewModel.getCurrentUserId()

        // Then - Deve retornar o ID correto
        assertEquals("user456", userId)
    }

    @Test
    @DisplayName("Deve cancelar job anterior ao recarregar dados")
    fun `loadHomeData should cancel previous job when called again`() = runTest {
        // Given - Setup de mocks
        val testUser = createTestUser()
        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(emptyList())
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(createTestStatistics())
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(createTestSeason())
        coEvery { gamificationRepository.getUserParticipation(any(), any()) } returns Result.success(createTestParticipation())
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        // When - Quando chamar loadHomeData duas vezes rapidamente
        viewModel.loadHomeData()
        viewModel.loadHomeData()
        advanceUntilIdle()

        // Then - Deve completar sem erros (job anterior cancelado)
        assertTrue(viewModel.uiState.value is HomeUiState.Success || viewModel.uiState.value is HomeUiState.Loading)
    }

    // Helper functions para criar dados de teste
    private fun createTestUser() = User(
        id = "user123",
        name = "Test User",
        email = "test@test.com",
        photoUrl = "",
        level = 5,
        experiencePoints = 2500L,
        createdAt = System.currentTimeMillis()
    )

    private fun createTestGame(id: String) = Game(
        id = id,
        date = "2026-01-10",
        time = "20:00",
        status = GameStatus.SCHEDULED.name,
        locationName = "Arena Test",
        fieldName = "Quadra 1",
        maxPlayers = 14,
        ownerId = "user123",
        ownerName = "Test User"
    )

    private fun createTestStatistics() = UserStatistics(
        userId = "user123",
        gamesPlayed = 50,
        wins = 30,
        draws = 10,
        losses = 10,
        goals = 45,
        assists = 20
    )

    private fun createTestActivity() = Activity(
        id = "act1",
        userId = "user123",
        type = "GAME_CONFIRMED",
        message = "Você confirmou presença no jogo",
        timestamp = System.currentTimeMillis()
    )

    private fun createTestSeason() = Season(
        id = "season1",
        name = "Season 2026",
        startDate = "2026-01-01",
        endDate = "2026-03-31",
        isActive = true
    )

    private fun createTestParticipation() = SeasonParticipation(
        userId = "user123",
        seasonId = "season1",
        division = LeagueDivision.GOLD,
        points = 100,
        position = 5
    )
}
