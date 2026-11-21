package com.futebadosparcas.ui.core

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import com.futebadosparcas.domain.artes.ArteId
import com.futebadosparcas.domain.artes.PictogramaId
import com.futebadosparcas.ui.artes.ArteDaPelada
import com.futebadosparcas.ui.artes.rememberPictograma
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.welcome_onboarding_action_start
import com.futebadosparcas.compose.resources.welcome_onboarding_app_name
import com.futebadosparcas.compose.resources.welcome_onboarding_feature_groups
import com.futebadosparcas.compose.resources.welcome_onboarding_feature_identity
import com.futebadosparcas.compose.resources.welcome_onboarding_feature_matches
import com.futebadosparcas.compose.resources.welcome_onboarding_feature_stats
import com.futebadosparcas.compose.resources.welcome_onboarding_subtitle
import org.jetbrains.compose.resources.stringResource

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
        // Centraliza quando cabe e rola quando não cabe: com Dynamic Type grande (ou em
        // telas baixas) o botão "Começar" ficava cortado fora da área visível (#4401).
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
        ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .heightIn(min = maxHeight)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically)
        ) {
            // Arte do campo (spec ARTES_DA_PELADA): o campo da pelada abre o app
            ArteDaPelada(
                id = ArteId.CAMPO,
                modifier = Modifier
                    .widthIn(max = 340.dp)
                    .fillMaxWidth()
                    .heightIn(max = 180.dp)
            )

            Text(
                text = stringResource(Res.string.welcome_onboarding_app_name),
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                text = stringResource(Res.string.welcome_onboarding_subtitle),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            ElevatedCard {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    WelcomeFeatureItem(
                        pictograma = PictogramaId.BOLA,
                        text = stringResource(Res.string.welcome_onboarding_feature_matches)
                    )
                    WelcomeFeatureItem(
                        pictograma = PictogramaId.COLETE,
                        text = stringResource(Res.string.welcome_onboarding_feature_groups)
                    )
                    WelcomeFeatureItem(
                        pictograma = PictogramaId.PLACAR,
                        text = stringResource(Res.string.welcome_onboarding_feature_stats)
                    )
                    WelcomeFeatureItem(
                        pictograma = PictogramaId.CHUTEIRA,
                        text = stringResource(Res.string.welcome_onboarding_feature_identity)
                    )
                }
            }
            Button(
                onClick = onContinue,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text(
                    text = stringResource(Res.string.welcome_onboarding_action_start),
                    style = MaterialTheme.typography.titleMedium
                )
            }
        }
        }
    }
}

@Composable
private fun WelcomeFeatureItem(
    pictograma: PictogramaId,
    text: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp, horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = rememberPictograma(pictograma),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(22.dp)
            )
        }
        Text(
            text = text,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
