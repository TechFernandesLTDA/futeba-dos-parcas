package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class OwnerStats(
    val totalGamesOrganized: Int = 0,
    val confirmationRate: Double = 0.0,
    val organizerRating: Double = 0.0,
    val gamesCanceled: Int = 0,
    val totalRevenue: Double = 0.0,
    val gamesPerMonth: List<MonthlyGames> = emptyList(),
    val organizerRanking: List<OrganizerRankingItem> = emptyList()
)

private data class MonthlyGames(
    val month: String,
    val games: Int
)

private data class OrganizerRankingItem(
    val position: Int,
    val userId: String,
    val userName: String,
    val gamesOrganized: Int,
    val rating: Double,
    val isCurrentUser: Boolean
)

private sealed class OwnerStatsUiState {
    object Loading : OwnerStatsUiState()
    data class Success(val stats: OwnerStats) : OwnerStatsUiState()
    data class Error(val message: String) : OwnerStatsUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerStatsScreen(
    onBackClick: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<OwnerStatsUiState>(OwnerStatsUiState.Loading) }

    fun loadStats() {
        scope.launch {
            uiState = OwnerStatsUiState.Loading
            try {
                delay(500)
                val stats = getMockOwnerStats()
                uiState = OwnerStatsUiState.Success(stats)
            } catch (e: Exception) {
                uiState = OwnerStatsUiState.Error(e.message ?: "Erro ao carregar estatísticas")
            }
        }
    }

    LaunchedEffect(Unit) {
        loadStats()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "📊 Estatísticas do Organizador",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    ) 
                },
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
            is OwnerStatsUiState.Loading -> OwnerStatsLoadingContent(paddingValues)
            is OwnerStatsUiState.Success -> OwnerStatsContent(
                stats = state.stats,
                paddingValues = paddingValues
            )
            is OwnerStatsUiState.Error -> OwnerStatsErrorState(
                message = state.message,
                onRetry = { loadStats() },
                paddingValues = paddingValues
            )
        }
    }
}

@Composable
private fun OwnerStatsContent(
    stats: OwnerStats,
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
            MainStatsCard(stats = stats)
        }

        item {
            FinancialStatsCard(stats = stats)
        }

        item {
            MonthlyGamesChartCard(gamesPerMonth = stats.gamesPerMonth)
        }

        item {
            Text(
                text = "🏆 Ranking de Organizadores",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        items(stats.organizerRanking, key = { it.userId }) { organizer ->
            OrganizerRankingCard(organizer = organizer)
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun MainStatsCard(stats: OwnerStats) {
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
                text = "📈 Visão Geral",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MainStatItem(
                    emoji = "🎮",
                    value = stats.totalGamesOrganized.toString(),
                    label = "Jogos Organizados"
                )
                MainStatItem(
                    emoji = "✅",
                    value = "${(stats.confirmationRate * 100).toInt()}%",
                    label = "Taxa Confirmação"
                )
                MainStatItem(
                    emoji = "⭐",
                    value = "${(stats.organizerRating * 10).toInt() / 10.0}",
                    label = "Avaliação"
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "🚫 Jogos Cancelados: ",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = stats.gamesCanceled.toString(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (stats.gamesCanceled == 0) Color(0xFF4CAF50) else Color(0xFFFF9800)
                )
            }
        }
    }
}

@Composable
private fun MainStatItem(
    emoji: String,
    value: String,
    label: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = emoji, style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun FinancialStatsCard(stats: OwnerStats) {
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
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "💰 Receita Total Gerada",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "💚",
                    style = MaterialTheme.typography.headlineMedium
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "R$ ${formatCurrency(stats.totalRevenue)}",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF4CAF50)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Acumulado em todos os jogos organizados",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                FinancialMetric(
                    emoji = "📊",
                    label = "Média por jogo",
                    value = "R$ ${formatCurrency(if (stats.totalGamesOrganized > 0) stats.totalRevenue / stats.totalGamesOrganized else 0.0)}"
                )
                FinancialMetric(
                    emoji = "📅",
                    label = "Este mês",
                    value = "R$ ${formatCurrency(stats.totalRevenue * 0.15)}"
                )
            }
        }
    }
}

@Composable
private fun FinancialMetric(
    emoji: String,
    label: String,
    value: String
) {
    Column(horizontalAlignment = Alignment.Start) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = emoji, style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSecondaryContainer
        )
    }
}

