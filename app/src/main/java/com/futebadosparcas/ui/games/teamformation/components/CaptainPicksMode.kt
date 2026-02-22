package com.futebadosparcas.ui.games.teamformation.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.domain.model.DraftPlayer
import com.futebadosparcas.data.model.DraftState
import com.futebadosparcas.domain.model.TeamColor
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Componente principal do modo de escolha por capitaes.
 * Exibe turno atual, timer e jogadores disponiveis.
 */
@Composable
fun CaptainPicksPanel(
    draftState: DraftState.InProgress,
    availablePlayers: List<DraftPlayer>,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    onPlayerPicked: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    val currentTeamColor = if (draftState.isTeam1Turn) teamAColor else teamBColor

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header com capitao e timer
            CaptainPickHeader(
                draftState = draftState,
                teamColor = currentTeamColor
            )

            Spacer(Modifier.height(16.dp))

            HorizontalDivider()

            Spacer(Modifier.height(16.dp))

            // Jogadores disponiveis
            Text(
                text = stringResource(R.string.captain_pick_choose_player),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(12.dp))

            // Lista de jogadores
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(horizontal = 4.dp)
            ) {
                items(availablePlayers, key = { it.id }) { player ->
                    PickablePlayerCard(
                        player = player,
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onPlayerPicked(player.id)
                        }
                    )
                }
            }

            // Instrucoes
            Spacer(Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.captain_pick_tap_to_add),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/**
 * Header com informacoes do capitao atual e timer.
 */
@Composable
private fun CaptainPickHeader(
    draftState: DraftState.InProgress,
    teamColor: TeamColor
) {
    val colorValue = Color(teamColor.hexValue)
    val isLowTime = draftState.timerSeconds <= 10

    // Animacao de pulso quando tempo baixo
    val pulseScale by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 1f,
        targetValue = if (isLowTime) 1.15f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "timerPulse"
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Info do capitao
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Indicador de cor do time
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(colorValue, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.EmojiEvents,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = Color.White
                )
            }

            Spacer(Modifier.width(12.dp))

            Column {
                Text(
                    text = stringResource(R.string.captain_turn, draftState.currentPickerName),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = stringResource(R.string.pick_number, draftState.pickNumber),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Timer
        Surface(
            modifier = Modifier.scale(pulseScale),
            shape = CircleShape,
            color = if (isLowTime) {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.primaryContainer
            }
        ) {
            Box(
                modifier = Modifier.size(56.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${draftState.timerSeconds}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isLowTime) {
                        MaterialTheme.colorScheme.onErrorContainer
                    } else {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    }
                )
            }
        }
    }
}

/**
 * Card de jogador selecionavel durante escolha do capitao.
 */
