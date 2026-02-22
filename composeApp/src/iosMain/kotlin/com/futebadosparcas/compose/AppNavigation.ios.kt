package com.futebadosparcas.compose

import androidx.compose.runtime.Composable
import com.futebadosparcas.ui.HomeScreen

/**
 * Navegação para iOS
 *
 * iOS usa seu próprio sistema de navegação,
 * então aqui apenas mostramos o HomeScreen.
 */
@Composable
actual fun AppNavigation(
    isLoggedIn: Boolean,
    onLoginSuccess: () -> Unit
) {
    // iOS tem navegação própria, apenas mostra home
    HomeScreen()
}
