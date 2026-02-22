package com.futebadosparcas.compose

import androidx.compose.runtime.Composable
import com.futebadosparcas.ui.HomeScreenWeb
import com.futebadosparcas.ui.LoginScreen

/**
 * Navegação para Web (wasmJs)
 *
 * Mostra LoginScreen se não estiver autenticado, ou HomeScreenWeb se estiver.
 */
@Composable
actual fun AppNavigation(
    isLoggedIn: Boolean,
    onLoginSuccess: () -> Unit
) {
    if (isLoggedIn) {
        HomeScreenWeb()
    } else {
        LoginScreen(onLoginSuccess = onLoginSuccess)
    }
}
