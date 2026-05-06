package com.futebadosparcas.ui.groups

import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para DiscoverGroupsViewModel.
 * Verifica estados (Loading/Empty/Success/Error) e filtro client-side.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("DiscoverGroupsViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class DiscoverGroupsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var groupRepository: GroupRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        groupRepository = mockk()
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun publicGroup(
        id: String,
        name: String,
        description: String = "",
        memberCount: Int = 5
    ): Group = Group(
        id = id,
        name = name,
        description = description,
        memberCount = memberCount,
        isPublic = true
    )

    @Test
    @DisplayName("init carrega grupos publicos com Success")
    fun init_loadsPublicGroups_emitsSuccess() = runTest(testDispatcher) {
        val groups = listOf(
            publicGroup("g1", "Pelada Vila"),
            publicGroup("g2", "Racha Centro")
        )
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(groups))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DiscoverGroupsUiState.Success)
        assertEquals(2, (state as DiscoverGroupsUiState.Success).groups.size)
    }

    @Test
    @DisplayName("repositorio vazio resulta em Empty state")
    fun emptyRepository_emitsEmpty() = runTest(testDispatcher) {
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(emptyList()))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        assertEquals(DiscoverGroupsUiState.Empty, viewModel.uiState.value)
    }

    @Test
    @DisplayName("falha do repositorio resulta em Error state")
    fun repositoryFailure_emitsError() = runTest(testDispatcher) {
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(
            Result.failure(RuntimeException("network down"))
        )

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DiscoverGroupsUiState.Error)
        assertEquals("network down", (state as DiscoverGroupsUiState.Error).message)
    }

    @Test
    @DisplayName("flow exception emite Error com mensagem")
    fun flowException_emitsError() = runTest(testDispatcher) {
        every { groupRepository.getPublicGroupsFlow() } returns flow {
            throw RuntimeException("io fail")
        }

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DiscoverGroupsUiState.Error)
        assertEquals("io fail", (state as DiscoverGroupsUiState.Error).message)
    }

    @Test
    @DisplayName("filtro client-side por nome retorna apenas matches")
    fun searchQuery_filtersGroupsByName() = runTest(testDispatcher) {
        val groups = listOf(
            publicGroup("g1", "Pelada Vila Madalena"),
            publicGroup("g2", "Racha Centro"),
            publicGroup("g3", "Futebol da Vila Olimpia")
        )
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(groups))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        viewModel.onSearchQueryChange("vila")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DiscoverGroupsUiState.Success)
        val filtered = (state as DiscoverGroupsUiState.Success).groups
        assertEquals(2, filtered.size)
        assertTrue(filtered.all { it.name.lowercase().contains("vila") })
    }

    @Test
    @DisplayName("filtro client-side por descricao retorna match")
    fun searchQuery_filtersByDescription() = runTest(testDispatcher) {
        val groups = listOf(
            publicGroup("g1", "Grupo A", description = "Pelada toda quarta no Ibirapuera"),
            publicGroup("g2", "Grupo B", description = "Racha aos domingos")
        )
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(groups))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        viewModel.onSearchQueryChange("ibirapuera")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DiscoverGroupsUiState.Success)
        assertEquals("g1", (state as DiscoverGroupsUiState.Success).groups.single().id)
    }

    @Test
    @DisplayName("filtro sem matches resulta em Empty")
    fun searchQuery_noMatches_emitsEmpty() = runTest(testDispatcher) {
        val groups = listOf(publicGroup("g1", "Pelada Vila"))
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(groups))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        viewModel.onSearchQueryChange("inexistente")
        advanceUntilIdle()

        assertEquals(DiscoverGroupsUiState.Empty, viewModel.uiState.value)
    }

    @Test
    @DisplayName("limpar busca restaura todos os grupos")
    fun clearSearchQuery_restoresAllGroups() = runTest(testDispatcher) {
        val groups = listOf(
            publicGroup("g1", "Pelada Vila"),
            publicGroup("g2", "Racha Centro")
        )
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(groups))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        viewModel.onSearchQueryChange("vila")
        advanceUntilIdle()
        viewModel.onSearchQueryChange("")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DiscoverGroupsUiState.Success)
        assertEquals(2, (state as DiscoverGroupsUiState.Success).groups.size)
    }

    @Test
    @DisplayName("busca eh case-insensitive")
    fun searchQuery_isCaseInsensitive() = runTest(testDispatcher) {
        val groups = listOf(publicGroup("g1", "Pelada Vila Madalena"))
        every { groupRepository.getPublicGroupsFlow() } returns flowOf(Result.success(groups))

        val viewModel = DiscoverGroupsViewModel(groupRepository)
        advanceUntilIdle()

        viewModel.onSearchQueryChange("PELADA")
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is DiscoverGroupsUiState.Success)
    }
}
