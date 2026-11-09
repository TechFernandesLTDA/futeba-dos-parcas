package com.futebadosparcas.ui.splash

import com.futebadosparcas.domain.model.User
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Resultado da decisão da splash: para onde ir e, se carregou a tempo, o usuário
 * (usado só para mostrar o brasão antes de navegar).
 */
data class SplashDecision(
    val destination: SplashDestination,
    val user: User?
)

/**
 * Decide o destino da splash sem deixar a navegação refém da rede.
 *
 * Spec: specs/BUGFIX_2026-11-09_SPLASH_TRAVADA_REVISAO_PLAY.md
 *
 * Antes, a splash só navegava depois que `UserRepository.getCurrentUser()` retornava.
 * Essa chamada faz duas leituras do Firestore sem timeout (`users/{uid}` e
 * `users_private/{uid}`); se uma delas não completasse, a splash ficava parada para
 * sempre em "Aquecendo os motores..." (recusa da Play na 1.42.0).
 *
 * Regras:
 * - Sem sessão local: Login, sem tocar na rede.
 * - Com sessão: carrega o usuário com teto de [userLoadTimeoutMillis].
 *   - Carregou: destino pela regra de reautenticação de 4 horas, com o brasão.
 *   - Falhou (doc ausente, erro): Login, como antes (o Login refaz a leitura e
 *     mostra erro com nova tentativa).
 *   - Estourou o tempo: destino pela regra de reautenticação, sem o brasão. A sessão
 *     local é válida e a Main funciona com o cache do Firestore.
 *
 * As dependências são funções para testar sem Activity nem Firebase.
 */
class SplashStartupResolver(
    private val isLoggedIn: () -> Boolean,
    private val loadCurrentUser: suspend () -> Result<User>,
    private val lastLoginTimeMillis: () -> Long,
    private val nowMillis: () -> Long = { System.currentTimeMillis() },
    private val userLoadTimeoutMillis: Long = USER_LOAD_TIMEOUT_MILLIS
) {

    suspend fun resolve(): SplashDecision {
        if (!safeIsLoggedIn()) {
            return SplashDecision(SplashDestination.Login, user = null)
        }

        val loadResult: Result<User>? = withTimeoutOrNull(userLoadTimeoutMillis) {
            try {
                loadCurrentUser()
            } catch (e: CancellationException) {
                // Inclui o próprio timeout: precisa subir para o withTimeoutOrNull.
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

        return when {
            // Timeout: segue pela sessão local, sem brasão.
            loadResult == null -> SplashDecision(sessionDestination(), user = null)
            loadResult.isSuccess -> SplashDecision(sessionDestination(), loadResult.getOrNull())
            // Falha definitiva: mantém o comportamento anterior (Login).
            else -> SplashDecision(SplashDestination.Login, user = null)
        }
    }

    /**
     * Regra de reautenticação: sem registro de login ou login com mais de 4 horas
     * leva ao Login (que continua sozinho se a sessão do Firebase seguir válida).
     */
    private fun sessionDestination(): SplashDestination {
        val lastLogin = try {
            lastLoginTimeMillis()
        } catch (e: Exception) {
            // Preferências encriptadas ilegíveis: trata como sem registro.
            0L
        }
        val needsReauth = lastLogin <= 0L || (nowMillis() - lastLogin) > REAUTH_INTERVAL_MILLIS
        return if (needsReauth) SplashDestination.Login else SplashDestination.Main
    }

    private fun safeIsLoggedIn(): Boolean = try {
        isLoggedIn()
    } catch (e: Exception) {
        false
    }

    companion object {
        /** Teto para carregar o usuário na splash (o brasão é só cosmético). */
        const val USER_LOAD_TIMEOUT_MILLIS = 3_000L

        /** Janela de reautenticação (4 horas). */
        const val REAUTH_INTERVAL_MILLIS = 4 * 60 * 60 * 1000L
    }
}
