package com.futebadosparcas.ui.statistics

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.R
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.ContrastHelper
import com.futebadosparcas.util.LevelBadgeHelper

/**
 * Tela principal de Estatísticas com Jetpack Compose
 *
 * Exibe:
 * - Estatísticas pessoais do jogador (jogos, gols, assistências, presença)
 * - Gráfico de evolução de gols
 * - Top Artilheiros
 * - Top Goleiros
 * - Melhores Jogadores
 */
@Composable
fun StatisticsScreen(
    viewModel: StatisticsViewModel = hiltViewModel(),
    onNavigateToRanking: () -> Unit,
    onNavigateToEvolution: () -> Unit,
    modifier: Modifier = Modifier,
    onNavigateToLeague: () -> Unit = {},
    onPlayerClick: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    StatisticsContent(
        uiState = uiState,
        onRefresh = { viewModel.loadStatistics() },
        onNavigateToRanking = onNavigateToRanking,
        onNavigateToEvolution = onNavigateToEvolution,
        onNavigateToLeague = onNavigateToLeague,
        onPlayerClick = onPlayerClick,
        modifier = modifier
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatisticsContent(
    uiState: StatisticsUiState,
    onRefresh: () -> Unit,
    onNavigateToRanking: () -> Unit,
    onNavigateToEvolution: () -> Unit,
    onNavigateToLeague: () -> Unit,
    onPlayerClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val isRefreshing = uiState is StatisticsUiState.Loading

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = modifier.fillMaxSize()
    ) {
        when (uiState) {
            is StatisticsUiState.Loading -> {
                StatisticsLoadingState()
            }
            is StatisticsUiState.Success -> {
                StatisticsSuccessContent(
                    statistics = uiState.statistics,
                    onNavigateToRanking = onNavigateToRanking,
                    onNavigateToEvolution = onNavigateToEvolution,
                    onNavigateToLeague = onNavigateToLeague,
                    onPlayerClick = onPlayerClick
                )
            }
            is StatisticsUiState.Empty -> {
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.statistics_empty_title),
                        description = stringResource(R.string.statistics_empty_description),
                        icon = Icons.Default.BarChart
                    )
                )
            }
            is StatisticsUiState.Error -> {
                EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(R.string.error),
                        description = uiState.message,
                        actionLabel = stringResource(R.string.retry),
                        onRetry = onRefresh
                    )
                )
            }
        }
    }
}

/**
 * Estado de Loading com Shimmer
 */
@Composable
private fun StatisticsLoadingState(
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Título shimmer
        item {
            ShimmerBox(
                modifier = Modifier
                    .width(200.dp)
                    .height(32.dp),
                cornerRadius = 8.dp
            )
        }

        // Botões de navegação shimmer
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                repeat(2) {
                    ShimmerBox(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        cornerRadius = 8.dp
                    )
                }
            }
        }

        // Card de estatísticas shimmer
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    ShimmerBox(
                        modifier = Modifier
                            .width(150.dp)
                            .height(24.dp),
                        cornerRadius = 8.dp
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        repeat(2) {
                            Column(
                                modifier = Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                ShimmerBox(
                                    modifier = Modifier.size(32.dp),
                                    cornerRadius = 16.dp
                                )
                                ShimmerBox(
                                    modifier = Modifier
                                        .width(60.dp)
                                        .height(32.dp),
                                    cornerRadius = 8.dp
                                )
                                ShimmerBox(
                                    modifier = Modifier
                                        .width(50.dp)
                                        .height(16.dp),
                                    cornerRadius = 4.dp
                                )
                            }
                        }
                    }
                }
            }
        }

        // Rankings shimmer
        items(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp),
                cornerRadius = 12.dp
            )
        }
    }
}

/**
 * Conteúdo de sucesso com todas as estatísticas
 */
