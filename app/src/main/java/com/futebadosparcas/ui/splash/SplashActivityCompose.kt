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
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.random.Random

/**
 * Activity de Splash com suporte a autenticação biométrica.
 * Modernizada para Jetpack Compose.
 *
 * Fluxo de autenticação:
 * 1. Verifica usuário já logado
 * 2. Verifica se login expirou (4 horas)
 * 3. Carrega brasão do usuário se logado
 * 4. Navega para MainActivity ou LoginActivity
 */
@AndroidEntryPoint
class SplashActivityCompose : AppCompatActivity() {

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var userRepository: UserRepository

    @Inject
    lateinit var preferencesManager: PreferencesManager

    companion object {
        private const val FOUR_HOURS_IN_MILLIS = 4 * 60 * 60 * 1000L // 4 horas em milissegundos

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

    override fun onCreate(savedInstanceState: Bundle?) {
        // Instala a splash screen do sistema (Android 12+)
        installSplashScreen()
        super.onCreate(savedInstanceState)

        val randomQuote = SPLASH_QUOTES[Random.nextInt(SPLASH_QUOTES.size)]

        setContent {
            FutebaTheme {
                SplashScreen(
                    user = userState,
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
     * Carrega o usuário e determina o destino de navegação
     */
    private fun loadUserAndNavigate() {
        lifecycleScope.launch {
            if (authRepository.isLoggedIn()) {
                userRepository.getCurrentUser().onSuccess { user ->
                    userState = user
                    // Aguarda animação completar
                    delay(800)
                }.onFailure {
                    userState = null
                }
            } else {
                userState = null
            }
        }
    }

    /**
     * Navega para o destino apropriado baseado no estado de autenticação
     */
    private fun navigateToDestination(destination: SplashDestination) {
        // Verificar se precisa reautenticar (login expirou)
        if (destination == SplashDestination.Main) {
            val lastLoginTime = preferencesManager.getLastLoginTime()
            val currentTime = System.currentTimeMillis()
            val needsReauth = if (lastLoginTime > 0) {
                (currentTime - lastLoginTime) > FOUR_HOURS_IN_MILLIS
            } else {
                true
            }

            if (needsReauth) {
                navigateToLogin()
            } else {
                navigateToMain()
            }
        } else {
            navigateToLogin()
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivityCompose::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivityCompose::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
