package com.futebadosparcas.ui.statistics

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import app.cash.turbine.test
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.data.repository.IStatisticsRepository
import com.futebadosparcas.data.repository.UserRepository
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
import org.junit.Rule

/**
 * Testes unitários para StatisticsViewModel.
 * Verifica carregamento de estatísticas pessoais e rankings.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("StatisticsViewModel Tests")
class StatisticsViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var statisticsRepository: IStatisticsRepository
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
            createTestStatistics("mvp1", bestPlayerCount = 10),
            createTestStatistics("mvp2", bestPlayerCount = 8)
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
        assertNotNull(successState.stats.myStats)
        assertEquals(2, successState.stats.topScorers.size)
        assertEquals(2, successState.stats.topGoalkeepers.size)
        assertEquals(2, successState.stats.bestPlayers.size)
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
        assertTrue((state as StatisticsUiState.Error).message.contains("Erro"))
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
        assertEquals(2.0, state.stats.topScorers.first().average, 0.01)
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
        assertEquals(1, state.stats.topScorers.size)
        assertEquals("Jogador", state.stats.topScorers.first().playerName) // Fallback name
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
        assertEquals(1, state.stats.topScorers[0].rank)
        assertEquals(2, state.stats.topScorers[1].rank)
        assertEquals(3, state.stats.topScorers[2].rank)
        assertEquals(50L, state.stats.topScorers[0].value)
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
        assertEquals(3, state.stats.goalEvolution.size)
        assertEquals(5, state.stats.goalEvolution["1/2026"])
    }

    @Test
    @DisplayName("Deve transicionar por estados corretamente")
    fun `loadStatistics should transition through states`() = runTest {
        // Given
        coEvery { statisticsRepository.getMyStatistics() } returns Result.success(createTestStatistics("me"))
        coEvery { statisticsRepository.getTopScorers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getTopGoalkeepers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getBestPlayers(5) } returns Result.success(emptyList())
        coEvery { statisticsRepository.getGoalsHistory(any()) } returns Result.success(emptyMap())
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(emptyList())

        viewModel = StatisticsViewModel(statisticsRepository, userRepository)

        // When/Then
        viewModel.uiState.test {
            // Estado inicial
            assertTrue(awaitItem() is StatisticsUiState.Loading)

            // Carregar dados
            viewModel.loadStatistics()

            // Transição para Loading
            val loadingState = awaitItem()
            assertTrue(loadingState is StatisticsUiState.Loading)

            advanceUntilIdle()

            // Estado final
            val finalState = awaitItem()
            assertTrue(finalState is StatisticsUiState.Success)
        }
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
        val scorer = state.stats.topScorers.first()
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
        assertTrue(state.stats.goalEvolution.isEmpty()) // Fallback para mapa vazio
    }

    // Helper functions
    private fun createTestStatistics(
        id: String,
        totalGoals: Int = 10,
        totalSaves: Int = 5,
        bestPlayerCount: Int = 2,
        totalGames: Int = 20
    ) = UserStatistics(
        id = id,
        totalGames = totalGames,
        totalGoals = totalGoals,
        totalAssists = 5,
        totalSaves = totalSaves,
        totalYellowCards = 1,
        totalRedCards = 0,
        bestPlayerCount = bestPlayerCount,
        worstPlayerCount = 0,
        bestGoalCount = 1,
        gamesWon = 10,
        gamesLost = 5,
        gamesDraw = 5
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