@Composable
private fun StatisticsSuccessContent(
    statistics: CombinedStatistics,
    onNavigateToRanking: () -> Unit,
    onNavigateToEvolution: () -> Unit,
    onNavigateToLeague: () -> Unit,
    onPlayerClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Título
        item {
            Text(
                text = stringResource(R.string.statistics_my_stats),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        // Botões de navegação
        item {
            NavigationButtons(
                onNavigateToRanking = onNavigateToRanking,
                onNavigateToEvolution = onNavigateToEvolution,
                onNavigateToLeague = onNavigateToLeague
            )
        }

        // Card de estatísticas pessoais
        item {
            PersonalStatsCard(statistics = statistics.myStats)
        }

        // Gráfico de evolução de gols
        if (statistics.goalEvolution.isNotEmpty()) {
            item {
                GoalEvolutionCard(goalEvolution = statistics.goalEvolution)
            }
        }

        // Seção de Rankings
        item {
            Text(
                text = stringResource(R.string.statistics_rankings_general),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 16.dp)
            )
        }

        // Top Artilheiros
        if (statistics.topScorers.isNotEmpty()) {
            item {
                RankingSection(
                    title = stringResource(R.string.statistics_top_scorers),
                    rankingItems = statistics.topScorers,
                    icon = Icons.Default.SportsScore,
                    iconTint = MaterialTheme.colorScheme.tertiary,
                    onPlayerClick = onPlayerClick
                )
            }
        }

        // Top Goleiros
        if (statistics.topGoalkeepers.isNotEmpty()) {
            item {
                RankingSection(
                    title = stringResource(R.string.statistics_top_goalkeepers),
                    rankingItems = statistics.topGoalkeepers,
                    icon = Icons.Default.Shield,
                    iconTint = MaterialTheme.colorScheme.secondary,
                    onPlayerClick = onPlayerClick
                )
            }
        }

        // Melhores Jogadores
        if (statistics.bestPlayers.isNotEmpty()) {
            item {
                RankingSection(
                    title = stringResource(R.string.statistics_best_players),
                    rankingItems = statistics.bestPlayers,
                    icon = Icons.Default.Star,
                    iconTint = GamificationColors.Gold,
                    onPlayerClick = onPlayerClick
                )
            }
        }
    }
}

/**
 * Botões de navegação para Liga, Ranking e Evolução
 */
@Composable
private fun NavigationButtons(
    onNavigateToRanking: () -> Unit,
    onNavigateToEvolution: () -> Unit,
    onNavigateToLeague: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Botão principal: Liga (com seletor de período)
        Button(
            onClick = onNavigateToLeague,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = stringResource(R.string.statistics_league),
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.statistics_league))
        }

        // Botões secundários: Ranking e Evolução
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onNavigateToRanking,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Leaderboard,
                    contentDescription = stringResource(R.string.statistics_rankings_general),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.statistics_rankings_general))
            }

            OutlinedButton(
                onClick = onNavigateToEvolution,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                    contentDescription = stringResource(R.string.statistics_evolution),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.statistics_evolution))
            }
        }
    }
}

/**
 * Card de estatísticas pessoais
 */
@Composable
private fun PersonalStatsCard(
    statistics: com.futebadosparcas.data.model.UserStatistics,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(R.string.statistics_my_stats),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            // Primeira linha: Jogos e Gols
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatItem(
                    icon = Icons.Default.CalendarMonth,
                    iconTint = MaterialTheme.colorScheme.primary,
                    value = statistics.totalGames.toString(),
                    label = stringResource(R.string.games),
                    modifier = Modifier.weight(1f)
                )
                StatItem(
                    icon = Icons.Default.SportsScore,
                    iconTint = MaterialTheme.colorScheme.tertiary,
                    value = statistics.totalGoals.toString(),
                    label = stringResource(R.string.goals),
                    modifier = Modifier.weight(1f)
                )
            }

            // Segunda linha: Melhor Jogador e Presença
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatItem(
                    icon = Icons.Default.Star,
                    iconTint = GamificationColors.Gold,
                    value = statistics.bestPlayerCount.toString(),
                    label = stringResource(R.string.statistics_best_players),
                    modifier = Modifier.weight(1f)
                )
                StatItem(
                    icon = Icons.Default.CheckCircle,
                    iconTint = MaterialTheme.colorScheme.primary,
                    value = "${(statistics.presenceRate * 100).toInt()}%",
                    label = stringResource(R.string.presence_rate),
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

/**
 * Item individual de estatística
 */
@Composable
private fun StatItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    value: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = iconTint,
            modifier = Modifier.size(32.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Card com gráfico de evolução de gols
 */
@Composable
private fun GoalEvolutionCard(
    goalEvolution: Map<String, Int>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(R.string.statistics_goal_evolution),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            GoalEvolutionChart(
                data = goalEvolution,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
            )
        }
    }
}

/**
 * Gráfico de evolução de gols (simplificado com Canvas)
 */
