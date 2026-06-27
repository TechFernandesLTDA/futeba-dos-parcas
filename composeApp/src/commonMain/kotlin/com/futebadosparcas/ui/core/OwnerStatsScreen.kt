package com.futebadosparcas.ui.core

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.owner_attendance_rate
import com.futebadosparcas.compose.resources.owner_attendance_trend
import com.futebadosparcas.compose.resources.owner_avg_attendance_compact
import com.futebadosparcas.compose.resources.owner_best_game_compact
import com.futebadosparcas.compose.resources.owner_game_date_time
import com.futebadosparcas.compose.resources.owner_games_organized
import com.futebadosparcas.compose.resources.owner_last_n_games
import com.futebadosparcas.compose.resources.owner_players_count
import com.futebadosparcas.compose.resources.owner_players_hosted_compact
import com.futebadosparcas.compose.resources.owner_recent_games
import com.futebadosparcas.compose.resources.owner_stats_overview
import com.futebadosparcas.compose.resources.owner_stats_screen_title
import com.futebadosparcas.compose.resources.owner_total_revenue_compact
import com.futebadosparcas.compose.resources.owner_worst_game_compact
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource

/**
 * Issue #67: Estatísticas do Organizador
 * Mostra histórico de jogos organizados, média de presença, receita total.
 */
data class OwnerStats(
    val totalGamesOrganized: Int = 0,
    val totalPlayersHosted: Int = 0,
    val averageAttendance: Double = 0.0,
    val totalRevenue: Double = 0.0,
    val bestAttendedGame: Game? = null,
    val worstAttendedGame: Game? = null,
    val attendanceRateTrend: List<Float> = emptyList(),
    val recentGames: List<Game> = emptyList()
)

private fun formatCurrency(value: Double): String {
    val wholePart = value.toLong()
    val centsPart = ((value - wholePart) * 100).toInt().coerceIn(0, 99)
    val formattedWhole = wholePart.toString().reversed()
        .chunked(3)
        .joinToString(".")
        .reversed()
    return "R$ $formattedWhole,${centsPart.toString().padStart(2, '0')}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerStatsScreen(
    stats: OwnerStats,
    isLoading: Boolean,
    onNavigateBack: () -> Unit,
    onGameClick: (String) -> Unit
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.owner_stats_screen_title),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        if (isLoading) {
            // Loading simplificado
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .widthIn(max = 920.dp),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header com estatísticas principais
                item {
                    OwnerStatsHeader(stats = stats)
                }

                // Gráfico de tendência (simplificado)
                item {
                    AttendanceTrendCard(trend = stats.attendanceRateTrend)
                }

                // Melhor e pior jogo
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        stats.bestAttendedGame?.let { game ->
                            HighlightGameCard(
                                title = stringResource(Res.string.owner_best_game_compact),
                                game = game,
                                icon = Icons.Default.ThumbUp,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.weight(1f),
                                onClick = { onGameClick(game.id) }
                            )
                        }
                        stats.worstAttendedGame?.let { game ->
                            HighlightGameCard(
                                title = stringResource(Res.string.owner_worst_game_compact),
                                game = game,
                                icon = Icons.Default.ThumbDown,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.weight(1f),
                                onClick = { onGameClick(game.id) }
                            )
                        }
                    }
                }

                // Jogos recentes
                item {
                    Text(
                        text = stringResource(Res.string.owner_recent_games),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                items(stats.recentGames.take(10), key = { it.id }) { game ->
                    RecentGameCard(
                        game = game,
                        onClick = { onGameClick(game.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun OwnerStatsHeader(stats: OwnerStats) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = stringResource(Res.string.owner_stats_overview),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    value = stats.totalGamesOrganized.toString(),
                    label = stringResource(Res.string.owner_games_organized),
                    icon = Icons.Default.SportsScore
                )
                StatItem(
                    value = stats.totalPlayersHosted.toString(),
                    label = stringResource(Res.string.owner_players_hosted_compact),
                    icon = Icons.Default.Groups
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    value = stringResource(
                        Res.string.owner_attendance_rate,
                        (stats.averageAttendance * 100).toInt()
                    ),
                    label = stringResource(Res.string.owner_avg_attendance_compact),
                    icon = Icons.Default.CheckCircle
                )
                StatItem(
                    value = formatCurrency(stats.totalRevenue),
                    label = stringResource(Res.string.owner_total_revenue_compact),
                    icon = Icons.Default.AttachMoney
                )
            }
        }
    }
}

@Composable
private fun StatItem(
    value: String,
    label: String,
    icon: ImageVector
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(8.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun AttendanceTrendCard(trend: List<Float>) {
    if (trend.isEmpty()) return

    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(Res.string.owner_attendance_trend),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Gráfico simplificado de barras
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.Bottom
            ) {
                trend.takeLast(10).forEach { value ->
                    val height = (value * 70).dp
                    val color = when {
                        value >= 0.8f -> MaterialTheme.colorScheme.primary
                        value >= 0.5f -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.error
                    }
                    Box(
                        modifier = Modifier
                            .width(20.dp)
                            .height(height.coerceAtLeast(4.dp))
                            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                            .background(color)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(Res.string.owner_last_n_games, trend.size.coerceAtMost(10)),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun HighlightGameCard(
    title: String,
    game: Game,
    icon: ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier,
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = color
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = game.date,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = game.locationName,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = stringResource(
                    Res.string.owner_players_count,
                    game.playersCount,
                    game.maxPlayers
                ),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun RecentGameCard(
    game: Game,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status indicator baseado no campo status (String)
            val statusColor = when (game.status) {
                "FINISHED" -> MaterialTheme.colorScheme.primary
                "LIVE" -> MaterialTheme.colorScheme.tertiary
                "CANCELLED" -> MaterialTheme.colorScheme.error
                else -> MaterialTheme.colorScheme.secondary
            }
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(statusColor)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(Res.string.owner_game_date_time, game.date, game.time),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = game.locationName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${game.playersCount}/${game.maxPlayers}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
                val attendanceRate = if (game.maxPlayers > 0) {
                    (game.playersCount.toFloat() / game.maxPlayers * 100).toInt()
                } else 0
                Text(
                    text = stringResource(Res.string.owner_attendance_rate, attendanceRate),
                    style = MaterialTheme.typography.labelSmall,
                    color = when {
                        attendanceRate >= 80 -> MaterialTheme.colorScheme.primary
                        attendanceRate >= 50 -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.error
                    }
                )
            }
        }
    }
}
