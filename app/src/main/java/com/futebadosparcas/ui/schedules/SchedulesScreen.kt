package com.futebadosparcas.ui.schedules

import android.util.Log
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType

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
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulesScreen(
    viewModel: SchedulesViewModel,
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
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
            is SchedulesUiState.Loading -> Log.d(TAG, "Estado: Loading")
            is SchedulesUiState.Success -> {
                val count = (uiState as SchedulesUiState.Success).schedules.size
                Log.d(TAG, "Estado: Success com $count schedules")
            }
            is SchedulesUiState.Error -> {
                val msg = (uiState as SchedulesUiState.Error).message
                Log.e(TAG, "Estado: Error - $msg")
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Horários Recorrentes") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                actions = {
                    // Botão de refresh para CMD-08 (debug)
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Atualizar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        // CMD-09: FAB para criar novo horário
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Criar Horário"
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (uiState) {
                is SchedulesUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                is SchedulesUiState.Success -> {
                    val schedules = (uiState as SchedulesUiState.Success).schedules

                    if (schedules.isEmpty()) {
                        // CMD-09: EmptyState padrão com CTA para criar
                        EmptyState(
                            type = EmptyStateType.NoData(
                                title = "Nenhum horário recorrente",
                                description = "Configure horários para automatizar a criação de jogos semanais, quinzenais ou mensais.",
                                icon = Icons.Default.EventRepeat,
                                actionLabel = "Criar Horário",
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
                            title = "Erro ao carregar horários",
                            description = errorMsg,
                            icon = Icons.Default.ErrorOutline,
                            actionLabel = "Tentar Novamente",
                            onRetry = { viewModel.refresh() }
                        )
                    )
                }
            }
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
                Text("Excluir Recorrência")
            },
            text = {
                Text("Deseja interromper esta recorrência? Novos jogos não serão mais agendados automaticamente para esta série.")
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
                    Text("Interromper")
                }
            },
            dismissButton = {
                TextButton(onClick = { scheduleToDelete = null }) {
                    Text("Cancelar")
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
                text = schedule.name.ifEmpty { "Sem nome" },
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
                val recurrenceStr = when (schedule.recurrenceType) {
                    RecurrenceType.weekly -> "Semanal"
                    RecurrenceType.biweekly -> "Quinzenal"
                    RecurrenceType.monthly -> "Mensal"
                }

                Text(
                    text = buildString {
                        append("$recurrenceStr • $dayStr")
                        if (schedule.time.isNotEmpty()) {
                            append(" às ${schedule.time}")
                        } else {
                            append(" - Horário não definido")
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
                    Text("Editar")
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
                    Text("Excluir")
                }
            }
        }
    }
}

/**
 * Helper function para converter dia da semana em string
 */
private fun getDayOfWeekString(day: Int): String {
    return when (day) {
        0 -> "Domingo"
        1 -> "Segunda-feira"
        2 -> "Terça-feira"
        3 -> "Quarta-feira"
        4 -> "Quinta-feira"
        5 -> "Sexta-feira"
        6 -> "Sábado"
        else -> "Desconhecido"
    }
}
