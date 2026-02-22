package com.futebadosparcas.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.firebase.jsGetTimestamp
import kotlinx.coroutines.launch

private sealed class CreateGameUiState {
    object Idle : CreateGameUiState()
    object Loading : CreateGameUiState()
    object Success : CreateGameUiState()
    data class Error(val message: String) : CreateGameUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGameScreen(
    onBackClick: () -> Unit,
    onGameCreated: (WebGame) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }
    var endTime by remember { mutableStateOf("") }
    var duration by remember { mutableStateOf("120") }
    var locationName by remember { mutableStateOf("") }
    var locationAddress by remember { mutableStateOf("") }
    var gameType by remember { mutableStateOf("Society") }
    var maxPlayers by remember { mutableStateOf("14") }
    var dailyPrice by remember { mutableStateOf("") }
    var pixKey by remember { mutableStateOf("") }
    var recurrence by remember { mutableStateOf("none") }
    var visibility by remember { mutableStateOf("GROUP_ONLY") }
    var selectedGroupId by remember { mutableStateOf<String?>(null) }
    var selectedGroupName by remember { mutableStateOf<String?>(null) }

    var titleError by remember { mutableStateOf<String?>(null) }
    var dateError by remember { mutableStateOf<String?>(null) }
    var timeError by remember { mutableStateOf<String?>(null) }
    var locationError by remember { mutableStateOf<String?>(null) }
    var maxPlayersError by remember { mutableStateOf<String?>(null) }

