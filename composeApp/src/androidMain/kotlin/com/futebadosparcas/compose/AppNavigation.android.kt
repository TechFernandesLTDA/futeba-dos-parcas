package com.futebadosparcas.compose

import androidx.compose.runtime.Composable
import com.futebadosparcas.ui.HomeScreen

/**
 * Navegação para Android
 *
 * Android usa seu próprio sistema de navegação (NavController no app module),
 * então aqui apenas mostramos o HomeScreen.
 */
@Composable
actual fun AppNavigation(
    isLoggedIn: Boolean,
    onLoginSuccess: () -> Unit
) {
    // Android tem navegação própria, apenas mostra home
    HomeScreen()
}