@Composable
private fun MonthlyGamesChartCard(gamesPerMonth: List<MonthlyGames>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "📅 Jogos por Mês",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(20.dp))

            val maxGames = gamesPerMonth.maxOfOrNull { it.games } ?: 1

            gamesPerMonth.forEach { monthData ->
                MonthlyGameBar(
                    month = monthData.month,
                    games = monthData.games,
                    maxGames = maxGames
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun MonthlyGameBar(
    month: String,
    games: Int,
    maxGames: Int
) {
    val progress = if (maxGames > 0) games.toFloat() / maxGames else 0f

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = month,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "$games jogos",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(progress)
                    .clip(RoundedCornerShape(4.dp))
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.tertiary
                            )
                        )
                    )
            )
        }
    }
}

@Composable
private fun OrganizerRankingCard(organizer: OrganizerRankingItem) {
    val backgroundColor = when {
        organizer.isCurrentUser -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        organizer.position <= 3 -> when (organizer.position) {
            1 -> Color(0xFFFFD700).copy(alpha = 0.15f)
            2 -> Color(0xFFC0C0C0).copy(alpha = 0.15f)
            else -> Color(0xFFCD7F32).copy(alpha = 0.15f)
        }
        else -> MaterialTheme.colorScheme.surface
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            organizer.position == 1 -> Color(0xFFFFD700)
                            organizer.position == 2 -> Color(0xFFC0C0C0)
                            organizer.position == 3 -> Color(0xFFCD7F32)
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = when (organizer.position) {
                        1 -> "🥇"
                        2 -> "🥈"
                        3 -> "🥉"
                        else -> organizer.position.toString()
                    },
                    style = if (organizer.position <= 3) MaterialTheme.typography.titleMedium
                            else MaterialTheme.typography.labelLarge
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = organizer.userName,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (organizer.isCurrentUser) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.primary
                        ) {
                            Text(
                                text = "VOCÊ",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    RankingMiniStat(emoji = "🎮", value = "${organizer.gamesOrganized} jogos")
                    RankingMiniStat(emoji = "⭐", value = "${(organizer.rating * 10).toInt() / 10.0}")
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "#${organizer.position}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun RankingMiniStat(emoji: String, value: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(text = emoji, style = MaterialTheme.typography.labelMedium)
        Text(
            text = value,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun OwnerStatsLoadingContent(paddingValues: PaddingValues) {
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
                        .height(140.dp)
                        .background(brush)
                )
            }
        }
    }
}

@Composable
private fun OwnerStatsErrorState(
    message: String,
    onRetry: () -> Unit,
    paddingValues: PaddingValues
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("🔄")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Tentar novamente")
        }
    }
}

private fun formatCurrency(value: Double): String {
    val rounded = (value * 100).toInt() / 100.0
    val parts = rounded.toString().split(".")
    val intPart = parts[0]
    val decPart = if (parts.size > 1) parts[1].padEnd(2, '0').take(2) else "00"
    return "$intPart,$decPart"
}

private fun getMockOwnerStats(): OwnerStats {
    return OwnerStats(
        totalGamesOrganized = 47,
        confirmationRate = 0.87,
        organizerRating = 4.7,
        gamesCanceled = 3,
        totalRevenue = 3850.00,
        gamesPerMonth = listOf(
            MonthlyGames("Set", 5),
            MonthlyGames("Out", 8),
            MonthlyGames("Nov", 6),
            MonthlyGames("Dez", 4),
            MonthlyGames("Jan", 9),
            MonthlyGames("Fev", 7)
        ),
        organizerRanking = listOf(
            OrganizerRankingItem(1, "u1", "João Silva", 89, 4.9, false),
            OrganizerRankingItem(2, "u2", "Pedro Santos", 76, 4.8, false),
            OrganizerRankingItem(3, "u3", "Lucas Oliveira", 65, 4.7, false),
            OrganizerRankingItem(4, "current", "Você", 47, 4.7, true),
            OrganizerRankingItem(5, "u4", "Marcos Lima", 42, 4.5, false),
            OrganizerRankingItem(6, "u5", "Carlos Ferreira", 38, 4.6, false),
            OrganizerRankingItem(7, "u6", "André Souza", 31, 4.4, false)
        )
    )
}
