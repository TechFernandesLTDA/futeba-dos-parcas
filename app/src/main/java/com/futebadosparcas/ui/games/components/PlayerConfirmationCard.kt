package com.futebadosparcas.ui.games.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.ConfirmationStatus
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.PaymentStatus
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.ui.games.presence.GuestBadge
import com.futebadosparcas.ui.games.presence.ReliabilityBadge
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.roundToInt

/**
 * Card de confirmacao de jogador com swipe actions para owner/admin.
 *
 * Issue #40: Quick Actions on Player Card
 * - Swipe left: Remove player
 * - Swipe right: Mark as paid
 * - Long press: Show options menu
 *
 * Tambem inclui:
 * - Issue #35: Status "A caminho" com ETA
 * - Issue #36: Status de check-in
 * - Issue #37: Badge de confiabilidade
 * - Issue #38: Badge de convidado
 * - Issue #39: Ordem de confirmacao
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerConfirmationCard(
    confirmation: GameConfirmation,
    canManage: Boolean,
    isCurrentUser: Boolean,
    gameDailyPrice: Double,
    onCardClick: () -> Unit,
    onRemovePlayer: () -> Unit,
    onTogglePayment: () -> Unit,
    onMarkPaid: () -> Unit,
    onUpdatePartialPayment: (Double) -> Unit,
    modifier: Modifier = Modifier,
    showOrder: Boolean = true,
    showReliability: Boolean = true
) {
    var showOptionsMenu by remember { mutableStateOf(false) }
    var showPartialPaymentDialog by remember { mutableStateOf(false) }

    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    // Swipeable state para acoes rapidas (Issue #40)
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.EndToStart -> {
                    if (canManage) {
                        onRemovePlayer()
                    }
                    false // Nao dismissar automaticamente
                }
                SwipeToDismissBoxValue.StartToEnd -> {
                    if (canManage) {
                        onMarkPaid()
                    }
                    false // Nao dismissar automaticamente
                }
                else -> false
            }
        }
    )

    if (canManage) {
        SwipeToDismissBox(
            state = dismissState,
            backgroundContent = {
                SwipeBackground(dismissState)
            },
            enableDismissFromStartToEnd = true,
            enableDismissFromEndToStart = true,
            modifier = modifier.padding(horizontal = 16.dp, vertical = 4.dp)
        ) {
            PlayerCardContent(
                confirmation = confirmation,
                canManage = canManage,
                isCurrentUser = isCurrentUser,
                gameDailyPrice = gameDailyPrice,
                showOrder = showOrder,
                showReliability = showReliability,
                timeFormat = timeFormat,
                showOptionsMenu = showOptionsMenu,
                onShowOptionsMenu = { showOptionsMenu = true },
                onDismissOptionsMenu = { showOptionsMenu = false },
                onCardClick = onCardClick,
                onRemovePlayer = onRemovePlayer,
                onTogglePayment = onTogglePayment,
                onShowPartialPayment = { showPartialPaymentDialog = true }
            )
        }
    } else {
        PlayerCardContent(
            confirmation = confirmation,
            canManage = canManage,
            isCurrentUser = isCurrentUser,
            gameDailyPrice = gameDailyPrice,
            showOrder = showOrder,
            showReliability = showReliability,
            timeFormat = timeFormat,
            showOptionsMenu = showOptionsMenu,
            onShowOptionsMenu = { showOptionsMenu = true },
            onDismissOptionsMenu = { showOptionsMenu = false },
            onCardClick = onCardClick,
            onRemovePlayer = onRemovePlayer,
            onTogglePayment = onTogglePayment,
            onShowPartialPayment = { showPartialPaymentDialog = true },
            modifier = modifier.padding(horizontal = 16.dp, vertical = 4.dp)
        )
    }

    // Dialog para pagamento parcial
    if (showPartialPaymentDialog) {
        PartialPaymentDialog(
            currentPartial = confirmation.partialPayment,
            totalPrice = gameDailyPrice,
            onDismiss = { showPartialPaymentDialog = false },
            onConfirm = { amount ->
                onUpdatePartialPayment(amount)
                showPartialPaymentDialog = false
            }
        )
    }
}

@Composable
private fun SwipeBackground(dismissState: SwipeToDismissBoxState) {
    val direction = dismissState.dismissDirection

    val color by animateColorAsState(
        when (dismissState.targetValue) {
            SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.errorContainer
            SwipeToDismissBoxValue.StartToEnd -> MaterialTheme.colorScheme.primaryContainer
            SwipeToDismissBoxValue.Settled -> MaterialTheme.colorScheme.surfaceContainerLow
        },
        label = "swipe_bg_color"
    )

    val alignment = when (direction) {
        SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
        SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
        else -> Alignment.Center
    }

    val icon = when (direction) {
        SwipeToDismissBoxValue.EndToStart -> Icons.Default.Delete
        SwipeToDismissBoxValue.StartToEnd -> Icons.Default.AttachMoney
        else -> null
    }

    val iconTint = when (direction) {
        SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.onErrorContainer
        SwipeToDismissBoxValue.StartToEnd -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurface
    }

    val scale by animateFloatAsState(
        if (dismissState.targetValue == SwipeToDismissBoxValue.Settled) 0.75f else 1f,
        label = "swipe_icon_scale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color, RoundedCornerShape(12.dp))
            .padding(horizontal = 20.dp),
        contentAlignment = alignment
    ) {
        icon?.let {
            Icon(
                imageVector = it,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.scale(scale)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlayerCardContent(
    confirmation: GameConfirmation,
    canManage: Boolean,
    isCurrentUser: Boolean,
    gameDailyPrice: Double,
    showOrder: Boolean,
    showReliability: Boolean,
    timeFormat: SimpleDateFormat,
    showOptionsMenu: Boolean,
    onShowOptionsMenu: () -> Unit,
    onDismissOptionsMenu: () -> Unit,
    onCardClick: () -> Unit,
    onRemovePlayer: () -> Unit,
    onTogglePayment: () -> Unit,
    onShowPartialPayment: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isPaid = confirmation.paymentStatus == PaymentStatus.PAID.name
    val hasPartial = confirmation.hasPartialPayment()
    val isGoalkeeper = confirmation.position == PlayerPosition.GOALKEEPER.name
    val isConfirmed = confirmation.status == ConfirmationStatus.CONFIRMED.name
    val isOnTheWay = confirmation.isComingToGame()
    val hasCheckedIn = confirmation.hasCheckedIn()

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(
                onClick = onCardClick,
                onClickLabel = stringResource(R.string.player_card_click)
            ),
        colors = CardDefaults.cardColors(
            containerColor = when {
                hasCheckedIn -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                isOnTheWay -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
                else -> MaterialTheme.colorScheme.surface
            }
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ordem de confirmacao (Issue #39)
            if (showOrder && confirmation.confirmationOrder > 0) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(
                            MaterialTheme.colorScheme.primaryContainer,
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${confirmation.confirmationOrder}",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
            }

            // Foto do jogador
            AsyncImage(
                model = confirmation.userPhoto,
                contentDescription = confirmation.userName,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Nome, posicao e status
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = confirmation.getDisplayName(),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )

                    // Badge de convidado (Issue #38)
                    if (confirmation.isGuest) {
                        Spacer(modifier = Modifier.width(6.dp))
                        GuestBadge()
                    }

                    // Badge de goleiro
                    if (isGoalkeeper) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.secondaryContainer
                        ) {
                            Text(
                                text = stringResource(R.string.goalkeeper_short),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                // Status especiais (Issue #35, #36)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    when {
                        hasCheckedIn -> {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = confirmation.checkedInAt?.let {
                                    stringResource(R.string.checkin_done_at, timeFormat.format(it))
                                } ?: stringResource(R.string.status_checked_in),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        isOnTheWay -> {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.DirectionsRun,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.tertiary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = confirmation.getEtaDisplay() ?: stringResource(R.string.status_on_the_way),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.tertiary
                            )
                        }
                        else -> {
                            // Horario de confirmacao
                            confirmation.confirmedAt?.let { confirmedAt ->
                                Text(
                                    text = timeFormat.format(confirmedAt),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }

            // Badge de confiabilidade (Issue #37)
            if (showReliability) {
                ReliabilityBadge(attendanceRate = confirmation.playerAttendanceRate)
                Spacer(modifier = Modifier.width(8.dp))
            }

            // Status de pagamento
            PaymentStatusBadge(
                isPaid = isPaid,
                hasPartial = hasPartial,
                partialAmount = confirmation.partialPayment,
                onClick = if (canManage || isCurrentUser) onTogglePayment else null
            )

            // Menu de opcoes para owner (Issue #40)
            if (canManage) {
                Box {
                    IconButton(onClick = onShowOptionsMenu) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = stringResource(R.string.more_options),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    DropdownMenu(
                        expanded = showOptionsMenu,
                        onDismissRequest = onDismissOptionsMenu
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    if (isPaid) stringResource(R.string.mark_unpaid)
                                    else stringResource(R.string.mark_paid)
                                )
                            },
                            onClick = {
                                onTogglePayment()
                                onDismissOptionsMenu()
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.AttachMoney,
                                    contentDescription = null,
                                    tint = if (isPaid) MaterialTheme.colorScheme.error
                                           else MaterialTheme.colorScheme.primary
                                )
                            }
                        )

                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.partial_payment)) },
                            onClick = {
                                onShowPartialPayment()
                                onDismissOptionsMenu()
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Payments,
                                    contentDescription = null
                                )
                            }
                        )

                        HorizontalDivider()

                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.remove_player)) },
                            onClick = {
                                onRemovePlayer()
                                onDismissOptionsMenu()
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.PersonRemove,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentStatusBadge(
    isPaid: Boolean,
    hasPartial: Boolean,
    partialAmount: Double,
    onClick: (() -> Unit)?
) {
    val containerColor = when {
        isPaid -> MaterialTheme.colorScheme.primaryContainer
        hasPartial -> MaterialTheme.colorScheme.tertiaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val contentColor = when {
        isPaid -> MaterialTheme.colorScheme.onPrimaryContainer
        hasPartial -> MaterialTheme.colorScheme.onTertiaryContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = containerColor,
        modifier = if (onClick != null) {
            Modifier.clickable(onClick = onClick)
        } else Modifier
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when {
                    isPaid -> Icons.Default.CheckCircle
                    hasPartial -> Icons.Default.AttachMoney
                    else -> Icons.Default.Schedule
                },
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = contentColor
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = when {
                    isPaid -> stringResource(R.string.paid)
                    hasPartial -> stringResource(R.string.partial_value, partialAmount)
                    else -> stringResource(R.string.pending_payment)
                },
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium,
                color = contentColor
            )
        }
    }
}

@Composable
private fun PartialPaymentDialog(
    currentPartial: Double,
    totalPrice: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var amount by remember { mutableStateOf(currentPartial.toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.partial_payment)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.partial_payment_description, totalPrice),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text(stringResource(R.string.amount)) },
                    prefix = { Text(stringResource(R.string.currency_prefix) + " ") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    amount.toDoubleOrNull()?.let { onConfirm(it) }
                }
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
