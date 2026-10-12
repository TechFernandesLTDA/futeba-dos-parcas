package com.futebadosparcas.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.ui.main.MainActivityCompose
import com.futebadosparcas.ui.theme.FutebaTheme
import org.koin.androidx.viewmodel.ext.android.viewModel

class RegisterActivityCompose : AppCompatActivity() {

    private val viewModel: RegisterViewModel by viewModel()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            FutebaTheme {
                val uiState by viewModel.registerState.collectAsStateWithLifecycle()

                RegisterScreen(
                    uiState = uiState,
                    versionName = BuildConfig.VERSION_NAME,
                    onRegisterWithEmail = { email, password, name ->
                        viewModel.registerWithEmailAndPassword(email, password, name)
                    },
                    onNavigateToLogin = { finish() },
                    onNavigateToMain = {
                        val intent = Intent(this, MainActivityCompose::class.java)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        startActivity(intent)
                        finish()
                    }
                )
            }
        }
    }
}
