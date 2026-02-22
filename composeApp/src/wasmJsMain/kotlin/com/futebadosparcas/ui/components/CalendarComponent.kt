package com.futebadosparcas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class CalendarDay(
    val date: String,
    val dayOfMonth: Int,
    val isCurrentMonth: Boolean,
    val isToday: Boolean,
    val hasGames: Boolean
)

data class CalendarMonth(
    val year: Int,
    val month: Int,
    val days: List<CalendarDay>
)

private external fun jsGetCurrentYear(): Int
private external fun jsGetCurrentMonth(): Int
private external fun jsGetDaysInMonth(year: Int, month: Int): Int
private external fun jsGetFirstDayOfMonth(year: Int, month: Int): Int
private external fun jsGetDayOfMonth(): Int

fun getCurrentDateFormatted(): String {
    val year = jsGetCurrentYear()
    val month = jsGetCurrentMonth()
    val day = jsGetDayOfMonth()
    return "${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}"
}

@Composable
fun CalendarComponent(
    selectedDate: String,
    onDateSelected: (String) -> Unit,
    datesWithGames: Set<String>,
    modifier: Modifier = Modifier
) {
    var currentYear by remember { mutableStateOf(jsGetCurrentYear()) }
    var currentMonth by remember { mutableStateOf(jsGetCurrentMonth()) }

    val today = remember {
        val year = jsGetCurrentYear()
        val month = jsGetCurrentMonth()
        val day = jsGetDayOfMonth()
        "${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}"
    }

    val calendarMonth = remember(currentYear, currentMonth) {
        generateCalendarMonth(currentYear, currentMonth, today, datesWithGames)
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            CalendarHeader(
                year = currentYear,
                month = currentMonth,
                onPreviousMonth = {
                    if (currentMonth == 1) {
                        currentMonth = 12
                        currentYear--
                    } else {
                        currentMonth--
                    }
                },
                onNextMonth = {
                    if (currentMonth == 12) {
                        currentMonth = 1
                        currentYear++
                    } else {
                        currentMonth++
                    }
                }
            )

            Spacer(modifier = Modifier.height(12.dp))

            WeekDaysHeader()

            Spacer(modifier = Modifier.height(8.dp))

            CalendarGrid(
                calendarMonth = calendarMonth,
                selectedDate = selectedDate,
                onDateSelected = onDateSelected
            )
        }
    }
}

@Composable
private fun CalendarHeader(
    year: Int,
    month: Int,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit
) {
    val monthNames = listOf(
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onPreviousMonth) {
            Text("◀️", fontSize = 20.sp)
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = monthNames.getOrElse(month - 1) { "Mês" },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = year.toString(),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        IconButton(onClick = onNextMonth) {
            Text("▶️", fontSize = 20.sp)
        }
    }
}

@Composable
private fun WeekDaysHeader() {
    val weekDays = listOf("Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb")

    Row(modifier = Modifier.fillMaxWidth()) {
        weekDays.forEach { day ->
            Box(
                modifier = Modifier.weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = day,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CalendarGrid(
    calendarMonth: CalendarMonth,
    selectedDate: String,
    onDateSelected: (String) -> Unit
) {
    val rows = calendarMonth.days.chunked(7)

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        rows.forEach { week ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                week.forEach { day ->
                    DayCell(
                        day = day,
                        isSelected = day.date == selectedDate,
                        onClick = { onDateSelected(day.date) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    day: CalendarDay,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when {
        isSelected -> MaterialTheme.colorScheme.primary
        day.isToday -> MaterialTheme.colorScheme.primaryContainer
        !day.isCurrentMonth -> Color.Transparent
        else -> Color.Transparent
    }

    val textColor = when {
        isSelected -> MaterialTheme.colorScheme.onPrimary
        day.isToday -> MaterialTheme.colorScheme.onPrimaryContainer
        !day.isCurrentMonth -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
        else -> MaterialTheme.colorScheme.onSurface
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(CircleShape)
            .background(backgroundColor)
            .clickable(enabled = day.isCurrentMonth) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = day.dayOfMonth.toString(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (day.isToday || isSelected) FontWeight.Bold else FontWeight.Normal,
                color = textColor,
                textAlign = TextAlign.Center
            )

            if (day.hasGames) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(
                            if (isSelected) MaterialTheme.colorScheme.onPrimary
                            else MaterialTheme.colorScheme.primary
                        )
                )
            } else {
                Spacer(modifier = Modifier.size(6.dp))
            }
        }
    }
}

private fun generateCalendarMonth(
    year: Int,
    month: Int,
    today: String,
    datesWithGames: Set<String>
): CalendarMonth {
    val daysInMonth = jsGetDaysInMonth(year, month)
    val firstDayOfWeek = jsGetFirstDayOfMonth(year, month)

    val todayParts = today.split("-")
    val todayYear = todayParts.getOrNull(0)?.toIntOrNull() ?: 0
    val todayMonth = todayParts.getOrNull(1)?.toIntOrNull() ?: 0
    val todayDay = todayParts.getOrNull(2)?.toIntOrNull() ?: 0

    val days = mutableListOf<CalendarDay>()

    val prevMonth = if (month == 1) 12 else month - 1
    val prevYear = if (month == 1) year - 1 else year
    val daysInPrevMonth = jsGetDaysInMonth(prevYear, prevMonth)

    for (i in firstDayOfWeek - 1 downTo 0) {
        val dayOfMonth = daysInPrevMonth - i + 1
        val date = formatDate(prevYear, prevMonth, dayOfMonth)
        days.add(
            CalendarDay(
                date = date,
                dayOfMonth = dayOfMonth,
                isCurrentMonth = false,
                isToday = false,
                hasGames = date in datesWithGames
            )
        )
    }

    for (dayOfMonth in 1..daysInMonth) {
        val date = formatDate(year, month, dayOfMonth)
        val isToday = year == todayYear && month == todayMonth && dayOfMonth == todayDay
        days.add(
            CalendarDay(
                date = date,
                dayOfMonth = dayOfMonth,
                isCurrentMonth = true,
                isToday = isToday,
                hasGames = date in datesWithGames
            )
        )
    }

    val remainingDays = 42 - days.size
    val nextMonth = if (month == 12) 1 else month + 1
    val nextYear = if (month == 12) year + 1 else year

    for (dayOfMonth in 1..remainingDays) {
        val date = formatDate(nextYear, nextMonth, dayOfMonth)
        days.add(
            CalendarDay(
                date = date,
                dayOfMonth = dayOfMonth,
                isCurrentMonth = false,
                isToday = false,
                hasGames = date in datesWithGames
            )
        )
    }

    return CalendarMonth(year = year, month = month, days = days)
}

private fun formatDate(year: Int, month: Int, day: Int): String {
    val monthStr = month.toString().padStart(2, '0')
    val dayStr = day.toString().padStart(2, '0')
    return "$year-$monthStr-$dayStr"
}
