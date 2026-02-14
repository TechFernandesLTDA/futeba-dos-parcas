package com.futebadosparcas.ui.games.teamformation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.TeamColor
import com.futebadosparcas.data.model.TeamStrength
import com.futebadosparcas.util.ContrastHelper
import kotlin.math.abs

/**
 * Componente que exibe a forca calculada de um time.
 * Mostra o overall rating e indicadores de posicao.
 */
@Composable
fun TeamStrengthBadge(
    strength: TeamStrength?,
    teamColor: TeamColor,
    modifier: Modifier = Modifier
) {
    if (strength == null) return

    val colorValue = Color(teamColor.hexValue)

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Overall rating principal
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .background(colorValue, CircleShape)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.team_strength, strength.overallRating),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(8.dp))

            // Barra de forca
            StrengthBar(
                value = strength.overallRating,
                maxValue = 5f,
                color = colorValue
            )

            Spacer(Modifier.height(8.dp))

            // Indicadores de posicao
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                PositionStat(
                    label = "ATK",
                    value = strength.attackRating,
                    icon = Icons.Default.SportsSoccer
                )
                PositionStat(
                    label = "MID",
                    value = strength.midfieldRating,
                    icon = Icons.Default.SwapHoriz
                )
                PositionStat(
                    label = "DEF",
                    value = strength.defenseRating,
                    icon = Icons.Default.Shield
                )
            }

            // Indicador de goleiro
            Spacer(Modifier.height(8.dp))
            GoalkeeperIndicator(hasGoalkeeper = strength.hasGoalkeeper)
        }
    }
}

/**
 * Barra horizontal mostrando nivel de forca.
 */
@Composable
private fun StrengthBar(
    value: Float,
    maxValue: Float,
    color: Color,
    modifier: Modifier = Modifier
) {
    val animatedProgress by animateFloatAsState(
        targetValue = (value / maxValue).coerceIn(0f, 1f),
        animationSpec = tween(durationMillis = 500, easing = FastOutSlowInEasing),
        label = "strengthProgress"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(8.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(animatedProgress)
                .background(color, RoundedCornerShape(4.dp))
        )
    }
}

/**
 * Estatistica de posicao individual.
 */
@Composable
private fun PositionStat(
    label: String,
    value: Float,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = "%.1f".format(value),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Indicador de presenca de goleiro.
 */
@Composable
private fun GoalkeeperIndicator(hasGoalkeeper: Boolean) {
    val color by animateColorAsState(
        targetValue = if (hasGoalkeeper) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.error
        },
        label = "gkColor"
    )

    Row(
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (hasGoalkeeper) Icons.Default.CheckCircle else Icons.Default.Warning,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = color
        )
        Spacer(Modifier.width(4.dp))
        Text(
            text = if (hasGoalkeeper) {
                stringResource(R.string.has_goalkeeper)
            } else {
                stringResource(R.string.no_goalkeeper)
            },
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

/**
 * Componente de comparacao entre dois times.
 * Mostra barra de equilibrio e status.
 */
@Composable
fun TeamComparisonBar(
    teamAStrength: TeamStrength,
    teamBStrength: TeamStrength,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    val totalStrength = teamAStrength.overallRating + teamBStrength.overallRating
    val teamAPercent = if (totalStrength > 0) {
        teamAStrength.overallRating / totalStrength
    } else 0.5f

    val diffPercent = teamAStrength.getDifferencePercent(teamBStrength)
    val isBalanced = diffPercent < 5f
    val isSlightlyUnbalanced = diffPercent in 5f..15f

    val statusColor = when {
        isBalanced -> MaterialTheme.colorScheme.primary
        isSlightlyUnbalanced -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.error
    }

    val statusIcon = when {
        isBalanced -> Icons.Default.CheckCircle
        isSlightlyUnbalanced -> Icons.Default.Warning
        else -> Icons.Default.Error
    }

    val statusText = when {
        isBalanced -> stringResource(R.string.teams_balanced)
        else -> stringResource(R.string.teams_unbalanced, diffPercent)
    }

    Column(
        modifier = modifier.fillMaxWidth()
    ) {
        // Valores dos times
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TeamRatingChip(
                rating = teamAStrength.overallRating,
                color = Color(teamAColor.hexValue)
            )

            Text(
                text = "VS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            TeamRatingChip(
                rating = teamBStrength.overallRating,
                color = Color(teamBColor.hexValue)
            )
        }

        Spacer(Modifier.height(8.dp))

        // Barra de comparacao
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(16.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                // Time A
                Box(
                    modifier = Modifier
                        .weight(teamAPercent.coerceAtLeast(0.1f))
                        .fillMaxHeight()
                        .background(Color(teamAColor.hexValue))
                )
                // Time B
                Box(
                    modifier = Modifier
                        .weight((1f - teamAPercent).coerceAtLeast(0.1f))
                        .fillMaxHeight()
                        .background(Color(teamBColor.hexValue))
                )
            }

            // Indicador central de equilibrio
            if (abs(teamAPercent - 0.5f) < 0.05f) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(24.dp)
                        .background(MaterialTheme.colorScheme.surface, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Balance,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Status de equilibrio
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = statusIcon,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = statusColor
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = statusText,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium,
                color = statusColor
            )
        }
    }
}

