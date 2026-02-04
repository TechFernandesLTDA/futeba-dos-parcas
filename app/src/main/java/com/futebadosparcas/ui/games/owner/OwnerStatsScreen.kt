package com.futebadosparcas.ui.games.owner

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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import java.text.NumberFormat
import java.util.Locale

/**
 * Issue #67: Estatisticas do Organizador
 * Mostra historico de jogos organizados, media de presenca, receita total.
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerStatsScreen(
    stats: OwnerStats,
    isLoading: Boolean,
    onNavigateBack: () -> Unit,
    onGameClick: (String) -> Unit
) {
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.owner_stats_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header com estatisticas principais
                item {
                    OwnerStatsHeader(stats = stats, currencyFormat = currencyFormat)
                }

                // Grafico de tendencia (simplificado)
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
                                title = stringResource(R.string.owner_best_game),
                                game = game,
                                icon = Icons.Default.ThumbUp,
                                color = com.futebadosparcas.ui.theme.BrandColors.WhatsApp,
                                modifier = Modifier.weight(1f),
                                onClick = { onGameClick(game.id) }
                            )
                        }
                        stats.worstAttendedGame?.let { game ->
                            HighlightGameCard(
                                title = stringResource(R.string.owner_worst_game),
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
                        text = stringResource(R.string.owner_recent_games),
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
private fun OwnerStatsHeader(
    stats: OwnerStats,
    currencyFormat: NumberFormat
) {
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
                text = stringResource(R.string.owner_stats_overview),
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
                    label = stringResource(R.string.owner_games_organized),
                    icon = Icons.Default.SportsScore
                )
                StatItem(
                    value = stats.totalPlayersHosted.toString(),
                    label = stringResource(R.string.owner_players_hosted),
                    icon = Icons.Default.Groups
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    value = "${(stats.averageAttendance * 100).toInt()}%",
                    label = stringResource(R.string.owner_avg_attendance),
                    icon = Icons.Default.CheckCircle
                )
                StatItem(
                    value = currencyFormat.format(stats.totalRevenue),
                    label = stringResource(R.string.owner_total_revenue),
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
                    text = stringResource(R.string.owner_attendance_trend),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Grafico simplificado de barras
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
                        value >= 0.8f -> com.futebadosparcas.ui.theme.BrandColors.WhatsApp
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
                text = stringResource(R.string.owner_last_n_games, trend.size.coerceAtMost(10)),
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
                text = "${game.playersCount}/${game.maxPlayers} jogadores",
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
            // Status indicator
            val statusColor = when (game.getStatusEnum()) {
                GameStatus.FINISHED -> com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                GameStatus.LIVE -> MaterialTheme.colorScheme.tertiary
                GameStatus.CANCELLED -> MaterialTheme.colorScheme.error
                else -> MaterialTheme.colorScheme.primary
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
                    text = "${game.date} - ${game.time}",
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
                    text = "$attendanceRate%",
                    style = MaterialTheme.typography.labelSmall,
                    color = when {
                        attendanceRate >= 80 -> com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                        attendanceRate >= 50 -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.error
                    }
                )
            }
        }
    }
}
