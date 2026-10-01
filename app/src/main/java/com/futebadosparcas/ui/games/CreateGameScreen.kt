package com.futebadosparcas.ui.games

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.koin.compose.viewmodel.koinViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.domain.model.Field
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.GameGender
import com.futebadosparcas.domain.model.GameVisibility
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.validation.GameValidation
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.util.nextRecurrenceDates
import com.futebadosparcas.util.toKmpField
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.text.KeyboardOptions
import com.futebadosparcas.ui.components.rememberDiscardChangesGuard
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth

/** Teto de datas exibidas no preview de recorrencia (spec #2398, CA1). */
private const val RECURRENCE_PREVIEW_CAP = 12

/**
 * Tela moderna de criação/edição de jogos em Jetpack Compose
 * Preparada para KMP/iOS com Material Design 3
 *
 * Arquitetura KMP-Ready (3 camadas):
 * - CreateGameScreen: State collection + callbacks (stateful)
 * - CreateGameContent: UI pura sem Scaffold (stateless, KMP-ready)
 * - TopBar gerenciada por SecondaryScreenWrapper (platform-specific)
 *
 * Features:
 * - Validação em tempo real
 * - Date/Time Pickers Material3
 * - Dialogs modernos de seleção
 * - Animações suaves
 * - Accessibility completo
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGameScreen(
    gameId: String? = null,
    initialGroupId: String? = null,
    viewModel: CreateGameViewModel = koinViewModel(),
    hapticManager: HapticManager,
    onNavigateBack: () -> Unit,
    onGameCreated: (gameId: String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val selectedDate by viewModel.selectedDate.collectAsStateWithLifecycle()
    val selectedTime by viewModel.selectedTime.collectAsStateWithLifecycle()
    val selectedEndTime by viewModel.selectedEndTime.collectAsStateWithLifecycle()
    val selectedLocation by viewModel.selectedLocation.collectAsStateWithLifecycle()
    val selectedField by viewModel.selectedField.collectAsStateWithLifecycle()
    val currentUser by viewModel.currentUser.collectAsStateWithLifecycle()
    val availableGroups by viewModel.availableGroups.collectAsStateWithLifecycle()
    val selectedGroup by viewModel.selectedGroup.collectAsStateWithLifecycle()
    val selectedVisibility by viewModel.selectedVisibility.collectAsStateWithLifecycle()
    val selectedGender by viewModel.selectedGender.collectAsStateWithLifecycle()
    val maxGoalkeepers by viewModel.maxGoalkeepers.collectAsStateWithLifecycle()
    val numberOfTeams by viewModel.numberOfTeams.collectAsStateWithLifecycle()
    val recurrenceEndMode by viewModel.recurrenceEndMode.collectAsStateWithLifecycle()
    val recurrenceCount by viewModel.recurrenceCount.collectAsStateWithLifecycle()
    val recurrenceEndDate by viewModel.recurrenceEndDate.collectAsStateWithLifecycle()
    val timeConflicts by viewModel.timeConflicts.collectAsStateWithLifecycle()
    val isEditing by viewModel.isEditing.collectAsStateWithLifecycle()

    // Estados locais do formulário
    var ownerName by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var maxPlayers by remember { mutableStateOf("14") }
    var recurrenceEnabled by remember { mutableStateOf(false) }
    var recurrenceType by remember { mutableStateOf("weekly") }

    // Estados de erro
    var ownerNameError by remember { mutableStateOf<String?>(null) }
    var priceError by remember { mutableStateOf<String?>(null) }
    var maxPlayersError by remember { mutableStateOf<String?>(null) }

    // Estados de dialogs
    var showLocationDialog by remember { mutableStateOf(false) }
    var showFieldDialog by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showStartTimePicker by remember { mutableStateOf(false) }
    var showEndTimePicker by remember { mutableStateOf(false) }
    var showRecurrenceEndDatePicker by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val editingGame = (uiState as? CreateGameUiState.Editing)?.game
    val createdGameId = (uiState as? CreateGameUiState.Success)?.game?.id
    val hasCreateError = uiState is CreateGameUiState.Error

    // Carregar jogo se estiver editando
    LaunchedEffect(gameId) {
        gameId?.let {
            viewModel.loadGame(it)
        }
    }

    LaunchedEffect(initialGroupId, isEditing) {
        if (!isEditing) {
            viewModel.selectInitialGroup(initialGroupId)
        }
    }

    // Preencher form quando carregar jogo para edição
    LaunchedEffect(editingGame?.id) {
        editingGame?.let { game ->
            ownerName = game.ownerName
            price = game.dailyPrice.toString()
            maxPlayers = game.maxPlayers.toString()
            recurrenceEnabled = game.recurrence != "none" && game.recurrence.isNotEmpty()
            recurrenceType = when (game.recurrence) {
                "weekly", "biweekly", "monthly" -> game.recurrence
                else -> "weekly"
            }
        }
    }

    // Preencher nome do owner quando carregar usuário
    LaunchedEffect(currentUser) {
        if (ownerName.isEmpty() && currentUser.isNotEmpty()) {
            ownerName = currentUser
        }
    }

    // Handle success/error states
    LaunchedEffect(createdGameId, hasCreateError) {
        when {
            createdGameId != null -> {
                hapticManager?.tick() // Success feedback
                onGameCreated(createdGameId)
            }
            hasCreateError -> {
                hapticManager?.error()
            }
        }
    }

    // Guard contra descarte silencioso de dados não salvos
    val isDirty = remember(ownerName, price, maxPlayers, selectedDate, selectedTime, selectedEndTime, selectedLocation, selectedField, recurrenceEnabled) {
        ownerName.isNotEmpty() ||
        price.isNotEmpty() ||
        maxPlayers != "14" ||
        selectedDate != null ||
        selectedTime != null ||
        selectedEndTime != null ||
        selectedLocation != null ||
        selectedField != null ||
        recurrenceEnabled
    }
    val attemptExit = rememberDiscardChangesGuard(
        isDirty = isDirty,
        onConfirmedExit = onNavigateBack,
    )

    Box(modifier = Modifier.fillMaxSize()) {
        CreateGameContent(
            ownerName = ownerName,
            onOwnerNameChange = {
                ownerName = it
                ownerNameError = null
            },
            ownerNameError = ownerNameError,
            price = price,
            onPriceChange = {
                price = it
                priceError = null
            },
            priceError = priceError,
            maxPlayers = maxPlayers,
            onMaxPlayersChange = {
                maxPlayers = it
                maxPlayersError = null
            },
            maxPlayersError = maxPlayersError,
            maxGoalkeepers = maxGoalkeepers,
            onMaxGoalkeepersChange = { viewModel.setMaxGoalkeepers(it) },
            numberOfTeams = numberOfTeams,
            onNumberOfTeamsChange = { viewModel.setNumberOfTeams(it) },
            selectedDate = selectedDate,
            onDateClick = {
                hapticManager.tick()
                showDatePicker = true
            },
            selectedTime = selectedTime,
            onStartTimeClick = {
                hapticManager.tick()
                showStartTimePicker = true
            },
            selectedEndTime = selectedEndTime,
            onEndTimeClick = {
                hapticManager.tick()
                showEndTimePicker = true
            },
            selectedLocation = selectedLocation,
            onLocationClick = {
                hapticManager.tick()
                showLocationDialog = true
            },
            selectedField = selectedField,
            onFieldClick = {
                hapticManager.tick()
                selectedLocation?.let {
                    showFieldDialog = true
                }
            },
            availableGroups = availableGroups,
            selectedGroup = selectedGroup,
            onGroupSelected = { viewModel.selectGroup(it) },
            selectedVisibility = selectedVisibility,
            onVisibilitySelected = {
                hapticManager.tick()
                viewModel.setVisibility(it)
            },
            selectedGender = selectedGender,
            onGenderSelected = {
                hapticManager.tick()
                viewModel.setGender(it)
            },
            recurrenceEnabled = recurrenceEnabled,
            onRecurrenceEnabledChange = { recurrenceEnabled = it },
            recurrenceType = recurrenceType,
            onRecurrenceTypeChange = { recurrenceType = it },
            recurrenceEndMode = recurrenceEndMode,
            onRecurrenceEndModeChange = { viewModel.setRecurrenceEndMode(it) },
            recurrenceCount = recurrenceCount,
            onRecurrenceCountChange = { viewModel.setRecurrenceCount(it) },
            recurrenceEndDate = recurrenceEndDate,
            onRecurrenceEndDateClick = {
                hapticManager.tick()
                showRecurrenceEndDatePicker = true
            },
            timeConflicts = timeConflicts,
            onCancelClick = {
                hapticManager.tick()
                attemptExit()
            },
            onSaveClick = {
                hapticManager.tick()

                // Validações de campo
                var hasError = false

                if (ownerName.trim().length < 3) {
                    ownerNameError = context.getString(R.string.create_game_error_owner_name)
                    hasError = true
                }

                val priceValue = price.toDoubleOrNull()
                if (priceValue == null || priceValue < 0) {
                    priceError = context.getString(R.string.create_game_error_price)
                    hasError = true
                }

                val maxPlayersValue = maxPlayers.toIntOrNull()
                if (maxPlayersValue == null || maxPlayersValue < 2 || maxPlayersValue > 50) {
                    maxPlayersError = context.getString(R.string.create_game_error_max_players)
                    hasError = true
                }

                // Guard: modo "until" exige uma data de termino (spec #2398)
                if (recurrenceEnabled &&
                    recurrenceEndMode == CreateGameViewModel.RECURRENCE_END_MODE_UNTIL &&
                    recurrenceEndDate == null
                ) {
                    android.widget.Toast.makeText(
                        context,
                        context.getString(R.string.create_game_recurrence_until_required),
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                    hasError = true
                }

                if (!hasError) {
                    viewModel.saveGame(
                        gameId = gameId,
                        ownerName = ownerName.trim(),
                        price = priceValue ?: 0.0,
                        maxPlayers = maxPlayersValue ?: 14,
                        recurrence = if (recurrenceEnabled) {
                            recurrenceType
                        } else {
                            "none"
                        }
                    )
                }
            },
            isLoading = uiState is CreateGameUiState.Loading,
            errorMessage = (uiState as? CreateGameUiState.Error)?.message
        )

        // Loading overlay
        if (uiState is CreateGameUiState.Loading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.7f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
    }

    // Dialogs
    if (showLocationDialog) {
        LocationSelectionDialog(
            onDismiss = { showLocationDialog = false },
            onLocationSelected = { location ->
                viewModel.setLocation(location)
                showLocationDialog = false
            }
        )
    }

    if (showFieldDialog) {
        selectedLocation?.let { location ->
            FieldSelectionDialog(
                location = location,
                onDismiss = { showFieldDialog = false },
                onFieldSelected = { field ->
                    viewModel.setField(field.toKmpField()) // Converter data.model.Field -> domain.model.Field
                    showFieldDialog = false
                }
            )
        }
    }

    if (showDatePicker) {
        DatePickerDialog(
            onDismiss = { showDatePicker = false },
            onDateSelected = { year, month, day ->
                viewModel.setDate(year, month, day)
                showDatePicker = false
            },
            initialDate = selectedDate
        )
    }

    if (showStartTimePicker) {
        TimePickerDialog(
            title = stringResource(R.string.create_game_hint_start),
            onDismiss = { showStartTimePicker = false },
            onTimeSelected = { hour, minute ->
                viewModel.setTime(hour, minute)
                showStartTimePicker = false
            },
            initialTime = selectedTime
        )
    }

    if (showEndTimePicker) {
        TimePickerDialog(
            title = stringResource(R.string.create_game_hint_end),
            onDismiss = { showEndTimePicker = false },
            onTimeSelected = { hour, minute ->
                viewModel.setEndTime(hour, minute)
                showEndTimePicker = false
            },
            initialTime = selectedEndTime
        )
    }

    if (showRecurrenceEndDatePicker) {
        // DatePickerDialog retorna month 0-based (Calendar.MONTH); +1 para LocalDate.
        DatePickerDialog(
            onDismiss = { showRecurrenceEndDatePicker = false },
            onDateSelected = { year, month, day ->
                val iso = java.time.LocalDate.of(year, month + 1, day)
                    .format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
                viewModel.setRecurrenceEndDate(iso)
                showRecurrenceEndDatePicker = false
            },
            initialDate = recurrenceEndDate?.let {
                runCatching { java.time.LocalDate.parse(it) }.getOrNull()
            } ?: selectedDate
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateGameContent(
    ownerName: String,
    onOwnerNameChange: (String) -> Unit,
    ownerNameError: String?,
    price: String,
    onPriceChange: (String) -> Unit,
    priceError: String?,
    maxPlayers: String,
    onMaxPlayersChange: (String) -> Unit,
    maxPlayersError: String?,
    maxGoalkeepers: Int,
    onMaxGoalkeepersChange: (Int) -> Unit,
    numberOfTeams: Int,
    onNumberOfTeamsChange: (Int) -> Unit,
    selectedDate: LocalDate?,
    onDateClick: () -> Unit,
    selectedTime: LocalTime?,
    onStartTimeClick: () -> Unit,
    selectedEndTime: LocalTime?,
    onEndTimeClick: () -> Unit,
    selectedLocation: Location?,
    onLocationClick: () -> Unit,
    selectedField: Field?,
    onFieldClick: () -> Unit,
    availableGroups: List<com.futebadosparcas.data.model.UserGroup>,
    selectedGroup: com.futebadosparcas.data.model.UserGroup?,
    onGroupSelected: (com.futebadosparcas.data.model.UserGroup) -> Unit,
    selectedVisibility: GameVisibility,
    onVisibilitySelected: (GameVisibility) -> Unit,
    selectedGender: String,
    onGenderSelected: (String) -> Unit,
    recurrenceEnabled: Boolean,
    onRecurrenceEnabledChange: (Boolean) -> Unit,
    recurrenceType: String,
    onRecurrenceTypeChange: (String) -> Unit,
    recurrenceEndMode: String,
    onRecurrenceEndModeChange: (String) -> Unit,
    recurrenceCount: Int,
    onRecurrenceCountChange: (Int) -> Unit,
    recurrenceEndDate: String?,
    onRecurrenceEndDateClick: () -> Unit,
    timeConflicts: List<com.futebadosparcas.data.repository.TimeConflict>,
    onCancelClick: () -> Unit,
    onSaveClick: () -> Unit,
    isLoading: Boolean,
    errorMessage: String?
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .adaptiveContentWidth()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Error message
        AnimatedVisibility(
            visible = errorMessage != null,
            enter = slideInVertically() + fadeIn(),
            exit = slideOutVertically() + fadeOut()
        ) {
            errorMessage?.let {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = stringResource(R.string.cd_error_warning),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }
        }

        // Conflict warning
        AnimatedVisibility(
            visible = timeConflicts.isNotEmpty(),
            enter = slideInVertically() + fadeIn(),
            exit = slideOutVertically() + fadeOut()
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = stringResource(R.string.create_game_cd_alert),
                        tint = MaterialTheme.colorScheme.tertiary
                    )
                    Column {
                        Text(
                            text = stringResource(R.string.create_game_conflict_detected),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                        if (timeConflicts.isNotEmpty()) {
                            val conflict = timeConflicts.first()
                            // FIX #4127: TimeConflict não carrega mais o jogo
                            // (metadados de doc privado de outro grupo); mostra
                            // apenas o horário ocupado, igual ao web.
                            Text(
                                text = "Horário ocupado (${conflict.conflictingTime} - ${conflict.conflictingEndTime})",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                        }
                    }
                }
            }
        }

        // Seção: Local e Quadra
        SectionTitle(stringResource(R.string.create_game_section_location))

        LocationSelectionCard(
            selectedLocation = selectedLocation,
            onClick = onLocationClick
        )

        AnimatedVisibility(
            visible = selectedLocation != null,
            enter = slideInVertically() + fadeIn(),
            exit = slideOutVertically() + fadeOut()
        ) {
            FieldSelectionCard(
                selectedField = selectedField,
                onClick = onFieldClick,
                enabled = selectedLocation != null
            )
        }

        // Seção: Informações básicas
        SectionTitle(stringResource(R.string.create_game_section_basic_info))

        OutlinedTextField(
            value = ownerName,
            onValueChange = onOwnerNameChange,
            label = { Text(stringResource(R.string.create_game_hint_owner)) },
            isError = ownerNameError != null,
            supportingText = ownerNameError?.let { { Text(it) } },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        // Group selection
        if (availableGroups.isNotEmpty()) {
            var expanded by remember { mutableStateOf(false) }

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = selectedGroup?.groupName ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.create_game_hint_group)) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
                    colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                )

                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    availableGroups.forEach { group ->
                        DropdownMenuItem(
                            text = { Text(group.groupName) },
                            onClick = {
                                onGroupSelected(group)
                                expanded = false
                            }
                        )
                    }
                }
            }
        } else {
            Text(
                text = stringResource(R.string.create_game_no_groups_warning),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }

        // Seção: Data e Horário
        SectionTitle(stringResource(R.string.create_game_section_datetime))

        OutlinedTextField(
            value = selectedDate?.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) ?: "",
            onValueChange = {},
            label = { Text(stringResource(R.string.create_game_hint_date)) },
            readOnly = true,
            enabled = false,
            trailingIcon = {
                Icon(
                    imageVector = Icons.Default.DateRange,
                    contentDescription = stringResource(R.string.cd_select_date)
                )
            },
            modifier = Modifier
                .clickable(onClick = onDateClick)
                .fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = MaterialTheme.colorScheme.onSurface,
                disabledBorderColor = MaterialTheme.colorScheme.outline,
                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = selectedTime?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "",
                onValueChange = {},
                label = { Text(stringResource(R.string.create_game_hint_start)) },
                readOnly = true,
                enabled = false,
                trailingIcon = {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = stringResource(R.string.cd_select_start_time)
                    )
                },
                modifier = Modifier
                    .clickable(onClick = onStartTimeClick)
                    .weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    disabledTextColor = MaterialTheme.colorScheme.onSurface,
                    disabledBorderColor = MaterialTheme.colorScheme.outline,
                    disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            OutlinedTextField(
                value = selectedEndTime?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "",
                onValueChange = {},
                label = { Text(stringResource(R.string.create_game_hint_end)) },
                readOnly = true,
                enabled = false,
                trailingIcon = {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = stringResource(R.string.cd_select_end_time)
                    )
                },
                modifier = Modifier
                    .clickable(onClick = onEndTimeClick)
                    .weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    disabledTextColor = MaterialTheme.colorScheme.onSurface,
                    disabledBorderColor = MaterialTheme.colorScheme.outline,
                    disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }

        // Seção: Recorrência
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.create_game_label_auto_schedule),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Switch(
                        checked = recurrenceEnabled,
                        onCheckedChange = onRecurrenceEnabledChange
                    )
                }

                AnimatedVisibility(
                    visible = recurrenceEnabled,
                    enter = expandVertically() + fadeIn(),
                    exit = shrinkVertically() + fadeOut()
                ) {
                    Column(
                        modifier = Modifier.padding(top = 8.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.create_game_desc_auto_schedule),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )

                        var expandedRecurrence by remember { mutableStateOf(false) }
                        val recurrenceOptions = listOf("weekly", "biweekly", "monthly")
                        val recurrenceDisplayNames = mapOf(
                            "weekly" to stringResource(R.string.game_schedule_frequency_weekly),
                            "biweekly" to stringResource(R.string.game_schedule_frequency_biweekly),
                            "monthly" to stringResource(R.string.game_schedule_frequency_monthly)
                        )

                        ExposedDropdownMenuBox(
                            expanded = expandedRecurrence,
                            onExpandedChange = { expandedRecurrence = it }
                        ) {
                            OutlinedTextField(
                                value = recurrenceDisplayNames[recurrenceType] ?: recurrenceType,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(stringResource(R.string.create_game_hint_frequency)) },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedRecurrence) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                            )

                            ExposedDropdownMenu(
                                expanded = expandedRecurrence,
                                onDismissRequest = { expandedRecurrence = false }
                            ) {
                                recurrenceOptions.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(recurrenceDisplayNames[option] ?: option) },
                                        onClick = {
                                            onRecurrenceTypeChange(option)
                                            expandedRecurrence = false
                                        }
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Fim-de-serie (spec #2398): forever | count | until (count XOR end_date)
                        RecurrenceEndSelector(
                            recurrenceType = recurrenceType,
                            startDate = selectedDate,
                            endMode = recurrenceEndMode,
                            onEndModeChange = onRecurrenceEndModeChange,
                            count = recurrenceCount,
                            onCountChange = onRecurrenceCountChange,
                            endDate = recurrenceEndDate,
                            onEndDateClick = onRecurrenceEndDateClick
                        )
                    }
                }
            }
        }

        // Seção: Visibilidade
        SectionTitle(stringResource(R.string.create_game_label_visibility))

        VisibilitySelector(
            selectedVisibility = selectedVisibility,
            onVisibilitySelected = onVisibilitySelected
        )

        // Seção: Gênero/categoria do jogo (FASE 2)
        SectionTitle(stringResource(R.string.game_gender))

        GenderSelector(
            selectedGender = selectedGender,
            onGenderSelected = onGenderSelected
        )

        // Seção: Preço e Jogadores
        SectionTitle(stringResource(R.string.create_game_section_pricing))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = price,
                onValueChange = onPriceChange,
                label = { Text(stringResource(R.string.create_game_hint_price)) },
                isError = priceError != null,
                supportingText = {
                    Text(priceError ?: stringResource(R.string.create_game_price_helper))
                },
                modifier = Modifier.weight(1f),
                singleLine = true,
                placeholder = { Text(stringResource(R.string.create_game_price_placeholder)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                leadingIcon = {
                    Text(
                        text = "R$",
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            )

            OutlinedTextField(
                value = maxPlayers,
                onValueChange = onMaxPlayersChange,
                label = { Text(stringResource(R.string.create_game_hint_max_players)) },
                isError = maxPlayersError != null,
                supportingText = {
                    Text(maxPlayersError ?: stringResource(R.string.create_game_max_players_helper))
                },
                modifier = Modifier.weight(1f),
                placeholder = { Text(stringResource(R.string.create_game_max_players_placeholder)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Maximo de goleiros e numero de times (paridade com web, spec #2400)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            NumberStepper(
                label = stringResource(R.string.create_game_label_max_goalkeepers),
                value = maxGoalkeepers,
                min = GameValidation.MIN_GOALKEEPERS,
                max = GameValidation.MAX_GOALKEEPERS,
                onValueChange = onMaxGoalkeepersChange,
                decrementCd = stringResource(R.string.create_game_cd_decrement_goalkeepers),
                incrementCd = stringResource(R.string.create_game_cd_increment_goalkeepers),
                helperText = stringResource(
                    R.string.create_game_goalkeepers_helper,
                    GameValidation.MIN_GOALKEEPERS,
                    GameValidation.MAX_GOALKEEPERS
                ),
                modifier = Modifier.weight(1f)
            )

            NumberStepper(
                label = stringResource(R.string.create_game_label_number_of_teams),
                value = numberOfTeams,
                min = GameValidation.MIN_NUMBER_OF_TEAMS,
                max = GameValidation.MAX_NUMBER_OF_TEAMS,
                onValueChange = onNumberOfTeamsChange,
                decrementCd = stringResource(R.string.create_game_cd_decrement_teams),
                incrementCd = stringResource(R.string.create_game_cd_increment_teams),
                helperText = stringResource(
                    R.string.create_game_teams_helper,
                    GameValidation.MIN_NUMBER_OF_TEAMS,
                    GameValidation.MAX_NUMBER_OF_TEAMS
                ),
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Botões de ação
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onCancelClick,
                modifier = Modifier.weight(1f),
                enabled = !isLoading
            ) {
                Text(stringResource(R.string.create_game_button_cancel))
            }

            Button(
                onClick = onSaveClick,
                modifier = Modifier.weight(1f),
                enabled = !isLoading && availableGroups.isNotEmpty()
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(stringResource(R.string.create_game_button_schedule))
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

/**
 * Seletor de fim-de-serie da recorrencia (spec #2398, decisao "ambos").
 *
 * Tres modos mutuamente exclusivos:
 * - forever: sem data de termino (serie corre ate o hard cap de 52 no backend).
 * - count: total de N jogos (min 2, max 52). NAO sao repeticoes adicionais.
 * - until: repete ate uma data limite.
 *
 * Emite no maximo um de count XOR end_date; o motor (recurrence-engine) para
 * via recurrenceStopReason. Mostra um preview das proximas datas (CA1).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecurrenceEndSelector(
    recurrenceType: String,
    startDate: LocalDate?,
    endMode: String,
    onEndModeChange: (String) -> Unit,
    count: Int,
    onCountChange: (Int) -> Unit,
    endDate: String?,
    onEndDateClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.create_game_recurrence_end_label),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))

        // Seletor de modo via FilterChips
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val modes = listOf(
                CreateGameViewModel.RECURRENCE_END_MODE_FOREVER to
                    stringResource(R.string.create_game_recurrence_end_forever),
                CreateGameViewModel.RECURRENCE_END_MODE_COUNT to
                    stringResource(R.string.create_game_recurrence_end_count),
                CreateGameViewModel.RECURRENCE_END_MODE_UNTIL to
                    stringResource(R.string.create_game_recurrence_end_until)
            )
            modes.forEach { (mode, label) ->
                FilterChip(
                    selected = endMode == mode,
                    onClick = { onEndModeChange(mode) },
                    label = { Text(label) }
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        when (endMode) {
            CreateGameViewModel.RECURRENCE_END_MODE_COUNT -> {
                NumberStepper(
                    label = stringResource(R.string.create_game_recurrence_count_label),
                    value = count,
                    min = CreateGameViewModel.MIN_RECURRENCE_COUNT,
                    max = CreateGameViewModel.MAX_RECURRENCE_COUNT,
                    onValueChange = onCountChange,
                    decrementCd = stringResource(R.string.create_game_recurrence_count_decrement_cd),
                    incrementCd = stringResource(R.string.create_game_recurrence_count_increment_cd),
                    helperText = stringResource(
                        R.string.create_game_recurrence_count_helper,
                        CreateGameViewModel.MIN_RECURRENCE_COUNT,
                        CreateGameViewModel.MAX_RECURRENCE_COUNT
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
            CreateGameViewModel.RECURRENCE_END_MODE_UNTIL -> {
                OutlinedButton(
                    onClick = onEndDateClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Filled.DateRange,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = endDate ?: stringResource(R.string.create_game_recurrence_until_hint)
                    )
                }
            }
            else -> Unit
        }

        // Preview das proximas datas (CA1)
        val previewDates = remember(recurrenceType, startDate, endMode, count, endDate) {
            if (startDate == null) {
                emptyList()
            } else {
                when (endMode) {
                    // count = TOTAL de jogos; a 1a ocorrencia ja e a base, entao
                    // o preview de datas FUTURAS e count-1 (espelha o web).
                    CreateGameViewModel.RECURRENCE_END_MODE_COUNT ->
                        nextRecurrenceDates(startDate, recurrenceType, count - 1)
                    // until: gera ate o teto de preview e filtra por <= end_date.
                    CreateGameViewModel.RECURRENCE_END_MODE_UNTIL -> {
                        val limit = endDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                        nextRecurrenceDates(startDate, recurrenceType, RECURRENCE_PREVIEW_CAP)
                            .filter { limit == null || !it.isAfter(limit) }
                    }
                    // forever: apenas uma amostra ate o teto de preview.
                    else -> nextRecurrenceDates(startDate, recurrenceType, RECURRENCE_PREVIEW_CAP)
                }
            }
        }

        if (previewDates.isNotEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = stringResource(R.string.create_game_recurrence_preview_title),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            val previewFormatter = remember { DateTimeFormatter.ofPattern("EEE, dd/MM/yyyy") }
            previewDates.forEach { date ->
                Text(
                    text = date.format(previewFormatter),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Stepper numerico (-/+) para ranges pequenos, evitando teclado.
 * Botoes respeitam touch target de 48dp e desabilitam nos limites.
 */
