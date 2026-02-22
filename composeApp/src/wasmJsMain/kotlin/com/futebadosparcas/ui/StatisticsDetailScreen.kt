package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.CircleShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.material3.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.runtime.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Alignment
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.draw.clip
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Brush
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState
import kotlin.math.abs
import com.futebadosparcas.ui.components.states.ErrorState

private sealed class StatsUiState {
    object Loading : StatsUiState()
    data class Success(
        val stats: Map<String, Any?>,
        val groupAvg: Map<String, Any?>?,
        val history: List<Map<String, Any?>>
    ) : StatsUiState()
    data class Error(val message: String) : StatsUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatisticsDetailScreen(
    userId: String,
    groupId: String? = null,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<StatsUiState>(StatsUiState.Loading) }
    val scope = rememberCoroutineScope()

    fun loadStats() {
        scope.launch {
            uiState = StatsUiState.Loading
            try {
                val stats = FirebaseManager.getUserStatistics(userId)
                val groupAvg = groupId?.let { FirebaseManager.getGroupAverages(it) }
                val history = FirebaseManager.getStatisticsHistory(userId, 6)

                uiState = StatsUiState.Success(stats, groupAvg, history)
            } catch (e: Exception) {
                uiState = StatsUiState.Error(e.message ?: "Erro ao carregar estatísticas")
            }
        }
    }

    LaunchedEffect(userId) {
        loadStats()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Estatísticas") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is StatsUiState.Loading -> StatsLoadingContent(paddingValues)
            is StatsUiState.Success -> StatsContent(
                stats = state.stats,
                groupAvg = state.groupAvg,
                history = state.history,
                paddingValues = paddingValues
            )
            is StatsUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadStats() }
            )
        }
    }
}

@Composable
private fun StatsContent(
    stats: Map<String, Any?>,
    groupAvg: Map<String, Any?>?,
    history: List<Map<String, Any?>>,
    paddingValues: PaddingValues
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            OverviewStatsCard(stats = stats)
        }

        item {
            PerformanceStatsCard(stats = stats)
        }

        if (groupAvg != null) {
            item {
                ComparisonCard(stats = stats, groupAvg = groupAvg)
            }
        }

        item {
            Text(
                text = "📈 Evolução (últimos 6 meses)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        history.forEach { monthData ->
            item(key = monthData["month"] as? String) {
                MonthHistoryCard(data = monthData)
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun OverviewStatsCard(stats: Map<String, Any?>) {
    val totalGames = (stats["totalGames"] as? Number)?.toInt() ?: 0
    val totalWins = (stats["totalWins"] as? Number)?.toInt() ?: 0
    val totalDraws = (stats["totalDraws"] as? Number)?.toInt() ?: 0
    val totalLosses = (stats["totalLosses"] as? Number)?.toInt() ?: 0
    val winRate = (stats["winRate"] as? Number)?.toDouble() ?: 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "📊 Visão Geral",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                OverviewStatItem(
                    emoji = "🎮",
                    value = totalGames.toString(),
                    label = "Jogos"
                )
                OverviewStatItem(
                    emoji = "🏆",
                    value = totalWins.toString(),
                    label = "Vitórias"
                )
                OverviewStatItem(
                    emoji = "🤝",
                    value = totalDraws.toString(),
                    label = "Empates"
                )
                OverviewStatItem(
                    emoji = "❌",
                    value = totalLosses.toString(),
                    label = "Derrotas"
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Taxa de Vitória: ",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "${(winRate * 100).toInt()}%",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (winRate >= 0.5) Color(0xFF4CAF50) else Color(0xFFFF9800)
                )
            }
        }
    }
}

@Composable
private fun OverviewStatItem(
    emoji: String,
    value: String,
    label: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = emoji, style = MaterialTheme.typography.titleLarge)
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
private fun PerformanceStatsCard(stats: Map<String, Any?>) {
    val totalGoals = (stats["totalGoals"] as? Number)?.toInt() ?: 0
    val totalAssists = (stats["totalAssists"] as? Number)?.toInt() ?: 0
    val totalSaves = (stats["totalSaves"] as? Number)?.toInt() ?: 0
    val mvpCount = (stats["mvpCount"] as? Number)?.toInt() ?: 0
    val avgGoalsPerGame = (stats["avgGoalsPerGame"] as? Number)?.toDouble() ?: 0.0
    val avgAssistsPerGame = (stats["avgAssistsPerGame"] as? Number)?.toDouble() ?: 0.0
    val currentStreak = (stats["currentStreak"] as? Number)?.toInt() ?: 0
    val bestStreak = (stats["bestStreak"] as? Number)?.toInt() ?: 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "⚡ Performance",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                PerformanceItem(
                    emoji = "⚽",
                    value = totalGoals.toString(),
                    subtitle = "${(avgGoalsPerGame * 10).toInt() / 10.0}/jogo",
                    label = "Gols"
                )
                PerformanceItem(
                    emoji = "🎯",
                    value = totalAssists.toString(),
                    subtitle = "${(avgAssistsPerGame * 10).toInt() / 10.0}/jogo",
                    label = "Assists"
                )
                PerformanceItem(
                    emoji = "🧤",
                    value = totalSaves.toString(),
                    subtitle = "Defesas",
                    label = "Goleiro"
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                PerformanceItem(
                    emoji = "👑",
                    value = mvpCount.toString(),
                    subtitle = "Melhor jogador",
                    label = "MVPs"
                )
                PerformanceItem(
                    emoji = "🔥",
                    value = currentStreak.toString(),
                    subtitle = "Sequência atual",
                    label = "Streak"
                )
                PerformanceItem(
                    emoji = "⭐",
                    value = bestStreak.toString(),
                    subtitle = "Melhor marca",
                    label = "Recorde"
                )
            }
        }
    }
}

