package com.futebadosparcas.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.FutebaTheme
/**
 * Activity de Registro (descontinuada).
 *
 * Nota: O registro agora é feito via Google Sign-In.
 * Esta Activity mostra um Toast informativo e redireciona para o Login.
 *
 * Modernizada para Jetpack Compose.
 */
class RegisterActivityCompose : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            FutebaTheme {
                RegisterScreen(
                    versionName = BuildConfig.VERSION_NAME,
                    onNavigateToLogin = {
                        // Mostrar Toast informativo
                        Toast.makeText(
                            this@RegisterActivityCompose,
                            getString(R.string.register_use_google_button),
                            Toast.LENGTH_LONG
                        ).show()

                        // Voltar para a tela anterior (geralmente Login)
                        finish()
                    }
                )
            }
        }
    }
}
