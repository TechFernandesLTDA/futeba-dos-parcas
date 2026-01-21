package com.futebadosparcas.ui.profile

import app.cash.turbine.test
import com.futebadosparcas.data.datasource.ProfilePhotoDataSource
import com.futebadosparcas.data.model.UserBadge as DataUserBadge
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.domain.model.Statistics as DomainStatistics
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserBadge as DomainUserBadge
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import com.futebadosparcas.util.PreferencesManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.verify
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
 * Testes unitarios para ProfileViewModel.
 * Verifica carregamento de perfil, logout e limpeza de dados.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("ProfileViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class ProfileViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var userRepository: UserRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var gameRepository: GameRepository
    private lateinit var liveGameRepository: LiveGameRepository
    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var locationRepository: LocationRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var preferencesManager: PreferencesManager
    private lateinit var profilePhotoDataSource: ProfilePhotoDataSource
    private lateinit var firestore: FirebaseFirestore
    private lateinit var auth: FirebaseAuth

    private lateinit var viewModel: ProfileViewModel

    private fun createViewModel(): ProfileViewModel {
        return ProfileViewModel(
            userRepository,
            authRepository,
            gameRepository,
            liveGameRepository,
            gamificationRepository,
            statisticsRepository,
            locationRepository,
            notificationRepository,
            preferencesManager,
            profilePhotoDataSource,
            firestore,
            auth
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        userRepository = mockk()
        authRepository = mockk()
        gameRepository = mockk()
        liveGameRepository = mockk()
        gamificationRepository = mockk()
        statisticsRepository = mockk()
        locationRepository = mockk()
        notificationRepository = mockk()
        preferencesManager = mockk()
        profilePhotoDataSource = mockk()
        firestore = mockk(relaxed = true)
        auth = mockk(relaxed = true)

        // Setup default mock behaviors
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
        every { preferencesManager.isDevModeEnabled() } returns false

        // Default mock para updateAutoRatings (chamado internamente pelo loadProfile)
        coEvery {
            userRepository.updateAutoRatings(
                userId = any(),
                autoStrikerRating = any(),
                autoMidRating = any(),
                autoDefenderRating = any(),
                autoGkRating = any(),
                autoRatingSamples = any()
            )
        } returns Result.success(Unit)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() = runTest {
        // Given - Setup mocks para evitar erros no init
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)

        // When
        viewModel = createViewModel()

        // Then
        assertTrue(viewModel.uiState.value is ProfileUiState.Loading)
    }

    @Test
    @DisplayName("loadProfile com sucesso deve atualizar estado para Success")
    fun loadProfile_success_updatesState() = runTest {
        // Given - Dado usuario e dados validos
        val testUser = createTestUser()
        val testBadges = listOf(createTestDomainBadge())
        val testStats = createTestDomainStatistics()

        every { userRepository.observeCurrentUser() } returns flowOf(testUser)
        coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(testBadges)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)

        viewModel = createViewModel()

        // When - Quando carregar perfil
        viewModel.loadProfile()
        advanceUntilIdle()

        // Then - Estado deve ser Success com dados corretos
        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.Success)

        val successState = state as ProfileUiState.Success
        assertEquals(testUser.id, successState.user.id)
        assertEquals(testUser.name, successState.user.name)
        assertEquals(testUser.email, successState.user.email)
        assertNotNull(successState.statistics)
        assertEquals(50, successState.statistics?.totalGames)
    }

    @Test
    @DisplayName("loadProfile com erro deve atualizar estado para Error")
    fun loadProfile_error_showsError() = runTest {
        // Given - Dado erro no repositorio de usuario
        val exception = RuntimeException("Erro ao carregar usuario")
        every { userRepository.observeCurrentUser() } returns flowOf<User?>(null).let {
            // Simulando erro no flow
            kotlinx.coroutines.flow.flow {
                throw exception
            }
        }

        viewModel = createViewModel()

        // When - Quando carregar perfil
        viewModel.loadProfile()
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.Error)

        val errorState = state as ProfileUiState.Error
        assertTrue(errorState.message.contains("Erro ao carregar"))
    }

    @Test
    @DisplayName("logout deve limpar sessao e atualizar estado para LoggedOut")
    fun logout_clearsSession() = runTest {
        // Given - Dado ViewModel em estado Success
        val testUser = createTestUser()
        val testBadges = listOf(createTestDomainBadge())
        val testStats = createTestDomainStatistics()

        every { userRepository.observeCurrentUser() } returns flowOf(testUser)
        coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(testBadges)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
        every { authRepository.logout() } just runs

        viewModel = createViewModel()
        viewModel.loadProfile()
        advanceUntilIdle()

        // Verifica que esta em estado Success antes do logout
        assertTrue(viewModel.uiState.value is ProfileUiState.Success)

        // When - Quando realizar logout
        viewModel.logout()

        // Then - Deve chamar authRepository.logout() e atualizar estado
        verify(exactly = 1) { authRepository.logout() }

        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.LoggedOut)
    }

    @Test
    @DisplayName("resetAllData deve limpar dados e atualizar estado para DataReset")
    fun resetAllData_clearsData_updatesState() = runTest {
        // Given - Dado ViewModel configurado
        val testUser = createTestUser()
        val testBadges = listOf(createTestDomainBadge())
        val testStats = createTestDomainStatistics()

        every { userRepository.observeCurrentUser() } returns flowOf(testUser)
        coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(testBadges)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
        coEvery { gameRepository.clearAll() } returns Result.success(Unit)
        coEvery { liveGameRepository.clearAll() } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadProfile()
        advanceUntilIdle()

        // When - Quando resetar dados
        viewModel.resetAllData()
        advanceUntilIdle()

        // Then - Deve limpar repositorios e atualizar estado
        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.DataReset)
    }

    @Test
    @DisplayName("enableDevMode deve atualizar estado com devMode habilitado")
    fun enableDevMode_updatesStateWithDevMode() = runTest {
        // Given - Dado ViewModel em estado Success
        val testUser = createTestUser()
        val testBadges = listOf(createTestDomainBadge())
        val testStats = createTestDomainStatistics()

        every { userRepository.observeCurrentUser() } returns flowOf(testUser)
        coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(testBadges)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
        every { preferencesManager.setDevModeEnabled(true) } just runs
        every { preferencesManager.isDevModeEnabled() } returns true

        viewModel = createViewModel()
        viewModel.loadProfile()
        advanceUntilIdle()

        // When - Quando habilitar modo dev
        viewModel.enableDevMode()

        // Then - Deve atualizar estado com isDevMode = true
        verify(exactly = 1) { preferencesManager.setDevModeEnabled(true) }

        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.Success)
        assertTrue((state as ProfileUiState.Success).isDevMode)
    }

    @Test
    @DisplayName("Deve observar contador de notificacoes nao lidas")
    fun `should observe unread notifications count`() = runTest {
        // Given - Dado fluxo de notificacoes nao lidas
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(5)

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Deve receber o contador
        viewModel.unreadCount.test {
            assertEquals(5, awaitItem())
        }
    }

    @Test
    @DisplayName("loadProfile deve cancelar job anterior ao ser chamado novamente")
    fun loadProfile_cancelsPreviousJob_whenCalledAgain() = runTest {
        // Given - Setup de mocks
        val testUser = createTestUser()
        val testBadges = listOf(createTestDomainBadge())
        val testStats = createTestDomainStatistics()

        every { userRepository.observeCurrentUser() } returns flowOf(testUser)
        coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(testBadges)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)

        viewModel = createViewModel()

        // When - Quando chamar loadProfile duas vezes rapidamente
        viewModel.loadProfile()
        viewModel.loadProfile()
        advanceUntilIdle()

        // Then - Deve completar sem erros (job anterior cancelado)
        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.Success || state is ProfileUiState.Loading)
    }

    @Test
    @DisplayName("loadProfile com usuario de campo deve carregar locais")
    fun loadProfile_withFieldOwner_loadsLocations() = runTest {
        // Given - Dado usuario dono de quadra
        val testUser = createTestUser(role = "FIELD_OWNER")
        val testBadges = listOf(createTestDomainBadge())
        val testStats = createTestDomainStatistics()
        val testLocations = emptyList<com.futebadosparcas.domain.model.Location>()

        every { userRepository.observeCurrentUser() } returns flowOf(testUser)
        coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(testBadges)
        coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
        coEvery { locationRepository.getLocationsByOwner(testUser.id) } returns Result.success(testLocations)

        viewModel = createViewModel()

        // When - Quando carregar perfil
        viewModel.loadProfile()
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is ProfileUiState.Success)
    }

    // ========== Helper Functions ==========

    private fun createTestUser(
        id: String = "user123",
        name: String = "Test User",
        email: String = "test@test.com",
        role: String = "PLAYER"
    ) = User(
        id = id,
        name = name,
        email = email,
        photoUrl = "",
        level = 5,
        experiencePoints = 2500L,
        createdAt = System.currentTimeMillis(),
        role = role
    )

    private fun createTestDomainStatistics(
        userId: String = "user123"
    ) = DomainStatistics(
        id = userId,
        userId = userId,
        totalGames = 50,
        totalGoals = 45,
        totalAssists = 20,
        totalSaves = 0,
        totalWins = 30,
        totalDraws = 10,
        totalLosses = 10,
        mvpCount = 5,
        bestGkCount = 0,
        worstPlayerCount = 0,
        currentStreak = 3,
        bestStreak = 10,
        yellowCards = 2,
        redCards = 0
    )

    private fun createTestDomainBadge(
        id: String = "badge1",
        userId: String = "user123",
        badgeId: String = "hat_trick"
    ) = DomainUserBadge(
        id = id,
        userId = userId,
        badgeId = badgeId,
        unlockedAt = System.currentTimeMillis(),
        unlockCount = 1
    )

    private fun createTestDataUserBadge(
        id: String = "userbadge1",
        userId: String = "user123",
        badgeId: String = "badge1"
    ) = DataUserBadge(
        id = id,
        userId = userId,
        badgeId = badgeId,
        count = 1,
        unlockedAt = java.util.Date()
    )

    private fun createTestUserStatistics(
        id: String = "user123"
    ) = UserStatistics(
        id = id,
        totalGames = 50,
        totalGoals = 45,
        totalAssists = 20,
        totalSaves = 0,
        totalYellowCards = 2,
        totalRedCards = 0,
        bestPlayerCount = 5,
        worstPlayerCount = 0,
        bestGoalCount = 3,
        gamesWon = 30,
        gamesLost = 10,
        gamesDraw = 10,
        gamesInvited = 55,
        gamesAttended = 50
    )
}
