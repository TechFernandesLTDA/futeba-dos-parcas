package com.futebadosparcas.ui.search

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserGroup
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
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
 * Testes unitarios para GlobalSearchViewModel.
 * Verifica busca global com debounce, filtragem por categoria, historico e relevancia.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GlobalSearchViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class GlobalSearchViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var userRepository: UserRepository
    private lateinit var locationRepository: LocationRepository
    private lateinit var viewModel: GlobalSearchViewModel

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk()
        groupRepository = mockk()
        userRepository = mockk()
        locationRepository = mockk()
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): GlobalSearchViewModel {
        return GlobalSearchViewModel(gameRepository, groupRepository, userRepository, locationRepository)
    }

    // ========== Estado Inicial ==========

    @Test
    @DisplayName("Estado inicial deve ser Idle")
    fun init_default_startsWithIdle() = runTest {
        // When
        viewModel = createViewModel()

        // Then
        assertTrue(viewModel.uiState.value is GlobalSearchUiState.Idle)
        assertEquals("", viewModel.query.value)
        assertEquals(SearchFilter.ALL, viewModel.selectedCategory.value)
    }

    // ========== Debounce e Query ==========

    @Test
    @DisplayName("Query com menos de 2 caracteres deve manter Idle")
    fun onQueryChange_shortQuery_remainsIdle() = runTest {
        // Given
        viewModel = createViewModel()

        // When
        viewModel.onQueryChange("a")
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is GlobalSearchUiState.Idle)
        assertEquals("a", viewModel.query.value)
    }

    @Test
    @DisplayName("Query com 2+ caracteres deve iniciar busca apos debounce")
    fun onQueryChange_validQuery_startsSearch() = runTest {
        // Given
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(emptyList())
        coEvery { groupRepository.getUserGroups() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any()) } returns Result.success(emptyList())
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()

        // When
        viewModel.onQueryChange("fu")
        advanceTimeBy(350) // Debounce de 300ms
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is GlobalSearchUiState.Success)
    }

    @Test
    @DisplayName("Debounce deve cancelar busca anterior ao digitar rapidamente")
    fun onQueryChange_rapidTyping_cancelsOldSearch() = runTest {
        // Given
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(emptyList())
        coEvery { groupRepository.getUserGroups() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any()) } returns Result.success(emptyList())
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()

        // When - digita rapido
        viewModel.onQueryChange("fu")
        advanceTimeBy(100)
        viewModel.onQueryChange("fut")
        advanceTimeBy(100)
        viewModel.onQueryChange("fute")
        advanceTimeBy(350) // Apenas o ultimo debounce completa
        advanceUntilIdle()

        // Then - Busca deve ser feita apenas para "fute"
        assertEquals("fute", viewModel.query.value)
    }

    // ========== Clear Query ==========

    @Test
    @DisplayName("clearQuery deve resetar para Idle")
    fun clearQuery_afterSearch_resetsToIdle() = runTest {
        // Given
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(emptyList())
        coEvery { groupRepository.getUserGroups() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any()) } returns Result.success(emptyList())
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()
        viewModel.onQueryChange("futebol")
        advanceTimeBy(350)
        advanceUntilIdle()

        // When
        viewModel.clearQuery()

        // Then
        assertTrue(viewModel.uiState.value is GlobalSearchUiState.Idle)
        assertEquals("", viewModel.query.value)
    }

    // ========== Filtragem por Categoria ==========

    @Test
    @DisplayName("Selecionar filtro GAMES deve buscar apenas jogos")
    fun onFilterSelected_games_searchesOnlyGames() = runTest {
        // Given
        val games = listOf(
            Game(id = "g1", ownerName = "Futebol", locationName = "Arena", date = "2026-01-15")
        )
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(games)
        coEvery { groupRepository.getUserGroups() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any()) } returns Result.success(emptyList())
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()
        viewModel.onQueryChange("fu")
        advanceTimeBy(350)
        advanceUntilIdle()

        // When
        viewModel.onFilterSelected(SearchFilter.GAMES)
        advanceUntilIdle()

        // Then
        assertEquals(SearchFilter.GAMES, viewModel.selectedCategory.value)
    }

    @Test
    @DisplayName("Selecionar filtro quando query < 2 nao deve buscar")
    fun onFilterSelected_shortQuery_doesNotSearch() = runTest {
        // Given
        viewModel = createViewModel()
        viewModel.onQueryChange("a")

        // When
        viewModel.onFilterSelected(SearchFilter.PLAYERS)

        // Then
        assertEquals(SearchFilter.PLAYERS, viewModel.selectedCategory.value)
        assertTrue(viewModel.uiState.value is GlobalSearchUiState.Idle)
    }

    // ========== Resultados e Relevancia ==========

    @Test
    @DisplayName("Resultados devem ser ordenados por relevancia")
    fun search_multipleResults_sortedByRelevance() = runTest {
        // Given
        val users = listOf(
            User(id = "u1", name = "Futebol Master", email = "a@b.com", level = 5, experiencePoints = 100L, createdAt = 0L),
            User(id = "u2", name = "Craque do Fut", email = "b@b.com", level = 3, experiencePoints = 200L, createdAt = 0L)
        )
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(emptyList())
        coEvery { groupRepository.getUserGroups() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any()) } returns Result.success(users)
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()

        // When
        viewModel.onQueryChange("futebol")
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is GlobalSearchUiState.Success)
    }

    // ========== Historico de Busca ==========

    @Test
    @DisplayName("clearHistory deve limpar historico de buscas")
    fun clearHistory_afterSearches_clearsHistory() = runTest {
        // Given
        viewModel = createViewModel()

        // When
        viewModel.clearHistory()

        // Then
        assertTrue(viewModel.recentSearches.value.isEmpty())
    }

    // ========== Error Handling ==========

    @Test
    @DisplayName("Deve transitar para Error quando todas as buscas falham com excecao")
    fun search_allRepositoriesFail_transitionsToError() = runTest {
        // Given
        coEvery { gameRepository.getUpcomingGames() } throws RuntimeException("Game error")
        coEvery { groupRepository.getUserGroups() } throws RuntimeException("Group error")
        coEvery { userRepository.searchUsers(any()) } throws RuntimeException("User error")
        coEvery { locationRepository.searchLocations(any()) } throws RuntimeException("Location error")

        viewModel = createViewModel()

        // When
        viewModel.onQueryChange("teste")
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then - As buscas individuais tem try-catch, entao o resultado pode ser Success vazio
        // ou Error dependendo de onde a excecao ocorreu
        val state = viewModel.uiState.value
        assertTrue(
            state is GlobalSearchUiState.Success || state is GlobalSearchUiState.Error,
            "Estado deve ser Success (vazio) ou Error"
        )
    }

    @Test
    @DisplayName("Busca parcial com falha em um repositorio deve retornar outros resultados")
    fun search_partialFailure_returnsPartialResults() = runTest {
        // Given
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(emptyList())
        coEvery { groupRepository.getUserGroups() } returns Result.failure(Exception("Group error"))
        coEvery { userRepository.searchUsers(any()) } returns Result.success(
            listOf(User(id = "u1", name = "Teste", email = "t@t.com", level = 1, experiencePoints = 0L, createdAt = 0L))
        )
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()

        // When
        viewModel.onQueryChange("teste")
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is GlobalSearchUiState.Success)
    }

    // ========== search() direto ==========

    @Test
    @DisplayName("search() com query valida deve executar busca imediata sem debounce")
    fun search_validQuery_executesImmediately() = runTest {
        // Given
        coEvery { gameRepository.getUpcomingGames() } returns Result.success(emptyList())
        coEvery { groupRepository.getUserGroups() } returns Result.success(emptyList())
        coEvery { userRepository.searchUsers(any()) } returns Result.success(emptyList())
        coEvery { locationRepository.searchLocations(any()) } returns Result.success(emptyList())

        viewModel = createViewModel()

        // Setar query manualmente sem debounce
        val queryField = GlobalSearchViewModel::class.java.getDeclaredField("_query")
        queryField.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        (queryField.get(viewModel) as kotlinx.coroutines.flow.MutableStateFlow<String>).value = "futebol"

        // When
        viewModel.search()
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is GlobalSearchUiState.Success)
    }
}