@Composable
private fun NumberStepper(
    label: String,
    value: Int,
    min: Int,
    max: Int,
    onValueChange: (Int) -> Unit,
    decrementCd: String,
    incrementCd: String,
    helperText: String,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.small)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = { if (value > min) onValueChange(value - 1) },
                enabled = value > min,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Remove,
                    contentDescription = decrementCd,
                    tint = MaterialTheme.colorScheme.onSurface
                )
            }
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            IconButton(
                onClick = { if (value < max) onValueChange(value + 1) },
                enabled = value < max,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = incrementCd,
                    tint = MaterialTheme.colorScheme.onSurface
                )
            }
        }
        Text(
            text = helperText,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(vertical = 8.dp)
    )
}

@Composable
private fun LocationSelectionCard(
    selectedLocation: Location?,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selectedLocation != null) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Place,
                contentDescription = stringResource(R.string.create_game_cd_location_icon),
                tint = if (selectedLocation != null) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.create_game_label_location),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selectedLocation != null) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                Text(
                    text = selectedLocation?.name ?: stringResource(R.string.create_game_tap_to_select),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (selectedLocation != null) FontWeight.Bold else FontWeight.Normal,
                    color = if (selectedLocation != null) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                selectedLocation?.let {
                    Text(
                        text = it.getFullAddress(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = stringResource(R.string.create_game_cd_select),
                tint = if (selectedLocation != null) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}

@Composable
private fun FieldSelectionCard(
    selectedField: Field?,
    onClick: () -> Unit,
    enabled: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick, enabled = enabled),
        colors = CardDefaults.cardColors(
            containerColor = if (selectedField != null) {
                MaterialTheme.colorScheme.secondaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.SportsScore,
                contentDescription = stringResource(R.string.create_game_cd_field_icon),
                tint = if (selectedField != null) {
                    MaterialTheme.colorScheme.onSecondaryContainer
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.create_game_label_field),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selectedField != null) {
                        MaterialTheme.colorScheme.onSecondaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                Text(
                    text = selectedField?.name ?: stringResource(R.string.create_game_tap_to_select),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (selectedField != null) FontWeight.Bold else FontWeight.Normal,
                    color = if (selectedField != null) {
                        MaterialTheme.colorScheme.onSecondaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                selectedField?.let {
                    AssistChip(
                        onClick = {},
                        label = { Text(it.getTypeEnum().displayName) },
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = stringResource(R.string.create_game_cd_select),
                tint = if (selectedField != null) {
                    MaterialTheme.colorScheme.onSecondaryContainer
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}

/**
 * Seletor de gênero/categoria do jogo (FASE 2): Masculino | Feminino | Misto.
 *
 * Emite o valor canônico (UPPER_SNAKE) de [GameGender] via [onGenderSelected].
 * Segue o mesmo padrão de FilterChips em FlowRow usado por [RecurrenceEndSelector].
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GenderSelector(
    selectedGender: String,
    onGenderSelected: (String) -> Unit
) {
    // Apenas 3 valores para jogos (MALE/FEMALE/MIXED) — distinto do gênero de usuário.
    val options = listOf(
        GameGender.MALE.name to stringResource(R.string.game_gender_male),
        GameGender.FEMALE.name to stringResource(R.string.game_gender_female),
        GameGender.MIXED.name to stringResource(R.string.game_gender_mixed)
    )
    val current = GameGender.fromString(selectedGender).name

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = current == value,
                onClick = { onGenderSelected(value) },
                label = { Text(label) },
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .semantics { contentDescription = label }
            )
        }
    }
}

@Composable
private fun VisibilitySelector(
    selectedVisibility: GameVisibility,
    onVisibilitySelected: (GameVisibility) -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        VisibilityOption(
            icon = Icons.Default.Group,
            title = stringResource(R.string.create_game_visibility_group_only_label),
            description = stringResource(R.string.create_game_visibility_group_only),
            isSelected = selectedVisibility == GameVisibility.GROUP_ONLY,
            onClick = { onVisibilitySelected(GameVisibility.GROUP_ONLY) }
        )

        VisibilityOption(
            icon = Icons.Default.Lock,
            title = stringResource(R.string.create_game_visibility_public_closed),
            description = stringResource(R.string.create_game_visibility_public_closed_desc),
            isSelected = selectedVisibility == GameVisibility.PUBLIC_CLOSED,
            onClick = { onVisibilitySelected(GameVisibility.PUBLIC_CLOSED) }
        )

        VisibilityOption(
            icon = Icons.Default.Public,
            title = stringResource(R.string.create_game_visibility_public_open),
            description = stringResource(R.string.create_game_visibility_public_open_desc),
            isSelected = selectedVisibility == GameVisibility.PUBLIC_OPEN,
            onClick = { onVisibilitySelected(GameVisibility.PUBLIC_OPEN) }
        )
    }
}

@Composable
private fun VisibilityOption(
    icon: ImageVector,
    title: String,
    description: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        border = if (isSelected) {
            CardDefaults.outlinedCardBorder()
        } else null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface
                }
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    color = if (isSelected) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    }
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isSelected) {
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    } else {
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    }
                )
            }

            RadioButton(
                selected = isSelected,
                onClick = onClick
            )
        }
    }
}

// Composables para os dialogs Material3 serão criados em arquivos separados
// para manter a modularidade e reutilização