    var uiState by remember { mutableStateOf<CreateGameUiState>(CreateGameUiState.Idle) }
    var showLocationDropdown by remember { mutableStateOf(false) }
    var showGroupDropdown by remember { mutableStateOf(false) }
    var showGameTypeDropdown by remember { mutableStateOf(false) }
    var showRecurrenceDropdown by remember { mutableStateOf(false) }
    var showVisibilityDropdown by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    var groups by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }
    var locations by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }
    var locationSearchQuery by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        groups = FirebaseManager.getUserGroups()
        locations = FirebaseManager.getLocations()
        if (groups.isNotEmpty() && selectedGroupId == null) {
            selectedGroupId = groups.first()["id"] as? String
            selectedGroupName = (groups.first()["name"] as? String) ?: (groups.first()["groupName"] as? String)
        }
    }

    val filteredLocations = remember(locations, locationSearchQuery) {
        if (locationSearchQuery.isEmpty()) locations
        else locations.filter {
            val name = (it["name"] as? String ?: "").lowercase()
            val address = (it["address"] as? String ?: "").lowercase()
            val query = locationSearchQuery.lowercase()
            name.contains(query) || address.contains(query)
        }
    }

    val gameTypes = listOf("Society", "Futsal", "Campo", "Grama", "Areia")
    val recurrenceOptions = listOf(
        "none" to "Único",
        "weekly" to "Semanal",
        "biweekly" to "Quinzenal",
        "monthly" to "Mensal"
    )
    val visibilityOptions = listOf(
        "GROUP_ONLY" to "Apenas Grupo",
        "PUBLIC_CLOSED" to "Público (Fechado)",
        "PUBLIC_OPEN" to "Público (Aberto)"
    )

    fun validate(): Boolean {
        var isValid = true

        if (title.trim().length < 3) {
            titleError = "Título deve ter pelo menos 3 caracteres"
            isValid = false
        } else {
            titleError = null
        }

        if (date.isEmpty()) {
            dateError = "Selecione uma data"
            isValid = false
        } else {
            dateError = null
        }

        if (time.isEmpty()) {
            timeError = "Selecione um horário"
            isValid = false
        } else {
            timeError = null
        }

        if (locationName.trim().isEmpty()) {
            locationError = "Informe o local"
            isValid = false
        } else {
            locationError = null
        }

        val maxPlayersInt = maxPlayers.toIntOrNull()
        if (maxPlayersInt == null || maxPlayersInt < 4 || maxPlayersInt > 100) {
            maxPlayersError = "Mínimo 4, máximo 100 jogadores"
            isValid = false
        } else {
            maxPlayersError = null
        }

        return isValid
    }

    fun handleCreate() {
        if (!validate()) return

        scope.launch {
            uiState = CreateGameUiState.Loading
            try {
                val calculatedEndTime = if (endTime.isEmpty() && time.isNotEmpty() && duration.isNotEmpty()) {
                    val durationMin = duration.toIntOrNull() ?: 120
                    val parts = time.split(":")
                    if (parts.size == 2) {
                        val hour = parts[0].toIntOrNull() ?: 0
                        val minute = parts[1].toIntOrNull() ?: 0
                        val totalMinutes = hour * 60 + minute + durationMin
                        val endHour = (totalMinutes / 60) % 24
                        val endMinute = totalMinutes % 60
                        "${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}"
                    } else time
                } else endTime

                val game = WebGame(
                    id = "game_${jsGetTimestamp().toLong()}",
                    title = title.trim(),
                    date = date,
                    time = time,
                    locationName = locationName.trim(),
                    locationAddress = locationAddress.trim(),
                    status = "SCHEDULED",
                    playersCount = 0,
                    maxPlayers = maxPlayers.toInt(),
                    gameType = gameType,
                    dailyPrice = dailyPrice.toDoubleOrNull() ?: 0.0,
                    ownerName = FirebaseManager.getCurrentUserName() ?: "Organizador",
                    groupId = selectedGroupId,
                    groupName = selectedGroupName
                )
                uiState = CreateGameUiState.Success
                onGameCreated(game)
            } catch (e: Exception) {
                uiState = CreateGameUiState.Error(e.message ?: "Erro ao criar jogo")
            }
        }
    }

    val isLoading = uiState is CreateGameUiState.Loading

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Criar Jogo", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBackClick) {
                        Text("← Voltar", style = MaterialTheme.typography.bodyLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                AnimatedVisibility(
                    visible = uiState is CreateGameUiState.Error,
                    enter = slideInVertically() + fadeIn(),
                    exit = slideOutVertically() + fadeOut()
                ) {
                    (uiState as? CreateGameUiState.Error)?.message?.let { error ->
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
                                Text("⚠️", style = MaterialTheme.typography.titleMedium)
                                Text(
                                    text = error,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }

                SectionTitle("📝 Informações Básicas")

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it; titleError = null },
                    label = { Text("Título do jogo *") },
                    placeholder = { Text("Ex: Pelada do Sábado") },
                    isError = titleError != null,
                    supportingText = titleError?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                ExposedDropdownMenuBox(
                    expanded = showGroupDropdown,
                    onExpandedChange = { showGroupDropdown = it }
                ) {
                    OutlinedTextField(
                        value = selectedGroupName ?: "Selecione um grupo",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Grupo *") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showGroupDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        isError = groups.isEmpty()
                    )

                    ExposedDropdownMenu(
                        expanded = showGroupDropdown,
                        onDismissRequest = { showGroupDropdown = false }
                    ) {
                        groups.forEach { group ->
                            val groupName = group["name"] as? String ?: group["groupName"] as? String ?: ""
                            DropdownMenuItem(
                                text = { Text(groupName) },
                                onClick = {
                                    selectedGroupId = group["id"] as? String
                                    selectedGroupName = groupName
                                    showGroupDropdown = false
                                }
                            )
                        }
                    }
                }

                if (groups.isEmpty()) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("⚠️", style = MaterialTheme.typography.bodyLarge)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Você precisa estar em um grupo para criar jogos",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                SectionTitle("📍 Local")

                OutlinedTextField(
                    value = locationSearchQuery,
                    onValueChange = { 
                        locationSearchQuery = it
                        showLocationDropdown = it.isNotEmpty()
                    },
                    label = { Text("Buscar local *") },
                    placeholder = { Text("🔍 Digite para buscar...") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                AnimatedVisibility(
                    visible = showLocationDropdown && filteredLocations.isNotEmpty(),
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        LazyColumn(
                            modifier = Modifier.heightIn(max = 200.dp)
                        ) {
                            items(filteredLocations) { location ->
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            locationName = location["name"] as? String ?: ""
                                            locationAddress = location["address"] as? String ?: ""
                                            val fieldType = location["primaryFieldType"] as? String ?: "SOCIETY"
                                            gameType = when (fieldType.uppercase()) {
                                                "SOCIETY" -> "Society"
                                                "FUTSAL" -> "Futsal"
                                                "CAMPO" -> "Campo"
                                                else -> "Society"
                                            }
                                            locationSearchQuery = ""
                                            showLocationDropdown = false
                                            locationError = null
                                        }
                                        .padding(12.dp)
                                ) {
                                    Text(
                                        text = location["name"] as? String ?: "",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = location["address"] as? String ?: "",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                HorizontalDivider()
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = locationName,
                    onValueChange = { locationName = it; locationError = null },
                    label = { Text("Nome do local *") },
                    placeholder = { Text("Ex: Campo do Parque") },
                    isError = locationError != null,
                    supportingText = locationError?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = locationAddress,
                    onValueChange = { locationAddress = it },
                    label = { Text("Endereço (opcional)") },
                    placeholder = { Text("Ex: Rua das Palmeiras, 123") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                SectionTitle("📅 Data e Horário")

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = date,
                        onValueChange = { date = it; dateError = null },
                        label = { Text("Data *") },
                        placeholder = { Text("AAAA-MM-DD") },
                        isError = dateError != null,
                        supportingText = dateError?.let { { Text(it) } },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = time,
                        onValueChange = { time = it; timeError = null },
                        label = { Text("Início *") },
                        placeholder = { Text("HH:MM") },
                        isError = timeError != null,
                        supportingText = timeError?.let { { Text(it) } },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = endTime,
                        onValueChange = { endTime = it },
                        label = { Text("Término (opcional)") },
                        placeholder = { Text("HH:MM") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = duration,
                        onValueChange = { duration = it },
                        label = { Text("Duração (min)") },
                        placeholder = { Text("120") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                SectionTitle("⚽ Configurações do Jogo")

                ExposedDropdownMenuBox(
                    expanded = showGameTypeDropdown,
                    onExpandedChange = { showGameTypeDropdown = it }
                ) {
                    OutlinedTextField(
                        value = gameType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Tipo de campo") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showGameTypeDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )

                    ExposedDropdownMenu(
                        expanded = showGameTypeDropdown,
                        onDismissRequest = { showGameTypeDropdown = false }
                    ) {
                        gameTypes.forEach { type ->
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = getFieldTypeColor(type),
                                            modifier = Modifier.size(16.dp)
                                        ) {}
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(type)
                                    }
                                },
                                onClick = { gameType = type; showGameTypeDropdown = false }
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = maxPlayers,
                        onValueChange = { maxPlayers = it; maxPlayersError = null },
                        label = { Text("Max. jogadores *") },
                        isError = maxPlayersError != null,
                        supportingText = maxPlayersError?.let { { Text(it) } },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = dailyPrice,
                        onValueChange = { dailyPrice = it },
                        label = { Text("Valor por pessoa") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        prefix = { Text("R$") }
                    )
                }

                OutlinedTextField(
                    value = pixKey,
                    onValueChange = { pixKey = it },
                    label = { Text("Chave PIX para pagamento") },
                    placeholder = { Text("📱 CPF, email, telefone ou chave aleatória") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                SectionTitle("🔄 Recorrência e Visibilidade")

                ExposedDropdownMenuBox(
                    expanded = showRecurrenceDropdown,
                    onExpandedChange = { showRecurrenceDropdown = it }
                ) {
                    OutlinedTextField(
                        value = recurrenceOptions.find { it.first == recurrence }?.second ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Recorrência") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showRecurrenceDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )

                    ExposedDropdownMenu(
                        expanded = showRecurrenceDropdown,
                        onDismissRequest = { showRecurrenceDropdown = false }
                    ) {
                        recurrenceOptions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { recurrence = value; showRecurrenceDropdown = false }
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(
                    expanded = showVisibilityDropdown,
                    onExpandedChange = { showVisibilityDropdown = it }
                ) {
                    OutlinedTextField(
                        value = visibilityOptions.find { it.first == visibility }?.second ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Visibilidade") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showVisibilityDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )

                    ExposedDropdownMenu(
                        expanded = showVisibilityDropdown,
                        onDismissRequest = { showVisibilityDropdown = false }
                    ) {
                        visibilityOptions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(label)
                                        Text(
                                            when (value) {
                                                "GROUP_ONLY" -> "🔒 Apenas membros do grupo podem ver"
                                                "PUBLIC_CLOSED" -> "👀 Todos podem ver, mas apenas membros entram"
                                                else -> "🌐 Todos podem ver e entrar"
                                            },
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                },
                                onClick = { visibility = value; showVisibilityDropdown = false }
                            )
                        }
                    }
                }

                VisibilityInfoCard(visibility)

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onBackClick,
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading
                    ) {
                        Text("❌ Cancelar")
                    }

                    Button(
                        onClick = { handleCreate() },
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading && groups.isNotEmpty()
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("⚽ Criar Jogo")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }

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
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun VisibilityInfoCard(visibility: String) {
    val (icon, title, description) = when (visibility) {
        "GROUP_ONLY" -> Triple("🔒", "Apenas Grupo", "Somente membros do grupo poderão ver e participar deste jogo.")
        "PUBLIC_CLOSED" -> Triple("👀", "Público (Fechado)", "Qualquer pessoa poderá ver o jogo, mas apenas membros do grupo podem participar.")
        else -> Triple("🌐", "Público (Aberto)", "Todos podem ver e participar do jogo. Ideal para atrair novos jogadores.")
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Text(icon, style = MaterialTheme.typography.titleMedium)
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