@Composable
private fun PerformanceItem(
    emoji: String,
    value: String,
    subtitle: String,
    label: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = emoji, style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun ComparisonCard(
    stats: Map<String, Any?>,
    groupAvg: Map<String, Any?>
) {
    val userGoalsPerGame = (stats["avgGoalsPerGame"] as? Number)?.toDouble() ?: 0.0
    val userAssistsPerGame = (stats["avgAssistsPerGame"] as? Number)?.toDouble() ?: 0.0
    val userWinRate = (stats["winRate"] as? Number)?.toDouble() ?: 0.0
    val userMvpCount = (stats["mvpCount"] as? Number)?.toInt() ?: 0

    val groupGoalsPerGame = (groupAvg["avgGoalsPerGame"] as? Number)?.toDouble() ?: 0.0
    val groupAssistsPerGame = (groupAvg["avgAssistsPerGame"] as? Number)?.toDouble() ?: 0.0
    val groupWinRate = (groupAvg["avgWinRate"] as? Number)?.toDouble() ?: 0.0
    val groupMvpCount = (groupAvg["avgMvpCount"] as? Number)?.toDouble() ?: 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📊 Comparação com o Grupo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Média do Grupo",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            ComparisonRow(
                label = "Gols por Jogo",
                userValue = userGoalsPerGame,
                groupValue = groupGoalsPerGame
            )
            Spacer(modifier = Modifier.height(12.dp))
            ComparisonRow(
                label = "Assists por Jogo",
                userValue = userAssistsPerGame,
                groupValue = groupAssistsPerGame
            )
            Spacer(modifier = Modifier.height(12.dp))
            ComparisonRow(
                label = "Taxa de Vitória",
                userValue = userWinRate * 100,
                groupValue = groupWinRate * 100,
                suffix = "%"
            )
            Spacer(modifier = Modifier.height(12.dp))
            ComparisonRow(
                label = "MVPs",
                userValue = userMvpCount.toDouble(),
                groupValue = groupMvpCount
            )
        }
    }
}

@Composable
private fun ComparisonRow(
    label: String,
    userValue: Double,
    groupValue: Double,
    suffix: String = ""
) {
    val diff = userValue - groupValue
    val isAbove = diff > 0
    val percentageDiff = if (groupValue != 0.0) (diff / groupValue * 100) else 0.0

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${(userValue * 10).toInt() / 10.0}$suffix",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "vs ${(groupValue * 10).toInt() / 10.0}$suffix",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val barProgress = if (groupValue > 0) {
                (userValue / groupValue).coerceIn(0.0, 2.0).toFloat() / 2f
            } else {
                0.5f
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(barProgress)
                        .clip(RoundedCornerShape(3.dp))
                        .background(
                            when {
                                isAbove -> Color(0xFF4CAF50)
                                diff < 0 -> Color(0xFFFF9800)
                                else -> MaterialTheme.colorScheme.primary
                            }
                        )
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Surface(
                shape = RoundedCornerShape(4.dp),
                color = when {
                    isAbove -> Color(0xFF4CAF50).copy(alpha = 0.1f)
                    diff < 0 -> Color(0xFFFF9800).copy(alpha = 0.1f)
                    else -> MaterialTheme.colorScheme.surfaceVariant
                }
            ) {
                Text(
                    text = if (isAbove) "+${(percentageDiff * 10).toInt() / 10.0}% ▲" 
                           else if (diff < 0) "${(percentageDiff * 10).toInt() / 10.0}% ▼" 
                           else "= 0%",
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        isAbove -> Color(0xFF4CAF50)
                        diff < 0 -> Color(0xFFFF9800)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }
    }
}

@Composable
private fun MonthHistoryCard(data: Map<String, Any?>) {
    val month = (data["month"] as? String)?.substring(5) ?: "?"
    val games = (data["games"] as? Number)?.toInt() ?: 0
    val goals = (data["goals"] as? Number)?.toInt() ?: 0
    val assists = (data["assists"] as? Number)?.toInt() ?: 0
    val wins = (data["wins"] as? Number)?.toInt() ?: 0
    val mvpCount = (data["mvpCount"] as? Number)?.toInt() ?: 0
    val xpEarned = (data["xpEarned"] as? Long)?.toInt() ?: 0

    val monthName = when (month) {
        "01" -> "Jan"
        "02" -> "Fev"
        "03" -> "Mar"
        "04" -> "Abr"
        "05" -> "Mai"
        "06" -> "Jun"
        "07" -> "Jul"
        "08" -> "Ago"
        "09" -> "Set"
        "10" -> "Out"
        "11" -> "Nov"
        "12" -> "Dez"
        else -> month
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = monthName,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = games.toString(),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = "jogos",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    MiniStat(emoji = "⚽", value = goals)
                    MiniStat(emoji = "🎯", value = assists)
                    MiniStat(emoji = "🏆", value = wins)
                    MiniStat(emoji = "👑", value = mvpCount)
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "+$xpEarned",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "XP",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun MiniStat(emoji: String, value: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(text = emoji, style = MaterialTheme.typography.labelMedium)
        Text(
            text = value.toString(),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun StatsLoadingContent(paddingValues: PaddingValues) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(5) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .background(brush)
                )
            }
        }
    }
}
