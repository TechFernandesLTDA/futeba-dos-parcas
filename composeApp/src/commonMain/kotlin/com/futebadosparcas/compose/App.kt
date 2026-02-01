package com.futebadosparcas.compose

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import com.futebadosparcas.ui.SplashScreen
import com.futebadosparcas.ui.theme.FutebaTheme

/**
 * Entry point da aplicação Compose Multiplatform.
 *
 * Este composable é compartilhado entre Android e iOS.
 */
@Composable
fun App() {
    FutebaTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            SplashScreen()
        }
    }
}
