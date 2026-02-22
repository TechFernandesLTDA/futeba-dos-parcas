package com.futebadosparcas.compose

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.theme.FutebaTheme

/**
 * Entry point da aplicação Compose Multiplatform.
 *
 * Este composable é compartilhado entre Android, iOS e Web.
 */
@Composable
fun App() {
    var isLoggedIn by remember { mutableStateOf(false) }

    FutebaTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            AppNavigation(
                isLoggedIn = isLoggedIn,
                onLoginSuccess = { isLoggedIn = true }
            )
        }
    }
}

/**
 * Navegação entre telas (expect/actual para diferentes plataformas)
 */
@Composable
expect fun AppNavigation(
    isLoggedIn: Boolean,
    onLoginSuccess: () -> Unit
)
