package com.futebadosparcas.ui.profile

import com.futebadosparcas.data.datasource.ProfilePhotoDataSource
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.usecase.notification.ObserveUnreadCountUseCase
import com.futebadosparcas.util.MockLogExtension
import com.futebadosparcas.util.PreferencesManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.coVerify
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
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.util.Date

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("ProfileViewModel Tests")
@ExtendWith(MockLogExtension::class)
class ProfileViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var userRepository: UserRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var gameRepository: GameRepository
    private lateinit var liveGameRepository: LiveGameRepository
    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var locationRepository: LocationRepository
    private lateinit var observeUnreadCountUseCase: ObserveUnreadCountUseCase
    private lateinit var preferencesManager: PreferencesManager
    private lateinit var profilePhotoDataSource: ProfilePhotoDataSource
    private lateinit var firestore: FirebaseFirestore
    private lateinit var auth: FirebaseAuth
    private lateinit var viewModel: ProfileViewModel

    private val testUser = User(
        id = "user-1", name = "Joao Silva", nickname = "joao",
        experiencePoints = 500, level = 3
    )
    private val testStats = Statistics(id = "stats-1", userId = "user-1", totalGames = 10, totalGoals = 5, totalAssists = 3)

    private fun createFormData(name: String = "Joao", nickname: String? = "joao"): ProfileFormData = ProfileFormData(
        name = name, nickname = nickname,
        preferredFieldTypes = emptyList(), strikerRating = 0.0, midRating = 0.0,
        defenderRating = 0.0, gkRating = 0.0, birthDate = null, gender = null,
        heightCm = null, weightKg = null, dominantFoot = null,
        primaryPosition = null, secondaryPosition = null, playStyle = null,
        experienceYears = null
    )

    private fun createViewModel() = ProfileViewModel(
        userRepository, authRepository, gameRepository, liveGameRepository,
        gamificationRepository, statisticsRepository, locationRepository,
        observeUnreadCountUseCase, preferencesManager, profilePhotoDataSource,
        firestore, auth
    )

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        userRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        gameRepository = mockk(relaxed = true)
        liveGameRepository = mockk(relaxed = true)
        gamificationRepository = mockk(relaxed = true)
        statisticsRepository = mockk(relaxed = true)
        locationRepository = mockk(relaxed = true)
        observeUnreadCountUseCase = mockk(relaxed = true)
        preferencesManager = mockk(relaxed = true)
        profilePhotoDataSource = mockk(relaxed = true)
        firestore = mockk(relaxed = true)
        auth = mockk(relaxed = true)

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
        fun `initial state is Loading`() {
            viewModel = createViewModel()
            assertEquals(ProfileUiState.Loading, viewModel.uiState.value)
        }

        @Test
        @DisplayName("unreadCount inicial eh 0")
        fun `initial unreadCount is 0`() {
            viewModel = createViewModel()
            assertEquals(0, viewModel.unreadCount.value)
        }
    }

    @Nested
    @DisplayName("loadProfile")
    inner class LoadProfileTests {

        @Test
        @DisplayName("loadProfile carrega perfil com sucesso")
        fun `loadProfile loads profile successfully`() = runTest(testDispatcher) {
            val userFlow = MutableStateFlow<User?>(testUser)
            every { userRepository.observeCurrentUser() } returns userFlow
            coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(emptyList())
            coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
            every { preferencesManager.isDevModeEnabled() } returns false

            viewModel = createViewModel()
            viewModel.loadProfile()
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(ProfileUiState.Success::class.java, state)
            val success = state as ProfileUiState.Success
            assertEquals(testUser, success.user)
            assertNotNull(success.statistics)
        }

        @Test
        @DisplayName("loadProfile carrega badges do usuario")
        fun `loadProfile loads user badges`() = runTest(testDispatcher) {
            val userFlow = MutableStateFlow<User?>(testUser)
            every { userRepository.observeCurrentUser() } returns userFlow
            coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(emptyList())
            coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
            every { preferencesManager.isDevModeEnabled() } returns false

            viewModel = createViewModel()
            viewModel.loadProfile()
            advanceUntilIdle()

            coVerify { gamificationRepository.getUserBadges(testUser.id) }
        }
    }

    @Nested
    @DisplayName("updateProfile")
    inner class UpdateProfileTests {

        @Test
        @DisplayName("updateProfile atualiza perfil com sucesso")
        fun `updateProfile updates profile successfully`() = runTest(testDispatcher) {
            val userFlow = MutableStateFlow<User?>(testUser)
            every { userRepository.observeCurrentUser() } returns userFlow
            coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(emptyList())
            coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
            every { preferencesManager.isDevModeEnabled() } returns false
            coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
            coEvery { userRepository.updateUser(any()) } returns Result.success(Unit)
            coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
            coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(emptyList())
            coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)

            viewModel = createViewModel()
            viewModel.loadProfile()
            advanceUntilIdle()

            viewModel.updateProfile(createFormData(name = "Joao Atualizado"), null)
            advanceUntilIdle()

            coVerify { userRepository.updateUser(match { it.name == "Joao Atualizado" }) }
        }

        @Test
        @DisplayName("updateProfile com erro retorna Error")
        fun `updateProfile with error returns Error`() = runTest(testDispatcher) {
            val userFlow = MutableStateFlow<User?>(testUser)
            every { userRepository.observeCurrentUser() } returns userFlow
            coEvery { gamificationRepository.getUserBadges(testUser.id) } returns Result.success(emptyList())
            coEvery { statisticsRepository.getUserStatistics(testUser.id) } returns Result.success(testStats)
            every { preferencesManager.isDevModeEnabled() } returns false
            coEvery { userRepository.getCurrentUser() } returns Result.success(testUser)
            coEvery { userRepository.updateUser(any()) } returns Result.failure(RuntimeException("Erro ao atualizar"))

            viewModel = createViewModel()
            viewModel.loadProfile()
            advanceUntilIdle()

            viewModel.updateProfile(createFormData(name = "Joao Erro"), null)
            advanceUntilIdle()

            assertInstanceOf(ProfileUiState.Error::class.java, viewModel.uiState.value)
        }
    }

    @Nested
    @DisplayName("logout e devMode")
    inner class LogoutAndDevModeTests {

        @Test
        @DisplayName("logout chama authRepository.logout")
        fun `logout calls authRepository logout`() {
            viewModel = createViewModel()
            viewModel.logout()
            coVerify { authRepository.logout() }
        }

        @Test
        @DisplayName("logout altera estado para LoggedOut")
        fun `logout changes state to LoggedOut`() {
            viewModel = createViewModel()
            viewModel.logout()
            assertEquals(ProfileUiState.LoggedOut, viewModel.uiState.value)
        }

        @Test
        @DisplayName("enableDevMode ativa modo desenvolvedor")
        fun `enableDevMode enables dev mode`() {
            every { preferencesManager.isDevModeEnabled() } returns true
            viewModel = createViewModel()
            viewModel.enableDevMode()
            coVerify { preferencesManager.setDevModeEnabled(true) }
        }
    }
}
