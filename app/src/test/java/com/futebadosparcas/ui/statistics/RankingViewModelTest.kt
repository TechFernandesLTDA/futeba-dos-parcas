package com.futebadosparcas.ui.statistics

import com.futebadosparcas.data.cache.MemoryCache
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.domain.ranking.LeagueService
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
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
 * Testes unitarios para RankingViewModel.
 * Verifica carregamento de ranking, cache, selecao de categoria/periodo e evolucao.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("RankingViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class RankingViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var rankingRepository: RankingRepository
    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var userRepository: UserRepository
    private lateinit var leagueService: LeagueService
    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var auth: FirebaseAuth
    private lateinit var memoryCache: MemoryCache
    private lateinit var firebaseUser: FirebaseUser

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        rankingRepository = mockk()
        statisticsRepository = mockk()
        userRepository = mockk()
        leagueService = mockk()
        gamificationRepository = mockk()
        auth = mockk()
        memoryCache = mockk(relaxed = true)
        firebaseUser = mockk()

        every { auth.currentUser } returns firebaseUser
        every { firebaseUser.uid } returns "current-user"
        every { memoryCache.get<List<PlayerRankingItem>>(any()) } returns null
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): RankingViewModel {
        return RankingViewModel(
            rankingRepository, statisticsRepository, userRepository,
            leagueService, gamificationRepository, auth, memoryCache
        )
    }

    // ========== Estado Inicial ==========

    @Test
    @DisplayName("Estado inicial deve ter isLoading=true")
    fun init_default_isLoadingTrue() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())

        // When
        val viewModel = createViewModel()

        // Then
        assertTrue(viewModel.rankingState.value.isLoading)
    }

    // ========== Carregamento de Ranking ==========

    @Test
    @DisplayName("Deve carregar ranking com sucesso e calcular posicao do usuario")
    fun loadRanking_success_updatesStateAndPosition() = runTest {
        // Given
        val rankings = listOf(
            PlayerRankingItem(userId = "user1", playerName = "Jogador 1", value = 50L),
            PlayerRankingItem(userId = "current-user", playerName = "Eu", value = 30L),
            PlayerRankingItem(userId = "user3", playerName = "Jogador 3", value = 20L)
        )
        coEvery { rankingRepository.getRanking(RankingCategory.GOALS, any()) } returns Result.success(rankings)

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        val state = viewModel.rankingState.value
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertEquals(3, state.rankings.size)
        assertEquals(2, state.myPosition) // current-user e o 2o na lista
    }

    @Test
    @DisplayName("Deve atualizar estado com erro quando ranking falha")
    fun loadRanking_failure_updatesStateWithError() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns
            Result.failure(Exception("Erro de rede"))

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        val state = viewModel.rankingState.value
        assertFalse(state.isLoading)
        assertEquals("Erro de rede", state.error)
    }

    @Test
    @DisplayName("Deve lidar com excecao inesperada no ranking")
    fun loadRanking_exception_updatesStateWithError() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } throws RuntimeException("Crash")

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        val state = viewModel.rankingState.value
        assertFalse(state.isLoading)
        assertNotNull(state.error)
    }

    @Test
    @DisplayName("Ranking vazio deve ter isEmpty=true")
    fun loadRanking_empty_isEmptyTrue() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        val state = viewModel.rankingState.value
        assertTrue(state.isEmpty)
        assertEquals(0, state.myPosition)
    }

    // ========== Selecao de Categoria ==========

    @Test
    @DisplayName("Selecionar categoria ASSISTS deve recarregar ranking")
    fun selectCategory_assists_reloadsRanking() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.selectCategory(RankingCategory.ASSISTS)
        advanceUntilIdle()

        // Then
        assertEquals(RankingCategory.ASSISTS, viewModel.rankingState.value.selectedCategory)
    }

    // ========== Selecao de Periodo ==========

    @Test
    @DisplayName("Selecionar periodo MONTHLY deve usar getRankingByPeriod")
    fun selectPeriod_monthly_usesRankingByPeriod() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())
        coEvery { rankingRepository.getRankingByPeriod(any(), any(), any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.selectPeriod(RankingPeriod.MONTH)
        advanceUntilIdle()

        // Then
        assertEquals(RankingPeriod.MONTH, viewModel.rankingState.value.selectedPeriod)
    }

    // ========== Cache ==========

    @Test
    @DisplayName("Cache hit deve retornar dados sem chamar repositorio")
    fun loadRanking_cacheHit_usesCache() = runTest {
        // Given
        val cachedRankings = listOf(
            PlayerRankingItem(userId = "u1", playerName = "P1", value = 100L)
        )
        every { memoryCache.get<List<PlayerRankingItem>>(any()) } returns cachedRankings

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        val state = viewModel.rankingState.value
        assertEquals(1, state.rankings.size)
        assertEquals("P1", state.rankings[0].playerName)
    }

    @Test
    @DisplayName("refreshRanking deve buscar do servidor ignorando cache")
    fun refreshRanking_forceRefresh_ignoresCache() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.refreshRanking()
        advanceUntilIdle()

        // Then - Deve ter salvo no cache
        verify(atLeast = 1) { memoryCache.put(any(), any<List<PlayerRankingItem>>(), any()) }
    }

    @Test
    @DisplayName("invalidateRankingCache deve remover cache por padrao")
    fun invalidateRankingCache_removesAllRankingCache() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.invalidateRankingCache()

        // Then
        verify { memoryCache.removeByPattern("ranking_") }
    }

    // ========== Posicao do usuario nao autenticado ==========

    @Test
    @DisplayName("Posicao deve ser 0 quando usuario nao esta autenticado")
    fun loadRanking_noAuth_positionZero() = runTest {
        // Given
        every { auth.currentUser } returns null
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(
            listOf(PlayerRankingItem(userId = "u1", playerName = "P1", value = 100L))
        )

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        assertEquals(0, viewModel.rankingState.value.myPosition)
    }

    // ========== Cancelamento de Jobs ==========

    @Test
    @DisplayName("Chamadas multiplas de loadRanking devem cancelar jobs anteriores")
    fun loadRanking_calledMultipleTimes_cancelsPrevious() = runTest {
        // Given
        coEvery { rankingRepository.getRanking(any(), any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()

        // When
        viewModel.loadRanking()
        viewModel.loadRanking()
        viewModel.loadRanking()
        advanceUntilIdle()

        // Then - Nao deve lançar excecao
        assertFalse(viewModel.rankingState.value.isLoading)
    }
}
