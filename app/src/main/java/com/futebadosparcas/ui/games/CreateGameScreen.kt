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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.GameVisibility
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.util.HapticManager
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

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
    viewModel: CreateGameViewModel = hiltViewModel(),
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

    val context = LocalContext.current

    // Carregar jogo se estiver editando
    LaunchedEffect(gameId) {
        gameId?.let {
            viewModel.loadGame(it)
        }
    }

    // Preencher form quando carregar jogo para edição
    LaunchedEffect(uiState) {
        if (uiState is CreateGameUiState.Editing) {
            val game = (uiState as CreateGameUiState.Editing).game
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
    LaunchedEffect(uiState) {
        when (uiState) {
            is CreateGameUiState.Success -> {
                val game = (uiState as CreateGameUiState.Success).game
                hapticManager?.tick() // Success feedback
                onGameCreated(game.id)
            }
            is CreateGameUiState.Error -> {
                hapticManager?.error()
            }
            else -> Unit
        }
    }

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
            recurrenceEnabled = recurrenceEnabled,
            onRecurrenceEnabledChange = { recurrenceEnabled = it },
            recurrenceType = recurrenceType,
            onRecurrenceTypeChange = { recurrenceType = it },
            timeConflicts = timeConflicts,
            onCancelClick = {
                hapticManager.tick()
                onNavigateBack()
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
                if (maxPlayersValue == null || maxPlayersValue < 4 || maxPlayersValue > 100) {
                    maxPlayersError = context.getString(R.string.create_game_error_max_players)
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
                    viewModel.setField(field)
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
    recurrenceEnabled: Boolean,
    onRecurrenceEnabledChange: (Boolean) -> Unit,
    recurrenceType: String,
    onRecurrenceTypeChange: (String) -> Unit,
    timeConflicts: List<com.futebadosparcas.data.repository.TimeConflict>,
    onCancelClick: () -> Unit,
    onSaveClick: () -> Unit,
    isLoading: Boolean,
    errorMessage: String?
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
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
                            contentDescription = null,
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
                            Text(
                                text = "Conflito com ${conflict.conflictingGame.ownerName} (${conflict.conflictingGame.time} - ${conflict.conflictingGame.endTime})",
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
                    contentDescription = null
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
                        contentDescription = null
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
                        contentDescription = null
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
                supportingText = priceError?.let { { Text(it) } },
                modifier = Modifier.weight(1f),
                singleLine = true,
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
                supportingText = maxPlayersError?.let { { Text(it) } },
                modifier = Modifier.weight(1f),
                singleLine = true
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
