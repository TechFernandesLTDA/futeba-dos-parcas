package com.futebadosparcas.ui.splash

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.ui.auth.LoginActivityCompose
import com.futebadosparcas.ui.main.MainActivityCompose
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.PreferencesManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import kotlin.random.Random

/**
 * Activity de Splash com suporte a autenticação biométrica.
 * Modernizada para Jetpack Compose.
 *
 * Fluxo de autenticação (ver [SplashStartupResolver]):
 * 1. Verifica usuário já logado
 * 2. Carrega o usuário para o brasão, com teto de tempo
 * 3. Verifica se login expirou (4 horas)
 * 4. Navega para MainActivity ou LoginActivity
 */
class SplashActivityCompose : AppCompatActivity() {

    private val authRepository: AuthRepository by inject()
    private val userRepository: UserRepository by inject()
    private val preferencesManager: PreferencesManager by inject()

    companion object {
        private const val TAG = "SplashActivity"

        // Frases de efeito para a splash screen
        private val SPLASH_QUOTES = listOf(
            "Aquecendo os motores... ⚽",
            "Preparando as quadras... 🏟️",
            "Convocando os craques... 🌟",
            "Organizando o time... 👥",
            "Calibrando a chuteira... 👟",
            "Verificando o placar... 📊",
            "Chamando os parças... 🤝",
            "Inflando a bola... ⚽",
            "Marcando o horário... ⏰",
            "Preparando o campo... 🌱"
        )
    }

    private var userState: User? by mutableStateOf(null)
    private var destinationState: SplashDestination? by mutableStateOf(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Instala a splash screen do sistema (Android 12+)
        installSplashScreen()
        super.onCreate(savedInstanceState)

        val randomQuote = SPLASH_QUOTES[Random.nextInt(SPLASH_QUOTES.size)]

        setContent {
            FutebaTheme {
                SplashScreen(
                    user = userState,
                    destination = destinationState,
                    versionName = BuildConfig.VERSION_NAME,
                    randomQuote = randomQuote,
                    onNavigate = { destination ->
                        navigateToDestination(destination)
                    }
                )
            }
        }

        // Carrega dados do usuário
        loadUserAndNavigate()
    }

    /**
     * Decide o destino e o brasão sem deixar a splash presa à rede.
     *
     * Spec: specs/BUGFIX_2026-11-09_SPLASH_TRAVADA_REVISAO_PLAY.md. A leitura do
     * usuário tem teto ([SplashStartupResolver.USER_LOAD_TIMEOUT_MILLIS]); qualquer
     * erro inesperado cai no Login. O destino sempre é definido, então a splash
     * sempre navega.
     */
    private fun loadUserAndNavigate() {
        val resolver = SplashStartupResolver(
            isLoggedIn = { authRepository.isLoggedIn() },
            loadCurrentUser = { userRepository.getCurrentUser() },
            lastLoginTimeMillis = { preferencesManager.getLastLoginTime() }
        )
        lifecycleScope.launch {
            val decision = try {
                resolver.resolve()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                AppLogger.e(TAG, "Falha ao decidir o destino da splash: ${e.message}", e)
                SplashDecision(SplashDestination.Login, user = null)
            }
            // PERF (spec PERF_ANDROID_OPTIMIZATIONS_2026_10_31): sem delay aqui; o
            // SplashScreen mostra o brasão por 800 ms quando há usuário.
            userState = decision.user
            destinationState = decision.destination
        }
    }

    /**
     * Navega para o destino já decidido pelo [SplashStartupResolver] (a regra de
     * reautenticação de 4 horas é aplicada lá).
     */
    private fun navigateToDestination(destination: SplashDestination) {
        when (destination) {
            SplashDestination.Main -> navigateToMain()
            SplashDestination.Login -> navigateToLogin()
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivityCompose::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        // FIX #4140: repassa os extras do tap na push em background/quit
        // (gameId, notificationType, action) para o handleIntentExtras do
        // MainActivityCompose navegar para game_detail/{id}.
        copyPushExtras(intent)
        startActivity(intent)
        finish()
    }

    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivityCompose::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        // FIX #4140: mesmo após login, o deep link da push deve sobreviver.
        copyPushExtras(intent)
        startActivity(intent)
        finish()
    }

    /**
     * FIX #4140: copia os extras da notificação (payload `data` do FCM)
     * do intent de abertura para o intent de destino.
     */
    private fun copyPushExtras(target: Intent) {
        val source = intent
        val extras = source.extras ?: return
        for (key in listOf("gameId", "notificationType", "action")) {
            extras.getString(key)?.let { target.putExtra(key, it) }
        }
    }
}
