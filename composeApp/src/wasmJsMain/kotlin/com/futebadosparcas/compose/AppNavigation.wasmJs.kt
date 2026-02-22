package com.futebadosparcas.compose

import androidx.compose.runtime.*
import com.futebadosparcas.firebase.firebaseAuthGetUser
import com.futebadosparcas.firebase.firebaseAuthOnStateChanged
import com.futebadosparcas.ui.HomeScreenWeb
import com.futebadosparcas.ui.LoginScreen
import com.futebadosparcas.ui.SplashScreen

@Composable
actual fun AppNavigation(
    isLoggedIn: Boolean,
    onLoginSuccess: () -> Unit
) {
    var authState by remember { mutableStateOf<Boolean?>(null) }
    var showSplash by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        firebaseAuthOnStateChanged { user ->
            authState = user != null
        }
        val currentUser = firebaseAuthGetUser()
        authState = currentUser != null
    }

    when {
        showSplash -> {
            SplashScreen(
                isAuthenticated = authState,
                onNavigate = { authenticated ->
                    showSplash = false
                    if (authenticated) {
                        onLoginSuccess()
                    }
                }
            )
        }
        isLoggedIn -> {
            HomeScreenWeb(
                onLogout = { onLoginSuccess() }
            )
        }
        else -> {
            LoginScreen(onLoginSuccess = onLoginSuccess)
        }
    }
}
