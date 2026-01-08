package com.futebadosparcas.ui.schedules

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.data.model.Schedule

private const val TAG = "ComposeScheduleDialogs"

/**
 * Dialog para editar um agendamento recorrente.
 *
 * NOTA: Esta função Compose exibe a UI, mas o MaterialTimePicker requer FragmentManager.
 * Para usá-la corretamente, chame-a de um contexto que tenha acesso a supportFragmentManager
 * e implemente a lógica de time picker no Fragment/ViewModel que exibe este dialog.
 *
 * @param schedule Agendamento a ser editado
 * @param onDismiss Callback quando o dialog é dismissido
 * @param onSave Callback quando o usuário salva as alterações
 * @param onTimePickerClick Callback quando o usuário quer selecionar o horário (necessário implementar no Fragment)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditScheduleDialog(
    schedule: Schedule,
    onDismiss: () -> Unit,
    onSave: (Schedule) -> Unit,
    onTimePickerClick: ((currentTime: String) -> Unit)? = null
) {
    var name by remember { mutableStateOf(schedule.name) }
    var time by remember { mutableStateOf(schedule.time) }
    var selectedDayOfWeek by remember { mutableStateOf(schedule.dayOfWeek) }
    var selectedRecurrenceType by remember { mutableStateOf(schedule.recurrenceType) }
    var showTimeError by remember { mutableStateOf(false) }
    var showNameError by remember { mutableStateOf(false) }

    val days = arrayOf(
        "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado"
    )
    val recurrenceOptions = listOf(
        RecurrenceType.weekly to "Semanal",
        RecurrenceType.biweekly to "Quinzenal",
        RecurrenceType.monthly to "Mensal"
    )

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
                    text = "Editar Agendamento",
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
                    label = { Text("Nome") },
                    singleLine = true,
                    isError = showNameError,
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = if (showNameError) {
                        { Text("Campo obrigatório", color = MaterialTheme.colorScheme.error) }
                    } else null
                )

                // Horário
                OutlinedTextField(
                    value = time,
                    onValueChange = {},
                    label = { Text("Horário") },
                    singleLine = true,
                    readOnly = true,
                    trailingIcon = { Icon(Icons.Default.AccessTime, null) },
                    isError = showTimeError,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (onTimePickerClick != null) {
                                onTimePickerClick(time)
                            } else {
                                showTimeError = true
                            }
                        },
                    enabled = false,
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                        disabledBorderColor = MaterialTheme.colorScheme.outline,
                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    supportingText = if (showTimeError) {
                        { Text("Campo obrigatório", color = MaterialTheme.colorScheme.error) }
                    } else null
                )

                // Day of Week Dropdown
                var expandedDay by remember { mutableStateOf(false) }
                Box {
                    OutlinedTextField(
                        value = days.getOrNull(selectedDayOfWeek) ?: "Domingo",
                        onValueChange = {},
                        label = { Text("Dia da Semana") },
                        readOnly = true,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { expandedDay = true },
                        enabled = false,
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
                        value = recurrenceOptions.find { it.first == selectedRecurrenceType }?.second ?: "Semanal",
                        onValueChange = {},
                        label = { Text("Frequência") },
                        readOnly = true,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { expandedRecurrence = true },
                        enabled = false,
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
                        Text("Cancelar")
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            // Validação
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
                        enabled = name.isNotBlank()
                    ) {
                        Text("Salvar")
                    }
                }
            }
        }
    }
}
