@file:OptIn(ExperimentalFoundationApi::class)

package com.futebadosparcas.ui.games.teamformation.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import android.content.ClipData
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.draganddrop.dragAndDropSource
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.DragAndDropTransferData
import androidx.compose.ui.draganddrop.mimeTypes
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.DraftPlayer
import com.futebadosparcas.domain.model.TeamColor
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.ui.components.CachedProfileImage

/**
 * Card de jogador arrastavel para formacao de times.
 * Suporta drag-and-drop com feedback visual e haptico.
 */
@Composable
fun DraggablePlayerCard(
    player: DraftPlayer,
    teamColor: Color?,
    modifier: Modifier = Modifier,
    isPaired: Boolean = false,
    pairedPlayerName: String? = null
) {
    val haptic = LocalHapticFeedback.current
    var isDragging by remember { mutableStateOf(false) }

    // Animacoes
    val scale by animateFloatAsState(
        targetValue = if (isDragging) 1.1f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "dragScale"
    )

    val alpha by animateFloatAsState(
        targetValue = if (isDragging) 0.6f else 1f,
        animationSpec = tween(durationMillis = 150),
        label = "dragAlpha"
    )

    val elevation by animateDpAsState(
        targetValue = if (isDragging) 12.dp else 2.dp,
        animationSpec = spring(stiffness = Spring.StiffnessLow),
        label = "dragElevation"
    )

    Card(
        modifier = modifier
            .scale(scale)
            .alpha(alpha)
            .shadow(elevation, RoundedCornerShape(12.dp))
            .dragAndDropSource(block = {
                detectTapGestures(
                    onLongPress = {
                        isDragging = true
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        startTransfer(
                            DragAndDropTransferData(
                                clipData = ClipData.newPlainText("playerId", player.id)
                            )
                        )
                    }
                )
            }),
        colors = CardDefaults.cardColors(
            containerColor = if (teamColor != null) {
                teamColor.copy(alpha = 0.1f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh
            }
        ),
        border = if (isPaired) {
            androidx.compose.foundation.BorderStroke(
                2.dp,
                MaterialTheme.colorScheme.primary
            )
        } else if (teamColor != null) {
            androidx.compose.foundation.BorderStroke(1.dp, teamColor.copy(alpha = 0.5f))
        } else null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Foto do jogador
            Box {
                CachedProfileImage(
                    photoUrl = player.photoUrl,
                    userName = player.name,
                    size = 48.dp
                )

                // Badge de posicao
                if (player.position == PlayerPosition.GOALKEEPER) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .size(20.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.tertiary
                    ) {
                        Box(
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "GK",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onTertiary
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.width(12.dp))

            // Informacoes do jogador
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Rating
                    RatingStars(rating = player.overallRating)

                    // Indicador de par
                    if (isPaired && pairedPlayerName != null) {
                        Spacer(Modifier.width(8.dp))
                        Icon(
                            imageVector = Icons.Default.Link,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = pairedPlayerName.split(" ").firstOrNull() ?: "",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // Icone de arrastar
            Icon(
                imageVector = Icons.Default.DragIndicator,
                contentDescription = stringResource(Res.string.drag_players_here),
                modifier = Modifier
                    .size(24.dp)
                    .alpha(0.5f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    // Resetar estado ao soltar
    DisposableEffect(isDragging) {
        onDispose {
            isDragging = false
        }
    }
}

/**
 * Estrelas de rating do jogador.
 */
@Composable
private fun RatingStars(
    rating: Float,
    maxRating: Float = 5f
) {
    Row {
        repeat(maxRating.toInt()) { index ->
            val filled = rating > index
            Icon(
                imageVector = if (filled) Icons.Default.Star else Icons.Default.StarBorder,
                contentDescription = null,
                modifier = Modifier.size(12.dp),
                tint = if (filled) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                }
            )
        }
    }
}

/**
 * Zona de drop para receber jogadores.
 * Usado nos cards de time para aceitar jogadores arrastados.
 */
@Composable
fun PlayerDropZone(
    teamColor: TeamColor,
    players: List<DraftPlayer>,
    onPlayerDropped: (String) -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    var isDragOver by remember { mutableStateOf(false) }

    val backgroundColor by animateColorAsState(
        targetValue = if (isDragOver) {
            Color(teamColor.hexValue).copy(alpha = 0.2f)
        } else {
            Color.Transparent
        },
        animationSpec = tween(durationMillis = 150),
        label = "dropZoneBg"
    )

    val borderColor by animateColorAsState(
        targetValue = if (isDragOver) {
            Color(teamColor.hexValue)
        } else {
            Color(teamColor.hexValue).copy(alpha = 0.3f)
        },
        animationSpec = tween(durationMillis = 150),
        label = "dropZoneBorder"
    )

    val dropTarget = remember {
        object : DragAndDropTarget {
            override fun onDrop(event: DragAndDropEvent): Boolean {
                val dragData = event.toAndroidDragEvent().clipData
                if (dragData.itemCount > 0) {
                    val playerId = dragData.getItemAt(0).text.toString()
                    onPlayerDropped(playerId)
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    return true
                }
                return false
            }

            override fun onEntered(event: DragAndDropEvent) {
                isDragOver = true
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            }

            override fun onExited(event: DragAndDropEvent) {
                isDragOver = false
            }

            override fun onEnded(event: DragAndDropEvent) {
                isDragOver = false
            }
        }
    }

    Box(
        modifier = modifier
            .background(backgroundColor, RoundedCornerShape(16.dp))
            .border(
                width = if (isDragOver) 3.dp else 2.dp,
                color = borderColor,
                shape = RoundedCornerShape(16.dp)
            )
            .dragAndDropTarget(
                shouldStartDragAndDrop = { event ->
                    event.mimeTypes().contains("text/plain")
                },
                target = dropTarget
            )
    ) {
        content()
    }
}

/**
 * Card de jogador compacto para lista horizontal.
 */
@Composable
fun CompactPlayerCard(
    player: DraftPlayer,
    teamColor: Color?,
    isSelected: Boolean = false,
    onClick: () -> Unit = {}
) {
    val haptic = LocalHapticFeedback.current

    Card(
        onClick = {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            onClick()
        },
        modifier = Modifier.width(80.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh
            }
        ),
        border = if (teamColor != null) {
            androidx.compose.foundation.BorderStroke(2.dp, teamColor)
        } else null
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.name,
                size = 48.dp
            )

            Spacer(Modifier.height(4.dp))

            Text(
                text = player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = "%.1f".format(player.overallRating),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

/**
 * Placeholder para quando nao ha jogadores.
 */
@Composable
fun EmptyPlayerDropZone(
    teamColor: TeamColor,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(100.dp)
            .background(
                Color(teamColor.hexValue).copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .border(
                2.dp,
                Color(teamColor.hexValue).copy(alpha = 0.2f),
                RoundedCornerShape(12.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.PersonAdd,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(Res.string.drag_players_here),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }
    }
}
