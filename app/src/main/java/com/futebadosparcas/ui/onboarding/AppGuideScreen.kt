package com.futebadosparcas.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Sports
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.theme.AppDimensions
/**
 * Tela de guia do aplicativo.
 * Apresenta as principais funcionalidades e como usar.
 */
@Composable
fun AppGuideScreen(
    onComplete: () -> Unit
) {
    val scrollState = rememberScrollState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(AppDimensions.spacing_extraLarge),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Título
            Text(
                text = stringResource(R.string.app_guide_title),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Text(
                text = stringResource(R.string.app_guide_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Cards de funcionalidades
            GuideFeatureCard(
                icon = Icons.Default.Home,
                title = stringResource(R.string.app_guide_home_title),
                description = stringResource(R.string.app_guide_home_desc)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            GuideFeatureCard(
                icon = Icons.Default.Sports,
                title = stringResource(R.string.app_guide_games_title),
                description = stringResource(R.string.app_guide_games_desc)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            GuideFeatureCard(
                icon = Icons.Default.People,
                title = stringResource(R.string.app_guide_players_title),
                description = stringResource(R.string.app_guide_players_desc)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            GuideFeatureCard(
                icon = Icons.Default.EmojiEvents,
                title = stringResource(R.string.app_guide_league_title),
                description = stringResource(R.string.app_guide_league_desc)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            GuideFeatureCard(
                icon = Icons.Default.Groups,
                title = stringResource(R.string.app_guide_groups_title),
                description = stringResource(R.string.app_guide_groups_desc)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Dica final
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                shape = RoundedCornerShape(AppDimensions.radius_large)
            ) {
                Column(
                    modifier = Modifier.padding(AppDimensions.spacing_medium),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "\uD83D\uDCA1",
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Spacer(modifier = Modifier.height(AppDimensions.spacing_small))
                    Text(
                        text = stringResource(R.string.app_guide_tip),
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Botão Começar a usar
            Button(
                onClick = onComplete,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(AppDimensions.height_input),
                shape = RoundedCornerShape(AppDimensions.radius_large)
            ) {
                Text(
                    text = stringResource(R.string.app_guide_start),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))
        }
    }
}

@Composable
private fun GuideFeatureCard(
    icon: ImageVector,
    title: String,
    description: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(AppDimensions.radius_large)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppDimensions.spacing_medium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(AppDimensions.icon_extraLarge)
                    .background(
                        color = MaterialTheme.colorScheme.primary,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(AppDimensions.icon_medium)
                )
            }

            Spacer(modifier = Modifier.width(AppDimensions.spacing_medium))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
