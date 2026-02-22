package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

enum class GameEventType(
    val label: String,
    val emoji: String
) {
    GOAL("Gol", "⚽"),
    ASSIST("Assistência", "🎯"),
    SAVE("Defesa", "🧤"),
    YELLOW_CARD("Cartão Amarelo", "🟨"),
    RED_CARD("Cartão Vermelho", "🟥")
}

@Composable
fun EventButton(
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant
        )
    ) {
        Text(
            text = "➕ ",
            style = MaterialTheme.typography.titleMedium
        )
        Text(
            text = "Adicionar Evento",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEventDialog(
    team1: TeamData,
    team2: TeamData,
    onDismiss: () -> Unit,
    onConfirm: (
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistId: String?,
        assistName: String?,
        minute: Int
    ) -> Unit
) {
    var selectedEventType by remember { mutableStateOf(GameEventType.GOAL) }
    var selectedTeamId by remember { mutableStateOf(team1.id) }
    var selectedPlayer by remember { mutableStateOf<PlayerData?>(null) }
    var selectedAssist by remember { mutableStateOf<PlayerData?>(null) }
    var minuteText by remember { mutableStateOf("") }
    var showConfirmation by remember { mutableStateOf(false) }

    val currentTeam = remember(selectedTeamId) {
        if (selectedTeamId == team1.id) team1 else team2
    }

    val currentPlayers = currentTeam.players

    if (showConfirmation && selectedPlayer != null) {
        ConfirmEventDialog(
            eventType = selectedEventType,
            playerName = selectedPlayer!!.name,
            teamName = currentTeam.name,
            minute = minuteText.toIntOrNull() ?: 0,
            assistName = selectedAssist?.name,
            onConfirm = {
                onConfirm(
                    selectedEventType,
                    selectedPlayer!!.id,
                    selectedPlayer!!.name,
                    selectedTeamId,
                    selectedAssist?.id,
                    selectedAssist?.name,
                    minuteText.toIntOrNull() ?: 0
                )
            },
            onDismiss = { showConfirmation = false }
        )
    } else {
        AlertDialog(
            onDismissRequest = onDismiss
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Adicionar Evento",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )

                    HorizontalDivider()

                    Text(
                        text = "Tipo de Evento",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )

                    EventTypeSelector(
                        selectedType = selectedEventType,
                        onTypeSelected = { selectedEventType = it }
                    )

                    HorizontalDivider()

                    Text(
                        text = "Time",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TeamChip(
                            name = team1.name,
                            color = team1.color,
                            selected = selectedTeamId == team1.id,
                            onClick = {
                                selectedTeamId = team1.id
                                selectedPlayer = null
                                selectedAssist = null
                            },
                            modifier = Modifier.weight(1f)
                        )
                        TeamChip(
                            name = team2.name,
                            color = team2.color,
                            selected = selectedTeamId == team2.id,
                            onClick = {
                                selectedTeamId = team2.id
                                selectedPlayer = null
                                selectedAssist = null
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    HorizontalDivider()

                    OutlinedTextField(
                        value = minuteText,
                        onValueChange = { minuteText = it.filter { c -> c.isDigit() }.take(3) },
                        label = { Text("Minuto") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    PlayerDropdown(
                        label = "Jogador",
                        players = currentPlayers,
                        selectedPlayer = selectedPlayer,
                        onPlayerSelected = { selectedPlayer = it }
                    )

                    if (selectedEventType == GameEventType.GOAL) {
                        PlayerDropdown(
                            label = "Assistência (opcional)",
                            players = currentPlayers.filter { it.id != selectedPlayer?.id },
                            selectedPlayer = selectedAssist,
                            onPlayerSelected = { selectedAssist = it },
                            allowNone = true
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Cancelar")
                        }
                        Button(
                            onClick = {
                                if (selectedPlayer != null) {
                                    showConfirmation = true
                                }
                            },
                            enabled = selectedPlayer != null,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Confirmar")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EventTypeSelector(
    selectedType: GameEventType,
    onTypeSelected: (GameEventType) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        GameEventType.entries.take(5).forEach { type ->
            FilterChip(
                selected = selectedType == type,
                onClick = { onTypeSelected(type) },
                label = {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = type.emoji)
                        Text(
                            text = type.label,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                },
                modifier = Modifier.weight(1f),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }
}

@Composable
private fun TeamChip(
    name: String,
    color: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(name) },
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
        )
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlayerDropdown(
    label: String,
    players: List<PlayerData>,
    selectedPlayer: PlayerData?,
    onPlayerSelected: (PlayerData?) -> Unit,
    allowNone: Boolean = false
) {
    var expanded by remember { mutableStateOf(false) }

    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(4.dp))

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it }
        ) {
            OutlinedTextField(
                value = selectedPlayer?.name ?: if (allowNone && selectedPlayer == null) "Nenhum" else "",
                onValueChange = {},
                readOnly = true,
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                if (allowNone) {
                    DropdownMenuItem(
                        text = { Text("Nenhum") },
                        onClick = {
                            onPlayerSelected(null)
                            expanded = false
                        }
                    )
                }

                players.forEach { player ->
                    DropdownMenuItem(
                        text = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(player.name)
                                if (player.position == "GK") {
                                    Text(
                                        text = "🧤",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        },
                        onClick = {
                            onPlayerSelected(player)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ConfirmEventDialog(
    eventType: GameEventType,
    playerName: String,
    teamName: String,
    minute: Int,
    assistName: String?,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Text(
                text = eventType.emoji,
                style = MaterialTheme.typography.displayMedium
            )
        },
        title = {
            Text("Confirmar ${eventType.label}?")
        },
        text = {
            Column {
                Text(
                    text = "$playerName ($teamName)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (minute > 0) {
                    Text(
                        text = "Minuto: $minute'",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                if (assistName != null) {
                    Text(
                        text = "🎯 Assistência: $assistName",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text("Confirmar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Editar")
            }
        }
    )
}
