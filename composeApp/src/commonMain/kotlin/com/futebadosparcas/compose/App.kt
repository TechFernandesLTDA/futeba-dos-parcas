package com.futebadosparcas.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.futebadosparcas.compose.di.composeAppKoinModules
import com.futebadosparcas.compose.navigation.AppRoutes
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.whatsnew.WhatsNewPopupHost
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
import org.koin.compose.KoinApplication

/**
 * Entry point da aplicação Compose Multiplatform.
 *
 * Compartilhado entre Android (composeApp) e iOS (ComposeApp.framework).
 *
 * Koin é inicializado via [KoinApplication] composable — isso é seguro em KMP
 * porque `composeApp` é um módulo de biblioteca independente de `:app` e não
 * compartilha contexto Koin com ele.
 *
 * Refs: specs/feat-2026-05-16-ios-parity-cmp-phase3.md §3.2
 */
@Composable
fun App() {
    KoinApplication(application = {
        modules(composeAppKoinModules)
    }) {
        AppContent()
    }
}

/**
 * Conteúdo principal da app com tema e navegação.
 * Separado de [App] para ser legível e testável de forma independente.
 */
@Composable
private fun AppContent() {
    FutebaTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            Box {
                AppNavigation()
                // Pop-up "Novidades" pós-update — overlay global, montado acima
                // do NavHost. Não emite layout enquanto não há nota a exibir.
                WhatsNewPopupHost()
            }
        }
    }
}

/**
 * Navegação principal da aplicação — NavHost real em commonMain.
 *
 * Esta é a fundação onde adicionar uma nova tela + rota + ViewModel "just works":
 *
 * 1. Adicionar a rota em [AppRoutes]
 * 2. Registrar o ViewModel em [com.futebadosparcas.compose.di.composeAppModule]
 * 3. Adicionar o bloco `composable(AppRoutes.MINHA_ROTA) { MinhaScreen() }` aqui
 * 4. A tela renderiza em Android e iOS sem código adicional
 *
 * Refs: specs/feat-2026-05-16-ios-parity-cmp-phase3.md §3.2
 */
@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = AppRoutes.HOME
    ) {
        // Tela inicial — placeholder até o Bucket Core portar HomeScreen real do :app
        composable(AppRoutes.HOME) {
            HomeScreen(
                onOpenWhatsNew = { navController.navigate(AppRoutes.WHATS_NEW) },
            )
        }

        // Tela "Novidades" — histórico de release notes (spec feat-2026-05-22, Fase G)
        composable(AppRoutes.WHATS_NEW) {
            WhatsNewScreen(onBack = { navController.popBackStack() })
        }

        // ─── Bucket Core (frota adiciona aqui) ────────────────────────────────
        // composable(AppRoutes.LOGIN) {
        //     LoginScreen(
        //         onLoginSuccess = { navController.navigate(AppRoutes.HOME) {
        //             popUpTo(AppRoutes.LOGIN) { inclusive = true }
        //         }}
        //     )
        // }
        // composable(AppRoutes.GAMES) { GamesScreen(navController) }
        // composable(AppRoutes.GAME_DETAIL) { backStack ->
        //     val gameId = backStack.arguments?.getString("gameId") ?: return@composable
        //     GameDetailScreen(gameId, navController)
        // }
    }
}
