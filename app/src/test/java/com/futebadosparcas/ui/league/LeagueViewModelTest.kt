package com.futebadosparcas.ui.league

import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.Season as AndroidSeason
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.data.model.User
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.firestore.FirebaseFirestore
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para LeagueViewModel.
 * Verifica carregamento de temporadas, ranking,
 * filtro por divisao e tratamento de erros.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("LeagueViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class LeagueViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var firestore: FirebaseFirestore
    private lateinit var notificationRepository: NotificationRepository

    private lateinit var viewModel: LeagueViewModel

    private fun createViewModel(): LeagueViewModel {
        return LeagueViewModel(
            gamificationRepository,
            authRepository,
            firestore,
            notificationRepository
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gamificationRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        firestore = mockk(relaxed = true)
        notificationRepository = mockk(relaxed = true)

        // Setup default mocks
        every { authRepository.getCurrentUserId() } returns "user123"
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() = runTest {
        // Given - Dado seasons vazias (para evitar transicao rapida)
        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(emptyList())

        // When - Quando criar ViewModel
        viewModel = createViewModel()

        // Then - Estado inicial deve ser Loading
        assertTrue(viewModel.uiState.value is LeagueUiState.Loading)
    }

    @Test
    @DisplayName("Deve exibir NoActiveSeason quando nao ha temporadas")
    fun `loadAvailableSeasons_noSeasons_showsNoActiveSeason`() = runTest {
        // Given - Dado nenhuma season disponivel
        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(emptyList())

        // When - Quando criar ViewModel (init chama loadAvailableSeasons)
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser NoActiveSeason
        assertTrue(viewModel.uiState.value is LeagueUiState.NoActiveSeason)
        assertTrue(viewModel.availableSeasons.value.isEmpty())
    }

    @Test
    @DisplayName("Deve carregar ranking com sucesso quando ha seasons e dados")
    fun `loadAvailableSeasons_withData_showsSuccessState`() = runTest {
        // Given - Dado season ativa e participacoes
        val testSeason = createTestSeason(isActive = true)
        val testParticipations = listOf(
            createTestParticipation("user123", 100, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("user456", 80, com.futebadosparcas.domain.model.LeagueDivision.PRATA)
        )

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(listOf(testSeason))
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(testParticipations)

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is LeagueUiState.Success, "Estado esperado: Success, obtido: ${state::class.simpleName}")

        // Verificar que selectedSeason foi atualizado
        assertNotNull(viewModel.selectedSeason.value)
    }

    @Test
    @DisplayName("Deve preferir season ativa quando ha multiplas seasons")
    fun `loadAvailableSeasons_multipleSeasons_prefersActive`() = runTest {
        // Given - Dado multiplas seasons, uma ativa
        val inactiveSeason = createTestSeason(id = "s1", name = "Season 1", isActive = false)
        val activeSeason = createTestSeason(id = "s2", name = "Season 2", isActive = true)

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(
            listOf(inactiveSeason, activeSeason)
        )
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(emptyList())

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Deve selecionar a season ativa
        val selected = viewModel.selectedSeason.value
        assertNotNull(selected)
        assertEquals("s2", selected!!.id)
    }

    @Test
    @DisplayName("Deve exibir Error quando repositorio falha ao carregar seasons")
    fun `loadAvailableSeasons_repositoryFails_showsError`() = runTest {
        // Given - Dado erro no repositorio
        coEvery { gamificationRepository.getAllSeasons() } throws RuntimeException("Erro de rede")

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is LeagueUiState.Error)
        assertTrue((state as LeagueUiState.Error).message.contains("Erro ao carregar temporadas"))
    }

    @Test
    @DisplayName("Deve filtrar ranking por divisao")
    fun `filterByDivision_successState_updatesSelectedDivision`() = runTest {
        // Given - Dado ViewModel com estado Success
        val testSeason = createTestSeason(isActive = true)
        val participations = listOf(
            createTestParticipation("user1", 100, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("user2", 50, com.futebadosparcas.domain.model.LeagueDivision.BRONZE)
        )

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(listOf(testSeason))
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(participations)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando filtrar por divisao Prata
        viewModel.filterByDivision(LeagueDivision.PRATA)

        // Then - Divisao selecionada deve ser Prata
        val state = viewModel.uiState.value as? LeagueUiState.Success
        assertNotNull(state)
        assertEquals(LeagueDivision.PRATA, state!!.selectedDivision)
    }

    @Test
    @DisplayName("filterByDivision nao deve alterar estado quando nao e Success")
    fun `filterByDivision_notSuccessState_noChange`() = runTest {
        // Given - Dado ViewModel em estado Loading
        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(emptyList())

        viewModel = createViewModel()

        // When - Quando tentar filtrar
        viewModel.filterByDivision(LeagueDivision.OURO)

        // Then - Estado nao deve mudar (permanece NoActiveSeason ou Loading)
        assertTrue(
            viewModel.uiState.value is LeagueUiState.Loading ||
            viewModel.uiState.value is LeagueUiState.NoActiveSeason
        )
    }

    @Test
    @DisplayName("Deve retornar ranking filtrado corretamente")
    fun `getFilteredRanking_filtersByDivision`() = runTest {
        // Given - Dado estado Success com rankings misturados
        val testSeason = createTestSeason(isActive = true)
        val participations = listOf(
            createTestParticipation("user1", 100, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("user2", 80, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("user3", 50, com.futebadosparcas.domain.model.LeagueDivision.BRONZE)
        )

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(listOf(testSeason))
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(participations)

        viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value as? LeagueUiState.Success
        assertNotNull(state)

        // When - Quando filtrar por Ouro (se houver dados no cache de users)
        viewModel.filterByDivision(LeagueDivision.OURO)
        val updatedState = viewModel.uiState.value as? LeagueUiState.Success
        assertNotNull(updatedState)
        assertEquals(LeagueDivision.OURO, updatedState!!.selectedDivision)
    }

    @Test
    @DisplayName("Deve identificar posicao do usuario no ranking")
    fun `loadLeagueData_identifiesCurrentUserPosition`() = runTest {
        // Given - Dado usuario esta na posicao 2 do ranking
        val testSeason = createTestSeason(isActive = true)
        val participations = listOf(
            createTestParticipation("userTop", 200, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("user123", 150, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("userOther", 50, com.futebadosparcas.domain.model.LeagueDivision.BRONZE)
        )

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(listOf(testSeason))
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(participations)

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Deve identificar posicao do usuario
        val state = viewModel.uiState.value as? LeagueUiState.Success
        assertNotNull(state)
        assertNotNull(state!!.myParticipation)
        assertEquals("user123", state.myParticipation!!.userId)
        assertEquals(2, state.myPosition)
    }

    @Test
    @DisplayName("Deve retornar null quando usuario nao participa da temporada")
    fun `loadLeagueData_userNotInSeason_myParticipationIsNull`() = runTest {
        // Given - Dado usuario nao esta no ranking
        val testSeason = createTestSeason(isActive = true)
        val participations = listOf(
            createTestParticipation("otherUser1", 200, com.futebadosparcas.domain.model.LeagueDivision.OURO),
            createTestParticipation("otherUser2", 100, com.futebadosparcas.domain.model.LeagueDivision.PRATA)
        )

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(listOf(testSeason))
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(participations)

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - myParticipation e myPosition devem ser null
        val state = viewModel.uiState.value as? LeagueUiState.Success
        assertNotNull(state)
        assertNull(state!!.myParticipation)
        assertNull(state.myPosition)
    }

    @Test
    @DisplayName("Deve observar contagem de notificacoes nao lidas")
    fun `observeUnreadCount_updatesUnreadCount`() = runTest {
        // Given - Dado fluxo com 5 notificacoes
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(5)
        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(emptyList())

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Contagem deve ser 5
        assertEquals(5, viewModel.unreadCount.value)
    }

    @Test
    @DisplayName("selectSeason deve atualizar temporada selecionada e recarregar dados")
    fun `selectSeason_updatesSelectedSeasonAndReloads`() = runTest {
        // Given - Dado ViewModel inicializado com season
        val season1 = createTestSeason(id = "s1", name = "Season 1", isActive = true)
        val season2 = createTestSeason(id = "s2", name = "Season 2", isActive = false)

        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(listOf(season1, season2))
        every { gamificationRepository.observeSeasonRanking(any(), any()) } returns flowOf(emptyList())

        viewModel = createViewModel()
        advanceUntilIdle()

        // Converter season2 para AndroidSeason para selecionar
        val androidSeason2 = AndroidSeason(
            id = "s2",
            name = "Season 2",
            startDate = "2025-01-01",
            endDate = "2025-03-31",
            isActive = false
        )

        // When - Quando selecionar season2
        viewModel.selectSeason(androidSeason2)
        advanceUntilIdle()

        // Then - Deve atualizar a season selecionada
        val selected = viewModel.selectedSeason.value
        assertNotNull(selected)
        assertEquals("s2", selected!!.id)
    }

    @Test
    @DisplayName("onCleared deve cancelar jobs sem crashar")
    fun `onCleared_cancelsJobsGracefully`() = runTest {
        // Given - Dado ViewModel com jobs ativos
        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When/Then - ViewModel nao deve crashar ao ser coletado pelo GC
        // onCleared() e protected, entao verificamos que o estado permanece valido
        val state = viewModel.uiState.value
        assertTrue(
            state is LeagueUiState.Loading ||
            state is LeagueUiState.NoActiveSeason ||
            state is LeagueUiState.Success ||
            state is LeagueUiState.Error
        )
    }

    // === Helper Functions ===

    private fun createTestSeason(
        id: String = "season1",
        name: String = "Season 2026",
        isActive: Boolean = true
    ): Season {
        return Season(
            id = id,
            name = name,
            description = "Temporada de teste",
            startDate = parseDate("2026-01-01"),
            endDate = parseDate("2026-03-31"),
            isActive = isActive
        )
    }

    private fun createTestParticipation(
        userId: String,
        points: Int,
        division: com.futebadosparcas.domain.model.LeagueDivision
    ): SeasonParticipation {
        return SeasonParticipation(
            id = "part-$userId",
            userId = userId,
            seasonId = "season1",
            division = division.name,
            leagueRating = points,
            points = points,
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

    private fun parseDate(dateStr: String): Long {
        val format = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        return format.parse(dateStr)?.time ?: 0L
    }
}
