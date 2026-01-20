package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.home.GamificationSummary
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.util.LevelBadgeHelper
import androidx.compose.ui.res.painterResource
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.adaptive.AdaptiveSpacing
import com.futebadosparcas.ui.adaptive.rememberAdaptiveSpacing
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R

@Composable
fun ExpressiveHubHeader(
    user: com.futebadosparcas.domain.model.User,
    summary: GamificationSummary,
    statistics: com.futebadosparcas.data.model.UserStatistics? = null,
    onProfileClick: () -> Unit,
    hapticManager: HapticManager? = null,
    onLevelClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    // VERSÃO ESTÁTICA para scroll suave - SEM animação
    val animatedProgress = summary.progressPercent / 100f

    // Tamanhos adaptativos
    val photoSize = if (windowSizeClass.isCompact) 64.dp else 80.dp
    val badgeSize = if (windowSizeClass.isCompact) 28.dp else 36.dp
    val surfacePadding = if (windowSizeClass.isCompact) spacing.md else spacing.lg

    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.extraLarge,
        modifier = modifier
            .fillMaxWidth()
            .padding(spacing.contentPaddingHorizontal),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier = Modifier
                .padding(surfacePadding)
        ) {
            // Layout adaptativo: coluna única em compact, duas colunas em medium+
            if (windowSizeClass.isCompact) {
                // Layout compacto (portrait)
                CompactHeaderLayout(
                    user = user,
                    summary = summary,
                    statistics = statistics,
                    animatedProgress = animatedProgress,
                    photoSize = photoSize,
                    badgeSize = badgeSize,
                    onProfileClick = onProfileClick,
                    onLevelClick = onLevelClick,
                    hapticManager = hapticManager
                )
            } else {
                // Layout expandido (landscape/tablet)
                ExpandedHeaderLayout(
                    user = user,
                    summary = summary,
                    statistics = statistics,
                    animatedProgress = animatedProgress,
                    photoSize = photoSize,
                    badgeSize = badgeSize,
                    spacing = spacing,
                    onProfileClick = onProfileClick,
                    onLevelClick = onLevelClick,
                    hapticManager = hapticManager
                )
            }
        }
    }
}

@Composable
private fun CompactHeaderLayout(
    user: com.futebadosparcas.domain.model.User,
    summary: GamificationSummary,
    statistics: com.futebadosparcas.data.model.UserStatistics?,
    animatedProgress: Float,
    photoSize: Dp,
    badgeSize: Dp,
    onProfileClick: () -> Unit,
    onLevelClick: () -> Unit,
    hapticManager: HapticManager?
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        // Foto do Usuário com Brasão
        Box(
            modifier = Modifier.clickable {
                hapticManager?.tick()
                onProfileClick()
            }
        ) {
            CachedProfileImage(
                photoUrl = user.photoUrl,
                userName = user.name,
                size = photoSize
            )

            // Brasão de Nível
            androidx.compose.foundation.Image(
                painter = painterResource(id = LevelBadgeHelper.getBadgeForLevel(summary.level)),
                contentDescription = LevelBadgeHelper.getBadgeDescription(summary.level, summary.levelName),
                modifier = Modifier
                    .size(badgeSize)
                    .align(Alignment.BottomEnd)
                    .offset(x = 4.dp, y = 4.dp)
            )
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.hub_welcome_back),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = user.getDisplayName(),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        // Badge de Nível (Expressivo) - Clicável para Rumo ao Estrelato
        Surface(
            color = MaterialTheme.colorScheme.primaryContainer,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier
                .height(32.dp)
                .clickable {
                    hapticManager?.tick()
                    onLevelClick()
                }
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.padding(horizontal = 12.dp)
            ) {
                Text(
                    text = stringResource(R.string.hub_level_short, summary.level),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }

    Spacer(modifier = Modifier.height(20.dp))

    // Barra de XP
    XpProgressSection(summary = summary, animatedProgress = animatedProgress)

    if (statistics != null) {
        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            HeaderStatItem(stringResource(R.string.hub_stat_games), statistics.totalGames.toString())
            HeaderStatItem(stringResource(R.string.hub_stat_goals), statistics.totalGoals.toString())
            HeaderStatItem(stringResource(R.string.hub_stat_assists), statistics.totalAssists.toString())
            HeaderStatItem(stringResource(R.string.hub_stat_mvp), statistics.bestPlayerCount.toString())
        }
    }
}

@Composable
private fun ExpandedHeaderLayout(
    user: com.futebadosparcas.domain.model.User,
    summary: GamificationSummary,
    statistics: com.futebadosparcas.data.model.UserStatistics?,
    animatedProgress: Float,
    photoSize: Dp,
    badgeSize: Dp,
    spacing: com.futebadosparcas.ui.adaptive.AdaptiveSpacing,
    onProfileClick: () -> Unit,
    onLevelClick: () -> Unit,
    hapticManager: HapticManager?
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(spacing.lg)
    ) {
        // Coluna esquerda: Foto e info do usuário
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Box(
                modifier = Modifier.clickable {
                    hapticManager?.tick()
                    onProfileClick()
                }
            ) {
                CachedProfileImage(
                    photoUrl = user.photoUrl,
                    userName = user.name,
                    size = photoSize
                )

                androidx.compose.foundation.Image(
                    painter = painterResource(id = LevelBadgeHelper.getBadgeForLevel(summary.level)),
                    contentDescription = LevelBadgeHelper.getBadgeDescription(summary.level, summary.levelName),
                    modifier = Modifier
                        .size(badgeSize)
                        .align(Alignment.BottomEnd)
                        .offset(x = 4.dp, y = 4.dp)
                )
            }

            Spacer(modifier = Modifier.width(spacing.md))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.hub_welcome_back),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = user.getDisplayName(),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(spacing.xs))

                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier
                        .height(36.dp)
                        .clickable {
                            hapticManager?.tick()
                            onLevelClick()
                        }
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.hub_level_full, summary.level, summary.levelName),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }
        }

        // Coluna direita: Estatísticas (se disponível)
        if (statistics != null) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                HeaderStatItem(stringResource(R.string.hub_stat_games), statistics.totalGames.toString())
                HeaderStatItem(stringResource(R.string.hub_stat_goals), statistics.totalGoals.toString())
                HeaderStatItem(stringResource(R.string.hub_stat_assists), statistics.totalAssists.toString())
                HeaderStatItem(stringResource(R.string.hub_stat_mvp), statistics.bestPlayerCount.toString())
            }
        }
    }

    Spacer(modifier = Modifier.height(spacing.md))

    // Barra de XP (full width)
    XpProgressSection(summary = summary, animatedProgress = animatedProgress)
}

@Composable
private fun XpProgressSection(
    summary: GamificationSummary,
    animatedProgress: Float
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = summary.levelName.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "${summary.progressPercent}%",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Barra de Progresso Customizada (Gradiente)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(12.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surface)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animatedProgress)
                    .fillMaxHeight()
                    .clip(CircleShape)
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                GamificationColors.XpGreen,
                                GamificationColors.XpLightGreen
                            )
                        )
                    )
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = if (summary.isMaxLevel) stringResource(R.string.hub_max_level_reached)
                   else stringResource(R.string.hub_xp_remaining, summary.nextLevelXp, summary.nextLevelName),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline
        )
    }
}

@Composable
private fun HeaderStatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
