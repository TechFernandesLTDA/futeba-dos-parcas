package com.futebadosparcas.ui.splash

import com.futebadosparcas.domain.model.User
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * A splash nunca pode ficar presa (recusa da Play na 1.42.0, "app não está respondendo").
 *
 * Spec: specs/BUGFIX_2026-11-09_SPLASH_TRAVADA_REVISAO_PLAY.md
 *
 * Os testes rodam em tempo virtual: o `withTimeout` externo de 30 s faz o teste falhar
 * rápido (em vez de travar o CI) se a decisão voltar a depender de uma leitura que
 * nunca completa.
 */
@DisplayName("SplashStartupResolver")
class SplashStartupResolverTest {

    private val now = 1_000_000_000_000L
    private val freshLogin = now - 60_000L // 1 minuto atrás
    private val staleLogin = now - SplashStartupResolver.REAUTH_INTERVAL_MILLIS - 1L
    private val user = User(id = "uid-revisor", name = "Revisor")

    private fun resolver(
        loggedIn: Boolean = true,
        lastLogin: Long = freshLogin,
        load: suspend () -> Result<User> = { Result.success(user) }
    ) = SplashStartupResolver(
        isLoggedIn = { loggedIn },
        loadCurrentUser = load,
        lastLoginTimeMillis = { lastLogin },
        nowMillis = { now }
    )

    @Test
    @DisplayName("leitura do usuário que nunca completa: navega mesmo assim, dentro do teto")
    fun `hanging user load still yields a destination`() = runTest {
        val decision = withTimeout(30_000L) {
            resolver(load = { awaitCancellation() }).resolve()
        }

        assertEquals(SplashDestination.Main, decision.destination)
        assertNull(decision.user)
        assertTrue(
            currentTime <= SplashStartupResolver.USER_LOAD_TIMEOUT_MILLIS,
            "decidiu em ${currentTime}ms, acima do teto"
        )
    }

    @Test
    @DisplayName("leitura que nunca completa e login com mais de 4 horas: Login")
    fun `hanging user load with stale login goes to login`() = runTest {
        val decision = withTimeout(30_000L) {
            resolver(lastLogin = staleLogin, load = { awaitCancellation() }).resolve()
        }

        assertEquals(SplashDestination.Login, decision.destination)
        assertNull(decision.user)
    }

    @Test
    @DisplayName("sem sessão: Login sem carregar o usuário")
    fun `no session goes to login without loading`() = runTest {
        var loads = 0
        val decision = resolver(loggedIn = false, load = { loads++; Result.success(user) }).resolve()

        assertEquals(SplashDestination.Login, decision.destination)
        assertEquals(0, loads)
    }

    @Test
    @DisplayName("usuário carregado e login recente: Main com brasão")
    fun `loaded user with fresh login goes to main`() = runTest {
        val decision = resolver().resolve()

        assertEquals(SplashDestination.Main, decision.destination)
        assertEquals(user, decision.user)
    }

    @Test
    @DisplayName("usuário carregado e sem registro de login: Login (reautenticação)")
    fun `loaded user without login record goes to login`() = runTest {
        val decision = resolver(lastLogin = 0L).resolve()

        assertEquals(SplashDestination.Login, decision.destination)
        assertEquals(user, decision.user)
    }

    @Test
    @DisplayName("falha ao carregar: Login, como antes")
    fun `failed load goes to login`() = runTest {
        val decision = resolver(load = { Result.failure(Exception("Usuário não encontrado")) }).resolve()

        assertEquals(SplashDestination.Login, decision.destination)
        assertNull(decision.user)
    }

    @Test
    @DisplayName("exceção ao carregar: Login, sem derrubar a splash")
    fun `throwing load goes to login`() = runTest {
        val decision = resolver(load = { throw IllegalStateException("boom") }).resolve()

        assertEquals(SplashDestination.Login, decision.destination)
    }

    @Test
    @DisplayName("preferências encriptadas ilegíveis: trata como sem registro de login")
    fun `unreadable last login is treated as missing`() = runTest {
        val decision = SplashStartupResolver(
            isLoggedIn = { true },
            loadCurrentUser = { Result.success(user) },
            lastLoginTimeMillis = { throw SecurityException("keystore") },
            nowMillis = { now }
        ).resolve()

        assertEquals(SplashDestination.Login, decision.destination)
    }
}
