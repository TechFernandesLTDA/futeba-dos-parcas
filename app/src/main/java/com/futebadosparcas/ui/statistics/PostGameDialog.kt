package com.futebadosparcas.ui.statistics

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.futebadosparcas.ui.theme.FutebaColors

/**
 * Dialog exibido apos finalizacao de um jogo mostrando XP ganho.
 */
@Composable
fun PostGameDialog(
    summary: PostGameSummary,
    onDismiss: () -> Unit
) {
    val animatedXp by animateIntAsState(
        targetValue = summary.xpEarned,
        animationSpec = tween(durationMillis = 1500, easing = FastOutSlowInEasing),
        label = "xp"
    )

    val animatedProgress by animateFloatAsState(
        targetValue = summary.progressToNextLevel,
        animationSpec = tween(durationMillis = 1000, delayMillis = 500),
        label = "progress"
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color(FutebaColors.Surface)
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "VOCÊ EVOLUIU!",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(FutebaColors.Primary),
                        letterSpacing = 1.sp
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Fechar",
                            tint = Color(FutebaColors.TextSecondary)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Resultado
                GameResultBadge(result = summary.gameResult)

                Spacer(modifier = Modifier.height(24.dp))

                // XP ganho
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(Color(FutebaColors.Primary)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "+$animatedXp",
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "XP",
                            fontSize = 14.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Breakdown de XP
                XpBreakdownSection(breakdown = summary.xpBreakdown)

                Spacer(modifier = Modifier.height(20.dp))

                // Progresso de nivel
                LevelProgressSection(
                    previousLevel = summary.previousLevel,
                    newLevel = summary.newLevel,
                    leveledUp = summary.leveledUp,
                    newLevelName = summary.newLevelName,
                    progress = animatedProgress
                )

                // Milestones desbloqueados
                if (summary.milestonesUnlocked.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(20.dp))
                    MilestonesUnlockedSection(milestones = summary.milestonesUnlocked)
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Botao fechar
                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(FutebaColors.Primary)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "RUMO AO PRÓXIMO NÍVEL",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 4.dp),
                        letterSpacing = 1.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun GameResultBadge(result: String) {
    val (backgroundColor, text) = when (result.uppercase()) {
        "WIN" -> Color(FutebaColors.Success) to "VITÓRIA ÉPICA!"
        "LOSS" -> Color(FutebaColors.Error) to "NÃO DESISTA!"
        else -> Color(FutebaColors.Warning) to "MÁXIMO ESFORÇO!"
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(backgroundColor)
            .padding(horizontal = 24.dp, vertical = 8.dp)
    ) {
        Text(
            text = text,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

@Composable
private fun XpBreakdownSection(breakdown: Map<String, Int>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(FutebaColors.SurfaceVariant)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "SUA JORNADA NA PARTIDA",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color(FutebaColors.TextSecondary),
                modifier = Modifier.padding(bottom = 8.dp),
                letterSpacing = 0.5.sp
            )

            breakdown.forEach { (label, xp) ->
                if (xp > 0) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = label,
                            fontSize = 14.sp,
                            color = Color(FutebaColors.TextPrimary)
                        )
                        Text(
                            text = "+$xp XP",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(FutebaColors.Tertiary)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LevelProgressSection(
    previousLevel: Int,
    newLevel: Int,
    leveledUp: Boolean,
    newLevelName: String,
    progress: Float
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (leveledUp) {
            // Animacao de level up
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "SUBIU DE NIVEL!",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.Tertiary)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Nivel $previousLevel",
                    fontSize = 14.sp,
                    color = Color(FutebaColors.TextSecondary)
                )
                Text(
                    text = " → ",
                    fontSize = 14.sp,
                    color = Color(FutebaColors.TextSecondary)
                )
                Text(
                    text = "Nivel $newLevel - $newLevelName",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.Primary)
                )
            }
        } else {
            Text(
                text = "Nivel $newLevel",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color(FutebaColors.TextPrimary)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Barra de progresso
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = Color(FutebaColors.Primary),
            trackColor = Color(FutebaColors.SurfaceVariant)
        )

        Text(
            text = "${(progress * 100).toInt()}% para o proximo nivel",
            fontSize = 12.sp,
            color = Color(FutebaColors.TextSecondary),
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun MilestonesUnlockedSection(
    milestones: List<com.futebadosparcas.data.model.MilestoneType>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(FutebaColors.Tertiary).copy(alpha = 0.1f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    tint = Color(FutebaColors.Tertiary),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Conquistas Desbloqueadas!",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.Tertiary)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            milestones.forEach { milestone ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Filled.Star,
                        contentDescription = null,
                        tint = Color(FutebaColors.Gold),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = milestone.displayName,
                        fontSize = 14.sp,
                        color = Color(FutebaColors.TextPrimary)
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = "+${milestone.xpReward} XP",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(FutebaColors.Tertiary)
                    )
                }
            }
        }
    }
}
