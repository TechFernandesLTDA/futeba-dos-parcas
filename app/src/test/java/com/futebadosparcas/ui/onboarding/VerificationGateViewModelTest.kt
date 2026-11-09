package com.futebadosparcas.ui.onboarding

import com.google.android.gms.tasks.TaskCompletionSource
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GetTokenResult
import com.futebadosparcas.util.MockLogExtension
import io.mockk.every
import io.mockk.mockk
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
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.util.concurrent.atomic.AtomicInteger

/**
 * Testes unitarios para VerificationGateViewModel.
 *
 * Cobre os estados do gate anti-bot pos-login:
 * - verified=true  => VerifiedState.Verified
 * - verified=false, sem telefone => VerifiedState.Unverified(hasPhone=false)
 * - verified=false, com telefone => VerifiedState.Unverified(hasPhone=true)
 * - usuario nulo   => VerifiedState.Failed
 * - token explode  => VerifiedState.Failed
 * - recheckAfterVerify: token com verified=true => Verified
 * - recheckAfterVerify: token ainda false => Failed (sem loop)
 *
 * Spec: SPEC_BUGFIX_2026-05-17_C1_ANDROID_ANTIBOT_ENFORCEMENT.md (#1302)
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("VerificationGateViewModel Tests")
@ExtendWith(MockLogExtension::class)
class VerificationGateViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var auth: FirebaseAuth
    private lateinit var user: FirebaseUser
    private lateinit var viewModel: VerificationGateViewModel

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        auth = mockk(relaxed = true)
        user = mockk(relaxed = true)
        viewModel = VerificationGateViewModel(auth)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    /**
     * Cria GetTokenResult com claims especificos via reflexao.
     * O construtor do GetTokenResult e package-private; usamos getDeclaredConstructors().
     */
    private fun makeTokenResult(claims: Map<String, Any>): GetTokenResult {
        val constructor = GetTokenResult::class.java.getDeclaredConstructors()[0]
        constructor.isAccessible = true
        // Construtor: GetTokenResult(String token, Map<String,Object> claims)
        return constructor.newInstance("fake-token", claims) as GetTokenResult
    }

    private fun mockUserWithVerified(verified: Boolean, phoneNumber: String? = null) {
        every { auth.currentUser } returns user
        every { user.phoneNumber } returns phoneNumber
        val tokenResult = makeTokenResult(if (verified) mapOf("verified" to true) else emptyMap())
        every { user.getIdToken(false) } returns Tasks.forResult(tokenResult)
    }

    private fun mockUserWithVerifiedForRecheck(verified: Boolean) {
        every { auth.currentUser } returns user
        every { user.phoneNumber } returns null
        val tokenResult = makeTokenResult(if (verified) mapOf("verified" to true) else emptyMap())
        // getIdToken(true) = refresh forcado via refreshTokenWithRetry (sucesso em 1 tentativa)
        every { user.getIdToken(true) } returns Tasks.forResult(tokenResult)
        // getIdToken(false) = leitura de cache do claim apos retry bem-sucedido
        every { user.getIdToken(false) } returns Tasks.forResult(tokenResult)
    }

    // ─── check() ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("check(): verified=true => VerifiedState.Verified")
    fun check_verifiedTrue_returnsVerified() = runTest {
        mockUserWithVerified(verified = true)

        viewModel.check()
        advanceUntilIdle()

        assertInstanceOf(VerifiedState.Verified::class.java, viewModel.state.value)
    }

    @Test
    @DisplayName("check(): verified=false, sem telefone => Unverified(hasPhone=false)")
    fun check_verifiedFalse_noPhone_returnsUnverifiedWithoutPhone() = runTest {
        mockUserWithVerified(verified = false, phoneNumber = null)

        viewModel.check()
        advanceUntilIdle()

        val state = viewModel.state.value
        assertInstanceOf(VerifiedState.Unverified::class.java, state)
        assertEquals(false, (state as VerifiedState.Unverified).hasPhone)
    }

    @Test
    @DisplayName("check(): verified=false, com telefone => Unverified(hasPhone=true)")
    fun check_verifiedFalse_withPhone_returnsUnverifiedWithPhone() = runTest {
        mockUserWithVerified(verified = false, phoneNumber = "+5511999998888")

        viewModel.check()
        advanceUntilIdle()

        val state = viewModel.state.value
        assertInstanceOf(VerifiedState.Unverified::class.java, state)
        assertEquals(true, (state as VerifiedState.Unverified).hasPhone)
    }

    @Test
    @DisplayName("check(): usuario nulo => VerifiedState.Failed")
    fun check_nullUser_returnsFailed() = runTest {
        every { auth.currentUser } returns null

        viewModel.check()
        advanceUntilIdle()

        assertInstanceOf(VerifiedState.Failed::class.java, viewModel.state.value)
    }

    @Test
    @DisplayName("check(): getIdToken nunca responde => Failed com retry, sem loading eterno")
    fun check_tokenNeverCompletes_returnsFailed() = runTest {
        every { auth.currentUser } returns user
        // Task que nunca completa (rede/App Check parados). Spec
        // BUGFIX_2026-11-09_SPLASH_TRAVADA_REVISAO_PLAY.
        every { user.getIdToken(false) } returns TaskCompletionSource<GetTokenResult>().task

        viewModel.check()
        advanceUntilIdle()

        val state = viewModel.state.value
        assertInstanceOf(VerifiedState.Failed::class.java, state)
        assertEquals(false, (state as VerifiedState.Failed).postVerify)
    }

    @Test
    @DisplayName("check(): getIdToken lanca excecao => VerifiedState.Failed")
    fun check_tokenException_returnsFailed() = runTest {
        every { auth.currentUser } returns user
        every { user.getIdToken(false) } returns Tasks.forException(
            RuntimeException("network error"),
        )

        viewModel.check()
        advanceUntilIdle()

        assertInstanceOf(VerifiedState.Failed::class.java, viewModel.state.value)
    }

    // ─── recheckAfterVerify() ─────────────────────────────────────────────────────

    @Test
    @DisplayName("recheckAfterVerify(): verified=true no token forcado => Verified")
    fun recheckAfterVerify_verifiedTrue_returnsVerified() = runTest {
        mockUserWithVerifiedForRecheck(verified = true)

        viewModel.recheckAfterVerify()
        advanceUntilIdle()

        assertInstanceOf(VerifiedState.Verified::class.java, viewModel.state.value)
    }

    @Test
    @DisplayName("recheckAfterVerify(): verified=false no token forcado => Failed (sem loop)")
    fun recheckAfterVerify_stillFalse_returnsFailed_notLoop() = runTest {
        mockUserWithVerifiedForRecheck(verified = false)

        viewModel.recheckAfterVerify()
        advanceUntilIdle()

        // Deve ser Failed — nao deve re-rotear para Unverified (prevencao de loop)
        assertInstanceOf(VerifiedState.Failed::class.java, viewModel.state.value)
    }

    @Test
    @DisplayName("recheckAfterVerify(): usuario nulo => Failed")
    fun recheckAfterVerify_nullUser_returnsFailed() = runTest {
        every { auth.currentUser } returns null

        viewModel.recheckAfterVerify()
        advanceUntilIdle()

        assertInstanceOf(VerifiedState.Failed::class.java, viewModel.state.value)
    }

    @Test
    @DisplayName("recheckAfterVerify(): 2 falhas de getIdToken(true) seguidas de sucesso com verified=true => Verified")
    fun recheckAfterVerify_twoFailuresThenSuccess_returnsVerified() = runTest {
        // Configura usuario com telefone nulo
        every { auth.currentUser } returns user
        every { user.phoneNumber } returns null

        val successToken = makeTokenResult(mapOf("verified" to true))
        // getIdToken(false) retorna token com verified=true (leitura de cache apos retry bem-sucedido)
        every { user.getIdToken(false) } returns Tasks.forResult(successToken)

        // getIdToken(true) falha nas 2 primeiras chamadas e tem sucesso na 3a (retry/backoff)
        val callCount = AtomicInteger(0)
        every { user.getIdToken(true) } answers {
            val attempt = callCount.getAndIncrement()
            if (attempt < 2) {
                Tasks.forException(RuntimeException("transient error attempt $attempt"))
            } else {
                Tasks.forResult(successToken)
            }
        }

        viewModel.recheckAfterVerify()
        advanceUntilIdle()

        // Apos 2 falhas e 1 sucesso no retry, o claim verified=true deve liberar o app
        assertInstanceOf(VerifiedState.Verified::class.java, viewModel.state.value)
    }
}
