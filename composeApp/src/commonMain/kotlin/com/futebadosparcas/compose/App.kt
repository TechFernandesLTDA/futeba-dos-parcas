package com.futebadosparcas.compose

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.futebadosparcas.compose.di.composeAppKoinModules
import com.futebadosparcas.compose.navigation.AppRoutes
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.ui.HomeScreen
import com.futebadosparcas.ui.core.GamesScreen
import com.futebadosparcas.ui.core.LoginScreen
import com.futebadosparcas.ui.core.LoginState
import com.futebadosparcas.ui.core.LoginViewModel
import com.futebadosparcas.ui.core.ProfileSetupScreen
import com.futebadosparcas.ui.core.WelcomeScreen
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.whatsnew.WhatsNewPopupHost
import com.futebadosparcas.ui.whatsnew.WhatsNewScreen
import org.koin.compose.KoinApplication
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun App() {
    KoinApplication(application = {
        modules(composeAppKoinModules)
    }) {
        AppContent()
    }
}

@Composable
private fun AppContent() {
    FutebaTheme {
        // #2673/#2691 — Surface de fundo desenha edge-to-edge (cor cobre toda a tela,
        // inclusive sob status bar / notch / home indicator), enquanto o conteúdo
        // interno respeita a safe-area via `WindowInsets.safeDrawing`.
        //
        // `safeDrawing` combina system bars + display cutout (notch/Dynamic Island), então
        // este único padding no scaffold raiz garante que nenhuma tela full-bleed coloque
        // conteúdo interativo/texto sob recortes da tela. As telas filhas herdam essa área
        // segura; backgrounds que devem sangrar até a borda usam a `Surface` externa.
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
            ) {
                AppNavigation()
                WhatsNewPopupHost()
            }
        }
    }
}

@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    val authRepository: AuthRepository? = runCatching { koinInject<AuthRepository>() }.getOrNull()
    val startDestination = if (authRepository?.isLoggedIn() == true) AppRoutes.HOME else AppRoutes.WELCOME

    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = {
            fadeIn(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start)
        },
        exitTransition = {
            fadeOut(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Start)
        },
        popEnterTransition = {
            fadeIn(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.End)
        },
        popExitTransition = {
            fadeOut(animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)) +
            slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.End)
        }
    ) {
        // Welcome / Onboarding
        composable(AppRoutes.WELCOME) {
            WelcomeScreen(
                onContinue = { navController.navigate(AppRoutes.LOGIN) }
            )
        }

        // Login
        composable(AppRoutes.LOGIN) {
            val vm: LoginViewModel? = runCatching { koinViewModel<LoginViewModel>() }.getOrNull()
            val uiState = vm?.loginState?.collectAsStateWithLifecycle()?.value ?: LoginState.Idle

            LaunchedEffect(uiState) {
                if (uiState is LoginState.Success) {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                }
            }

            LoginScreen(
                uiState = uiState,
                versionName = "",
                onGoogleSignInClick = { vm?.onGoogleSignInSuccess() },
                onEmailPasswordSignIn = { email, password -> vm?.signInWithEmailAndPassword(email, password) },
                onForgotPassword = { email -> vm?.sendPasswordResetEmail(email) },
                onNavigateToRegister = {
                    navController.navigate(AppRoutes.PROFILE_SETUP)
                },
                onNavigateToMain = {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        // Perfil setup (pós-registro / primeiro acesso)
        composable(AppRoutes.PROFILE_SETUP) {
            ProfileSetupScreen(
                onContinue = {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.PROFILE_SETUP) { inclusive = true }
                    }
                },
                onSkip = {
                    navController.navigate(AppRoutes.HOME) {
                        popUpTo(AppRoutes.PROFILE_SETUP) { inclusive = true }
                    }
                }
            )
        }

        // Home
        composable(AppRoutes.HOME) {
            HomeScreen(
                onOpenWhatsNew = { navController.navigate(AppRoutes.WHATS_NEW) },
                onNavigateToGames = { navController.navigate(AppRoutes.GAMES) },
                onNavigateToGroups = { navController.navigate(AppRoutes.GROUPS) },
                onNavigateToProfile = { navController.navigate(AppRoutes.PROFILE) },
            )
        }

        // Games
        composable(AppRoutes.GAMES) {
            GamesScreen(
                onGameClick = { gameId -> navController.navigate("game/$gameId") },
                onCreateGameClick = { /* TODO: rota create_game */ }
            )
        }

        // Game detail
        composable(AppRoutes.GAME_DETAIL) {
            // TODO: extrair gameId dos argumentos e renderizar GameDetailScreen
        }

        // Groups
        composable(AppRoutes.GROUPS) {
            // TODO: GroupsScreen(navController)
        }

        // Group detail
        composable(AppRoutes.GROUP_DETAIL) {
            // TODO: extrair groupId dos argumentos e renderizar GroupDetailScreen
        }

        // Profile
        composable(AppRoutes.PROFILE) {
            // TODO: ProfileScreen(navController)
        }

        // Ranking
        composable(AppRoutes.RANKING) {
            // TODO: RankingScreen(navController)
        }

        // Badges
        composable(AppRoutes.BADGES) {
            // TODO: BadgesScreen(navController)
        }

        // Locations
        composable(AppRoutes.LOCATIONS) {
            // TODO: LocationsScreen(navController)
        }

        // Cashbox
        composable(AppRoutes.CASHBOX) {
            // TODO: CashboxScreen(navController)
        }

        // Novidades
        composable(AppRoutes.WHATS_NEW) {
            WhatsNewScreen(onBack = { navController.popBackStack() })
        }
    }
}
