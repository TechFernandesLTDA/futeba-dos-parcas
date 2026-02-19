package com.futebadosparcas.ui.statistics

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.koin.compose.viewmodel.koinViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.domain.model.XpLog
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.LevelBadgeHelper
import java.text.SimpleDateFormat
import java.util.*

/**
 * Tela de Evolucao do Jogador
 *
 * Exibe:
 * - Nivel atual e barra de progresso de XP
 * - Historico de ganhos de XP
 * - Grafico de evolucao mensal
 * - Milestones conquistados
 * - Proximos milestones com progresso
 * - Dados da liga (divisao, pontos)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EvolutionScreen(
    modifier: Modifier = Modifier,
    viewModel: RankingViewModel = koinViewModel()
) {
    val evolutionState by viewModel.evolutionState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadEvolution()
    }

    PullToRefreshBox(
        isRefreshing = evolutionState is EvolutionUiState.Loading,
        onRefresh = { viewModel.loadEvolution() },
        modifier = modifier.fillMaxSize()
    ) {
        when (val state = evolutionState) {
            is EvolutionUiState.Loading -> {
                EvolutionLoadingState()
            }
            is EvolutionUiState.Success -> {
                EvolutionSuccessContent(
                    data = state.data,
                    onRefresh = { viewModel.loadEvolution() }
                )
            }
            is EvolutionUiState.Error -> {
                EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(R.string.error),
                        description = state.message,
                        actionLabel = stringResource(R.string.retry),
                        onRetry = { viewModel.loadEvolution() }
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
private fun EvolutionLoadingState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header shimmer
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            cornerRadius = 16.dp
        )

        // XP Progress shimmer
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp),
            cornerRadius = 16.dp
        )

        // Chart shimmer
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp),
            cornerRadius = 16.dp
        )

        // Milestones shimmer
        repeat(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp),
                cornerRadius = 12.dp
            )
        }
    }
}

/**
 * Conteudo principal com todos os dados de evolucao
 */
@Composable
private fun EvolutionSuccessContent(
    data: PlayerEvolutionData,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header com Nivel
        LevelHeader(
            currentLevel = data.currentLevel,
            levelName = data.levelName,
            currentXp = data.currentXp,
            xpProgress = data.xpProgress,
            xpNeeded = data.xpNeeded,
            progressPercentage = data.progressPercentage
        )

        // Liga Data
        if (data.leagueData != null) {
            LeagueCard(leagueData = data.leagueData)
        }

        // Grafico de evolucao de XP
        if (data.xpEvolution.isNotEmpty()) {
            XpEvolutionChartCard(xpEvolution = data.xpEvolution)
        }

        // Historico de XP recente
        if (data.xpHistory.isNotEmpty()) {
            XpHistoryCard(xpHistory = data.xpHistory)
        }

        // Milestones Conquistados
        if (data.achievedMilestones.isNotEmpty()) {
            Text(
                text = stringResource(R.string.achieved_milestones),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            AchievedMilestonesRow(milestones = data.achievedMilestones)
        }

        // Proximos Milestones
        if (data.nextMilestones.isNotEmpty()) {
            Text(
                text = stringResource(R.string.next_milestones),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            data.nextMilestones.forEach { milestone ->
                MilestoneProgressCard(milestone = milestone)
            }
        }
    }
}

/**
 * Header com nivel e progresso de XP
 */
@Composable
private fun LevelHeader(
    currentLevel: Int,
    levelName: String,
    currentXp: Long,
    xpProgress: Long,
    xpNeeded: Long,
    progressPercentage: Float
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Badge do nivel
            Box(
                modifier = Modifier.size(80.dp),
                contentAlignment = Alignment.Center
            ) {
                // Background glow
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.3f),
                                    Color.Transparent
                                )
                            )
                        )
                )

                // Badge image
                androidx.compose.foundation.Image(
                    painter = painterResource(LevelBadgeHelper.getBadgeForLevel(currentLevel)),
                    contentDescription = stringResource(R.string.level_prefix, currentLevel),
                    modifier = Modifier.size(72.dp)
                )
            }

            // Nome do nivel
            Text(
                text = levelName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            // XP total
            Text(
                text = "$currentXp XP",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
            )

            // Barra de progresso
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = stringResource(R.string.progress_to_next_level),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        text = "$xpProgress / $xpNeeded XP",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                LinearProgressIndicator(
                    progress = { progressPercentage },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
                )
            }
        }
    }
}

