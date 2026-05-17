package com.futebadosparcas.ui.core

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.RemoveCircleOutline
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.GameConfirmation

/**
 * Issue #64: Tela para gerenciar jogadores bloqueados (porte KMP).
 */
data class BlockedPlayerData(
    val userId: String,
    val userName: String,
    val reason: String,
    val blockedAt: Long? = null   // timestamp em millis
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BlockedPlayersScreen(
    blockedPlayers: List<BlockedPlayerData>,
    availablePlayers: List<GameConfirmation>,
    onBlockPlayer: (String, String, String) -> Unit,
    onUnblockPlayer: (String) -> Unit,
    onNavigateBack: () -> Unit
) {
    var showBlockDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Jogadores Bloqueados") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    IconButton(onClick = { showBlockDialog = true }) {
                        Icon(Icons.Default.PersonAdd, contentDescription = "Bloquear jogador")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        if (blockedPlayers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Block,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Nenhum jogador bloqueado",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Você pode bloquear jogadores que não cumprem as regras",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(blockedPlayers, key = { it.userId }) { player ->
                    BlockedPlayerCard(
                        player = player,
                        onUnblock = { onUnblockPlayer(player.userId) }
                    )
                }
            }
        }
    }

    if (showBlockDialog) {
        BlockPlayerDialog(
            availablePlayers = availablePlayers,
            onDismiss = { showBlockDialog = false },
            onBlock = { userId, userName, reason ->
                onBlockPlayer(userId, userName, reason)
                showBlockDialog = false
            }
        )
    }
}

@Composable
private fun BlockedPlayerCard(
    player: BlockedPlayerData,
    onUnblock: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Block,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(40.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = player.userName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.Default.SportsSoccer,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (player.reason.isNotBlank()) {
                    Text(
                        text = "Motivo: ${player.reason}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                player.blockedAt?.let { blockedAt ->
                    // Formatação simples do timestamp (dd/MM/yyyy) usando datas básicas
                    val dateText = formatTimestamp(blockedAt)
                    Text(
                        text = "Bloqueado desde $dateText",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            IconButton(onClick = onUnblock) {
                Icon(
                    imageVector = Icons.Default.RemoveCircleOutline,
                    contentDescription = "Desbloquear",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun BlockPlayerDialog(
    availablePlayers: List<GameConfirmation>,
    onDismiss: () -> Unit,
    onBlock: (String, String, String) -> Unit
) {
    var selectedPlayer by remember { mutableStateOf<GameConfirmation?>(null) }
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Bloquear Jogador") },
        text = {
            Column {
                Text(
                    text = "Selecione um jogador para bloquear e informe o motivo.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Player selection
                if (availablePlayers.isEmpty()) {
                    Text(
                        text = "Não há jogadores disponíveis para bloquear.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    Text(
                        text = "Selecione o jogador:",
                        style = MaterialTheme.typography.labelLarge
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        modifier = Modifier.heightIn(max = 200.dp)
                    ) {
                        items(availablePlayers, key = { it.userId }) { player ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = selectedPlayer?.userId == player.userId,
                                    onClick = { selectedPlayer = player }
                                )
                                AsyncImage(
                                    model = player.userPhoto,
                                    contentDescription = null,
                                    modifier = Modifier.size(32.dp),
                                    contentScale = ContentScale.Crop
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = player.getDisplayName(),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        imageVector = Icons.Default.SportsSoccer,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text("Motivo do bloqueio") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 2
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    selectedPlayer?.let {
                        onBlock(it.userId, it.userName, reason)
                    }
                },
                enabled = selectedPlayer != null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Bloquear")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

// Função auxiliar para formatar timestamp (em millis) para "dd/MM/yyyy"
private fun formatTimestamp(millis: Long): String {
    // Usa cálculo simples baseado em UTC
    val totalDays = millis / (24 * 60 * 60 * 1000)
    val year = 1970 + (totalDays / 365).toInt()
    val remainingDays = totalDays % 365
    val month = (remainingDays / 30).toInt() + 1
    val day = (remainingDays % 30).toInt() + 1
    return "${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/$year"
}