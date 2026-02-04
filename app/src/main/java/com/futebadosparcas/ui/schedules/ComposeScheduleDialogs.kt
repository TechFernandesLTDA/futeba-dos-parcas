package com.futebadosparcas.ui.schedules

import androidx.compose.foundation.clickable
import com.futebadosparcas.ui.games.TimePickerDialog
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.R
import java.time.LocalTime

import com.futebadosparcas.util.AppLogger
import java.util.Date

private const val TAG = "ComposeScheduleDialogs"

/**
 * Dialog para criar um novo agendamento recorrente.
 *
 * CMD-09: Adicionado para suportar criação de horários via FAB.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateScheduleDialog(
    onDismiss: () -> Unit,
    onCreate: (Schedule) -> Unit,
    userId: String,
    userName: String
) {
    var name by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("19:00") }
    var selectedDayOfWeek by remember { mutableIntStateOf(0) }
    var selectedRecurrenceType by remember { mutableStateOf(RecurrenceType.weekly) }
    var showTimeError by remember { mutableStateOf(false) }
    var showNameError by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val context = LocalContext.current

    val initialTime = remember(time) {
        try {
            val parts = time.split(":")
            if (parts.size == 2) {
                LocalTime.of(parts[0].toIntOrNull() ?: 19, parts[1].toIntOrNull() ?: 0)
            } else {
                LocalTime.of(19, 0)
            }
        } catch (e: Exception) {
            LocalTime.of(19, 0)
        }
    }

    val days = getDaysOfWeek()
    val recurrenceOptions = getRecurrenceOptions()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.95f),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Title
                Text(
                    text = stringResource(R.string.schedules_new_schedule),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                // Nome
                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        showNameError = false
                    },
                    label = { Text(stringResource(R.string.schedules_name_optional)) },
                    singleLine = true,
                    isError = showNameError,
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = if (showNameError) {
                        { Text(stringResource(R.string.schedules_required_field), color = MaterialTheme.colorScheme.error) }
                    } else null
                )

                // Horario
                OutlinedTextField(
                    value = if (time.isEmpty()) "--:--" else time,
                    onValueChange = {},
                    label = { Text(stringResource(R.string.schedules_time_hint)) },
                    singleLine = true,
                    readOnly = true,
                    enabled = false,
                    trailingIcon = { Icon(Icons.Default.AccessTime, null) },
                    isError = showTimeError,
                    modifier = Modifier
                        .clickable {
                            showTimePicker = true
                        }
                        .fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                        disabledBorderColor = MaterialTheme.colorScheme.outline,
                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    supportingText = if (showTimeError) {
                        { Text(stringResource(R.string.schedules_required_field), color = MaterialTheme.colorScheme.error) }
                    } else if (time.isEmpty()) {
                        { Text(stringResource(R.string.schedules_tap_to_set_time), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    } else null
                )

                // Day of Week Dropdown
                var expandedDay by remember { mutableStateOf(false) }
                Box {
                    OutlinedTextField(
                        value = days.getOrNull(selectedDayOfWeek) ?: stringResource(R.string.schedules_day_sunday),
                        onValueChange = {},
                        label = { Text(stringResource(R.string.schedules_day_of_week)) },
                        readOnly = true,
                        enabled = false,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier
                            .clickable { expandedDay = true }
                            .fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = MaterialTheme.colorScheme.onSurface,
                            disabledBorderColor = MaterialTheme.colorScheme.outline,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )

                    DropdownMenu(
                        expanded = expandedDay,
                        onDismissRequest = { expandedDay = false }
                    ) {
                        days.forEachIndexed { index, day ->
                            DropdownMenuItem(
                                text = { Text(day) },
                                onClick = {
                                    selectedDayOfWeek = index
                                    expandedDay = false
                                }
                            )
                        }
                    }
                }

                // Recurrence Frequency Dropdown
                var expandedRecurrence by remember { mutableStateOf(false) }
                Box {
                    OutlinedTextField(
                        value = recurrenceOptions.find { it.first == selectedRecurrenceType }?.second ?: stringResource(R.string.schedules_recurrence_weekly),
                        onValueChange = {},
                        label = { Text(stringResource(R.string.schedules_frequency_hint)) },
                        readOnly = true,
                        enabled = false,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier
                            .clickable { expandedRecurrence = true }
                            .fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = MaterialTheme.colorScheme.onSurface,
                            disabledBorderColor = MaterialTheme.colorScheme.outline,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )

                    DropdownMenu(
                        expanded = expandedRecurrence,
                        onDismissRequest = { expandedRecurrence = false }
                    ) {
                        recurrenceOptions.forEach { (type, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    selectedRecurrenceType = type
                                    expandedRecurrence = false
                                }
                            )
                        }
                    }
                }

                // Info text sobre local
                Text(
                    text = stringResource(R.string.schedules_note),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Action Buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.schedules_cancel))
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            showNameError = name.isBlank()
                            showTimeError = time.isBlank()

                            if (!showTimeError) {
                                val newSchedule = Schedule(
                                    ownerId = userId,
                                    ownerName = userName,
                                    name = name.ifBlank { context.getString(R.string.schedules_unnamed_schedule) },
                                    time = time,
                                    dayOfWeek = selectedDayOfWeek,
                                    recurrenceType = selectedRecurrenceType,
                                    createdAt = Date()
                                )
                                AppLogger.d(TAG) { context.getString(R.string.schedules_create_content, newSchedule.name) }
                                onCreate(newSchedule)
                            }
                        },
                        enabled = time.isNotBlank()
                    ) {
                        Text(stringResource(R.string.schedules_create))
                    }
                }
            }
        }
    }

    // Time Picker Dialog
    if (showTimePicker) {
        TimePickerDialog(
            title = stringResource(R.string.schedules_select_time),
            onDismiss = { showTimePicker = false },
            onTimeSelected = { hour, minute ->
                time = String.format("%02d:%02d", hour, minute)
                showTimePicker = false
                showTimeError = false
            },
            initialTime = initialTime
        )
    }
}

private const val TAG_EDIT = "EditScheduleDialog"

/**
 * Dialog para editar um agendamento recorrente com TimePicker integrado.
 *
 * @param schedule Agendamento a ser editado
 * @param onDismiss Callback quando o dialog e dismissido
 * @param onSave Callback quando o usuario salva as alteracoes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditScheduleDialog(
    schedule: Schedule,
    onDismiss: () -> Unit,
    onSave: (Schedule) -> Unit
) {
    var name by remember { mutableStateOf(schedule.name) }
    var time by remember { mutableStateOf(schedule.time) }
    var selectedDayOfWeek by remember { mutableIntStateOf(schedule.dayOfWeek) }
    var selectedRecurrenceType by remember { mutableStateOf(schedule.recurrenceType) }
    var showTimeError by remember { mutableStateOf(false) }
    var showNameError by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // Parse initial time or use default 19:00
    val initialTime = remember(time) {
        try {
            if (time.isNotEmpty()) {
                val parts = time.split(":")
                if (parts.size == 2) {
                    LocalTime.of(parts[0].toIntOrNull() ?: 19, parts[1].toIntOrNull() ?: 0)
                } else {
                    LocalTime.of(19, 0)
                }
            } else {
                LocalTime.of(19, 0)
            }
        } catch (e: Exception) {
            LocalTime.of(19, 0)
        }
    }

    val days = getDaysOfWeek()
    val recurrenceOptions = getRecurrenceOptions()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.95f),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Title
                Text(
                    text = stringResource(R.string.schedules_edit_schedule),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                // Nome
                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        showNameError = false
                    },
                    label = { Text(stringResource(R.string.schedules_name_optional)) },
                    singleLine = true,
                    isError = showNameError,
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = if (showNameError) {
                        { Text(stringResource(R.string.schedules_required_field), color = MaterialTheme.colorScheme.error) }
                    } else null
                )

                // Horario - Agora funcional com time picker integrado
                OutlinedTextField(
                    value = if (time.isEmpty()) "--:--" else time,
                    onValueChange = {},
                    label = { Text(stringResource(R.string.schedules_time_hint)) },
                    singleLine = true,
                    readOnly = true,
                    enabled = false,
                    trailingIcon = { Icon(Icons.Default.AccessTime, null) },
                    isError = showTimeError,
                    modifier = Modifier
                        .clickable {
                            showTimePicker = true
                        }
                        .fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                        disabledBorderColor = MaterialTheme.colorScheme.outline,
                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    supportingText = if (showTimeError) {
                        { Text(stringResource(R.string.schedules_required_field), color = MaterialTheme.colorScheme.error) }
                    } else if (time.isEmpty()) {
                        { Text(stringResource(R.string.schedules_tap_to_set_time), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    } else null
                )

                // Day of Week Dropdown
                var expandedDay by remember { mutableStateOf(false) }
                Box {
                    OutlinedTextField(
                        value = days.getOrNull(selectedDayOfWeek) ?: stringResource(R.string.schedules_day_sunday),
                        onValueChange = {},
                        label = { Text(stringResource(R.string.schedules_day_of_week)) },
                        readOnly = true,
                        enabled = false,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier
                            .clickable { expandedDay = true }
                            .fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = MaterialTheme.colorScheme.onSurface,
                            disabledBorderColor = MaterialTheme.colorScheme.outline,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )

                    DropdownMenu(
                        expanded = expandedDay,
                        onDismissRequest = { expandedDay = false }
                    ) {
                        days.forEachIndexed { index, day ->
                            DropdownMenuItem(
                                text = { Text(day) },
                                onClick = {
                                    selectedDayOfWeek = index
                                    expandedDay = false
                                }
                            )
                        }
                    }
                }

                // Recurrence Frequency Dropdown
                var expandedRecurrence by remember { mutableStateOf(false) }
                Box {
                    OutlinedTextField(
                        value = recurrenceOptions.find { it.first == selectedRecurrenceType }?.second ?: stringResource(R.string.schedules_recurrence_weekly),
                        onValueChange = {},
                        label = { Text(stringResource(R.string.schedules_frequency_hint)) },
                        readOnly = true,
                        enabled = false,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier
                            .clickable { expandedRecurrence = true }
                            .fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = MaterialTheme.colorScheme.onSurface,
                            disabledBorderColor = MaterialTheme.colorScheme.outline,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )

                    DropdownMenu(
                        expanded = expandedRecurrence,
                        onDismissRequest = { expandedRecurrence = false }
                    ) {
                        recurrenceOptions.forEach { (type, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    selectedRecurrenceType = type
                                    expandedRecurrence = false
                                }
                            )
                        }
                    }
                }

                // Action Buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.schedules_cancel))
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            // Validacao
                            showNameError = name.isBlank()
                            showTimeError = time.isBlank()

                            if (!showNameError && !showTimeError) {
                                val updatedSchedule = schedule.copy(
                                    name = name,
                                    time = time,
                                    dayOfWeek = selectedDayOfWeek,
                                    recurrenceType = selectedRecurrenceType
                                )
                                onSave(updatedSchedule)
                                onDismiss()
                            }
                        },
                        enabled = name.isNotBlank() && time.isNotBlank()
                    ) {
                        Text(stringResource(R.string.schedules_save))
                    }
                }
            }
        }
    }

    // Time Picker Dialog
    if (showTimePicker) {
        TimePickerDialog(
            title = stringResource(R.string.schedules_select_time),
            onDismiss = { showTimePicker = false },
            onTimeSelected = { hour, minute ->
                time = String.format("%02d:%02d", hour, minute)
                showTimePicker = false
                showTimeError = false
            },
            initialTime = initialTime
        )
    }
}

/**
 * Helper function para obter lista de dias da semana
 */
@Composable
private fun getDaysOfWeek(): Array<String> {
    return arrayOf(
        stringResource(R.string.schedules_day_sunday),
        stringResource(R.string.schedules_day_monday),
        stringResource(R.string.schedules_day_tuesday),
        stringResource(R.string.schedules_day_wednesday),
        stringResource(R.string.schedules_day_thursday),
        stringResource(R.string.schedules_day_friday),
        stringResource(R.string.schedules_day_saturday)
    )
}

/**
 * Helper function para obter lista de opções de recorrência
 */
@Composable
private fun getRecurrenceOptions(): List<Pair<RecurrenceType, String>> {
    return listOf(
        RecurrenceType.weekly to stringResource(R.string.schedules_recurrence_weekly),
        RecurrenceType.biweekly to stringResource(R.string.schedules_recurrence_biweekly),
        RecurrenceType.monthly to stringResource(R.string.schedules_recurrence_monthly)
    )
}