/**
 * Card com dados da liga
 */
@Composable
private fun LeagueCard(leagueData: com.futebadosparcas.data.model.SeasonParticipationV2) {
    val divisionColor = when (leagueData.division) {
        com.futebadosparcas.data.model.LeagueDivision.DIAMANTE -> GamificationColors.Diamond
        com.futebadosparcas.data.model.LeagueDivision.OURO -> GamificationColors.Gold
        com.futebadosparcas.data.model.LeagueDivision.PRATA -> GamificationColors.Silver
        com.futebadosparcas.data.model.LeagueDivision.BRONZE -> GamificationColors.Bronze
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = stringResource(R.string.current_season),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = leagueData.division.displayName,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = divisionColor
                )
            }

            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "${leagueData.points} pts",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${leagueData.wins}V ${leagueData.draws}E ${leagueData.losses}D",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Card com grafico de evolucao de XP mensal
 */
@Composable
private fun XpEvolutionChartCard(xpEvolution: Map<String, Long>) {
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
            Text(
                text = stringResource(R.string.xp_evolution),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            XpEvolutionChart(
                data = xpEvolution,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            )
        }
    }
}

/**
 * Grafico de evolucao de XP com Canvas
 */
@Composable
private fun XpEvolutionChart(
    data: Map<String, Long>,
    modifier: Modifier = Modifier
) {
    val primaryColor = MaterialTheme.colorScheme.primary
    val onSurfaceVariant = MaterialTheme.colorScheme.onSurfaceVariant

    if (data.isEmpty()) {
        Box(
            modifier = modifier,
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = stringResource(R.string.no_data),
                style = MaterialTheme.typography.bodyMedium,
                color = onSurfaceVariant
            )
        }
        return
    }

    val sortedData = remember(data) { data.entries.sortedBy { it.key } }
    val maxValue = remember(sortedData) { sortedData.maxOfOrNull { it.value } ?: 1L }

    Column(modifier = modifier) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(vertical = 8.dp)
        ) {
            if (sortedData.isEmpty()) return@Canvas

            val barWidth = size.width / sortedData.size.coerceAtLeast(1) * 0.6f
            val spacing = size.width / sortedData.size.coerceAtLeast(1)
            val heightScale = size.height / maxValue.toFloat()

            sortedData.forEachIndexed { index, entry ->
                val x = index * spacing + (spacing - barWidth) / 2
                val barHeight = entry.value * heightScale

                drawRoundRect(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            primaryColor,
                            primaryColor.copy(alpha = 0.6f)
                        )
                    ),
                    topLeft = Offset(x, size.height - barHeight),
                    size = androidx.compose.ui.geometry.Size(barWidth, barHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx(), 8.dp.toPx())
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            sortedData.forEach { entry ->
                Text(
                    text = entry.key.take(3),
                    style = MaterialTheme.typography.labelSmall,
                    color = onSurfaceVariant,
                    fontSize = 10.sp,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/**
 * Card com historico de ganhos de XP
 */
@Composable
private fun XpHistoryCard(xpHistory: List<XpLog>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.recent_xp_gains),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                xpHistory.take(5).forEach { log ->
                    XpHistoryItem(log = log)
                }
            }
        }
    }
}

/**
 * Item individual do historico de XP
 */
