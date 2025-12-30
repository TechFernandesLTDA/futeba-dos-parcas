package com.futebadosparcas.ui.splash

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.ui.auth.LoginActivity
import com.futebadosparcas.ui.main.MainActivity
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@SuppressLint("CustomSplashScreen")
@AndroidEntryPoint
class SplashActivity : AppCompatActivity() {

    @Inject
    lateinit var authRepository: AuthRepository
    
    @Inject
    lateinit var preferencesManager: PreferencesManager

    companion object {
        private const val FOUR_HOURS_IN_MILLIS = 4 * 60 * 60 * 1000L // 4 horas em milissegundos
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Instala a splash screen do sistema (Android 12+)
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Navega imediatamente sem delay
        checkAuthAndNavigate()
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