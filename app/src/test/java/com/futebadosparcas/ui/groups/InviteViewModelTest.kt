package com.futebadosparcas.ui.groups

import app.cash.turbine.test
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
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
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para InviteViewModel.
 * Verifica busca de usuarios, debounce, e limpeza de estado.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("InviteViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class)
class InviteViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var inviteRepository: InviteRepository
    private lateinit var userRepository: UserRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var viewModel: InviteViewModel

    private fun createViewModel(): InviteViewModel {
        return InviteViewModel(inviteRepository, userRepository, groupRepository)
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        inviteRepository = mockk(relaxed = true)
        userRepository = mockk()
        groupRepository = mockk()

        // Setup default mock behaviors - Flow vazio para nao disparar observer automatico
        every { inviteRepository.getMyPendingInvitesFlow() } returns flowOf(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("searchUsers com query deve retornar resultados")
    fun searchUsers_withQuery_returnsResults() = runTest {
        // Given - Dado usuarios disponiveis
        val users = listOf(
            createTestUser("1", "Joao Silva"),
            createTestUser("2", "Maria Souza")
        )
        coEvery { userRepository.searchUsers("joao", 20) } returns Result.success(users)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando buscar usuarios
        viewModel.searchUsers("joao")

        // Aguardar debounce (300ms) + processamento
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then - Deve retornar Success com usuarios
        viewModel.searchUsersState.test {
            val state = awaitItem()
            assertTrue(state is SearchUsersState.Success)
            assertEquals(2, (state as SearchUsersState.Success).users.size)
        }
    }

    @Test
    @DisplayName("searchUsers com resultado vazio deve retornar Empty")
    fun searchUsers_emptyResults_returnsEmpty() = runTest {
        // Given - Dado nenhum usuario encontrado
        coEvery { userRepository.searchUsers("xyz123", 20) } returns Result.success(emptyList())

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando buscar usuarios inexistentes
        viewModel.searchUsers("xyz123")

        // Aguardar debounce + processamento
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then - Deve retornar Empty
        viewModel.searchUsersState.test {
            val state = awaitItem()
            assertTrue(state is SearchUsersState.Empty)
        }
    }

    @Test
    @DisplayName("searchUsers com erro deve retornar Error")
    fun searchUsers_onError_returnsError() = runTest {
        // Given - Dado erro no repositorio
        val exception = Exception("Erro de conexao")
        coEvery { userRepository.searchUsers("joao", 20) } returns Result.failure(exception)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando buscar usuarios e falhar
        viewModel.searchUsers("joao")

        // Aguardar debounce + processamento
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then - Deve retornar Error com mensagem
        viewModel.searchUsersState.test {
            val state = awaitItem()
            assertTrue(state is SearchUsersState.Error)
            assertEquals("Erro de conexao", (state as SearchUsersState.Error).message)
        }
    }

    @Test
    @DisplayName("searchUsers deve cancelar busca anterior (debounce)")
    fun searchUsers_cancels_previousSearch() = runTest {
        // Given - Dado multiplas buscas em sequencia
        val users1 = listOf(createTestUser("1", "Joao"))
        val users2 = listOf(createTestUser("2", "Maria"))

        coEvery { userRepository.searchUsers("joao", 20) } returns Result.success(users1)
        coEvery { userRepository.searchUsers("maria", 20) } returns Result.success(users2)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando buscar rapidamente sem aguardar debounce
        viewModel.searchUsers("joao")
        advanceTimeBy(100) // Menor que debounce (300ms)
        viewModel.searchUsers("maria") // Deve cancelar a busca anterior

        // Aguardar debounce da segunda busca + processamento
        advanceTimeBy(350)
        advanceUntilIdle()

        // Then - Deve retornar apenas resultado da segunda busca (Maria)
        viewModel.searchUsersState.test {
            val state = awaitItem()
            assertTrue(state is SearchUsersState.Success)
            val successState = state as SearchUsersState.Success
            assertEquals(1, successState.users.size)
            assertEquals("Maria", successState.users.first().name)
        }
    }

    @Test
    @DisplayName("clearSearch deve resetar estado para Idle")
    fun clearSearch_resetsState() = runTest {
        // Given - Dado ViewModel com busca em andamento
        val users = listOf(createTestUser("1", "Joao"))
        coEvery { userRepository.searchUsers("joao", 20) } returns Result.success(users)

        viewModel = createViewModel()
        advanceUntilIdle()

        // Realizar busca primeiro
        viewModel.searchUsers("joao")
        advanceTimeBy(350)
        advanceUntilIdle()

        // Verificar que esta em Success
        viewModel.searchUsersState.test {
            assertTrue(awaitItem() is SearchUsersState.Success)
        }

        // When - Quando limpar busca
        viewModel.clearSearch()
        advanceUntilIdle()

        // Then - Deve resetar para Idle
        viewModel.searchUsersState.test {
            val state = awaitItem()
            assertTrue(state is SearchUsersState.Idle)
        }
    }

    @Test
    @DisplayName("searchUsers deve mostrar Loading enquanto busca")
    fun searchUsers_showsLoadingState() = runTest {
        // Given - Dado resposta do repositorio
        coEvery { userRepository.searchUsers("joao", 20) } returns Result.success(
            listOf(createTestUser("1", "Joao"))
        )

        viewModel = createViewModel()
        advanceUntilIdle()

        // When/Then - Observar transicoes de estado usando Turbine
        viewModel.searchUsersState.test {
            // Estado inicial deve ser Idle
            assertEquals(SearchUsersState.Idle, awaitItem())

            // Iniciar busca
            viewModel.searchUsers("joao")

            // Avancar alem do debounce para entrar no Loading
            advanceTimeBy(310)

            // Deve transicionar para Loading
            assertEquals(SearchUsersState.Loading, awaitItem())

            // Completar processamento
            advanceUntilIdle()

            // Deve transicionar para Success
            val successState = awaitItem()
            assertTrue(successState is SearchUsersState.Success)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    @DisplayName("Estado inicial de searchUsersState deve ser Idle")
    fun initialState_shouldBeIdle() = runTest {
        // Given/When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado inicial deve ser Idle
        assertTrue(viewModel.searchUsersState.value is SearchUsersState.Idle)
    }

    // Helper function para criar dados de teste
    private fun createTestUser(
        id: String,
        name: String,
        email: String = "$name@test.com"
    ): User {
        return User(
            id = id,
            name = name,
            email = email.lowercase().replace(" ", ""),
            level = 1,
            experiencePoints = 0
        )
    }
}
