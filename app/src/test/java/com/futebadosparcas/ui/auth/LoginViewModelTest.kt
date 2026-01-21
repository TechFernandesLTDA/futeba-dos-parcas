package com.futebadosparcas.ui.auth

import app.cash.turbine.test
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
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
 * Testes unitarios para LoginViewModel.
 * Verifica estados de login, autenticacao com Google e tratamento de erros.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("LoginViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class LoginViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: LoginViewModel

    private fun createViewModel(): LoginViewModel {
        return LoginViewModel(authRepository)
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        authRepository = mockk()

        // Setup default mock behaviors
        every { authRepository.isLoggedIn() } returns false
        every { authRepository.authStateFlow } returns flowOf(null)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Idle")
    fun `initial state should be Idle`() = runTest {
        // Given - Dado que nenhum usuario esta logado
        every { authRepository.isLoggedIn() } returns false

        // When - Quando criar ViewModel
        viewModel = createViewModel()

        // Then - Estado inicial deve ser Idle
        assertTrue(viewModel.loginState.value is LoginState.Idle)
    }

    @Test
    @DisplayName("checkExistingUser deve retornar Success quando usuario esta logado")
    fun checkExistingUser_whenLoggedIn_returnsSuccess() = runTest {
        // Given - Dado que existe um usuario logado
        val testUser = createTestUser()
        every { authRepository.isLoggedIn() } returns true
        coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

        viewModel = createViewModel()

        // When - Quando verificar usuario existente
        viewModel.checkExistingUser()
        advanceUntilIdle()

        // Then - Estado deve ser Success com o usuario
        viewModel.loginState.test {
            val state = awaitItem()
            assertTrue(state is LoginState.Success)
            assertEquals(testUser, (state as LoginState.Success).user)
        }
    }

    @Test
    @DisplayName("checkExistingUser deve permanecer Idle quando usuario nao esta logado")
    fun checkExistingUser_whenNotLoggedIn_remainsIdle() = runTest {
        // Given - Dado que nenhum usuario esta logado
        every { authRepository.isLoggedIn() } returns false

        viewModel = createViewModel()

        // When - Quando verificar usuario existente
        viewModel.checkExistingUser()
        advanceUntilIdle()

        // Then - Estado deve permanecer Idle
        viewModel.loginState.test {
            val state = awaitItem()
            assertTrue(state is LoginState.Idle)
        }
    }

    @Test
    @DisplayName("onGoogleSignInSuccess deve atualizar estado para Success")
    fun onGoogleSignInSuccess_updatesStateToSuccess() = runTest {
        // Given - Dado que o login com Google foi bem sucedido
        val testUser = createTestUser()
        every { authRepository.isLoggedIn() } returns false
        coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

        viewModel = createViewModel()

        // When - Quando processar sucesso do login Google
        viewModel.onGoogleSignInSuccess()
        advanceUntilIdle()

        // Then - Estado deve ser Success com o usuario
        viewModel.loginState.test {
            val state = awaitItem()
            assertTrue(state is LoginState.Success)
            assertEquals(testUser, (state as LoginState.Success).user)
        }
    }

    @Test
    @DisplayName("onGoogleSignInSuccess deve atualizar estado para Error quando ocorre erro")
    fun onGoogleSignInSuccess_onError_updatesStateToError() = runTest {
        // Given - Dado que ocorre erro ao obter usuario apos login Google
        val errorMessage = "Erro ao buscar dados do usuario"
        every { authRepository.isLoggedIn() } returns false
        coEvery { authRepository.getCurrentUser() } returns Result.failure(Exception(errorMessage))

        viewModel = createViewModel()

        // When - Quando processar sucesso do login Google (mas erro no getCurrentUser)
        viewModel.onGoogleSignInSuccess()
        advanceUntilIdle()

        // Then - Estado deve ser Error com a mensagem
        viewModel.loginState.test {
            val state = awaitItem()
            assertTrue(state is LoginState.Error)
            assertEquals(errorMessage, (state as LoginState.Error).message)
        }
    }

    @Test
    @DisplayName("onGoogleSignInError deve atualizar estado para Error")
    fun onGoogleSignInError_updatesStateToError() = runTest {
        // Given - Dado que ViewModel esta criado
        every { authRepository.isLoggedIn() } returns false

        viewModel = createViewModel()

        // When - Quando ocorre erro no login Google
        val errorMessage = "Falha na autenticacao com Google"
        viewModel.onGoogleSignInError(errorMessage)

        // Then - Estado deve ser Error com a mensagem
        viewModel.loginState.test {
            val state = awaitItem()
            assertTrue(state is LoginState.Error)
            assertEquals(errorMessage, (state as LoginState.Error).message)
        }
    }

    @Test
    @DisplayName("onGoogleSignInSuccess deve passar por estado Loading antes de Success")
    fun onGoogleSignInSuccess_goThroughLoadingState() = runTest {
        // Given - Dado que o login com Google foi bem sucedido
        val testUser = createTestUser()
        every { authRepository.isLoggedIn() } returns false
        coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

        viewModel = createViewModel()

        // When/Then - Quando processar sucesso, deve passar por Loading
        viewModel.loginState.test {
            // Estado inicial
            assertEquals(LoginState.Idle, awaitItem())

            // Iniciar login
            viewModel.onGoogleSignInSuccess()

            // Deve passar por Loading
            assertEquals(LoginState.Loading, awaitItem())

            // Avanca o dispatcher
            advanceUntilIdle()

            // Finalmente Success
            val finalState = awaitItem()
            assertTrue(finalState is LoginState.Success)
        }
    }

    @Test
    @DisplayName("resetState deve retornar estado para Idle")
    fun resetState_shouldReturnToIdle() = runTest {
        // Given - Dado que o estado esta em Error
        every { authRepository.isLoggedIn() } returns false

        viewModel = createViewModel()
        viewModel.onGoogleSignInError("Algum erro")

        // Verificar que esta em Error
        assertTrue(viewModel.loginState.value is LoginState.Error)

        // When - Quando resetar estado
        viewModel.resetState()

        // Then - Estado deve ser Idle
        assertTrue(viewModel.loginState.value is LoginState.Idle)
    }

    @Test
    @DisplayName("checkExistingUser deve retornar Idle quando getCurrentUser falha")
    fun checkExistingUser_whenGetCurrentUserFails_returnsIdle() = runTest {
        // Given - Dado que usuario esta logado mas getCurrentUser falha
        every { authRepository.isLoggedIn() } returns true
        coEvery { authRepository.getCurrentUser() } returns Result.failure(Exception("Erro de rede"))

        viewModel = createViewModel()

        // When - Quando verificar usuario existente
        viewModel.checkExistingUser()
        advanceUntilIdle()

        // Then - Estado deve ser Idle (fallback para re-autenticacao)
        viewModel.loginState.test {
            val state = awaitItem()
            assertTrue(state is LoginState.Idle)
        }
    }

    // Helper function para criar dados de teste
    private fun createTestUser() = User(
        id = "user123",
        name = "Test User",
        email = "test@test.com",
        photoUrl = "https://example.com/photo.jpg",
        level = 5,
        experiencePoints = 2500L,
        createdAt = System.currentTimeMillis()
    )
}
