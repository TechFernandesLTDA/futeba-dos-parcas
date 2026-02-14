package com.futebadosparcas.ui.games.teamformation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.DraftPlayer
import com.futebadosparcas.data.model.PlayerPair
import com.futebadosparcas.ui.components.CachedProfileImage

/**
 * Secao de gerenciamento de pares de jogadores.
 * Permite adicionar jogadores que devem ficar no mesmo time.
 */
@Composable
fun PairPlayersSection(
    pairs: List<PlayerPair>,
    availablePlayers: List<DraftPlayer>,
    onAddPair: (String, String) -> Unit,
    onRemovePair: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showAddPairDialog by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Link,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.keep_together),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }

                TextButton(
                    onClick = { showAddPairDialog = true },
                    enabled = getAvailableForPairing(availablePlayers, pairs).size >= 2
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.add))
                }
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.keep_together_description),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(12.dp))

            // Lista de pares
            if (pairs.isEmpty()) {
                EmptyPairsPlaceholder()
            } else {
                pairs.forEach { pair ->
                    PairCard(
                        pair = pair,
                        onRemove = { onRemovePair(pair.player1Id, pair.player2Id) }
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }

    // Dialog para adicionar par
    if (showAddPairDialog) {
        AddPairDialog(
            players = getAvailableForPairing(availablePlayers, pairs),
            onDismiss = { showAddPairDialog = false },
            onConfirm = { player1Id, player2Id ->
                onAddPair(player1Id, player2Id)
                showAddPairDialog = false
            }
        )
    }
}

/**
 * Retorna jogadores disponiveis para formar pares.
 */
private fun getAvailableForPairing(
    players: List<DraftPlayer>,
    existingPairs: List<PlayerPair>
): List<DraftPlayer> {
    val pairedIds = existingPairs.flatMap { listOf(it.player1Id, it.player2Id) }.toSet()
    return players.filter { it.id !in pairedIds }
}

/**
 * Placeholder quando nao ha pares.
 */
@Composable
private fun EmptyPairsPlaceholder() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .background(
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                RoundedCornerShape(12.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.PeopleOutline,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.pair_players_none),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }
    }
}

/**
 * Card mostrando um par de jogadores com link visual.
 */
@Composable
private fun PairCard(
    pair: PlayerPair,
    onRemove: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val linkColor = MaterialTheme.colorScheme.primary

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Jogador 1
            PairPlayerChip(name = pair.player1Name)

            // Link visual
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(2.dp)
                    .padding(horizontal = 8.dp)
                    .drawBehind {
                        drawLine(
                            color = linkColor,
                            start = Offset(0f, size.height / 2),
                            end = Offset(size.width, size.height / 2),
                            strokeWidth = 2f,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 4f))
                        )
                    }
            )

            // Icone de link
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(MaterialTheme.colorScheme.primary, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Link,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }

            // Link visual
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(2.dp)
                    .padding(horizontal = 8.dp)
                    .drawBehind {
                        drawLine(
                            color = linkColor,
                            start = Offset(0f, size.height / 2),
                            end = Offset(size.width, size.height / 2),
                            strokeWidth = 2f,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 4f))
                        )
                    }
            )

            // Jogador 2
            PairPlayerChip(name = pair.player2Name)

            Spacer(Modifier.width(8.dp))

            // Botao remover
            IconButton(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onRemove()
                },
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = stringResource(R.string.remove),
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Chip com nome do jogador pareado.
 */
@Composable
private fun PairPlayerChip(name: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Text(
            text = name.split(" ").firstOrNull() ?: name,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Dialog para adicionar novo par.
 */
@Composable
private fun AddPairDialog(
    players: List<DraftPlayer>,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit
) {
    var player1 by remember { mutableStateOf<DraftPlayer?>(null) }
    var player2 by remember { mutableStateOf<DraftPlayer?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.keep_together),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.keep_together_description),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(16.dp))

                // Preview do par
                if (player1 != null || player2 != null) {
                    PairPreview(player1 = player1, player2 = player2)
                    Spacer(Modifier.height(16.dp))
                }

                // Selecao de jogadores
                Text(
                    text = stringResource(R.string.player_1),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(8.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(players, key = { it.id }) { player ->
                        val isSelected = player.id == player1?.id
                        val isDisabled = player.id == player2?.id

                        SelectablePlayerChip(
                            player = player,
                            isSelected = isSelected,
                            isDisabled = isDisabled,
                            onClick = {
                                if (!isDisabled) {
                                    player1 = if (isSelected) null else player
                                }
                            }
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.player_2),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(8.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(players, key = { it.id }) { player ->
                        val isSelected = player.id == player2?.id
                        val isDisabled = player.id == player1?.id

                        SelectablePlayerChip(
                            player = player,
                            isSelected = isSelected,
                            isDisabled = isDisabled,
                            onClick = {
                                if (!isDisabled) {
                                    player2 = if (isSelected) null else player
                                }
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    player1?.let { p1 ->
                        player2?.let { p2 ->
                            onConfirm(p1.id, p2.id)
                        }
                    }
                },
                enabled = player1 != null && player2 != null
            ) {
                Text(stringResource(R.string.add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

/**
 * Preview visual do par sendo criado.
 */
@Composable
private fun PairPreview(
    player1: DraftPlayer?,
    player2: DraftPlayer?
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Jogador 1
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (player1 != null) {
                CachedProfileImage(
                    photoUrl = player1.photoUrl,
                    userName = player1.name,
                    size = 48.dp
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = player1.name.split(" ").firstOrNull() ?: "",
                    style = MaterialTheme.typography.labelSmall
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("?", style = MaterialTheme.typography.titleMedium)
                }
            }
        }

        // Link
        Icon(
            imageVector = Icons.Default.Link,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        // Jogador 2
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (player2 != null) {
                CachedProfileImage(
                    photoUrl = player2.photoUrl,
                    userName = player2.name,
                    size = 48.dp
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = player2.name.split(" ").firstOrNull() ?: "",
                    style = MaterialTheme.typography.labelSmall
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("?", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

/**
 * Chip selecionavel de jogador.
 */
@Composable
private fun SelectablePlayerChip(
    player: DraftPlayer,
    isSelected: Boolean,
    isDisabled: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor by animateColorAsState(
        targetValue = when {
            isSelected -> MaterialTheme.colorScheme.primaryContainer
            isDisabled -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            else -> MaterialTheme.colorScheme.surface
        },
        animationSpec = spring(),
        label = "chipBg"
    )

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = backgroundColor,
        border = if (isSelected) {
            androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        } else null,
        modifier = Modifier
            .clickable(enabled = !isDisabled, onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.name,
                size = 32.dp
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelMedium,
                color = if (isDisabled) {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                } else {
                    MaterialTheme.colorScheme.onSurface
                }
            )
            if (isSelected) {
                Spacer(Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Indicador visual de jogadores pareados na lista de times.
 */
@Composable
fun PairedPlayerIndicator(
    isPaired: Boolean,
    partnerName: String?,
    modifier: Modifier = Modifier
) {
    if (!isPaired || partnerName == null) return

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Link,
            contentDescription = null,
            modifier = Modifier.size(12.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.width(4.dp))
        Text(
            text = "com ${partnerName.split(" ").firstOrNull() ?: ""}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary
        )
    }
}
