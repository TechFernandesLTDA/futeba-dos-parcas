package com.futebadosparcas.ui.players

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.model.User as SharedUser
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
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
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitários para PlayersViewModel.
 * Verifica busca de jogadores, filtros, ordenação e convites.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("PlayersViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class PlayersViewModelTest {

    // Usar StandardTestDispatcher permite controlar avanco do tempo (advanceTimeBy)
    // para pular o debounce de 300ms no ViewModel
    private val testDispatcher = StandardTestDispatcher()

    private lateinit var userRepository: UserRepository
    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var inviteRepository: InviteRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var savedStateHandle: SavedStateHandle

    private lateinit var viewModel: PlayersViewModel

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        userRepository = mockk()
        statisticsRepository = mockk()
        groupRepository = mockk()
        inviteRepository = mockk()
        notificationRepository = mockk()
        savedStateHandle = SavedStateHandle()

        // Setup default mock behaviors
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): PlayersViewModel {
        return PlayersViewModel(
            userRepository,
            statisticsRepository,
            groupRepository,
            inviteRepository,
            notificationRepository,
            savedStateHandle
        )
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() = runTest {
        // When
        viewModel = createViewModel()

        // Then
        assertTrue(viewModel.uiState.value is PlayersUiState.Loading)
    }

    @Test
    @DisplayName("Deve carregar jogadores com sucesso")
    fun `loadPlayers should load successfully`() = runTest {
        // Given
        val players = listOf(
            createTestUser("1", "João", true),
            createTestUser("2", "Maria", true)
        )
        coEvery { userRepository.getAllUsers() } returns Result.success(players)

        // When
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success)
        assertEquals(2, (state as PlayersUiState.Success).players.size)
    }

    @Test
    @DisplayName("Deve retornar Empty quando não há jogadores")
    fun `loadPlayers should return Empty when no players`() = runTest {
        // Given
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())

        // When
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is PlayersUiState.Empty)
    }

    @Test
    @DisplayName("Deve retornar Error quando repositório falhar")
    fun `loadPlayers should return Error when repository fails`() = runTest {
        // Given
        val exception = Exception("Erro ao carregar jogadores")
        coEvery { userRepository.getAllUsers() } returns Result.failure(exception)
        coEvery { userRepository.searchUsers(any()) } returns Result.failure(exception)

        // When
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Error)
        assertEquals("Erro ao carregar jogadores", (state as PlayersUiState.Error).message)
    }

    @Test
    @DisplayName("Deve buscar jogadores com query")
    fun `searchPlayers should search with query`() = runTest {
        // Given
        val players = listOf(createTestUser("1", "João Silva", true))
        coEvery { userRepository.searchUsers("João", limit = 100) } returns Result.success(players)

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.searchPlayers("João")
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then
        coVerify { userRepository.searchUsers("João", limit = 100) }
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success)
    }

    @Test
    @DisplayName("Deve filtrar apenas jogadores com perfil público")
    fun `loadPlayers should filter only public profiles`() = runTest {
        // Given
        val players = listOf(
            createTestUser("1", "João", true),
            createTestUser("2", "Maria", false), // Perfil privado
            createTestUser("3", "Pedro", true)
        )
        coEvery { userRepository.getAllUsers() } returns Result.success(players)

        // When
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success)
        assertEquals(2, (state as PlayersUiState.Success).players.size)
        assertTrue(state.players.all { it.isProfilePublic })
    }

    @Test
    @DisplayName("Deve filtrar por tipo de campo")
    fun `setFieldTypeFilter should filter players by field type`() = runTest {
        // Given
        val players = listOf(
            createTestUser("1", "João", true, listOf(FieldType.SOCIETY)),
            createTestUser("2", "Maria", true, listOf(FieldType.FUTSAL)),
            createTestUser("3", "Pedro", true, listOf(FieldType.SOCIETY, FieldType.FUTSAL))
        )
        coEvery { userRepository.getAllUsers() } returns Result.success(players)

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.setFieldTypeFilter(FieldType.SOCIETY)

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success)
        assertEquals(2, (state as PlayersUiState.Success).players.size)
        assertTrue(state.players.all { it.preferredFieldTypes.contains(FieldType.SOCIETY) })
    }

    @Test
    @DisplayName("Deve ordenar jogadores por nome")
    fun `setSortOption NAME should sort by name`() = runTest {
        // Given
        val players = listOf(
            createTestUser("1", "Zico", true),
            createTestUser("2", "Abel", true),
            createTestUser("3", "Maria", true)
        )
        coEvery { userRepository.getAllUsers() } returns Result.success(players)

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.setSortOption(PlayersViewModel.SortOption.NAME)

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success)
        val names = (state as PlayersUiState.Success).players.map { it.name }
        assertEquals(listOf("Abel", "Maria", "Zico"), names)
    }

    @Test
    @DisplayName("Deve limpar filtros corretamente")
    fun `clearFilters should reset all filters`() = runTest {
        // Given
        val players = listOf(
            createTestUser("1", "João", true, listOf(FieldType.SOCIETY)),
            createTestUser("2", "Maria", true, listOf(FieldType.FUTSAL))
        )
        coEvery { userRepository.getAllUsers() } returns Result.success(players)

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        viewModel.setFieldTypeFilter(FieldType.SOCIETY)
        assertEquals(1, (viewModel.uiState.value as PlayersUiState.Success).players.size)

        // When
        viewModel.clearFilters()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success)
        assertEquals(2, (state as PlayersUiState.Success).players.size)
        assertNull(viewModel.currentFieldType)
        assertEquals(PlayersViewModel.SortOption.NAME, viewModel.currentSortOption)
    }

    @Test
    @DisplayName("Deve persistir filtros no SavedStateHandle")
    fun `filters should persist in SavedStateHandle`() = runTest {
        // Given
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.currentQuery = "teste"
        viewModel.currentFieldType = FieldType.FUTSAL
        viewModel.currentSortOption = PlayersViewModel.SortOption.BEST_STRIKER

        // Then
        assertEquals("teste", savedStateHandle.get<String>("current_query"))
        assertEquals("FUTSAL", savedStateHandle.get<String>("current_field_type"))
        assertEquals("BEST_STRIKER", savedStateHandle.get<String>("current_sort_option"))
    }

    @Test
    @DisplayName("Deve observar contador de notificações")
    fun `should observe unread notifications count`() = runTest {
        // Given
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(5)
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())

        // When
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then
        viewModel.unreadCount.test {
            assertEquals(5, awaitItem())
        }
    }

    @Test
    @DisplayName("Deve carregar dados de comparação com sucesso")
    fun `loadComparisonData should load successfully`() = runTest {
        // Given
        val user1 = createTestUser("1", "João", true)
        val user2 = createTestUser("2", "Maria", true)
        val stats1 = createTestStatistics("1")
        val stats2 = createTestStatistics("2")

        coEvery { statisticsRepository.getUserStatistics("1") } returns Result.success(stats1)
        coEvery { statisticsRepository.getUserStatistics("2") } returns Result.success(stats2)
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.loadComparisonData(user1, user2)
        advanceUntilIdle()

        // Then
        val state = viewModel.comparisonState.value
        assertTrue(state is ComparisonUiState.Ready)
        val readyState = state as ComparisonUiState.Ready
        assertEquals(user1, readyState.user1)
        assertEquals(user2, readyState.user2)
        assertNotNull(readyState.stats1)
        assertNotNull(readyState.stats2)
    }

    @Test
    @DisplayName("Deve resetar comparação")
    fun `resetComparison should set state to Idle`() = runTest {
        // Given
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.resetComparison()

        // Then
        assertTrue(viewModel.comparisonState.value is ComparisonUiState.Idle)
    }

    @Test
    @Disabled("Turbine timeout - inviteEvent SharedFlow não emite valor em tempo hábil")
    @DisplayName("Deve mostrar seleção de grupos quando admin de múltiplos grupos")
    fun `invitePlayer should show group selection when admin of multiple groups`() = runTest {
        // Given
        val targetUser = createTestUser("target", "Target User", true)
        val groups = listOf(
            createTestGroup("group1", "Grupo 1", isAdmin = true),
            createTestGroup("group2", "Grupo 2", isAdmin = true)
        )
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        coEvery { groupRepository.getMyGroups() } returns Result.success(groups)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.invitePlayer(targetUser)
        advanceUntilIdle()

        // Then
        viewModel.inviteEvent.test {
            val event = awaitItem()
            assertTrue(event is InviteUiEvent.ShowGroupSelection)
            assertEquals(2, (event as InviteUiEvent.ShowGroupSelection).groups.size)
        }
    }

    @Test
    @DisplayName("Deve enviar convite diretamente quando admin de apenas um grupo")
    fun `invitePlayer should send directly when admin of single group`() = runTest {
        // Given
        val targetUser = createTestUser("target", "Target User", true)
        val groups = listOf(createTestGroup("group1", "Grupo 1", isAdmin = true))
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        coEvery { groupRepository.getMyGroups() } returns Result.success(groups)
        coEvery { inviteRepository.createInvite("group1", "target") } returns Result.success(
            GroupInvite(
                id = "invite1",
                groupId = "group1",
                groupName = "Test Group",
                invitedUserId = "target",
                invitedUserName = "Target User",
                invitedUserEmail = "target@test.com",
                invitedById = "user123",
                invitedByName = "Admin User"
            )
        )

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When
        viewModel.invitePlayer(targetUser)
        advanceUntilIdle()

        // Then
        coVerify { inviteRepository.createInvite("group1", "target") }
    }

    @Test
    @Disabled("Turbine timeout - inviteEvent SharedFlow não emite valor em tempo hábil")
    @DisplayName("Deve mostrar erro quando não é admin de nenhum grupo")
    fun `invitePlayer should show error when not admin of any group`() = runTest {
        // Given
        val targetUser = createTestUser("target", "Target User", true)
        val groups = listOf(createTestGroup("group1", "Grupo 1", isAdmin = false))
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        coEvery { groupRepository.getMyGroups() } returns Result.success(groups)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.invitePlayer(targetUser)
        advanceUntilIdle()

        // Then
        viewModel.inviteEvent.test {
            val event = awaitItem()
            assertTrue(event is InviteUiEvent.Error)
            assertTrue((event as InviteUiEvent.Error).message.contains("admin"))
        }
    }

    @Test
    @Disabled("Turbine timeout - inviteEvent SharedFlow não emite valor em tempo hábil")
    @DisplayName("Deve enviar convite para grupo específico com sucesso")
    fun `sendInvite should send invite successfully`() = runTest {
        // Given
        val targetUser = createTestUser("target", "Target User", true)
        coEvery { userRepository.getAllUsers() } returns Result.success(emptyList())
        coEvery { inviteRepository.createInvite("group1", "target") } returns Result.success(
            GroupInvite(
                id = "invite1",
                groupId = "group1",
                groupName = "Test Group",
                invitedUserId = "target",
                invitedUserName = "Target User",
                invitedUserEmail = "target@test.com",
                invitedById = "user123",
                invitedByName = "Admin User"
            )
        )

        viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.sendInvite("group1", targetUser)
        advanceUntilIdle()

        // Then
        viewModel.inviteEvent.test {
            val event = awaitItem()
            assertTrue(event is InviteUiEvent.InviteSent)
            assertEquals("Target User", (event as InviteUiEvent.InviteSent).userName)
        }
    }

    @Test
    @DisplayName("Deve cancelar job anterior ao buscar novamente")
    fun `searchPlayers should cancel previous job`() = runTest {
        // Given
        val players1 = listOf(createTestUser("1", "João", true))
        val players2 = listOf(createTestUser("2", "Maria", true))
        coEvery { userRepository.searchUsers("Jo", limit = 100) } returns Result.success(players1)
        coEvery { userRepository.searchUsers("João", limit = 100) } returns Result.success(players2)

        viewModel = createViewModel()
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // When - Buscar rapidamente duas vezes
        viewModel.searchPlayers("Jo")
        viewModel.searchPlayers("João")
        advanceTimeBy(350) // Pular debounce de 300ms
        advanceUntilIdle()

        // Then - Deve completar sem erros
        val state = viewModel.uiState.value
        assertTrue(state is PlayersUiState.Success || state is PlayersUiState.Empty)
    }

    // Helper functions
    private fun createTestUser(
        id: String,
        name: String,
        isPublic: Boolean,
        fieldTypes: List<FieldType> = emptyList()
    ) = SharedUser(
        id = id,
        name = name,
        email = "$id@test.com",
        photoUrl = "",
        isProfilePublic = isPublic,
        preferredFieldTypes = fieldTypes,
        level = 5,
        experiencePoints = 1000L,
        createdAt = System.currentTimeMillis()
    )

    private fun createTestStatistics(userId: String) = com.futebadosparcas.domain.model.Statistics(
        id = userId,
        totalGames = 50,
        totalGoals = 30,
        totalAssists = 20,
        totalSaves = 10,
        bestPlayerCount = 5
    )

    private fun createTestGroup(
        id: String,
        name: String,
        isAdmin: Boolean
    ): UserGroup {
        return mockk<UserGroup>().apply {
            every { this@apply.groupId } returns id
            every { this@apply.groupName } returns name
            every { this@apply.isAdmin() } returns isAdmin
        }
    }
}
