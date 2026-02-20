package com.futebadosparcas.ui.statistics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Card de evolucao do jogador mostrando nivel e XP.
 */
@Composable
fun PlayerEvolutionCard(
    currentLevel: Int,
    levelName: String,
    currentXp: Long,
    xpProgress: Long,
    xpNeeded: Long,
    progressPercentage: Float,
    modifier: Modifier = Modifier,
    onPrimaryColor: Color = MaterialTheme.colorScheme.onPrimary
) {
    // Valor estático pré-calculado para otimização de scroll
    val staticProgress = progressPercentage

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primary
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Level Badge
            Box(
                modifier = Modifier
                    .size(100.dp),
                contentAlignment = Alignment.Center
            ) {
                // Background circle
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawCircle(
                        color = onPrimaryColor.copy(alpha = 0.2f),
                        radius = size.minDimension / 2
                    )
                }

                // Progress arc
                Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
                    val sweepAngle = staticProgress * 360f
                    drawArc(
                        color = onPrimaryColor,
                        startAngle = -90f,
                        sweepAngle = sweepAngle,
                        useCenter = false,
                        style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round),
                        size = Size(size.width, size.height)
                    )
                }

                // Level number
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$currentLevel",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        color = onPrimaryColor
                    )
                    Text(
                        text = stringResource(R.string.player_evolution_level),
                        fontSize = 10.sp,
                        color = onPrimaryColor.copy(alpha = 0.8f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Level name
            Text(
                text = levelName,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = onPrimaryColor
            )

            Spacer(modifier = Modifier.height(16.dp))

            // XP progress bar
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "$xpProgress XP",
                        fontSize = 12.sp,
                        color = onPrimaryColor.copy(alpha = 0.8f)
                    )
                    Text(
                        text = "$xpNeeded XP",
                        fontSize = 12.sp,
                        color = onPrimaryColor.copy(alpha = 0.8f)
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                LinearProgressIndicator(
                    progress = { staticProgress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = onPrimaryColor,
                    trackColor = onPrimaryColor.copy(alpha = 0.3f)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = stringResource(R.string.player_evolution_xp_remaining, xpNeeded - xpProgress),
                    fontSize = 11.sp,
                    color = onPrimaryColor.copy(alpha = 0.7f),
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Total XP
            Text(
                text = stringResource(R.string.player_evolution_total, currentXp),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = onPrimaryColor
            )
        }
    }
}

/**
 * Card de liga/divisao do jogador.
 */
@Composable
fun PlayerLeagueCard(
    division: LeagueDivision,
    leagueRating: Double,
    promotionProgress: Int,
    relegationProgress: Int,
    protectionGames: Int,
    modifier: Modifier = Modifier
) {
    val divisionColor = when (division) {
        LeagueDivision.BRONZE -> GamificationColors.Bronze
        LeagueDivision.PRATA -> GamificationColors.SilverDark
        LeagueDivision.OURO -> GamificationColors.Gold
        LeagueDivision.DIAMANTE -> GamificationColors.DiamondDark
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Division badge
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(divisionColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = getDivisionIcon(division),
                        fontSize = 24.sp,
                        color = com.futebadosparcas.util.ContrastHelper.getContrastingTextColor(divisionColor)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.player_evolution_league, division.displayName),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = stringResource(R.string.player_evolution_rating, leagueRating.toFloat()),
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

            }
            // Status indicator from fields
            val hasExplicitStatus = protectionGames > 0 || promotionProgress > 0 || relegationProgress > 0
            if (protectionGames > 0) {
                StatusBadge(
                    text = stringResource(R.string.evolution_protected),
                    color = MaterialTheme.colorScheme.primary
                )
            } else if (promotionProgress > 0) {
                StatusBadge(
                    text = stringResource(R.string.evolution_promoting, promotionProgress),
                    color = MaterialTheme.colorScheme.primary
                )
            } else if (relegationProgress > 0) {
                StatusBadge(
                    text = stringResource(R.string.evolution_relegating, relegationProgress),
                    color = MaterialTheme.colorScheme.error
                )
            }
            // Computed Status Badge
            val status = if (!hasExplicitStatus) {
                getComputedStatus(
                    division,
                    leagueRating,
                    MaterialTheme.colorScheme.onSurfaceVariant,
                    MaterialTheme.colorScheme.primary,
                    MaterialTheme.colorScheme.error
                )
            } else null
            if (status != null) {
                StatusBadge(
                    text = status.first,
                    color = status.second
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Rating bar
            LeagueRatingBar(
                rating = leagueRating,
                division = division
            )
        }
    }
}

@Composable
private fun LeagueRatingBar(
    rating: Double,
    division: LeagueDivision
) {
    val thresholds = listOf(0, 30, 50, 70, 100)
    val colors = listOf(
        GamificationColors.Bronze,
        GamificationColors.Silver,
        GamificationColors.Gold,
        GamificationColors.DiamondDark
    )

    Column {
        // Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
        ) {
            colors.forEachIndexed { index, color ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(
                            if (rating >= thresholds[index]) color
                            else color.copy(alpha = 0.3f)
                        )
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Labels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            thresholds.dropLast(1).forEach { threshold ->
                Text(
                    text = "$threshold",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = "100",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun StatusBadge(
    text: String,
    color: Color
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = color
        )
    }
}

/**
 * Card de milestone/objetivo proximo.
 */
@Composable
fun MilestoneProgressCard(
    milestoneName: String,
    description: String,
    current: Int,
    target: Int,
    xpReward: Long,
    modifier: Modifier = Modifier
) {
    val progress = if (target > 0) current.toFloat() / target else 0f

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Progress circle
            Box(
                modifier = Modifier.size(48.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                    strokeWidth = 4.dp
                )
                Text(
                    text = "${(progress * 100).toInt()}%",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = milestoneName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "$current / $target - $description",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // XP reward
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "+$xpReward",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.tertiary
                )
                Text(
                    text = stringResource(R.string.player_evolution_xp, xpReward),
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private fun getDivisionIcon(division: LeagueDivision): String {
    return when (division) {
        LeagueDivision.BRONZE -> "B"
        LeagueDivision.PRATA -> "P"
        LeagueDivision.OURO -> "O"
        LeagueDivision.DIAMANTE -> "D"
    }
}

@Composable
private fun getComputedStatus(
    division: LeagueDivision,
    leagueRating: Double,
    neutralColor: Color,
    successColor: Color,
    errorColor: Color
): Pair<String, Color>? {
    if (leagueRating.isNaN()) return null
    return when {
        leagueRating >= 90.0 -> "Elite" to successColor
        leagueRating >= 70.0 -> "Boa fase" to successColor
        leagueRating >= 50.0 -> "Estavel" to neutralColor
        else -> "Em risco" to errorColor
    }
}
