package com.futebadosparcas.ui.home.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.adaptive.rememberAdaptiveSpacing
import com.futebadosparcas.ui.adaptive.adaptiveValue
import com.patrykandpatrick.vico.compose.axis.horizontal.rememberBottomAxis
import com.patrykandpatrick.vico.compose.axis.vertical.rememberStartAxis
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.column.columnChart
import com.patrykandpatrick.vico.core.axis.AxisPosition
import com.patrykandpatrick.vico.core.axis.formatter.AxisValueFormatter
import com.patrykandpatrick.vico.core.entry.entryModelOf

@Composable
fun ExpandableStatsSection(
    statistics: UserStatistics,
    modifier: Modifier = Modifier
) {
    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    // Em telas grandes, sempre expandir por padrão
    var expanded by remember { mutableStateOf(windowSizeClass.isMedium || windowSizeClass.isExpanded) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(spacing.md),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(Res.string.season_stats_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Icon(
                    imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = if (expanded) stringResource(Res.string.cd_collapse) else stringResource(Res.string.cd_expand),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(horizontal = spacing.md, vertical = spacing.sm)) {

                    Text(
                        text = stringResource(Res.string.general_summary_title),
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(bottom = spacing.sm)
                    )

                    // Layout adaptativo para estatísticas
                    if (windowSizeClass.isCompact) {
                        // Layout compacto: uma linha
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceAround
                        ) {
                            StatItem("Jogos", statistics.totalGames.toString())
                            StatItem("Gols", statistics.totalGoals.toString())
                            StatItem("Assistências", statistics.totalAssists.toString())
                            StatItem("MVPs", statistics.bestPlayerCount.toString())
                        }
                    } else {
                        // Layout expandido: duas linhas ou grid
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(spacing.md)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceAround
                            ) {
                                StatItemLarge("Jogos", statistics.totalGames.toString())
                                StatItemLarge("Gols", statistics.totalGoals.toString())
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceAround
                            ) {
                                StatItemLarge("Assistências", statistics.totalAssists.toString())
                                StatItemLarge("MVPs", statistics.bestPlayerCount.toString())
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(spacing.md))

                    // Vico Chart - Performance Stats
                    val chartEntryModel = entryModelOf(
                        statistics.totalGoals.toFloat(),
                        statistics.totalAssists.toFloat(),
                        if (statistics.totalSaves > 0) statistics.totalSaves.toFloat() else 0f
                    )

                    val horizontalAxisValueFormatter = AxisValueFormatter<AxisPosition.Horizontal.Bottom> { value, _ ->
                        when (value.toInt()) {
                            0 -> "Gols"
                            1 -> "Assis."
                            2 -> "Defesas"
                            else -> ""
                        }
                    }

                    val chartHeight = adaptiveValue(
                        compact = 200.dp,
                        medium = 250.dp,
                        expanded = 300.dp
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(chartHeight)
                            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(8.dp))
                    ) {
                        Chart(
                            chart = columnChart(),
                            model = chartEntryModel,
                            startAxis = rememberStartAxis(),
                            bottomAxis = rememberBottomAxis(
                                valueFormatter = horizontalAxisValueFormatter
                            ),
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    Spacer(modifier = Modifier.height(spacing.md))
                }
            }
        }
    }
}

@Composable
private fun StatItemLarge(label: String, value: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun StatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
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
