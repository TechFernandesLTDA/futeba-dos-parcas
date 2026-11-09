package com.futebadosparcas.ui.auth

import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.util.MockLogExtension
import com.futebadosparcas.util.PreferencesManager
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
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
    private lateinit var preferencesManager: PreferencesManager
    private lateinit var viewModel: LoginViewModel

    private val testUser = User(id = "user-1", name = "Joao Silva")

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        authRepository = mockk(relaxed = true)
        androidAuthRepository = mockk(relaxed = true)
        preferencesManager = mockk(relaxed = true)

        viewModel = LoginViewModel(authRepository, androidAuthRepository, preferencesManager)
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
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Success::class.java, state)
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
        @DisplayName("signInWithEmailAndPassword mostra Loading durante execucao")
        fun `signInWithEmailAndPassword shows Loading during execution`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } returns Result.success(testUser)

            viewModel.signInWithEmailAndPassword("joao@email.com", "123456")
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Success::class.java, state)
        }
    }

    @Nested
    @DisplayName("sendPasswordResetEmail e onGoogleSignInError")
    inner class MiscTests {

        @Test
        @DisplayName("sendPasswordResetEmail chama repositorio")
        fun `sendPasswordResetEmail calls repository`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.sendPasswordResetEmail(any()) } returns Result.success(Unit)
            viewModel.sendPasswordResetEmail("joao@email.com")
            advanceUntilIdle()

            coVerify { androidAuthRepository.sendPasswordResetEmail("joao@email.com") }
        }

        @Test
        @DisplayName("sendPasswordResetEmail com sucesso emite EmailSent sem tocar loginState")
        fun `sendPasswordResetEmail with success emits EmailSent`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.sendPasswordResetEmail(any()) } returns Result.success(Unit)

            viewModel.sendPasswordResetEmail("joao@email.com")
            advanceUntilIdle()

            assertEquals(ResetState.EmailSent, viewModel.resetState.value)
            // Estado de login nao deve ser poluido pelo fluxo de reset (#3184)
            assertEquals(LoginState.Idle, viewModel.loginState.value)
        }

        @Test
        @DisplayName("sendPasswordResetEmail com falha generica emite EmailSent (anti-enumeracao)")
        fun `sendPasswordResetEmail with generic failure emits EmailSent`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.sendPasswordResetEmail(any()) } returns
                Result.failure(RuntimeException("user-not-found"))

            viewModel.sendPasswordResetEmail("naoexiste@email.com")
            advanceUntilIdle()

            assertEquals(ResetState.EmailSent, viewModel.resetState.value)
        }

        @Test
        @DisplayName("onGoogleSignInError define estado de erro")
        fun `onGoogleSignInError sets error state`() {
            viewModel.onGoogleSignInError(R.string.auth_error_generic)

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Error::class.java, state)
            assertEquals(R.string.auth_error_generic, (state as LoginState.Error).errorResId)
        }
    }

    @Nested
    @DisplayName("Splash travada na revisão da Play (BUGFIX_2026-11-09)")
    inner class SplashTravadaTests {

        @Test
        @DisplayName("login por email com sucesso grava o horário do login")
        fun `email login success records last login time`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } returns
                Result.success(testUser)

            viewModel.signInWithEmailAndPassword("revisor@email.com", "senha-de-teste")
            advanceUntilIdle()

            assertInstanceOf(LoginState.Success::class.java, viewModel.loginState.value)
            verify(exactly = 1) { preferencesManager.setLastLoginTime(any()) }
        }

        @Test
        @DisplayName("login Google (ou continuação da sessão) com sucesso grava o horário do login")
        fun `google login success records last login time`() = runTest(testDispatcher) {
            coEvery { authRepository.getCurrentUser() } returns Result.success(testUser)

            viewModel.onGoogleSignInSuccess()
            advanceUntilIdle()

            verify(exactly = 1) { preferencesManager.setLastLoginTime(any()) }
        }

        @Test
        @DisplayName("login com erro não grava o horário do login")
        fun `failed login does not record last login time`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } returns
                Result.failure(RuntimeException("senha errada"))

            viewModel.signInWithEmailAndPassword("revisor@email.com", "senha-de-teste")
            advanceUntilIdle()

            verify(exactly = 0) { preferencesManager.setLastLoginTime(any()) }
        }

        @Test
        @DisplayName("falha ao gravar o horário não impede o login")
        fun `failing to record time still succeeds`() = runTest(testDispatcher) {
            every { preferencesManager.setLastLoginTime(any()) } throws SecurityException("keystore")
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } returns
                Result.success(testUser)

            viewModel.signInWithEmailAndPassword("revisor@email.com", "senha-de-teste")
            advanceUntilIdle()

            assertInstanceOf(LoginState.Success::class.java, viewModel.loginState.value)
        }

        @Test
        @DisplayName("continuação da sessão que nunca responde vira erro de conexão, sem loading eterno")
        fun `hanging session continuation times out to error`() = runTest(testDispatcher) {
            coEvery { authRepository.getCurrentUser() } coAnswers { awaitCancellation() }

            viewModel.onGoogleSignInSuccess()
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Error::class.java, state)
            assertEquals(R.string.auth_error_network, (state as LoginState.Error).errorResId)
        }

        @Test
        @DisplayName("login por email que nunca responde vira erro de conexão")
        fun `hanging email login times out to error`() = runTest(testDispatcher) {
            coEvery { androidAuthRepository.signInWithEmailAndPassword(any(), any()) } coAnswers {
                awaitCancellation()
            }

            viewModel.signInWithEmailAndPassword("revisor@email.com", "senha-de-teste")
            advanceUntilIdle()

            val state = viewModel.loginState.value
            assertInstanceOf(LoginState.Error::class.java, state)
            assertEquals(R.string.auth_error_network, (state as LoginState.Error).errorResId)
        }
    }
}
