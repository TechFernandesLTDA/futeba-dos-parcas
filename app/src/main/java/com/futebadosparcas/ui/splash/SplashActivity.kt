package com.futebadosparcas.ui.splash

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.ui.auth.LoginActivity
import com.futebadosparcas.ui.main.MainActivity
import com.futebadosparcas.util.LevelBadgeHelper
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.random.Random

@SuppressLint("CustomSplashScreen")
@AndroidEntryPoint
class SplashActivity : AppCompatActivity() {

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

    override fun onCreate(savedInstanceState: Bundle?) {
        // Instala a splash screen do sistema (Android 12+)
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Define o layout para poder acessar as views
        setContentView(R.layout.activity_splash)

        val tvSplashVersion = findViewById<TextView>(R.id.tvSplashVersion)
        tvSplashVersion.text = "v${com.futebadosparcas.BuildConfig.VERSION_NAME}"


        // Define frase aleatória
        setupRandomQuote()

        // Carrega o brasão do usuário antes de navegar
        loadUserBadgeAndNavigate()
    }

    private fun setupRandomQuote() {
        val tvQuote = findViewById<TextView>(R.id.tvSplashQuote)
        val randomQuote = SPLASH_QUOTES[Random.nextInt(SPLASH_QUOTES.size)]
        tvQuote.text = randomQuote
    }

    private fun loadUserBadgeAndNavigate() {
        val ivLevelBadge = findViewById<ImageView>(R.id.ivLevelBadgeSplash)

        // Se o usuário estiver logado, busca o nível e atualiza o brasão
        if (authRepository.isLoggedIn()) {
            lifecycleScope.launch {
                userRepository.getCurrentUser().onSuccess { user ->
                    // Define o brasão correto
                    ivLevelBadge.setImageResource(LevelBadgeHelper.getBadgeForLevel(user.level))

                    // Anima o aparecimento do brasão com zoom e fade in
                    ivLevelBadge.animate()
                        .alpha(1f)
                        .scaleX(1f)
                        .scaleY(1f)
                        .setDuration(600)
                        .setInterpolator(android.view.animation.OvershootInterpolator())
                        .start()
                }

                // Aguarda animação completar antes de navegar
                kotlinx.coroutines.delay(800)
                checkAuthAndNavigate()
            }
        } else {
            // Se não estiver logado, navega direto sem mostrar brasão
            checkAuthAndNavigate()
        }
    }

    private fun checkAuthAndNavigate() {
        val isLoggedIn = authRepository.isLoggedIn()
        val lastLoginTime = preferencesManager.getLastLoginTime()
        val currentTime = System.currentTimeMillis()
        
        // Verifica se passou mais de 4 horas desde o último login
        val needsReauth = if (lastLoginTime > 0) {
            (currentTime - lastLoginTime) > FOUR_HOURS_IN_MILLIS
        } else {
            true // Se nunca fez login, precisa autenticar
        }

        val intent = if (isLoggedIn && !needsReauth) {
            // Usuário logado e login recente (< 4 horas)
            Intent(this, MainActivity::class.java)
        } else {
            // Usuário não logado OU login expirado (> 4 horas)
            Intent(this, LoginActivity::class.java)
        }

        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}