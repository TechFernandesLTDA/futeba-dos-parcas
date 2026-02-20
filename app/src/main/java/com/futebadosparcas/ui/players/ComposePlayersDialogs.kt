package com.futebadosparcas.ui.players

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.LevelTable
import com.futebadosparcas.domain.model.PlayerRatingRole
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.LevelBadgeHelper
import com.futebadosparcas.util.LevelHelper
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Dialog de Comparação de Jogadores
 */
@Composable
fun ComparePlayersUiDialog(
    user1: User,
    stats1: UserStatistics?,
    user2: User,
    stats2: UserStatistics?,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header com Avatares
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Jogador 1
                    PlayerHeader(user = user1, color = MaterialTheme.colorScheme.primary)
                    
                    Text(
                        text = stringResource(R.string.players_vs),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    // Jogador 2
                    PlayerHeader(user = user2, color = MaterialTheme.colorScheme.secondary)
                }
                
                HorizontalDivider()
                
                // Gráfico Radar Customizado
                Box(
                    modifier = Modifier
                        .size(300.dp)
                        .padding(8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    RadarChart(
                        user1 = user1,
                        user2 = user2,
                        color1 = MaterialTheme.colorScheme.primary,
                        color2 = MaterialTheme.colorScheme.secondary
                    )
                }
                
                HorizontalDivider()
                
                // Tabela de Estatísticas
                StatsComparisonTable(
                    stats1 = stats1,
                    stats2 = stats2,
                    color1 = MaterialTheme.colorScheme.primary,
                    color2 = MaterialTheme.colorScheme.secondary
                )
                
                // Botão Fechar
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.players_close))
                }
            }
        }
    }
}

@Composable
private fun PlayerHeader(user: User, color: Color) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(100.dp)
    ) {
        Box(
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            CachedProfileImage(
                photoUrl = user.photoUrl,
                userName = user.getDisplayName(),
                size = 60.dp
            )
             if (user.photoUrl.isNullOrEmpty()) {
                 Text(
                     text = user.getDisplayName().take(1).uppercase(),
                     style = MaterialTheme.typography.titleLarge,
                     color = color,
                     fontWeight = FontWeight.Bold
                 )
             }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = user.getDisplayName(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            color = MaterialTheme.colorScheme.onSurface 
        )
    }
}

