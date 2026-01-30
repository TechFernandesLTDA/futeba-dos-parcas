package com.futebadosparcas.ui.games.owner

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.BlockedPlayer
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Issue #64: Tela para gerenciar jogadores bloqueados
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BlockedPlayersScreen(
    blockedPlayers: List<BlockedPlayer>,
    availablePlayers: List<GameConfirmation>,
    onBlockPlayer: (String, String, String) -> Unit,
    onUnblockPlayer: (String) -> Unit,
    onNavigateBack: () -> Unit
) {
    var showBlockDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.owner_blocked_players)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                    }
                },
                actions = {
                    IconButton(onClick = { showBlockDialog = true }) {
                        Icon(Icons.Outlined.PersonAdd, stringResource(R.string.owner_block_player))
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
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.owner_no_blocked_players),
                        description = stringResource(R.string.owner_no_blocked_players_desc)
                    )
                )
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
    player: BlockedPlayer,
    onUnblock: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")) }

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
                imageVector = Icons.Outlined.Block,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(40.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.userName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                if (player.reason.isNotBlank()) {
                    Text(
                        text = stringResource(R.string.owner_block_reason, player.reason),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                player.blockedAt?.let { date ->
                    Text(
                        text = stringResource(
                            R.string.owner_blocked_since,
                            dateFormat.format(date)
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            IconButton(onClick = onUnblock) {
                Icon(
                    imageVector = Icons.Default.RemoveCircleOutline,
                    contentDescription = stringResource(R.string.owner_unblock),
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
        title = { Text(stringResource(R.string.owner_block_player)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.owner_block_player_desc),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Player selection
                if (availablePlayers.isEmpty()) {
                    Text(
                        text = stringResource(R.string.owner_no_players_to_block),
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    Text(
                        text = stringResource(R.string.owner_select_player),
                        style = MaterialTheme.typography.labelLarge
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        modifier = Modifier.heightIn(max = 200.dp)
                    ) {
                        items(availablePlayers) { player ->
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
                                CachedProfileImage(
                                    photoUrl = player.userPhoto,
                                    userName = player.userName,
                                    size = 32.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = player.getDisplayName(),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text(stringResource(R.string.owner_block_reason_label)) },
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
                Text(stringResource(R.string.owner_block))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
