package com.futebadosparcas.ui.games

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import java.time.LocalDate
import java.time.LocalTime
import java.util.*
import kotlinx.coroutines.delay

/**
 * Dialog moderno de seleção de data usando Material3 DatePicker
 * Preparado para KMP/iOS
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerDialog(
    onDismiss: () -> Unit,
    onDateSelected: (year: Int, month: Int, day: Int) -> Unit,
    initialDate: LocalDate? = null
) {
    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = initialDate?.let {
            // Converter LocalDate para millis UTC
            Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                set(it.year, it.monthValue - 1, it.dayOfMonth, 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        } ?: System.currentTimeMillis()
    )

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
                        calendar.timeInMillis = millis
                        onDateSelected(
                            calendar.get(Calendar.YEAR),
                            calendar.get(Calendar.MONTH),
                            calendar.get(Calendar.DAY_OF_MONTH)
                        )
                    }
                }
            ) {
                Text(stringResource(R.string.dialog_confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    ) {
        DatePicker(
            state = datePickerState,
            title = {
                Text(
                    text = stringResource(R.string.fragment_create_game_hint_13),
                    modifier = Modifier.padding(start = 24.dp, top = 16.dp)
                )
            }
        )
    }
}

/**
 * Dialog moderno de seleção de horário usando Material3 TimePicker
 * Com alternância entre modo relógio e teclado para melhor UX
 * Preparado para KMP/iOS
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerDialog(
    title: String,
    onDismiss: () -> Unit,
    onTimeSelected: (hour: Int, minute: Int) -> Unit,
    initialTime: LocalTime? = null
) {
    // Estado mutavel para permitir quick select
    var selectedHour by remember { mutableIntStateOf(initialTime?.hour ?: 19) }
    var selectedMinute by remember { mutableIntStateOf(initialTime?.minute ?: 0) }
    var showInputMode by remember { mutableStateOf(false) }
    // Chave para recriar o state quando usar quick select
    var stateKey by remember { mutableIntStateOf(0) }

    // Recriar o state quando mudar via quick select usando key
    val timePickerState = key(stateKey) {
        rememberTimePickerState(
            initialHour = selectedHour,
            initialMinute = selectedMinute,
            is24Hour = true
        )
    }

    // Sincronizar quando o usuario usa o time picker
    LaunchedEffect(timePickerState.hour, timePickerState.minute) {
        selectedHour = timePickerState.hour
        selectedMinute = timePickerState.minute
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Medium
                )
                IconButton(onClick = { showInputMode = !showInputMode }) {
                    Icon(
                        imageVector = if (showInputMode) Icons.Default.AccessTime else Icons.Default.Keyboard,
                        contentDescription = stringResource(R.string.time_picker_toggle_mode),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Preview do horário selecionado
                Text(
                    text = String.format("%02d:%02d", selectedHour, selectedMinute),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (showInputMode) {
                        TimeInput(
                            state = timePickerState
                        )
                    } else {
                        TimePicker(
                            state = timePickerState,
                            colors = TimePickerDefaults.colors(
                                clockDialColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                                selectorColor = MaterialTheme.colorScheme.primary,
                                containerColor = MaterialTheme.colorScheme.surface,
                                timeSelectorSelectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                                timeSelectorUnselectedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh
                            )
                        )
                    }
                }

                // Sugestões de horário comum para pelada
                Text(
                    text = stringResource(R.string.time_picker_suggestions),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
                ) {
                    TimeQuickSelectChip("18:00", 18, 0, timePickerState) { h, m ->
                        selectedHour = h
                        selectedMinute = m
                        stateKey++
                    }
                    TimeQuickSelectChip("19:00", 19, 0, timePickerState) { h, m ->
                        selectedHour = h
                        selectedMinute = m
                        stateKey++
                    }
                    TimeQuickSelectChip("20:00", 20, 0, timePickerState) { h, m ->
                        selectedHour = h
                        selectedMinute = m
                        stateKey++
                    }
                    TimeQuickSelectChip("21:00", 21, 0, timePickerState) { h, m ->
                        selectedHour = h
                        selectedMinute = m
                        stateKey++
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onTimeSelected(selectedHour, selectedMinute)
                }
            ) {
                Text(stringResource(R.string.dialog_confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

/**
 * Chip de seleção rápida de horário.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeQuickSelectChip(
    label: String,
    hour: Int,
    minute: Int,
    state: TimePickerState,
    onSelect: (Int, Int) -> Unit
) {
    val isSelected = state.hour == hour && state.minute == minute

    FilterChip(
        selected = isSelected,
        onClick = { onSelect(hour, minute) },
        label = {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium
            )
        },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}
