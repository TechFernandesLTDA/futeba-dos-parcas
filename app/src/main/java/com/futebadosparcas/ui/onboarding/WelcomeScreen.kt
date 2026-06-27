package com.futebadosparcas.ui.onboarding

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.components.design.AppLogo
import com.futebadosparcas.ui.components.design.AppLogoShape
import com.futebadosparcas.ui.components.design.AppLogoSize
import com.futebadosparcas.ui.theme.AppDimensions
/**
 * Tela de boas-vindas do onboarding.
 * Apresenta o app e seus principais recursos.
 */
@Composable
fun WelcomeScreen(
    onContinue: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(AppDimensions.spacing_extraLarge),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.weight(0.5f))

            // Logo do app — componente padronizado AppLogo
            AppLogo(
                size = AppLogoSize.XLarge,
                shape = AppLogoShape.Rounded,
                contentDescription = null
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Título
            Text(
                text = stringResource(R.string.welcome_title),
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            // Subtítulo
            Text(
                text = stringResource(R.string.welcome_subtitle),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_massive))

            // Features
            WelcomeFeatureItem(
                emoji = "\u26BD",
                text = stringResource(R.string.welcome_feature_games)
            )
            WelcomeFeatureItem(
                emoji = "\uD83C\uDFC6",
                text = stringResource(R.string.welcome_feature_ranking)
            )
            WelcomeFeatureItem(
                emoji = "\uD83D\uDCCA",
                text = stringResource(R.string.welcome_feature_stats)
            )
            WelcomeFeatureItem(
                emoji = "\uD83E\uDD1D",
                text = stringResource(R.string.welcome_feature_balance)
            )

            Spacer(modifier = Modifier.weight(1f))

            // Botão Começar
            Button(
                onClick = onContinue,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(AppDimensions.height_input),
                shape = RoundedCornerShape(AppDimensions.radius_large)
            ) {
                Text(
                    text = stringResource(R.string.welcome_get_started),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))
        }
    }
}

@Composable
private fun WelcomeFeatureItem(
    emoji: String,
    text: String
) {
    Text(
        text = "$emoji  $text",
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = AppDimensions.spacing_small, horizontal = AppDimensions.spacing_medium)
    )
}
