package com.futebadosparcas.ui.schedules
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import com.futebadosparcas.util.AppLogger
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.domain.model.Schedule
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType

private const val TAG = "SchedulesScreen"

/**
 * SchedulesScreen - Lista de Horários Recorrentes
 *
 * Permite:
 * - Visualizar lista de horários recorrentes
 * - Criar novo horário recorrente
 * - Editar horário existente
 * - Deletar horário (com confirmação)
 *
 * Features:
 * - LazyColumn para lista de schedules
 * - Dialog de edição/criação (ComposeScheduleDialogs)
 * - Dialog de confirmação de exclusão
 * - Estados: Loading, Success (lista), Empty (sem schedules), Error
 *
 * CMD-08: Debug de filtro vazio com logs aprimorados
 * CMD-09: EmptyState padrão Material3 com CTA
 */
@Composable
fun SchedulesScreen(
    viewModel: SchedulesViewModel
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var currentUserName by remember { mutableStateOf("") }

    // Carrega o nome do usuario
    LaunchedEffect(Unit) {
        currentUserName = viewModel.getCurrentUserName()
    }

    var showCreateDialog by remember { mutableStateOf(false) }
    var scheduleToEdit by remember { mutableStateOf<Schedule?>(null) }
    var scheduleToDelete by remember { mutableStateOf<String?>(null) }

    // CMD-08: Log para debug do estado da UI
    LaunchedEffect(uiState) {
        when (uiState) {
            is SchedulesUiState.Loading -> AppLogger.d(TAG) { "Estado: Loading" }
            is SchedulesUiState.Success -> {
                val count = (uiState as SchedulesUiState.Success).schedules.size
                AppLogger.d(TAG) { "Estado: Success com $count schedules" }
            }
            is SchedulesUiState.Error -> {
                val msg = (uiState as SchedulesUiState.Error).message
                AppLogger.e(TAG, "Estado: Error - $msg")
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (uiState) {
            is SchedulesUiState.Loading -> {
                LoadingState(shimmerCount = 8, itemType = LoadingItemType.LIST_ITEM)
            }

            is SchedulesUiState.Success -> {
                val schedules = (uiState as SchedulesUiState.Success).schedules

                if (schedules.isEmpty()) {
                    // CMD-09: EmptyState padrão com CTA para criar
                    EmptyState(
                        type = EmptyStateType.NoData(
                            title = stringResource(Res.string.schedules_no_schedules),
                            description = stringResource(Res.string.schedules_empty_description),
                            icon = Icons.Default.EventRepeat,
                            actionLabel = stringResource(Res.string.schedules_create_schedule),
                            onAction = { showCreateDialog = true }
                        )
                    )
                } else {
                    // List of Schedules
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(
                            items = schedules,
                            key = { it.id }
                        ) { schedule ->
                            ScheduleCard(
                                schedule = schedule,
                                onEditClick = { scheduleToEdit = schedule },
                                onDeleteClick = { scheduleToDelete = schedule.id }
                            )
                        }
                    }
                }
            }

            is SchedulesUiState.Error -> {
                // CMD-09: Error State com retry usando EmptyState padrão
                val errorMsg = (uiState as SchedulesUiState.Error).message
                EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(Res.string.schedules_error_loading),
                        description = errorMsg,
                        icon = Icons.Default.ErrorOutline,
                        actionLabel = stringResource(Res.string.schedules_try_again),
                        onRetry = { viewModel.refresh() }
                    )
                )
            }
        }

        // CMD-09: FAB para criar novo horário
        FloatingActionButton(
            onClick = { showCreateDialog = true },
            containerColor = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = stringResource(Res.string.schedules_fab_description)
            )
        }
    }

    // Create Schedule Dialog (CMD-08/09)
    if (showCreateDialog) {
        val userId = viewModel.getCurrentUserId()
        if (userId != null) {
            CreateScheduleDialog(
                onDismiss = { showCreateDialog = false },
                onCreate = { newSchedule ->
                    viewModel.createSchedule(newSchedule)
                    showCreateDialog = false
                },
                userId = userId,
                userName = currentUserName
            )
        }
    }

    // Edit Schedule Dialog
    scheduleToEdit?.let { schedule ->
        EditScheduleDialog(
            schedule = schedule,
            onDismiss = { scheduleToEdit = null },
            onSave = { updatedSchedule ->
                viewModel.updateSchedule(updatedSchedule)
                scheduleToEdit = null
            }
        )
    }

    // Delete Confirmation Dialog
    scheduleToDelete?.let { scheduleId ->
        AlertDialog(
            onDismissRequest = { scheduleToDelete = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error
                )
            },
            title = {
                Text(stringResource(Res.string.schedules_delete_title))
            },
            text = {
                Text(stringResource(Res.string.schedules_delete_message))
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteSchedule(scheduleId)
                        scheduleToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(stringResource(Res.string.schedules_stop))
                }
            },
            dismissButton = {
                TextButton(onClick = { scheduleToDelete = null }) {
                    Text(stringResource(Res.string.schedules_cancel))
                }
            }
        )
    }
}

/**
 * Card de horário recorrente individual
 */
@Composable
private fun ScheduleCard(
    schedule: Schedule,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Nome do horário
            Text(
                text = schedule.name.ifEmpty { stringResource(Res.string.schedules_no_name) },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Informações de recorrência
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.EventRepeat,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary
                )

                val dayStr = getDayOfWeekString(schedule.dayOfWeek)
                val recurrenceStr = getRecurrenceString(schedule.recurrenceType)

                Text(
                    text = buildString {
                        append("$recurrenceStr • $dayStr")
                        if (schedule.time.isNotEmpty()) {
                            append(" ${stringResource(Res.string.schedules_at)} ${schedule.time}")
                        } else {
                            append(" - ${stringResource(Res.string.schedules_time_not_defined)}")
                        }
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (schedule.time.isEmpty()) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Informações de local e campo
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.secondary
                )

                Text(
                    text = "${schedule.locationName} - ${schedule.fieldName}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Botões de ação
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Botão Editar
                TextButton(
                    onClick = onEditClick,
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(Res.string.schedules_edit))
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Botão Deletar
                TextButton(
                    onClick = onDeleteClick,
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(Res.string.schedules_delete))
                }
            }
        }
    }
}

/**
 * Helper function para converter dia da semana em string
 */
@Composable
private fun getDayOfWeekString(day: Int): String {
    return when (day) {
        0 -> stringResource(Res.string.schedules_day_sunday)
        1 -> stringResource(Res.string.schedules_day_monday)
        2 -> stringResource(Res.string.schedules_day_tuesday)
        3 -> stringResource(Res.string.schedules_day_wednesday)
        4 -> stringResource(Res.string.schedules_day_thursday)
        5 -> stringResource(Res.string.schedules_day_friday)
        6 -> stringResource(Res.string.schedules_day_saturday)
        else -> "Desconhecido"
    }
}

/**
 * Helper function para converter tipo de recorrência em string
 */
@Composable
private fun getRecurrenceString(recurrenceType: RecurrenceType): String {
    return when (recurrenceType) {
        RecurrenceType.weekly -> stringResource(Res.string.schedules_recurrence_weekly)
        RecurrenceType.biweekly -> stringResource(Res.string.schedules_recurrence_biweekly)
        RecurrenceType.monthly -> stringResource(Res.string.schedules_recurrence_monthly)
    }
}
