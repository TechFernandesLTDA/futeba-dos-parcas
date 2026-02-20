package com.futebadosparcas.ui.games.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.service.DayAvailability
import com.futebadosparcas.domain.service.TimeSlot
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Mini-calendario visual mostrando disponibilidade de horarios da quadra.
 * Improvement #4 - Visual Conflict Preview.
 */
@Composable
fun AvailabilityCalendar(
    weekAvailability: List<DayAvailability>,
    selectedDate: LocalDate?,
    onDateSelected: (LocalDate) -> Unit,
    modifier: Modifier = Modifier
) {
    if (weekAvailability.isEmpty()) return

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(Res.string.create_game_availability_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            weekAvailability.forEach { dayAvailability ->
                DayColumn(
                    dayAvailability = dayAvailability,
                    isSelected = dayAvailability.date == selectedDate,
                    onClick = { onDateSelected(dayAvailability.date) }
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Legenda
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            LegendItem(
                color = MaterialTheme.colorScheme.primaryContainer,
                label = stringResource(Res.string.create_game_availability_available)
            )
            LegendItem(
                color = MaterialTheme.colorScheme.errorContainer,
                label = stringResource(Res.string.create_game_availability_occupied)
            )
        }
    }
}

@Composable
private fun DayColumn(
    dayAvailability: DayAvailability,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val ptBr = Locale.forLanguageTag("pt-BR")
    val dayName = dayAvailability.date.dayOfWeek.getDisplayName(TextStyle.SHORT, ptBr)
    val dayNumber = dayAvailability.date.dayOfMonth.toString()

    Card(
        modifier = modifier
            .width(56.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected)
                MaterialTheme.colorScheme.primaryContainer
            else
                MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = dayName.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = dayNumber,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = if (isSelected)
                    MaterialTheme.colorScheme.onPrimaryContainer
                else
                    MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Mini indicadores de disponibilidade (horarios das 18h-22h)
            val eveningSlots = dayAvailability.slots.filter { slot ->
                slot.startTime.substringBefore(":").toIntOrNull()?.let { it in 18..22 } == true
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier.padding(top = 4.dp)
            ) {
                eveningSlots.take(5).forEach { slot ->
                    AvailabilityDot(isAvailable = slot.isAvailable)
                }
            }

            if (!dayAvailability.hasAvailableSlots) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .size(16.dp)
                        .padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun AvailabilityDot(
    isAvailable: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(8.dp)
            .clip(CircleShape)
            .background(
                if (isAvailable)
                    MaterialTheme.colorScheme.primary
                else
                    MaterialTheme.colorScheme.error
            )
    )
}

@Composable
private fun LegendItem(
    color: androidx.compose.ui.graphics.Color,
    label: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Card de detalhes de disponibilidade para um dia especifico.
 * Mostra todos os horarios com status.
 */
@Composable
fun DayAvailabilityDetail(
    dayAvailability: DayAvailability,
    onTimeSlotSelected: (TimeSlot) -> Unit,
    modifier: Modifier = Modifier
) {
    val ptBr = remember { Locale.forLanguageTag("pt-BR") }
    val formatter = remember { DateTimeFormatter.ofPattern("EEEE, dd 'de' MMMM", ptBr) }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = dayAvailability.date.format(formatter).replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Grid de horarios (horarios noturnos mais relevantes para pelada)
            val relevantSlots = dayAvailability.slots.filter { slot ->
                slot.startTime.substringBefore(":").toIntOrNull()?.let { it in 17..23 } == true
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                relevantSlots.chunked(3).forEach { rowSlots ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        rowSlots.forEach { slot ->
                            TimeSlotChip(
                                slot = slot,
                                onClick = { if (slot.isAvailable) onTimeSlotSelected(slot) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        // Preencher espacos vazios
                        repeat(3 - rowSlots.size) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TimeSlotChip(
    slot: TimeSlot,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = if (slot.isAvailable)
        MaterialTheme.colorScheme.primaryContainer
    else
        MaterialTheme.colorScheme.errorContainer

    val textColor = if (slot.isAvailable)
        MaterialTheme.colorScheme.onPrimaryContainer
    else
        MaterialTheme.colorScheme.onErrorContainer

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .clickable(enabled = slot.isAvailable, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = slot.startTime,
            style = MaterialTheme.typography.labelMedium,
            color = textColor,
            textAlign = TextAlign.Center
        )
    }
}
