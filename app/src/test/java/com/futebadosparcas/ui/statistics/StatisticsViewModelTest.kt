package com.futebadosparcas.ui.statistics

import app.cash.turbine.test
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
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
 * Testes unitários para StatisticsViewModel.
 * Verifica carregamento de estatísticas pessoais e rankings.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("StatisticsViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class StatisticsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var userRepository: UserRepository

    private lateinit var viewModel: StatisticsViewModel

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        statisticsRepository = mockk()
        userRepository = mockk()
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() = runTest {
        // Given - Setup mocks
        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(emptyList())

        // When
        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // Then
        assertTrue(viewModel.uiState.value is StatisticsUiState.Loading)
    }

    @Test
    @DisplayName("Deve carregar estatísticas com sucesso")
    fun `loadStatistics should load successfully`() = runTest {
        // Given
        val myStats = createTestStatistics("user1")
        val topScorers = listOf(
            createTestStatistics("scorer1", totalGoals = 50),
            createTestStatistics("scorer2", totalGoals = 40)
        )
        val topGoalkeepers = listOf(
            createTestStatistics("gk1", totalSaves = 100),
            createTestStatistics("gk2", totalSaves = 80)
        )
        val bestPlayers = listOf(
            createTestStatistics("mvp1", mvpCount = 10),
            createTestStatistics("mvp2", mvpCount = 8)
        )
        val goalsHistory = mapOf("1/2026" to 5, "2/2026" to 8)
        val users = listOf(
            createTestUser("scorer1", "Artilheiro 1"),
            createTestUser("scorer2", "Artilheiro 2"),
            createTestUser("gk1", "Goleiro 1"),
            createTestUser("gk2", "Goleiro 2"),
            createTestUser("mvp1", "MVP 1"),
            createTestUser("mvp2", "MVP 2")
        )

        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(myStats)
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(topScorers)
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(topGoalkeepers)
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(bestPlayers)
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(goalsHistory)
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(users)

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is StatisticsUiState.Success)
        val successState = state as StatisticsUiState.Success
        assertNotNull(successState.statistics.myStats)
        assertEquals(2, successState.statistics.topScorers.size)
        assertEquals(2, successState.statistics.topGoalkeepers.size)
        assertEquals(2, successState.statistics.bestPlayers.size)
    }

    @Test
    @DisplayName("Deve retornar Error quando repositório falhar")
    fun `loadStatistics should return Error when repository fails`() = runTest {
        // Given
        val exception = Exception("Erro ao carregar estatísticas")
        coEvery { statisticsRepository.getMyStatistics() } returns Result.failure(exception)
        coEvery { statisticsRepository.getTopScorers(any()) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getTopGoalkeepers(any()) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(any()) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is StatisticsUiState.Error)
    }

    @Test
    @DisplayName("Deve calcular média de gols corretamente")
    fun `loadStatistics should calculate goal average correctly`() = runTest {
        // Given
        val topScorers = listOf(
            createTestStatistics("scorer1", totalGoals = 20, totalGames = 10) // Média: 2.0
        )
        val users = listOf(createTestUser("scorer1", "Artilheiro"))

        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(topScorers)
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(users)

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value as StatisticsUiState.Success
        assertEquals(2.0, state.statistics.topScorers.first().average, 0.01)
    }

    @Test
    @DisplayName("Deve lidar com usuários não encontrados graciosamente")
    fun `loadStatistics should handle missing users gracefully`() = runTest {
        // Given
        val topScorers = listOf(createTestStatistics("unknown_user", totalGoals = 50))

        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(topScorers)
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(emptyList()) // User not found

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value as StatisticsUiState.Success
        assertEquals(1, state.statistics.topScorers.size)
        assertEquals("Jogador", state.statistics.topScorers.first().playerName) // Fallback name
    }

    @Test
    @DisplayName("Deve ordenar artilheiros por rank corretamente")
    fun `loadStatistics should rank top scorers correctly`() = runTest {
        // Given
        val topScorers = listOf(
            createTestStatistics("scorer1", totalGoals = 50),
            createTestStatistics("scorer2", totalGoals = 40),
            createTestStatistics("scorer3", totalGoals = 30)
        )
        val users = listOf(
            createTestUser("scorer1", "Primeiro"),
            createTestUser("scorer2", "Segundo"),
            createTestUser("scorer3", "Terceiro")
        )

        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(topScorers)
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(users)

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value as StatisticsUiState.Success
        assertEquals(1, state.statistics.topScorers[0].rank)
        assertEquals(2, state.statistics.topScorers[1].rank)
        assertEquals(3, state.statistics.topScorers[2].rank)
        assertEquals(50L, state.statistics.topScorers[0].value)
    }

    @Test
    @DisplayName("Deve incluir histórico de gols na resposta")
    fun `loadStatistics should include goals history`() = runTest {
        // Given
        val goalsHistory = mapOf(
            "1/2026" to 5,
            "2/2026" to 8,
            "3/2026" to 3
        )

        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(goalsHistory)
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(emptyList())

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value as StatisticsUiState.Success
        assertEquals(3, state.statistics.goalEvolution.size)
        assertEquals(5, state.statistics.goalEvolution["1/2026"])
    }

    @Test
    @DisplayName("Deve incluir nível e apelido do jogador")
    fun `loadStatistics should include player level and nickname`() = runTest {
        // Given
        val topScorers = listOf(createTestStatistics("scorer1", totalGoals = 50))
        val users = listOf(
            User(
                id = "scorer1",
                name = "Jogador 1",
                nickname = "Craque",
                email = "scorer1@test.com",
                level = 15,
                experiencePoints = 5000L,
                createdAt = System.currentTimeMillis()
            )
        )

        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(topScorers)
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(users)

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value as StatisticsUiState.Success
        val scorer = state.statistics.topScorers.first()
        assertEquals("Craque", scorer.nickname)
        assertEquals(15, scorer.level)
    }

    @Test
    @DisplayName("Deve lidar com falha ao buscar histórico de gols")
    fun `loadStatistics should handle goals history failure gracefully`() = runTest {
        // Given
        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.failure(Exception("Erro"))
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(emptyList())

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When
        viewModel.loadStatistics()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value as StatisticsUiState.Success
        assertTrue(state.statistics.goalEvolution.isEmpty()) // Fallback para mapa vazio
    }

    // Helper functions
    private fun createTestStatistics(
        id: String,
        totalGoals: Int = 10,
        totalSaves: Int = 5,
        mvpCount: Int = 2,
        totalGames: Int = 20
    ) = Statistics(
        id = id,
        userId = id,
        totalGames = totalGames,
        totalGoals = totalGoals,
        totalAssists = 5,
        totalSaves = totalSaves,
        totalWins = 10,
        totalDraws = 5,
        totalLosses = 5,
        mvpCount = mvpCount,
        bestGkCount = 0,
        worstPlayerCount = 0,
        currentStreak = 0,
        bestStreak = 0,
        yellowCards = 1,
        redCards = 0
    )

    private fun createTestUser(
        id: String,
        name: String,
        nickname: String? = null,
        level: Int = 5
    ) = User(
        id = id,
        name = name,
        nickname = nickname,
        email = "$id@test.com",
        photoUrl = "",
        level = level,
        experiencePoints = 1000L,
        createdAt = System.currentTimeMillis()
    )
}
