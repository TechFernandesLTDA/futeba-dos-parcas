package com.futebadosparcas.ui.statistics

import androidx.compose.animation.core.*
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
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.ui.theme.FutebaColors

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
    modifier: Modifier = Modifier
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progressPercentage,
        animationSpec = tween(durationMillis = 1000, easing = FastOutSlowInEasing),
        label = "progress"
    )

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(FutebaColors.Primary)
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
                        color = Color.White.copy(alpha = 0.2f),
                        radius = size.minDimension / 2
                    )
                }

                // Progress arc
                Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
                    val sweepAngle = animatedProgress * 360f
                    drawArc(
                        color = Color.White,
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
                        color = Color.White
                    )
                    Text(
                        text = "NIVEL",
                        fontSize = 10.sp,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Level name
            Text(
                text = levelName,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
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
                        color = Color.White.copy(alpha = 0.8f)
                    )
                    Text(
                        text = "$xpNeeded XP",
                        fontSize = 12.sp,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                LinearProgressIndicator(
                    progress = { animatedProgress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = Color.White,
                    trackColor = Color.White.copy(alpha = 0.3f)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Faltam ${xpNeeded - xpProgress} XP para o proximo nivel",
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Total XP
            Text(
                text = "Total: $currentXp XP",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White
            )
        }
    }
}

/**
 * Card de liga/divisao do jogador.
 */
@Composable
fun LeagueDivisionCard(
    division: LeagueDivision,
    leagueRating: Double,
    promotionProgress: Int,
    relegationProgress: Int,
    protectionGames: Int,
    modifier: Modifier = Modifier
) {
    val divisionColor = when (division) {
        LeagueDivision.BRONZE -> Color(FutebaColors.Bronze)
        LeagueDivision.PRATA -> Color(FutebaColors.Silver)
        LeagueDivision.OURO -> Color(FutebaColors.Gold)
        LeagueDivision.DIAMANTE -> Color(FutebaColors.Secondary)
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(FutebaColors.Surface)
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
                        fontSize = 24.sp
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Liga ${division.displayName}",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(FutebaColors.TextPrimary)
                    )
                    Text(
                        text = "Rating: ${"%.1f".format(leagueRating)}",
                        fontSize = 14.sp,
                        color = Color(FutebaColors.TextSecondary)
                    )
                }

                // Status indicator
                if (protectionGames > 0) {
                    StatusBadge(
                        text = "Protegido",
                        color = Color(FutebaColors.Success)
                    )
                } else if (promotionProgress > 0) {
                    StatusBadge(
                        text = "Subindo ($promotionProgress/3)",
                        color = Color(FutebaColors.Primary)
                    )
                } else if (relegationProgress > 0) {
                    StatusBadge(
                        text = "Risco ($relegationProgress/3)",
                        color = Color(FutebaColors.Warning)
                    )
                }
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
        Color(FutebaColors.Bronze),
        Color(FutebaColors.Silver),
        Color(FutebaColors.Gold),
        Color(FutebaColors.Secondary)
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
                    color = Color(FutebaColors.TextSecondary)
                )
            }
            Text(
                text = "100",
                fontSize = 10.sp,
                color = Color(FutebaColors.TextSecondary)
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
            containerColor = Color(FutebaColors.Surface)
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
                    color = Color(FutebaColors.Primary),
                    trackColor = Color(FutebaColors.SurfaceVariant),
                    strokeWidth = 4.dp
                )
                Text(
                    text = "${(progress * 100).toInt()}%",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.Primary)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = milestoneName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(FutebaColors.TextPrimary)
                )
                Text(
                    text = "$current / $target - $description",
                    fontSize = 12.sp,
                    color = Color(FutebaColors.TextSecondary)
                )
            }

            // XP reward
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "+$xpReward",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.Tertiary)
                )
                Text(
                    text = "XP",
                    fontSize = 10.sp,
                    color = Color(FutebaColors.TextSecondary)
                )
            }
        }
    }
}

private fun getDivisionIcon(division: LeagueDivision): String {
    return when (division) {
        LeagueDivision.BRONZE -> "🥉"
        LeagueDivision.PRATA -> "🥈"
        LeagueDivision.OURO -> "🥇"
        LeagueDivision.DIAMANTE -> "💎"
    }
}
