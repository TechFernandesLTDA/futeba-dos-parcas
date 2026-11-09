package com.futebadosparcas.ui.splash

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme.colorScheme
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.theme.AppDimensions
import com.futebadosparcas.util.LevelBadgeHelper
import kotlinx.coroutines.delay
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Tela de Splash em Jetpack Compose.
 *
 * Funcionalidades:
 * - Mostra brasão do usuário com animação
 * - Exibe logo e frase aleatória
 * - Branding na parte inferior
 */
@Composable
fun SplashScreen(
    user: User?,
    destination: SplashDestination?,
    versionName: String,
    randomQuote: String,
    onNavigate: (destination: SplashDestination) -> Unit
) {
    var badgeAlpha by remember { mutableFloatStateOf(0f) }
    var badgeScale by remember { mutableFloatStateOf(0.8f) }
    var hasNavigated by remember { mutableStateOf(false) }

    // Navega assim que o destino é decidido (SplashStartupResolver sempre decide,
    // com teto de tempo). Antes a navegação dependia de `userChecked`, que só virava
    // true quando a leitura do usuário no Firestore retornava (spec
    // BUGFIX_2026-11-09_SPLASH_TRAVADA_REVISAO_PLAY).
    LaunchedEffect(destination) {
        val target = destination ?: return@LaunchedEffect
        if (hasNavigated) return@LaunchedEffect
        if (user != null) {
            // Animação de aparecimento do brasão
            badgeAlpha = 1f
            badgeScale = 1f
            delay(800)
        }
        hasNavigated = true
        onNavigate(target)
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = colorScheme.surface
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Conteúdo centralizado
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(AppDimensions.spacing_huge),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Brasão do Jogador (se logado)
                if (user != null) {
                    AsyncImage(
                        model = LevelBadgeHelper.getBadgeForLevel(user.level),
                        contentDescription = stringResource(R.string.activity_splash_contentdescription_1),
                        modifier = Modifier
                            .size(200.dp)
                            .alpha(badgeAlpha)
                            .scale(badgeScale),
                        contentScale = ContentScale.Fit
                    )
                }

                // Logo do App
                AsyncImage(
                    model = R.drawable.ic_launcher_foreground,
                    contentDescription = stringResource(R.string.app_name),
                    modifier = Modifier
                        .size(100.dp)
                        .padding(top = AppDimensions.spacing_extraLarge)
                )

                // Frase de Efeito
                Text(
                    text = randomQuote,
                    style = typography.bodyLarge.copy(
                        fontWeight = FontWeight.Bold,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                    ),
                    color = colorScheme.primary.copy(alpha = 0.7f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = AppDimensions.spacing_huge).padding(top = AppDimensions.spacing_extraLarge)
                )
            }

            // Branding na parte inferior
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = AppDimensions.spacing_massive),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom
            ) {
                Text(
                    text = stringResource(R.string.layout_splash_branding_text_1),
                    style = typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = colorScheme.primary
                )

                Text(
                    text = stringResource(R.string.version, versionName),
                    style = typography.bodySmall,
                    color = colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = AppDimensions.spacing_extraSmall)
                )

                Text(
                    text = stringResource(R.string.layout_splash_branding_text_2),
                    style = typography.bodySmall,
                    color = colorScheme.onSurface,
                    modifier = Modifier.padding(top = AppDimensions.spacing_extraSmall)
                )
            }
        }
    }
}

/**
 * Destino de navegação após splash
 */
enum class SplashDestination {
    Main,
    Login
}
