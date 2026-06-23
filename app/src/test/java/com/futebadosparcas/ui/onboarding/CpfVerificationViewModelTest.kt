package com.futebadosparcas.ui.onboarding

import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GetTokenResult
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.HttpsCallableReference
import com.google.firebase.functions.HttpsCallableResult
import com.futebadosparcas.util.MockLogExtension
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
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para CpfVerificationViewModel.
 *
 * Casos criticos (pina a classe de bug da saga web #1284/#1285/#1301):
 * - Sucesso server-side + falha no refresh pos-verify => UiState.Success (nao Error)
 * - Retry: 2 falhas + 1 sucesso => prossegue normalmente
 * - Retry: 3 falhas => propaga excecao
 * - Pre-call refresh chamado antes do callable verifyCpf
 *
 * Fix: SPEC_BUGFIX_2026-05-17_CPF_ANDROID_TOKEN_CLUSTER.md (H1-H3, #1303)
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("CpfVerificationViewModel Tests")
@ExtendWith(MockLogExtension::class)
class CpfVerificationViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var auth: FirebaseAuth
    private lateinit var functions: FirebaseFunctions
    private lateinit var user: FirebaseUser
    private lateinit var viewModel: CpfVerificationViewModel

    // CPF valido para testes (529.982.247-25)
    private val cpfValido = "52998224725"

    /**
     * Cria HttpsCallableResult com dado especifico via reflexao.
     * O construtor e internal em Kotlin, mas o campo data e acessivel via getDeclaredField.
     * Usamos setAccessible para contornar o modificador final em JVM de testes (JDK 17+).
     */
    @Suppress("UNCHECKED_CAST")
    private fun makeCallableResult(data: Any?): HttpsCallableResult {
        // Aloca instancia sem chamar construtor
        val constructor = HttpsCallableResult::class.java.getDeclaredConstructors()[0]
        constructor.isAccessible = true
        val instance = constructor.newInstance(data) as HttpsCallableResult
        return instance
    }

    private val resultVerifyCpfSuccess by lazy { makeCallableResult(mapOf("success" to true)) }
    private val resultSetVerifiedSuccess by lazy { makeCallableResult(null) }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        auth = mockk(relaxed = true)
        functions = mockk(relaxed = true)
        user = mockk(relaxed = true)

        every { auth.currentUser } returns user

        viewModel = CpfVerificationViewModel(functions, auth)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    /**
     * Configura mocks para fluxo de sucesso completo.
     * Pre-call refresh: sucesso.
     * verifyCpf: sucesso.
     * setUserVerified: sucesso.
     * Pos-verify refresh: configuravel via [posVerifyRefreshError].
     */
    private fun setupSuccessFlow(posVerifyRefreshError: Exception? = null) {
        val refVerifyCpf = mockk<HttpsCallableReference>(relaxed = true)
        val refSetUserVerified = mockk<HttpsCallableReference>(relaxed = true)

        every { functions.getHttpsCallable("verifyCpf") } returns refVerifyCpf
        every { functions.getHttpsCallable("setUserVerified") } returns refSetUserVerified

        every { refVerifyCpf.call(any<Map<String, Any?>>()) } returns
            Tasks.forResult(resultVerifyCpfSuccess)
        every { refSetUserVerified.call(any<Map<String, Any?>>()) } returns
            Tasks.forResult(resultSetVerifiedSuccess)

        if (posVerifyRefreshError == null) {
            val verifiedToken = mockk<GetTokenResult>()
            every { verifiedToken.claims } returns mapOf("verified" to true)
            every { user.getIdToken(true) } returnsMany listOf(
                Tasks.forResult(null),
                Tasks.forResult(verifiedToken),
            )
        } else {
            // Pre-call refresh OK (Task com null); pos-verify refresh com falha (todas as 3 tentativas)
            every { user.getIdToken(true) } returnsMany listOf(
                Tasks.forResult(null),                        // pre-call tentativa 1
                Tasks.forException(posVerifyRefreshError),   // pos-verify tentativa 1
                Tasks.forException(posVerifyRefreshError),   // pos-verify tentativa 2
                Tasks.forException(posVerifyRefreshError),   // pos-verify tentativa 3
            )
        }
    }

    // ─── H2: Sucesso server-side + falha pos-verify => UiState.Success ────────────

    @Test
    @DisplayName("H2: sucesso server-side + falha refresh pos-verify => UiState.Success")
    fun verifyCpf_serverSideSuccess_posVerifyRefreshFails_stateIsSuccess() = runTest {
        // O servidor ja confirmou CPF + custom claim. O refresh pos-verify e
        // apenas warm-up; o AntiBotGate faz a rechecagem final apos a tela de sucesso.
        setupSuccessFlow(posVerifyRefreshError = RuntimeException("user-token-expired"))

        viewModel.verifyCpf(cpfValido)
        advanceUntilIdle()

        assertInstanceOf(
            CpfVerificationUiState.Success::class.java,
            viewModel.uiState.value,
            "Sucesso server-side nao deve prender o usuario por atraso de refresh local.",
        )
    }

    // ─── Fluxo completo sem erros ──────────────────────────────────────────────────

    @Test
    @DisplayName("verifyCpf_sucesso_estadoSuccess")
    fun verifyCpf_allSuccess_stateIsSuccess() = runTest {
        setupSuccessFlow()

        viewModel.verifyCpf(cpfValido)
        advanceUntilIdle()

        assertInstanceOf(CpfVerificationUiState.Success::class.java, viewModel.uiState.value)
    }

    // ─── H1/H3: retry de refresh ──────────────────────────────────────────────────

    @Test
    @DisplayName("H1/H3: refreshTokenWithRetry com 2 falhas + 1 sucesso => prossegue (nao propaga)")
    fun refreshTokenWithRetry_twoFailsThenSuccess_doesNotThrow() = runTest {
        val erro = RuntimeException("network error")

        // Duas falhas, depois sucesso
        every { user.getIdToken(true) } returnsMany listOf(
            Tasks.forException(erro),
            Tasks.forException(erro),
            Tasks.forResult(null),
        )

        var threw = false
        try {
            viewModel.refreshTokenWithRetry(user)
        } catch (e: Exception) {
            threw = true
        }

        assertTrue(!threw, "refreshTokenWithRetry nao deve propagar excecao se a 3a tentativa tiver sucesso")
    }

    @Test
    @DisplayName("H1/H3: refreshTokenWithRetry com 3 falhas => propaga excecao")
    fun refreshTokenWithRetry_threeFailures_throws() = runTest {
        val erro = RuntimeException("network error permanente")

        every { user.getIdToken(true) } returnsMany listOf(
            Tasks.forException(erro),
            Tasks.forException(erro),
            Tasks.forException(erro),
        )

        var threw = false
        try {
            viewModel.refreshTokenWithRetry(user)
        } catch (e: Exception) {
            threw = true
        }

        assertTrue(threw, "refreshTokenWithRetry deve propagar excecao apos 3 falhas")
    }

    // ─── H1: pre-call refresh chamado antes do callable ───────────────────────────

    @Test
    @DisplayName("H1: getIdToken chamado antes de verifyCpf callable")
    fun verifyCpf_callsGetIdTokenBeforeCallable() = runTest {
        val refVerifyCpf = mockk<HttpsCallableReference>(relaxed = true)
        val refSetUserVerified = mockk<HttpsCallableReference>(relaxed = true)

        every { functions.getHttpsCallable("verifyCpf") } returns refVerifyCpf
        every { functions.getHttpsCallable("setUserVerified") } returns refSetUserVerified
        every { refVerifyCpf.call(any<Map<String, Any?>>()) } returns
            Tasks.forResult(resultVerifyCpfSuccess)
        every { refSetUserVerified.call(any<Map<String, Any?>>()) } returns
            Tasks.forResult(resultSetVerifiedSuccess)
        val verifiedToken = mockk<GetTokenResult>()
        every { verifiedToken.claims } returns mapOf("verified" to true)
        every { user.getIdToken(true) } returnsMany listOf(
            Tasks.forResult(null),
            Tasks.forResult(verifiedToken),
        )

        viewModel.verifyCpf(cpfValido)
        advanceUntilIdle()

        // Verificar que getIdToken foi chamado (pre-call refresh)
        // e que o callable foi chamado (ambos aconteceram)
        verify(atLeast = 1) { user.getIdToken(true) }
        verify(exactly = 1) { refVerifyCpf.call(any<Map<String, Any?>>()) }
    }

    // ─── Validacao client-side ─────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyCpf com CPF invalido => UiState.Error sem chamar server")
    fun verifyCpf_invalidCpf_errorWithoutServerCall() = runTest {
        viewModel.verifyCpf("00000000000")
        advanceUntilIdle()

        assertInstanceOf(CpfVerificationUiState.Error::class.java, viewModel.uiState.value)
        verify(exactly = 0) { functions.getHttpsCallable(any()) }
    }

    @Test
    @DisplayName("verifyCpf sem usuario logado => UiState.Error sem chamar server")
    fun verifyCpf_noCurrentUser_errorWithoutServerCall() = runTest {
        every { auth.currentUser } returns null

        viewModel.verifyCpf(cpfValido)
        advanceUntilIdle()

        assertInstanceOf(CpfVerificationUiState.Error::class.java, viewModel.uiState.value)
        verify(exactly = 0) { functions.getHttpsCallable(any()) }
    }

    // ─── Falha no callable verifyCpf => Error ─────────────────────────────────────

    @Test
    @DisplayName("verifyCpf falha no callable => UiState.Error")
    fun verifyCpf_callableFails_stateIsError() = runTest {
        val refVerifyCpf = mockk<HttpsCallableReference>(relaxed = true)

        every { functions.getHttpsCallable("verifyCpf") } returns refVerifyCpf
        every { user.getIdToken(true) } returns Tasks.forResult(null)
        every { refVerifyCpf.call(any<Map<String, Any?>>()) } returns
            Tasks.forException(RuntimeException("already-exists"))

        viewModel.verifyCpf(cpfValido)
        advanceUntilIdle()

        assertInstanceOf(CpfVerificationUiState.Error::class.java, viewModel.uiState.value)
    }
}
