package com.futebadosparcas.compose

import com.futebadosparcas.compose.navigation.AppRoutes
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.ui.core.BlockedPlayerData
import com.futebadosparcas.ui.core.LoginState
import com.futebadosparcas.ui.core.LoginViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Testes unitários em `commonTest` do `:composeApp` (#4433 — Onda G):
 * - Navegação e rotas (`AppRoutes.gameDetail`, `AppRoutes.groupDetail`, `AppRoutes.CREATE_GAME`, `AppRoutes.resolveDeepLink`).
 * - Universal Links e bridge de deep links (`ComposeDeepLinkBridge` — #4426).
 * - Codificação/decodificação de jogadores bloqueados (`encodeBlockedPlayers` / `decodeBlockedPlayers` — #4423).
 * - Fluxo de recuperação de senha (`sendPasswordResetEmail`) e aviso honesto de Google Sign-In no iOS (`LoginViewModel` — B9).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class OndaGParityTest {

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        ComposeDeepLinkBridge.consumePendingUrl()
    }

    @AfterTest
    fun tearDown() {
        ComposeDeepLinkBridge.consumePendingUrl()
        Dispatchers.resetMain()
    }

    @Test
    fun appRoutes_buildersGenerateExpectedRoutes() {
        assertEquals("game/game_123", AppRoutes.gameDetail("game_123"))
        assertEquals("group/group_456", AppRoutes.groupDetail("group_456"))
        assertEquals("create_game", AppRoutes.CREATE_GAME)
        assertEquals("mvp_voting/{gameId}", AppRoutes.MVP_VOTING)
    }

    @Test
    fun resolveDeepLink_supportsUniversalLinksAndCustomScheme() {
        // Universal Links em futebadosparcas.com.br (#4426)
        assertEquals(
            "game/abc99",
            AppRoutes.resolveDeepLink("https://futebadosparcas.com.br/game/abc99")
        )
        assertEquals(
            "game/abc99",
            AppRoutes.resolveDeepLink("https://www.futebadosparcas.com.br/game/abc99")
        )
        assertEquals(
            "group/grp77",
            AppRoutes.resolveDeepLink("https://futebadosparcas.com.br/group/grp77")
        )
        assertEquals(
            "invite_players/CODE2026",
            AppRoutes.resolveDeepLink("https://futebadosparcas.com.br/invite/CODE2026")
        )

        // Custom scheme futeba://
        assertEquals(
            "game/jogo42",
            AppRoutes.resolveDeepLink("futeba://game/jogo42")
        )
        assertEquals(
            "invite_players/PARCA10",
            AppRoutes.resolveDeepLink("futeba://invite/PARCA10")
        )
        assertEquals(
            AppRoutes.RANKING,
            AppRoutes.resolveDeepLink("futeba://ranking")
        )

        // URL inválida ou host externo não suportado
        assertNull(AppRoutes.resolveDeepLink("https://example.com/game/123"))
        assertNull(AppRoutes.resolveDeepLink(""))
    }

    @Test
    fun composeDeepLinkBridge_storesAndConsumesIncomingUrl() {
        assertNull(ComposeDeepLinkBridge.pendingUrl.value)

        ComposeDeepLinkBridge.onOpenUrl("  https://futebadosparcas.com.br/game/g1  ")
        assertEquals("https://futebadosparcas.com.br/game/g1", ComposeDeepLinkBridge.pendingUrl.value)

        // URL em branco é ignorada
        ComposeDeepLinkBridge.onOpenUrl("   ")
        assertEquals("https://futebadosparcas.com.br/game/g1", ComposeDeepLinkBridge.pendingUrl.value)

        val consumed = ComposeDeepLinkBridge.consumePendingUrl()
        assertEquals("https://futebadosparcas.com.br/game/g1", consumed)
        assertNull(ComposeDeepLinkBridge.pendingUrl.value)
    }

    @Test
    fun blockedPlayers_encodeAndDecodeRoundTripPreservesFieldsAndSanitizesSeparators() {
        assertEquals(emptyList(), decodeBlockedPlayers(""))
        assertEquals("", encodeBlockedPlayers(emptyList()))

        val original = listOf(
            BlockedPlayerData(
                userId = "u1",
                userName = "Carlos Silva",
                reason = "Falta sem avisar",
                blockedAt = 1700000000000L
            ),
            BlockedPlayerData(
                userId = "u2",
                userName = "Pedro\nSantos",
                reason = "Conduta antidesportiva",
                blockedAt = null
            )
        )

        val encoded = encodeBlockedPlayers(original)
        val decoded = decodeBlockedPlayers(encoded)

        assertEquals(2, decoded.size)
        assertEquals("u1", decoded[0].userId)
        assertEquals("Carlos Silva", decoded[0].userName)
        assertEquals("Falta sem avisar", decoded[0].reason)
        assertEquals(1700000000000L, decoded[0].blockedAt)

        assertEquals("u2", decoded[1].userId)
        assertEquals("Pedro Santos", decoded[1].userName)
        assertEquals("Conduta antidesportiva", decoded[1].reason)
        assertNull(decoded[1].blockedAt)
    }

    @Test
    fun loginViewModel_sendPasswordResetEmailValidatesAndReportsSuccessOrFailure() = runTest {
        val fakeAuth = FakeAuthRepository()
        val viewModel = LoginViewModel(fakeAuth)

        // E-mail em branco -> erro imediato
        viewModel.sendPasswordResetEmail("   ")
        val blankError = assertIs<LoginState.Error>(viewModel.loginState.value)
        assertTrue(blankError.message.contains("e-mail", ignoreCase = true))

        // E-mail válido com sucesso -> volta a Idle e publica mensagem de confirmação
        viewModel.sendPasswordResetEmail(" craque@futeba.com ")
        assertEquals(LoginState.Idle, viewModel.loginState.value)
        assertEquals("craque@futeba.com", fakeAuth.lastResetEmail)
        assertTrue(viewModel.passwordResetMessage.value.orEmpty().contains("craque@futeba.com"))

        // Falha no envio -> LoginState.Error
        fakeAuth.resetResult = Result.failure(IllegalStateException("Usuário não encontrado"))
        viewModel.sendPasswordResetEmail("inexistente@futeba.com")
        val failError = assertIs<LoginState.Error>(viewModel.loginState.value)
        assertEquals("Usuário não encontrado", failError.message)
    }

    @Test
    fun loginViewModel_googleSignInUnavailableShowsHonestMessage() {
        val fakeAuth = FakeAuthRepository()
        val viewModel = LoginViewModel(fakeAuth)

        viewModel.onGoogleSignInUnavailable()
        val errorState = assertIs<LoginState.Error>(viewModel.loginState.value)
        assertTrue(errorState.message.contains("Google", ignoreCase = true))
        assertTrue(errorState.message.contains("iOS", ignoreCase = true))
    }

    private class FakeAuthRepository : AuthRepository {
        override val authStateFlow: Flow<String?> = MutableStateFlow(null)
        var lastResetEmail: String? = null
        var resetResult: Result<Unit> = Result.success(Unit)

        override fun isLoggedIn(): Boolean = false
        override fun getCurrentUserId(): String? = null
        override suspend fun getCurrentUser(): Result<User> =
            Result.success(User(id = "u1", name = "Craque", email = "craque@futeba.com"))

        override suspend fun signIn(email: String, password: String): Result<String> =
            Result.success("u1")

        override suspend fun signUp(email: String, password: String): Result<String> =
            Result.success("u1")

        override suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
            lastResetEmail = email
            return resetResult
        }

        override suspend fun logout() = Unit
    }
}