@Composable
private fun XpHistoryItem(log: XpLog) {
    val dateFormat = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.surface,
                RoundedCornerShape(8.dp)
            )
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = getXpLogDescription(log),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = log.createdAt?.let { dateFormat.format(Date(it)) } ?: "--",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Text(
            text = "+${log.xpEarned} XP",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

private fun getXpLogDescription(log: XpLog): String {
    val parts = mutableListOf<String>()
    if (log.goals > 0) parts.add("${log.goals} gols")
    if (log.assists > 0) parts.add("${log.assists} assists")
    if (log.saves > 0) parts.add("${log.saves} defesas")
    if (log.wasMvp) parts.add("MVP")

    return if (parts.isNotEmpty()) {
        "Jogo: " + parts.joinWithEMouE() + " (${log.gameResult})"
    } else {
        "Participacao (${log.gameResult})"
    }
}

private fun List<String>.joinWithEMouE(): String {
    return if (size == 1) this[0]
    else if (size == 2) "${this[0]} e ${this[1]}"
    else dropLast(1).joinToString(", ") + " e ${last()}"
}

/**
 * Row de milestones conquistados
 */
@Composable
private fun AchievedMilestonesRow(milestones: List<MilestoneType>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        milestones.take(6).forEach { milestone ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .aspectRatio(1f)
                    .background(
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = getMilestoneIcon(milestone),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

private fun getMilestoneIcon(milestone: MilestoneType): ImageVector {
    return when (milestone) {
        MilestoneType.GAMES_10, MilestoneType.GAMES_25, MilestoneType.GAMES_50,
        MilestoneType.GAMES_100, MilestoneType.GAMES_250, MilestoneType.GAMES_500 -> Icons.Default.CalendarMonth
        MilestoneType.GOALS_10, MilestoneType.GOALS_25, MilestoneType.GOALS_50,
        MilestoneType.GOALS_100, MilestoneType.GOALS_250 -> Icons.Default.SportsScore
        MilestoneType.ASSISTS_10, MilestoneType.ASSISTS_25, MilestoneType.ASSISTS_50,
        MilestoneType.ASSISTS_100 -> Icons.Default.Handshake
        MilestoneType.SAVES_25, MilestoneType.SAVES_50, MilestoneType.SAVES_100,
        MilestoneType.SAVES_250 -> Icons.Default.Shield
        MilestoneType.MVP_5, MilestoneType.MVP_10, MilestoneType.MVP_25,
        MilestoneType.MVP_50 -> Icons.Default.Star
        MilestoneType.WINS_10, MilestoneType.WINS_25, MilestoneType.WINS_50,
        MilestoneType.WINS_100 -> Icons.Default.EmojiEvents
    }
}

/**
 * Card de progresso de milestone
 */
@Composable
private fun MilestoneProgressCard(milestone: MilestoneProgress) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = getMilestoneIcon(milestone.milestone),
                    contentDescription = null,
                    tint = getMilestoneColor(milestone.milestone),
                    modifier = Modifier.size(24.dp)
                )
                Text(
                    text = milestone.milestone.displayName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )
            }

            LinearProgressIndicator(
                progress = { milestone.percentage },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = getMilestoneColor(milestone.milestone),
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${milestone.current}/${milestone.target}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${(milestone.percentage * 100).toInt()}%",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = getMilestoneColor(milestone.milestone)
                )
            }
        }
    }
}

@Composable
private fun getMilestoneColor(milestone: MilestoneType): Color {
    return when (milestone) {
        MilestoneType.GOALS_10, MilestoneType.GOALS_25, MilestoneType.GOALS_50,
        MilestoneType.GOALS_100, MilestoneType.GOALS_250 -> MaterialTheme.colorScheme.tertiary
        MilestoneType.MVP_5, MilestoneType.MVP_10, MilestoneType.MVP_25,
        MilestoneType.MVP_50 -> GamificationColors.Gold
        MilestoneType.WINS_10, MilestoneType.WINS_25, MilestoneType.WINS_50,
        MilestoneType.WINS_100 -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.secondary
    }
}
