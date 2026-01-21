package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Activity
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.adaptive.rememberAdaptiveSpacing
import com.futebadosparcas.ui.adaptive.adaptiveValue
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@Composable
fun ActivityHeatmapSection(
    activities: List<Activity>,
    modifier: Modifier = Modifier
) {
    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(spacing.md)) {
            Text(
                text = stringResource(R.string.game_frequency_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = spacing.gridItemSpacing)
            )

            // Mais semanas em telas grandes
            val weeksToShow = adaptiveValue(
                compact = 12,
                medium = 16,
                expanded = 20
            )

            HeatmapGrid(activities = activities, weeksToShow = weeksToShow, spacing = spacing)
        }
    }
}

@Composable
fun HeatmapGrid(
    activities: List<Activity>,
    weeksToShow: Int = 12,
    spacing: com.futebadosparcas.ui.adaptive.AdaptiveSpacing
) {
    val today = java.time.LocalDate.now()
    val daysToShow = weeksToShow * 7

    // Prepare data
    val activityCounts = remember(activities) {
        val counts = mutableMapOf<java.time.LocalDate, Int>()
        activities.forEach { activity ->
            activity.createdAt?.let { date ->
                try {
                    val localDate = date.toInstant()
                        .atZone(java.time.ZoneId.systemDefault())
                        .toLocalDate()
                    counts[localDate] = (counts[localDate] ?: 0) + 1
                } catch (e: Exception) {
                    // Handle conversion error or legacy date
                }
            }
        }
        counts
    }

    // Tamanho adaptativo das células
    val cellSize = when {
        weeksToShow <= 12 -> 12.dp
        weeksToShow <= 16 -> 10.dp
        else -> 8.dp
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Iterate weeks (columns)
        for (week in 0 until weeksToShow) {
            Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                // Iterate days (rows)
                for (day in 0 until 7) {
                    // Calculate date for this cell
                    // Determine start date of the grid (Sunday of weeksToShow weeks ago)
                    val startDate = today.minusWeeks(weeksToShow.toLong()).with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.SUNDAY))
                    val cellDate = startDate.plusWeeks(week.toLong()).plusDays(day.toLong())

                    val count = activityCounts[cellDate] ?: 0
                    HeatmapCell(count = count, size = cellSize)
                }
            }
        }
    }
}

@Composable
fun HeatmapCell(count: Int, size: androidx.compose.ui.unit.Dp = 12.dp) {
    val color = when {
        count == 0 -> MaterialTheme.colorScheme.surfaceVariant
        count < 2 -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.primary
    }

    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(2.dp))
            .background(color)
    )
}
