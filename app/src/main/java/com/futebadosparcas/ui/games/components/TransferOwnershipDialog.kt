package com.futebadosparcas.ui.games.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.ConfirmationStatus
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.ui.components.CachedProfileImage

/**
 * Issue #70: Dialog para transferir titularidade do jogo.
 *
 * Permite que o dono do jogo transfira a propriedade para outro jogador confirmado.
 * Inclui aviso de que a acao e irreversivel.
 */
@Composable
fun TransferOwnershipDialog(
    confirmations: List<GameConfirmation>,
    currentOwnerId: String,
    onDismiss: () -> Unit,
    onConfirm: (newOwnerId: String, newOwnerName: String) -> Unit
) {
    var selectedPlayer by remember { mutableStateOf<GameConfirmation?>(null) }
    var showConfirmation by remember { mutableStateOf(false) }

    // Jogadores elegiveis (confirmados, exceto o dono atual)
    val eligiblePlayers = confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name && it.userId != currentOwnerId
    }

    if (showConfirmation && selectedPlayer != null) {
        // Dialog de confirmacao final
        AlertDialog(
            onDismissRequest = { showConfirmation = false },
            icon = {
                Icon(
                    imageVector = Icons.Outlined.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error
                )
            },
            title = {
                Text(
                    text = stringResource(Res.string.transfer_confirm_title),
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = stringResource(Res.string.transfer_about_to),
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 8.dp)
                    ) {
                        CachedProfileImage(
                            photoUrl = selectedPlayer?.userPhoto,
                            userName = selectedPlayer?.userName ?: "",
                            size = 48.dp
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = selectedPlayer?.getDisplayName() ?: "",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            text = stringResource(Res.string.transfer_irreversible),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        selectedPlayer?.let {
                            onConfirm(it.userId, it.getDisplayName())
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.Default.SwapHoriz, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(Res.string.owner_confirm_transfer))
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmation = false }) {
                    Text(stringResource(Res.string.cancel))
                }
            }
        )
    } else {
        // Dialog principal de selecao
        AlertDialog(
            onDismissRequest = onDismiss,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.SwapHoriz,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(Res.string.owner_transfer_ownership))
                }
            },
            text = {
                Column {
                    // Aviso
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Warning,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = stringResource(Res.string.owner_transfer_warning),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (eligiblePlayers.isEmpty()) {
                        // Nenhum jogador disponivel
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Default.PersonOff,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = stringResource(Res.string.owner_no_players_to_transfer),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    } else {
                        Text(
                            text = stringResource(Res.string.transfer_select_organizer),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        // Lista de jogadores
                        LazyColumn(
                            modifier = Modifier.heightIn(max = 300.dp)
                        ) {
                            items(eligiblePlayers, key = { it.id }) { player ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedPlayer = player }
                                        .padding(vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    RadioButton(
                                        selected = selectedPlayer?.userId == player.userId,
                                        onClick = { selectedPlayer = player }
                                    )
                                    CachedProfileImage(
                                        photoUrl = player.userPhoto,
                                        userName = player.userName,
                                        size = 40.dp
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = player.getDisplayName(),
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Medium
                                        )
                                        if (player.nickname != null && player.nickname != player.userName) {
                                            Text(
                                                text = player.userName,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showConfirmation = true },
                    enabled = selectedPlayer != null,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(stringResource(Res.string.action_continue))
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(Res.string.cancel))
                }
            }
        )
    }
}