@Composable
private fun RadarChart(
    user1: User,
    user2: User,
    color1: Color,
    color2: Color
) {
    val labels = listOf("ATA", "MEI", "DEF", "GOL")

    // Ratings
    val ratings1 = listOf(
        user1.getEffectiveRating(PlayerRatingRole.STRIKER).toFloat(),
        user1.getEffectiveRating(PlayerRatingRole.MID).toFloat(),
        user1.getEffectiveRating(PlayerRatingRole.DEFENDER).toFloat(),
        user1.getEffectiveRating(PlayerRatingRole.GOALKEEPER).toFloat()
    )

    val ratings2 = listOf(
        user2.getEffectiveRating(PlayerRatingRole.STRIKER).toFloat(),
        user2.getEffectiveRating(PlayerRatingRole.MID).toFloat(),
        user2.getEffectiveRating(PlayerRatingRole.DEFENDER).toFloat(),
        user2.getEffectiveRating(PlayerRatingRole.GOALKEEPER).toFloat()
    )

    // Capture theme color outside Canvas scope
    val gridColor = MaterialTheme.colorScheme.outlineVariant

    Canvas(modifier = Modifier.fillMaxSize()) {
        val center = Offset(size.width / 2, size.height / 2)
        val radius = size.minDimension / 2 * 0.8f
        val angleStep = (2 * Math.PI / 4).toFloat()
        
        // Desenhar Teia
        for (i in 1..5) {
            val r = radius * (i / 5f)
            drawPath(
                path = Path().apply {
                    for (j in 0 until 4) {
                        val angle = j * angleStep - Math.PI.toFloat() / 2
                        val x = center.x + r * cos(angle)
                        val y = center.y + r * sin(angle)
                        if (j == 0) moveTo(x, y) else lineTo(x, y)
                    }
                    close()
                },
                color = gridColor,
                style = Stroke(width = 1.dp.toPx())
            )
        }

        // Desenhar Eixos
        for (j in 0 until 4) {
            val angle = j * angleStep - Math.PI.toFloat() / 2
            val x = center.x + radius * cos(angle)
            val y = center.y + radius * sin(angle)
            drawLine(
                color = gridColor,
                start = center,
                end = Offset(x, y),
                strokeWidth = 1.dp.toPx()
            )
        }
        
        // Desenhar Dados User 1
        drawDataset(center, radius, angleStep, ratings1, color1)
        
        // Desenhar Dados User 2
        drawDataset(center, radius, angleStep, ratings2, color2)
    }
    
    // Labels posicionados manualmente (Simplificação)
    Box(modifier = Modifier.fillMaxSize()) {
        Text(labels[0], modifier = Modifier.align(Alignment.TopCenter), style = MaterialTheme.typography.labelSmall)
        Text(labels[1], modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp), style = MaterialTheme.typography.labelSmall)
        Text(labels[2], modifier = Modifier.align(Alignment.BottomCenter), style = MaterialTheme.typography.labelSmall)
        Text(labels[3], modifier = Modifier.align(Alignment.CenterStart).padding(start = 8.dp), style = MaterialTheme.typography.labelSmall)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDataset(
    center: Offset,
    maxRadius: Float,
    angleStep: Float,
    ratings: List<Float>,
    color: Color
) {
    val path = Path()
    ratings.forEachIndexed { i, rating ->
        val r = maxRadius * (rating / 5f)
        val angle = i * angleStep - Math.PI.toFloat() / 2
        val x = center.x + r * cos(angle)
        val y = center.y + r * sin(angle)
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    path.close()
    
    drawPath(path = path, color = color.copy(alpha = 0.3f))
    drawPath(path = path, color = color, style = Stroke(width = 2.dp.toPx()))
}

@Composable
private fun StatsComparisonTable(
    stats1: UserStatistics?,
    stats2: UserStatistics?,
    color1: Color,
    color2: Color
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        StatRow(stringResource(R.string.players_goals), stats1?.totalGoals ?: 0, stats2?.totalGoals ?: 0, color1, color2)
        StatRow(stringResource(R.string.players_assists), stats1?.totalAssists ?: 0, stats2?.totalAssists ?: 0, color1, color2)
        StatRow(stringResource(R.string.players_games), stats1?.totalGames ?: 0, stats2?.totalGames ?: 0, color1, color2)
        StatRow(stringResource(R.string.players_mvps), stats1?.mvpCount ?: 0, stats2?.mvpCount ?: 0, color1, color2)
    }
}

@Composable
private fun StatRow(label: String, val1: Int, val2: Int, color1: Color, color2: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = val1.toString(),
            color = if (val1 > val2) color1 else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (val1 > val2) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
        
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
             color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
        
        Text(
            text = val2.toString(),
             color = if (val2 > val1) color2 else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (val2 > val1) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Conteúdo do Cartão de Jogador (para ser usado dentro de um Dialog ou Fragment)
 */
@Composable
fun PlayerCardContent(
    user: User,
    stats: UserStatistics?,
    onClose: () -> Unit,
    onShare: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header: Foto + Level Badge
            Box(
                contentAlignment = Alignment.BottomEnd,
                modifier = Modifier.size(100.dp)
            ) {
                // Foto
                CachedProfileImage(
                    photoUrl = user.photoUrl,
                    userName = user.getDisplayName(),
                    size = 100.dp
                )

                // Badge
                val badgeRes = LevelBadgeHelper.getBadgeForLevel(user.level)
                Image(
                    painter = painterResource(id = badgeRes),
                    contentDescription = stringResource(R.string.cd_level_badge),
                    modifier = Modifier
                        .size(36.dp)
                        .offset(x = 4.dp, y = 4.dp)
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Nome
            Text(
                text = user.getDisplayName(),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            // Level e Nome do Level
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Surface(
                    color = GamificationColors.Gold,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = user.level.toString(),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                
                Text(
                    text = LevelTable.getLevelName(user.level),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // XP Progress
            val nextLevelXP = LevelHelper.getXPForNextLevel(user.level)
            val currentXP = user.experiencePoints
            val progress = LevelHelper.getProgressPercentage(currentXP) / 100f
            
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = stringResource(R.string.players_xp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "$currentXP / $nextLevelXP",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = GamificationColors.Gold,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
            }
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
            
            // Stats Grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(label = stringResource(R.string.players_games), value = stats?.totalGames?.toString() ?: "0")
                StatItem(label = stringResource(R.string.players_goals), value = stats?.totalGoals?.toString() ?: "0")
                StatItem(label = stringResource(R.string.players_assists), value = stats?.totalAssists?.toString() ?: "0")
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(label = stringResource(R.string.players_wins), value = stats?.totalWins?.toString() ?: "0")
                StatItem(label = stringResource(R.string.players_mvps), value = stats?.mvpCount?.toString() ?: "0")
                StatItem(label = stringResource(R.string.players_saves), value = stats?.totalSaves?.toString() ?: "0")
            }
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
            
            // Skills (Ratings)
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SkillBar(
                    label = stringResource(R.string.players_attack),
                    rating = user.getEffectiveRating(PlayerRatingRole.STRIKER),
                    color = MaterialTheme.colorScheme.tertiary
                )
                SkillBar(
                    label = stringResource(R.string.players_goalkeeper),
                    rating = user.getEffectiveRating(PlayerRatingRole.GOALKEEPER),
                    color = MaterialTheme.colorScheme.secondary
                )
                SkillBar(
                    label = stringResource(R.string.players_mid),
                    rating = user.getEffectiveRating(PlayerRatingRole.MID),
                    color = MaterialTheme.colorScheme.primary
                )
                SkillBar(
                    label = stringResource(R.string.players_defense),
                    rating = user.getEffectiveRating(PlayerRatingRole.DEFENDER),
                    color = MaterialTheme.colorScheme.error
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Timestamp
            Text(
                text = stringResource(R.string.players_generated_on, SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale.forLanguageTag("pt-BR")).format(Date())),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Botões de Ação
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OutlinedButton(
                    onClick = onClose,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.players_close))
                }

                Button(
                    onClick = onShare,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = androidx.compose.material.icons.Icons.Default.Share,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.players_share))
                }
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun SkillBar(label: String, rating: Double, color: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            modifier = Modifier.width(60.dp),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
        
        Box(modifier = Modifier.weight(1f).height(8.dp)) {
            LinearProgressIndicator(
                progress = { (rating / 5.0).toFloat() },
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(4.dp)),
                color = color,
                trackColor = color.copy(alpha = 0.2f),
            )
        }
        
        Spacer(modifier = Modifier.width(8.dp))
        
        Text(
            text = String.format("%.1f", rating),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = color,
             modifier = Modifier.width(30.dp),
             textAlign = TextAlign.End
        )
    }
}
