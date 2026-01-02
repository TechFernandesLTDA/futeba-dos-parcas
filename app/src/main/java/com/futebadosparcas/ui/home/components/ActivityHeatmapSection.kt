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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.data.model.Activity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@Composable
fun ActivityHeatmapSection(
    activities: List<Activity>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Frequência de Jogos",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // Mock implementation for visual structure
            // In a real scenario, we map activities to dates.
            // For now, drawing a static grid representing the last 12 weeks.
            HeatmapGrid(activities)
        }
    }
}

@Composable
fun HeatmapGrid(activities: List<Activity>) {
    val today = java.time.LocalDate.now()
    // Show last 12 weeks
    val weeksToShow = 12
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

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Iterate weeks (columns)
        for (week in 0 until weeksToShow) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                // Iterate days (rows)
                for (day in 0 until 7) {
                    // Calculate date for this cell
                    // Start from: (Today - (12 weeks * 7 days)) + (week * 7) + day
                    // This is naive. Better to align columns by week start?
                    // GitHub style: Columns are weeks. Rows are Mon, Tue, Wed...
                    // Let's simplified: Column 0 is Oldest week. 
                    // To do it right, we need `startDate`.
                    
                    // Simple approach:
                    // Determine start date of the grid (Sunday of 12 weeks ago)
                    val startDate = today.minusWeeks(weeksToShow.toLong()).with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.SUNDAY))
                    val cellDate = startDate.plusWeeks(week.toLong()).plusDays(day.toLong())
                    
                    val count = activityCounts[cellDate] ?: 0
                    HeatmapCell(count)
                }
            }
        }
    }
}

@Composable
fun HeatmapCell(count: Int) {
    val color = when {
        count == 0 -> MaterialTheme.colorScheme.surfaceVariant
        count < 2 -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.primary
    }

    Box(
        modifier = Modifier
            .size(12.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(color)
    )
}