@Composable
private fun PickablePlayerCard(
    player: DraftPlayer,
    onClick: () -> Unit
) {
    var isPressed by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessLow),
        label = "pickScale"
    )

    Card(
        onClick = {
            isPressed = true
            onClick()
        },
        modifier = Modifier
            .width(100.dp)
            .scale(scale),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 2.dp,
            pressedElevation = 8.dp
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Foto
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.name,
                size = 56.dp
            )

            Spacer(Modifier.height(8.dp))

            // Nome
            Text(
                text = player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            // Rating
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(Modifier.width(2.dp))
                Text(
                    text = "%.1f".format(player.overallRating),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Posicao
            Text(
                text = if (player.position == PlayerPosition.GOALKEEPER) "GK" else "LINHA",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Dialog para selecao dos capitaes.
 */
@Composable
fun CaptainSelectionDialog(
    players: List<DraftPlayer>,
    onDismiss: () -> Unit,
    onConfirm: (captain1Id: String, captain2Id: String) -> Unit
) {
    var captain1 by remember { mutableStateOf<DraftPlayer?>(null) }
    var captain2 by remember { mutableStateOf<DraftPlayer?>(null) }
    var currentSelection by remember { mutableIntStateOf(1) } // 1 ou 2

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.select_captains),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                // Instrucoes
                Text(
                    text = stringResource(R.string.captain_pick_alternating),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(16.dp))

                // Capitaes selecionados
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    CaptainSlot(
                        number = 1,
                        player = captain1,
                        isSelected = currentSelection == 1,
                        onClick = { currentSelection = 1 },
                        onRemove = { captain1 = null }
                    )

                    Text(
                        text = "VS",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.align(Alignment.CenterVertically)
                    )

                    CaptainSlot(
                        number = 2,
                        player = captain2,
                        isSelected = currentSelection == 2,
                        onClick = { currentSelection = 2 },
                        onRemove = { captain2 = null }
                    )
                }

                Spacer(Modifier.height(16.dp))

                HorizontalDivider()

                Spacer(Modifier.height(16.dp))

                // Lista de jogadores
                Text(
                    text = stringResource(R.string.captain_pick_select_captain, stringResource(if (currentSelection == 1) R.string.captain_1 else R.string.captain_2)),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(8.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(players, key = { it.id }) { player ->
                        val isAlreadySelected = player.id == captain1?.id || player.id == captain2?.id

                        CaptainCandidateChip(
                            player = player,
                            isDisabled = isAlreadySelected,
                            onClick = {
                                if (!isAlreadySelected) {
                                    if (currentSelection == 1) {
                                        captain1 = player
                                        currentSelection = 2
                                    } else {
                                        captain2 = player
                                    }
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
                    captain1?.let { c1 ->
                        captain2?.let { c2 ->
                            onConfirm(c1.id, c2.id)
                        }
                    }
                },
                enabled = captain1 != null && captain2 != null
            ) {
                Text(stringResource(R.string.start))
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
 * Slot para exibir capitao selecionado.
 */
@Composable
private fun CaptainSlot(
    number: Int,
    player: DraftPlayer?,
    isSelected: Boolean,
    onClick: () -> Unit,
    onRemove: () -> Unit
) {
    val borderColor = if (isSelected) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.outline
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = stringResource(if (number == 1) R.string.captain_1 else R.string.captain_2),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(4.dp))

        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(
                    if (player != null) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                )
                .border(3.dp, borderColor, CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            if (player != null) {
                Box {
                    CachedProfileImage(
                        photoUrl = player.photoUrl,
                        userName = player.name,
                        size = 74.dp
                    )

                    // Botao remover
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(24.dp)
                            .background(
                                MaterialTheme.colorScheme.errorContainer,
                                CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.remove),
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            } else {
                Icon(
                    imageVector = Icons.Default.PersonAdd,
                    contentDescription = null,
                    modifier = Modifier.size(32.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (player != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

/**
 * Chip para selecao de candidato a capitao.
 */
@Composable
private fun CaptainCandidateChip(
    player: DraftPlayer,
    isDisabled: Boolean,
    onClick: () -> Unit
) {
    FilterChip(
        selected = isDisabled,
        onClick = onClick,
        enabled = !isDisabled,
        label = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(player.name.split(" ").firstOrNull() ?: player.name)
                Spacer(Modifier.width(4.dp))
                Text(
                    text = "%.1f".format(player.overallRating),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isDisabled) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.primary
                    }
                )
            }
        },
        leadingIcon = if (isDisabled) {
            {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        } else null
    )
}

/**
 * Indicador de progresso do snake draft.
 * Mostra qual time escolhe a cada rodada.
 */
@Composable
fun SnakeDraftIndicator(
    currentPick: Int,
    totalPicks: Int,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Mostrar sequencia de picks (snake: 1,2,2,1,1,2,2...)
        repeat(minOf(totalPicks, 8)) { index ->
            val pickNumber = index + 1
            val roundNumber = (pickNumber - 1) / 2
            val isTeam1 = if (roundNumber % 2 == 0) {
                (pickNumber - 1) % 2 == 0
            } else {
                (pickNumber - 1) % 2 == 1
            }

            val color = if (isTeam1) teamAColor else teamBColor
            val isCurrent = pickNumber == currentPick
            val isPast = pickNumber < currentPick

            Box(
                modifier = Modifier
                    .size(if (isCurrent) 24.dp else 16.dp)
                    .background(
                        if (isPast) {
                            Color(color.hexValue).copy(alpha = 0.3f)
                        } else if (isCurrent) {
                            Color(color.hexValue)
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        },
                        CircleShape
                    )
                    .border(
                        if (isCurrent) 2.dp else 0.dp,
                        MaterialTheme.colorScheme.primary,
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (isCurrent) {
                    Text(
                        text = pickNumber.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            if (index < minOf(totalPicks, 8) - 1) {
                Spacer(Modifier.width(4.dp))
            }
        }

        if (totalPicks > 8) {
            Spacer(Modifier.width(8.dp))
            Text(
                text = "...",
                style = MaterialTheme.typography.labelMedium
            )
        }
    }
}