@Composable
private fun GoalEvolutionChart(
    data: Map<String, Int>,
    modifier: Modifier = Modifier
) {
    val primaryColor = MaterialTheme.colorScheme.primary
    val onSurfaceVariant = MaterialTheme.colorScheme.onSurfaceVariant
    val surfaceColor = MaterialTheme.colorScheme.surface

    if (data.isEmpty()) {
        Box(
            modifier = modifier,
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = stringResource(R.string.statistics_no_data),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    val sortedData = remember(data) { data.entries.sortedBy { it.key } }
    val maxValue = remember(sortedData) { sortedData.maxOfOrNull { it.value } ?: 1 }

    Column(modifier = modifier) {
        // Gráfico
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .padding(vertical = 8.dp)
        ) {
            if (sortedData.isEmpty()) return@Canvas

            val spacing = size.width / (sortedData.size - 1).coerceAtLeast(1)
            val heightScale = size.height / maxValue.toFloat()

            // Desenhar grade horizontal
            val gridLines = 4
            repeat(gridLines) { i ->
                val y = size.height * i / (gridLines - 1)
                drawLine(
                    color = onSurfaceVariant.copy(alpha = 0.2f),
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = 1.dp.toPx()
                )
            }

            // Desenhar área preenchida (gradiente)
            val path = Path().apply {
                moveTo(0f, size.height)
                sortedData.forEachIndexed { index, entry ->
                    val x = index * spacing
                    val y = size.height - (entry.value * heightScale)
                    if (index == 0) {
                        lineTo(x, y)
                    } else {
                        lineTo(x, y)
                    }
                }
                lineTo(size.width, size.height)
                close()
            }

            drawPath(
                path = path,
                brush = Brush.verticalGradient(
                    colors = listOf(
                        primaryColor.copy(alpha = 0.3f),
                        primaryColor.copy(alpha = 0.05f)
                    )
                )
            )

            // Desenhar linha
            val linePath = Path()
            sortedData.forEachIndexed { index, entry ->
                val x = index * spacing
                val y = size.height - (entry.value * heightScale)
                if (index == 0) {
                    linePath.moveTo(x, y)
                } else {
                    linePath.lineTo(x, y)
                }
            }

            drawPath(
                path = linePath,
                color = primaryColor,
                style = Stroke(
                    width = 3.dp.toPx(),
                    cap = StrokeCap.Round,
                    join = StrokeJoin.Round
                )
            )

            // Desenhar pontos
            sortedData.forEachIndexed { index, entry ->
                val x = index * spacing
                val y = size.height - (entry.value * heightScale)
                drawCircle(
                    color = primaryColor,
                    radius = 5.dp.toPx(),
                    center = Offset(x, y)
                )
                drawCircle(
                    color = surfaceColor,  // Adapta ao tema dark/light
                    radius = 3.dp.toPx(),
                    center = Offset(x, y)
                )
            }
        }

        // Labels de data (eixo X)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            sortedData.forEachIndexed { index, entry ->
                if (index == 0 || index == sortedData.size - 1 || sortedData.size < 5) {
                    Text(
                        text = entry.key,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}

/**
 * Seção de ranking com título e lista de jogadores
 */
@Composable
private fun RankingSection(
    title: String,
    rankingItems: List<PlayerRankingItem>,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    onPlayerClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Título da seção com ícone
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = iconTint,
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        // Lista de jogadores
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            rankingItems.take(5).forEach { item ->
                RankingItem(
                    item = item,
                    onPlayerClick = onPlayerClick
                )
            }
        }
    }
}

/**
 * Item individual de ranking
 */
@Composable
private fun RankingItem(
    item: PlayerRankingItem,
    onPlayerClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onPlayerClick(item.userId) },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Posição com destaque para top 3
            Box(
                modifier = Modifier.size(40.dp),
                contentAlignment = Alignment.Center
            ) {
                val rankColor = when (item.rank) {
                    1 -> GamificationColors.Gold
                    2 -> GamificationColors.Silver
                    3 -> GamificationColors.Bronze
                    else -> MaterialTheme.colorScheme.surfaceVariant
                }

                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(rankColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = item.rank.toString(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (item.rank <= 3) ContrastHelper.getContrastingTextColor(rankColor) else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Avatar do jogador
            CachedProfileImage(
                photoUrl = item.photoUrl,
                userName = item.playerName,
                size = 48.dp
            )

            // Badge de nível (now as sibling, not nested)
            Box(
                modifier = Modifier.size(48.dp)
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(item.photoUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = stringResource(R.string.statistics_avatar, item.playerName),
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop,
                    placeholder = painterResource(R.drawable.ic_launcher_foreground),
                    error = painterResource(R.drawable.ic_launcher_foreground)
                )

                // Badge de nível
                Image(
                    painter = painterResource(LevelBadgeHelper.getBadgeForLevel(item.level)),
                    contentDescription = stringResource(R.string.statistics_level_badge, item.level),
                    modifier = Modifier
                        .size(20.dp)
                        .align(Alignment.BottomEnd)
                )
            }

            // Informações do jogador
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = item.playerName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${item.gamesPlayed} ${stringResource(R.string.statistics_jogos)} • ${stringResource(R.string.statistics_average)}: ${"%.1f".format(item.average)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Pontuação/Valor
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = item.value.toString(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = stringResource(R.string.statistics_points),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