@Composable
private fun TeamRatingChip(
    rating: Float,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .background(color, CircleShape)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "%.1f".format(rating),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * Card completo de comparacao de times.
 */
@Composable
fun TeamComparisonCard(
    teamAStrength: TeamStrength,
    teamBStrength: TeamStrength,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.team_comparison),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(16.dp))

            TeamComparisonBar(
                teamAStrength = teamAStrength,
                teamBStrength = teamBStrength,
                teamAColor = teamAColor,
                teamBColor = teamBColor
            )

            Spacer(Modifier.height(16.dp))

            HorizontalDivider()

            Spacer(Modifier.height(16.dp))

            // Comparacao detalhada por posicao
            DetailedPositionComparison(
                teamAStrength = teamAStrength,
                teamBStrength = teamBStrength,
                teamAColor = teamAColor,
                teamBColor = teamBColor
            )
        }
    }
}

/**
 * Comparacao detalhada por posicao.
 */
@Composable
private fun DetailedPositionComparison(
    teamAStrength: TeamStrength,
    teamBStrength: TeamStrength,
    teamAColor: TeamColor,
    teamBColor: TeamColor
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PositionComparisonRow(
            label = "Ataque",
            teamAValue = teamAStrength.attackRating,
            teamBValue = teamBStrength.attackRating,
            teamAColor = Color(teamAColor.hexValue),
            teamBColor = Color(teamBColor.hexValue)
        )
        PositionComparisonRow(
            label = "Meio-campo",
            teamAValue = teamAStrength.midfieldRating,
            teamBValue = teamBStrength.midfieldRating,
            teamAColor = Color(teamAColor.hexValue),
            teamBColor = Color(teamBColor.hexValue)
        )
        PositionComparisonRow(
            label = "Defesa",
            teamAValue = teamAStrength.defenseRating,
            teamBValue = teamBStrength.defenseRating,
            teamAColor = Color(teamAColor.hexValue),
            teamBColor = Color(teamBColor.hexValue)
        )
        if (teamAStrength.hasGoalkeeper || teamBStrength.hasGoalkeeper) {
            PositionComparisonRow(
                label = "Goleiro",
                teamAValue = teamAStrength.goalkeeperRating,
                teamBValue = teamBStrength.goalkeeperRating,
                teamAColor = Color(teamAColor.hexValue),
                teamBColor = Color(teamBColor.hexValue)
            )
        }
    }
}

@Composable
private fun PositionComparisonRow(
    label: String,
    teamAValue: Float,
    teamBValue: Float,
    teamAColor: Color,
    teamBColor: Color
) {
    val total = teamAValue + teamBValue
    val teamAPercent = if (total > 0) teamAValue / total else 0.5f

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "%.1f".format(teamAValue),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.width(32.dp)
        )

        Spacer(Modifier.width(8.dp))

        Box(
            modifier = Modifier
                .weight(1f)
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .weight(teamAPercent.coerceAtLeast(0.1f))
                        .fillMaxHeight()
                        .background(teamAColor)
                )
                Box(
                    modifier = Modifier
                        .weight((1f - teamAPercent).coerceAtLeast(0.1f))
                        .fillMaxHeight()
                        .background(teamBColor)
                )
            }
        }

        Spacer(Modifier.width(8.dp))

        Text(
            text = "%.1f".format(teamBValue),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.width(32.dp)
        )
    }

    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 40.dp)
    )
}

/**
 * Distribuicao de posicoes no time.
 */
@Composable
fun PositionDistributionCard(
    positionDistribution: Map<String, Pair<Int, Int>>,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.team_strength_position_distribution),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                positionDistribution.forEach { (position, counts) ->
                    PositionCountColumn(
                        position = position,
                        teamACount = counts.first,
                        teamBCount = counts.second,
                        teamAColor = Color(teamAColor.hexValue),
                        teamBColor = Color(teamBColor.hexValue)
                    )
                }
            }
        }
    }
}

@Composable
private fun PositionCountColumn(
    position: String,
    teamACount: Int,
    teamBCount: Int,
    teamAColor: Color,
    teamBColor: Color
) {
    val displayName = when (position) {
        "GOALKEEPER" -> "GK"
        "LINE", "FIELD" -> "LINHA"
        else -> position.take(3)
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = displayName,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(4.dp))

        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = teamAColor.copy(alpha = 0.2f)
            ) {
                Text(
                    text = teamACount.toString(),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = teamAColor
                )
            }

            Surface(
                shape = CircleShape,
                color = teamBColor.copy(alpha = 0.2f)
            ) {
                Text(
                    text = teamBCount.toString(),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = teamBColor
                )
            }
        }
    }
}
