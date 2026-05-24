package com.futebadosparcas.ui.auth

import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("LoginViewModel Tests")
@ExtendWith(MockLogExtension::class)
class LoginViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository
    private lateinit var androidAuthRepository: AndroidAuthRepository
    private lateinit var viewModel: LoginViewModel

    private val testUser = User(id = "user-1", name = "Joao Silva")

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        authRepository = mockk(relaxed = true)
        androidAuthRepository = mockk(relaxed = true)

        viewModel = LoginViewModel(authRepository, androidAuthRepository)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("Estado Inicial")
    inner class InitialStateTests {

        @Test
        @DisplayName("Estado inicial deve ser Idle")
        fun `initial state is Idle`() {
            assertEquals(LoginState.Idle, viewModel.loginState.value)
        }

        @Test
        @DisplayName("resetState volta para Idle")
        fun `resetState goes back to Idle`() {
            viewModel.resetState()
            assertEquals(LoginState.Idle, viewModel.loginState.value)
        }
    }

    @Nested
    @DisplayName("checkExistingUser")
    inner class CheckExistingUserTests {

        @Test
        @DisplayName("checkExistingUser com usuario logado retorna Success")
        fun `checkExistingUser with logged in user returns Success`() = runTest(testDispatcher) {
            every { authRepository.isLoggedIn() } returns true
            coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

            viewModel.checkExistingUser()
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Success::class.java, state)
            assertEquals(testUser, (state as LoginState.Success).user)
        }

        @Test
        @DisplayName("checkExistingUser sem usuario logado permanece Idle")
        fun `checkExistingUser without logged in user stays Idle`() = runTest(testDispatcher) {
            every { authRepository.isLoggedIn() } returns false

            viewModel.checkExistingUser()
            advanceUntilIdle()

            assertEquals(LoginState.Idle, viewModel.loginState.value)
        }

        @Test
        @DisplayName("checkExistingUser com falha volta para Idle")
        fun `checkExistingUser with failure goes back to Idle`() = runTest(testDispatcher) {
            every { authRepository.isLoggedIn() } returns true
            coEvery { authRepository.getCurrentUser() } returns Result.failure(RuntimeException("Erro"))

            viewModel.checkExistingUser()
            advanceUntilIdle()

            assertEquals(LoginState.Idle, viewModel.loginState.value)
        }
    }

    @Nested
    @DisplayName("onGoogleSignInSuccess")
    inner class GoogleSignInTests {

        @Test
        @DisplayName("onGoogleSignInSuccess com sucesso retorna Success")
        fun `onGoogleSignInSuccess with success returns Success`() = runTest(testDispatcher) {
            coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

            viewModel.onGoogleSignInSuccess()
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Success::class.java, state)
            assertEquals(testUser, (state as LoginState.Success).user)
        }

        @Test
        @DisplayName("onGoogleSignInSuccess com falha retorna Error")
        fun `onGoogleSignInSuccess with failure returns Error`() = runTest(testDispatcher) {
            coEvery { authRepository.getCurrentUser() } returns Result.failure(RuntimeException("Falha ao obter usuario"))

            viewModel.onGoogleSignInSuccess()
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Error::class.java, state)
        }

        @Test
        @DisplayName("onGoogleSignInSuccess mostra Loading durante execucao")
        fun `onGoogleSignInSuccess shows Loading during execution`() = runTest(testDispatcher) {
            coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

            viewModel.onGoogleSignInSuccess()
            assertEquals(LoginState.Loading, viewModel.loginState.value)
            advanceUntilIdle()
        }
    }

    @Nested
    @DisplayName("signInWithEmailAndPassword")
    inner class EmailPasswordTests {

        @Test
        @DisplayName("signInWithEmailAndPassword com sucesso retorna Success")
        fun `signInWithEmailAndPassword with success returns Success`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword("joao@email.com", "123456") } returns Result.success(testUser)

            viewModel.signInWithEmailAndPassword("joao@email.com", "123456")
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Success::class.java, state)
        }

        @Test
        @DisplayName("signInWithEmailAndPassword com erro retorna Error")
        fun `signInWithEmailAndPassword with error returns Error`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } returns
                Result.failure(RuntimeException("Senha incorreta"))

            viewModel.signInWithEmailAndPassword("joao@email.com", "senha_errada")
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Error::class.java, state)
        }

        @Test
        @DisplayName("signInWithEmailAndPassword mostra Loading during execution")
        fun `signInWithEmailAndPassword shows Loading during execution`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } returns Result.success(testUser)

            viewModel.signInWithEmailAndPassword("joao@email.com", "123456")
            assertEquals(LoginState.Loading, viewModel.loginState.value)
            advanceUntilIdle()
        }
    }

    @Nested
    @DisplayName("sendPasswordResetEmail e onGoogleSignInError")
    inner class MiscTests {

        @Test
        @DisplayName("sendPasswordResetEmail chama repositorio")
        fun `sendPasswordResetEmail calls repository`() = runTest(testDispatcher) {
            viewModel.sendPasswordResetEmail("joao@email.com")
            advanceUntilIdle()

            coVerify { androidAuthRepository.sendPasswordResetEmail("joao@email.com") }
        }

        @Test
        @DisplayName("onGoogleSignInError define estado de erro")
        fun `onGoogleSignInError sets error state`() {
            viewModel.onGoogleSignInError("Popup fechado pelo usuario")

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Error::class.java, state)
            assertEquals("Popup fechado pelo usuario", (state as LoginState.Error).message)
        }
    }
}
