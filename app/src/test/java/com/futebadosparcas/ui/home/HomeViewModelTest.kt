package com.futebadosparcas.ui.home

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.futebadosparcas.data.model.Activity as AndroidActivity
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.UserStatistics as AndroidUserStatistics
import com.futebadosparcas.data.repository.ActivityRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.StatisticsRepository
import com.futebadosparcas.domain.cache.SharedCacheService
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.domain.model.User as SharedUser
import com.futebadosparcas.domain.prefetch.PrefetchService
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.ConnectivityMonitor
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
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
import org.junit.jupiter.api.extension.ExtendWith
import java.util.Date

/**
 * Testes unitários para HomeViewModel.
 * Verifica estados de UI, carregamento de dados e integração com repositórios.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("HomeViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
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

    private fun createViewModel(): HomeViewModel {
        return HomeViewModel(
            gameRepository,
            userRepository,
            notificationRepository,
            gamificationRepository,
            statisticsRepository,
            activityRepository,
            gameConfirmationRepository,
            connectivityMonitor,
            SavedStateHandle(),
            sharedCache,
            prefetchService
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gameRepository = mockk()
        userRepository = mockk()
        notificationRepository = mockk()
        gamificationRepository = mockk()
        statisticsRepository = mockk()
        activityRepository = mockk()
        gameConfirmationRepository = mockk()
        connectivityMonitor = mockk()
        savedStateHandle = SavedStateHandle()
        sharedCache = mockk(relaxed = true)
        prefetchService = mockk(relaxed = true)

        // Setup default mock behaviors
        every { connectivityMonitor.isConnected } returns flowOf(true)
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
        every { userRepository.getCurrentUserId() } returns "user123"

        // Setup default mocks for init loading
        coEvery { userRepository.getCurrentUser() } returns Result.success(createTestUser())
        coEvery { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(createTestStatistics())
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any(), any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(createTestSeason())
        coEvery { gamificationRepository.getUserParticipation(any(), any()) } returns Result.success(createTestParticipation())
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        // NAO criar viewModel aqui - init block executa coroutines imediatamente
        // Cada teste deve chamar createViewModel() quando necessario para controlar
        // o momento da inicializacao. Isso garante que testes de estado inicial
        // possam verificar o estado Loading antes de advanceUntilIdle().
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() {
        // Given - ViewModel criado no setup com StandardTestDispatcher (coroutines nao executam automaticamente)
        // Criar novo ViewModel para garantir que estado inicial e verificado imediatamente
        val freshViewModel = createViewModel()

        // Then - Estado inicial deve ser Loading (antes de advanceUntilIdle)
        assertTrue(
            freshViewModel.uiState.value is HomeUiState.Loading,
            "Estado esperado: Loading, obtido: ${freshViewModel.uiState.value::class.simpleName}"
        )
    }

    @Test
    @DisplayName("Deve observar contador de notificações não lidas")
    fun `should observe unread notifications count`() = runTest {
        // Given - Dado um fluxo de notificações não lidas
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(5)

        // When - Quando criar ViewModel
        val testViewModel = createViewModel()

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
        val testViewModel = createViewModel()

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
        val testGames = listOf(createTestGameWithConfirmations("1"), createTestGameWithConfirmations("2"))
        val testStats = createTestStatistics()
        val testActivities = listOf(createTestActivity())
        val testSeason = createTestSeason()
        val testParticipation = createTestParticipation()

        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        coEvery { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(testGames))
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(testActivities)
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(testUser.id) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(testUser.id, any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(testSeason)
        coEvery { gamificationRepository.getUserParticipation(testUser.id, testSeason.id) } returns Result.success(testParticipation)
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        // When - Quando criar ViewModel e carregar dados
        viewModel = createViewModel()
        viewModel.loadHomeData(forceRetry = true)
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Success)

        val successState = state as HomeUiState.Success
        assertEquals(testUser, successState.user)
        assertEquals(2, successState.games.size)
        assertEquals(LoadingState.Success, viewModel.loadingState.value)
    }

    @Test
    @DisplayName("Deve falhar quando usuário não está logado")
    fun `loadHomeData should fail when user not logged in`() = runTest {
        // Given - Dado erro ao obter usuário
        val exception = Exception("Usuário não autenticado")
        coEvery { userRepository.getCurrentUser() } returns Result.failure(exception)
        coEvery { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))

        // When - Quando criar ViewModel e carregar dados
        viewModel = createViewModel()
        viewModel.loadHomeData(forceRetry = true)
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Error)
    }

    @Test
    @DisplayName("Deve alternar modo de visualização")
    fun `toggleViewMode should switch between grid and list view`() = runTest {
        // Given - Dado estado Success com isGridView = false
        val testUser = createTestUser()
        coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
        coEvery { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(createTestStatistics())
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any(), any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(createTestSeason())
        coEvery { gamificationRepository.getUserParticipation(any(), any()) } returns Result.success(createTestParticipation())
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        viewModel = createViewModel()
        viewModel.loadHomeData(forceRetry = true)
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
        viewModel = createViewModel()

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
        coEvery { gameRepository.getLiveAndUpcomingGamesFlow() } returns flowOf(Result.success(emptyList()))
        coEvery { statisticsRepository.getUserStatistics(any()) } returns Result.success(createTestStatistics())
        coEvery { activityRepository.getRecentActivities(any()) } returns Result.success(emptyList())
        coEvery { gameRepository.getPublicGames(any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getUserStreak(any()) } returns Result.success(null)
        coEvery { gamificationRepository.getActiveChallenges() } returns Result.success(emptyList())
        coEvery { gamificationRepository.getRecentBadges(any(), any()) } returns Result.success(emptyList())
        coEvery { gamificationRepository.getActiveSeason() } returns Result.success(createTestSeason())
        coEvery { gamificationRepository.getUserParticipation(any(), any()) } returns Result.success(createTestParticipation())
        coEvery { gamificationRepository.getChallengesProgress(any(), any()) } returns Result.success(emptyList())

        // When - Quando criar ViewModel e chamar loadHomeData duas vezes rapidamente
        viewModel = createViewModel()
        viewModel.loadHomeData(forceRetry = true)
        viewModel.loadHomeData(forceRetry = true)
        advanceUntilIdle()

        // Then - Deve completar sem erros (job anterior cancelado)
        assertTrue(viewModel.uiState.value is HomeUiState.Success || viewModel.uiState.value is HomeUiState.Loading)
    }

    // Helper functions para criar dados de teste
    private fun createTestUser() = SharedUser(
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

    private fun createTestGameWithConfirmations(id: String) = GameWithConfirmations(
        game = createTestGame(id),
        confirmedCount = 10,
        isUserConfirmed = false
    )

    private fun createTestStatistics() = AndroidUserStatistics(
        id = "user123",
        totalGames = 50,
        totalGoals = 45,
        totalAssists = 20,
        totalSaves = 0,
        totalYellowCards = 0,
        totalRedCards = 0,
        bestPlayerCount = 5,
        worstPlayerCount = 0,
        bestGoalCount = 2,
        gamesWon = 30,
        gamesLost = 10,
        gamesDraw = 10,
        gamesInvited = 50,
        gamesAttended = 50
    )

    private fun createTestActivity() = AndroidActivity(
        id = "act1",
        userId = "user123",
        userName = "Test User",
        type = "GAME_CONFIRMED",
        title = "Presença confirmada",
        description = "Você confirmou presença no jogo",
        createdAt = Date(System.currentTimeMillis())
    )

    private fun createTestSeason() = Season(
        id = "season1",
        name = "Season 2026",
        description = "Temporada de teste",
        startDate = parseDate("2026-01-01"),
        endDate = parseDate("2026-03-31"),
        isActive = true
    )

    private fun parseDate(dateStr: String): Long {
        val format = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        return format.parse(dateStr)?.time ?: 0L
    }

    private fun createTestParticipation() = SeasonParticipation(
        id = "participation1",
        userId = "user123",
        seasonId = "season1",
        division = com.futebadosparcas.domain.model.LeagueDivision.OURO.name,
        leagueRating = 55,
        points = 100,
        gamesPlayed = 10,
        wins = 5,
        draws = 2,
        losses = 3,
        goals = 15,
        assists = 5,
        saves = 0,
        mvpCount = 2
    )
}
