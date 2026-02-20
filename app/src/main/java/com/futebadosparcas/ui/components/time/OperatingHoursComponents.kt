package com.futebadosparcas.ui.components.time
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.util.LocationTimeFormatter
import com.futebadosparcas.util.PreferencesManager
import java.util.Locale

/**
 * Composable para exibir um horario formatado de acordo com o locale do usuario.
 *
 * @param time Horario no formato 24h (ex: "08:00", "14:30")
 * @param modifier Modifier para customizacao
 * @param style TextStyle para o texto
 * @param showIcon Se deve exibir icone de relogio
 */
@Composable
fun FormattedTime(
    time: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
    showIcon: Boolean = false
) {
    val context = LocalContext.current
    val formattedTime = remember(time) {
        LocationTimeFormatter.formatTime(time, context)
    }

    if (showIcon) {
        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = Icons.Default.AccessTime,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = formattedTime,
                style = style,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    } else {
        Text(
            text = formattedTime,
            style = style,
            modifier = modifier,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

/**
 * Composable para exibir um range de horarios formatado.
 *
 * @param openingTime Horario de abertura no formato 24h
 * @param closingTime Horario de fechamento no formato 24h
 * @param modifier Modifier para customizacao
 * @param style TextStyle para o texto
 * @param showIcon Se deve exibir icone de relogio
 */
@Composable
fun FormattedTimeRange(
    openingTime: String,
    closingTime: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
    showIcon: Boolean = false
) {
    val context = LocalContext.current
    val formattedRange = remember(openingTime, closingTime) {
        LocationTimeFormatter.formatTimeRange(openingTime, closingTime, context)
    }

    if (showIcon) {
        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = Icons.Default.AccessTime,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = formattedRange,
                style = style,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    } else {
        Text(
            text = formattedRange,
            style = style,
            modifier = modifier,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

/**
 * Composable para exibir horarios de funcionamento completos de um local.
 * Inclui dias de operacao e horarios de abertura/fechamento.
 *
 * @param openingTime Horario de abertura no formato 24h
 * @param closingTime Horario de fechamento no formato 24h
 * @param operatingDays Lista de dias de operacao (1 = Domingo, ..., 7 = Sabado)
 * @param modifier Modifier para customizacao
 * @param compact Se true, exibe em layout mais compacto (uma linha)
 */
@Composable
fun OperatingHoursDisplay(
    openingTime: String,
    closingTime: String,
    operatingDays: List<Int>,
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    val context = LocalContext.current
    val locale = Locale.getDefault()

    val formattedTime = remember(openingTime, closingTime) {
        LocationTimeFormatter.formatTimeRange(openingTime, closingTime, context)
    }

    val formattedDays = remember(operatingDays) {
        LocationTimeFormatter.formatOperatingDays(operatingDays, locale)
    }

    if (compact) {
        // Layout compacto: tudo em uma linha
        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.AccessTime,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "$formattedDays $formattedTime",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    } else {
        // Layout completo: card com informacoes detalhadas
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Dias de operacao
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CalendarToday,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = formattedDays,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            // Horarios
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.AccessTime,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = formattedTime,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

/**
 * Card para exibir horarios de funcionamento em destaque.
 * Ideal para uso em telas de detalhes de local.
 *
 * @param openingTime Horario de abertura no formato 24h
 * @param closingTime Horario de fechamento no formato 24h
 * @param operatingDays Lista de dias de operacao
 * @param modifier Modifier para customizacao
 */
@Composable
fun OperatingHoursCard(
    openingTime: String,
    closingTime: String,
    operatingDays: List<Int>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(Res.string.location_time_operating_hours),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            OperatingHoursDisplay(
                openingTime = openingTime,
                closingTime = closingTime,
                operatingDays = operatingDays
            )
        }
    }
}

/**
 * Chip compacto para exibir horarios de funcionamento.
 * Ideal para uso em listas e cards resumidos.
 *
 * @param openingTime Horario de abertura no formato 24h
 * @param closingTime Horario de fechamento no formato 24h
 * @param modifier Modifier para customizacao
 */
@Composable
fun OperatingHoursChip(
    openingTime: String,
    closingTime: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val formattedTime = remember(openingTime, closingTime) {
        LocationTimeFormatter.formatTimeRange(openingTime, closingTime, context)
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.AccessTime,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = formattedTime,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Status indicator para mostrar se o local esta aberto ou fechado.
 * Calcula baseado no horario atual e horarios de operacao.
 *
 * @param openingTime Horario de abertura no formato 24h
 * @param closingTime Horario de fechamento no formato 24h
 * @param operatingDays Lista de dias de operacao
 * @param modifier Modifier para customizacao
 */
@Composable
fun OpenStatusIndicator(
    openingTime: String,
    closingTime: String,
    operatingDays: List<Int>,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isOpen = remember(openingTime, closingTime, operatingDays) {
        isLocationCurrentlyOpen(openingTime, closingTime, operatingDays)
    }

    val statusText = if (isOpen) {
        stringResource(Res.string.location_time_open_now)
    } else {
        stringResource(Res.string.location_time_closed)
    }

    val statusColor = if (isOpen) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.error
    }

    Text(
        text = statusText,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        color = statusColor,
        modifier = modifier
    )
}

/**
 * Verifica se o local esta atualmente aberto.
 */
private val TIME_FORMATTER = java.time.format.DateTimeFormatter.ofPattern("HH:mm")

private fun isLocationCurrentlyOpen(
    openingTime: String,
    closingTime: String,
    operatingDays: List<Int>
): Boolean {
    return try {
        val now = java.time.LocalTime.now()
        val today = java.time.LocalDate.now().dayOfWeek.value
        // Converte DayOfWeek (1=Mon) para nosso formato (1=Sun)
        val todayOurFormat = if (today == 7) 1 else today + 1

        // Verifica se hoje e dia de operacao
        if (todayOurFormat !in operatingDays) return false

        val opening = java.time.LocalTime.parse(openingTime, TIME_FORMATTER)
        val closing = java.time.LocalTime.parse(closingTime, TIME_FORMATTER)

        // Verifica se horario atual esta dentro do range
        now.isAfter(opening) && now.isBefore(closing)
    } catch (e: Exception) {
        false
    }
}
