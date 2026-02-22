package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGameDialog(
    onDismiss: () -> Unit,
    onCreate: (WebGame) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }
    var endTime by remember { mutableStateOf("") }
    var locationName by remember { mutableStateOf("") }
    var locationAddress by remember { mutableStateOf("") }
    var gameType by remember { mutableStateOf("Society") }
    var maxPlayers by remember { mutableStateOf("14") }
    var dailyPrice by remember { mutableStateOf("") }
    var selectedGroupId by remember { mutableStateOf<String?>(null) }
    var selectedGroupName by remember { mutableStateOf<String?>(null) }
    var visibility by remember { mutableStateOf("GROUP_ONLY") }

    var titleError by remember { mutableStateOf<String?>(null) }
    var dateError by remember { mutableStateOf<String?>(null) }
    var timeError by remember { mutableStateOf<String?>(null) }
    var locationError by remember { mutableStateOf<String?>(null) }
    var maxPlayersError by remember { mutableStateOf<String?>(null) }

    var isLoading by remember { mutableStateOf(false) }
    var showGroupDropdown by remember { mutableStateOf(false) }
    var showGameTypeDropdown by remember { mutableStateOf(false) }
    var showVisibilityDropdown by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    var groups by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }

    LaunchedEffect(Unit) {
        groups = FirebaseManager.getUserGroups()
        if (groups.isNotEmpty() && selectedGroupId == null) {
            selectedGroupId = groups.first()["id"] as? String
            selectedGroupName = (groups.first()["name"] as? String) ?: (groups.first()["groupName"] as? String)
        }
    }

    val gameTypes = listOf("Society", "Futsal", "Grama", "Areia", "Campo")
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
            isLoading = true
            try {
                val game = WebGame(
                    id = "game_${jsGetTimestamp()}",
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
                onCreate(game)
            } finally {
                isLoading = false
            }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().heightIn(max = 700.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("⚽ Criar Jogo", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    TextButton(onClick = onDismiss) { Text("✕") }
                }

                HorizontalDivider()

                Column(
                    modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("📍 Local", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

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

                    Text("📅 Data e Horário", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

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

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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

                    OutlinedTextField(
                        value = endTime,
                        onValueChange = { endTime = it },
                        label = { Text("Término (opcional)") },
                        placeholder = { Text("HH:MM") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    Text("⚙️ Configurações", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

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
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )

                        ExposedDropdownMenu(
                            expanded = showGameTypeDropdown,
                            onDismissRequest = { showGameTypeDropdown = false }
                        ) {
                            gameTypes.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text(type) },
                                    onClick = { gameType = type; showGameTypeDropdown = false }
                                )
                            }
                        }
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
                            label = { Text("Valor (R$)") },
                            prefix = { Text("R$") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }

                    if (groups.isNotEmpty()) {
                        ExposedDropdownMenuBox(
                            expanded = showGroupDropdown,
                            onExpandedChange = { showGroupDropdown = it }
                        ) {
                            OutlinedTextField(
                                value = selectedGroupName ?: "Selecione um grupo",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Grupo") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showGroupDropdown) },
                                modifier = Modifier.fillMaxWidth().menuAnchor()
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
                    } else {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
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
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )

                        ExposedDropdownMenu(
                            expanded = showVisibilityDropdown,
                            onDismissRequest = { showVisibilityDropdown = false }
                        ) {
                            visibilityOptions.forEach { (value, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = { visibility = value; showVisibilityDropdown = false }
                                )
                            }
                        }
                    }
                }

                HorizontalDivider()

                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading
                    ) {
                        Text("Cancelar")
                    }

                    Button(
                        onClick = { handleCreate() },
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading && groups.isNotEmpty()
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("+ Criar")
                        }
                    }
                }
            }
        }
    }
}
