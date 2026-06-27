package com.futebadosparcas.ui.core

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.RemoveCircleOutline
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cancel
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.owner_block
import com.futebadosparcas.compose.resources.owner_block_player
import com.futebadosparcas.compose.resources.owner_block_player_dialog_desc
import com.futebadosparcas.compose.resources.owner_block_reason
import com.futebadosparcas.compose.resources.owner_block_reason_dialog_label
import com.futebadosparcas.compose.resources.owner_blocked_players
import com.futebadosparcas.compose.resources.owner_blocked_since
import com.futebadosparcas.compose.resources.owner_no_blocked_players
import com.futebadosparcas.compose.resources.owner_no_blocked_players_desc
import com.futebadosparcas.compose.resources.owner_no_players_to_block
import com.futebadosparcas.compose.resources.owner_select_player
import com.futebadosparcas.compose.resources.owner_unblock_player_cd
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource

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
            AdaptiveTopBar(
                title = stringResource(Res.string.owner_blocked_players),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showBlockDialog = true }) {
                        Icon(
                            Icons.Default.PersonAdd,
                            contentDescription = stringResource(Res.string.owner_block_player)
                        )
                    }
                }
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
                        text = stringResource(Res.string.owner_no_blocked_players),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(Res.string.owner_no_blocked_players_desc),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .widthIn(max = 920.dp),
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
                        text = stringResource(Res.string.owner_block_reason, player.reason),
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
                        text = stringResource(Res.string.owner_blocked_since, dateText),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            IconButton(onClick = onUnblock) {
                Icon(
                    imageVector = Icons.Default.RemoveCircleOutline,
                    contentDescription = stringResource(
                        Res.string.owner_unblock_player_cd,
                        player.userName
                    ),
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
        title = { Text(stringResource(Res.string.owner_block_player)) },
        text = {
            Column {
                Text(
                    text = stringResource(Res.string.owner_block_player_dialog_desc),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Player selection
                if (availablePlayers.isEmpty()) {
                    Text(
                        text = stringResource(Res.string.owner_no_players_to_block),
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    Text(
                        text = stringResource(Res.string.owner_select_player),
                        style = MaterialTheme.typography.labelLarge
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        modifier = Modifier.heightIn(max = 200.dp)
                    ) {
                        items(availablePlayers, key = { it.userId }) { player ->
                            val isSelected = selectedPlayer?.userId == player.userId
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .selectable(
                                        selected = isSelected,
                                        onClick = { selectedPlayer = player },
                                        role = Role.RadioButton
                                    )
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSelected,
                                    onClick = null
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
                        label = { Text(stringResource(Res.string.owner_block_reason_dialog_label)) },
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
                Text(stringResource(Res.string.owner_block))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.cancel))
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
