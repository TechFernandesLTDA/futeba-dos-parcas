package com.futebadosparcas.ui.games.owner
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.theme.BrandColors
import java.text.NumberFormat
import java.util.Locale

/**
 * Issue #61: Dashboard Financeiro do Jogo (Tela Completa)
 *
 * Exibe resumo financeiro completo para o organizador:
 * - Custo total do campo
 * - Total arrecadado
 * - Total pendente ou excedente
 * - Lista de jogadores com status de pagamento
 * - Calculo automatico do preco por jogador
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameFinancialDashboardScreen(
    game: Game,
    confirmations: List<GameConfirmation>,
    onMarkPayment: (String, Boolean) -> Unit,
    onMarkPartialPayment: (String, Double) -> Unit,
    onNavigateBack: () -> Unit
) {
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")) }

    // Calculos financeiros
    val confirmedPlayers = confirmations.filter { it.status == ConfirmationStatus.CONFIRMED.name }
    val totalPlayers = confirmedPlayers.size
    val pricePerPlayer = if (totalPlayers > 0) game.totalCost / totalPlayers else game.dailyPrice

    val paidPlayers = confirmedPlayers.filter { it.paymentStatus == PaymentStatus.PAID.name }
    val partialPlayers = confirmedPlayers.filter { it.hasPartialPayment() }
    val pendingPlayers = confirmedPlayers.filter {
        it.paymentStatus == PaymentStatus.PENDING.name && !it.hasPartialPayment()
    }

    val totalCollected = paidPlayers.size * pricePerPlayer +
        partialPlayers.sumOf { it.partialPayment }
    val totalPending = game.totalCost - totalCollected
    val surplus = totalCollected - game.totalCost

    var showPartialPaymentDialog by remember { mutableStateOf<GameConfirmation?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.owner_financial_dashboard)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Card de resumo principal
            item {
                FinancialSummaryCard(
                    totalCost = game.totalCost,
                    totalCollected = totalCollected,
                    totalPending = totalPending,
                    surplus = surplus,
                    currencyFormat = currencyFormat
                )
            }

            // Card de preco por jogador
            item {
                PricePerPlayerCard(
                    pricePerPlayer = pricePerPlayer,
                    totalPlayers = totalPlayers,
                    currencyFormat = currencyFormat
                )
            }

            // Status badges
            item {
                PaymentStatusSummary(
                    paidCount = paidPlayers.size,
                    partialCount = partialPlayers.size,
                    pendingCount = pendingPlayers.size
                )
            }

            // Secao de jogadores pagos
            if (paidPlayers.isNotEmpty()) {
                item {
                    Text(
                        text = stringResource(Res.string.owner_paid) + " (${paidPlayers.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = BrandColors.WhatsApp
                    )
                }
                items(paidPlayers, key = { it.id }) { player ->
                    PlayerPaymentCard(
                        player = player,
                        pricePerPlayer = pricePerPlayer,
                        currencyFormat = currencyFormat,
                        onTogglePaid = { onMarkPayment(player.userId, false) },
                        onMarkPartial = { showPartialPaymentDialog = player }
                    )
                }
            }

            // Secao de pagamentos parciais
            if (partialPlayers.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(Res.string.owner_partial) + " (${partialPlayers.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
                items(partialPlayers, key = { it.id }) { player ->
                    PlayerPaymentCard(
                        player = player,
                        pricePerPlayer = pricePerPlayer,
                        currencyFormat = currencyFormat,
                        onTogglePaid = { onMarkPayment(player.userId, true) },
                        onMarkPartial = { showPartialPaymentDialog = player }
                    )
                }
            }

            // Secao de pendentes
            if (pendingPlayers.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(Res.string.owner_pending_short) + " (${pendingPlayers.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                items(pendingPlayers, key = { it.id }) { player ->
                    PlayerPaymentCard(
                        player = player,
                        pricePerPlayer = pricePerPlayer,
                        currencyFormat = currencyFormat,
                        onTogglePaid = { onMarkPayment(player.userId, true) },
                        onMarkPartial = { showPartialPaymentDialog = player }
                    )
                }
            }
        }
    }

    // Dialog para pagamento parcial
    showPartialPaymentDialog?.let { player ->
        PartialPaymentDialog(
            playerName = player.userName,
            currentAmount = player.partialPayment,
            totalAmount = pricePerPlayer,
            onDismiss = { showPartialPaymentDialog = null },
            onConfirm = { amount ->
                onMarkPartialPayment(player.userId, amount)
                showPartialPaymentDialog = null
            }
        )
    }
}

/**
 * Card de resumo financeiro principal.
 */
@Composable
private fun FinancialSummaryCard(
    totalCost: Double,
    totalCollected: Double,
    totalPending: Double,
    surplus: Double,
    currencyFormat: NumberFormat
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = stringResource(Res.string.owner_financial_summary),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FinancialStatColumn(
                    label = stringResource(Res.string.owner_total_cost),
                    value = currencyFormat.format(totalCost),
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                FinancialStatColumn(
                    label = stringResource(Res.string.owner_collected),
                    value = currencyFormat.format(totalCollected),
                    color = if (totalCollected >= totalCost) BrandColors.WhatsApp
                           else MaterialTheme.colorScheme.onPrimaryContainer
                )
                FinancialStatColumn(
                    label = if (surplus >= 0) stringResource(Res.string.owner_surplus)
                           else stringResource(Res.string.owner_pending),
                    value = currencyFormat.format(if (surplus >= 0) surplus else totalPending.coerceAtLeast(0.0)),
                    color = if (surplus >= 0) BrandColors.WhatsApp
                           else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun FinancialStatColumn(
    label: String,
    value: String,
    color: Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color.copy(alpha = 0.7f)
        )
    }
}

/**
 * Card mostrando o preco por jogador.
 */
@Composable
private fun PricePerPlayerCard(
    pricePerPlayer: Double,
    totalPlayers: Int,
    currencyFormat: NumberFormat
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Outlined.Calculate,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = stringResource(Res.string.owner_per_player, currencyFormat.format(pricePerPlayer)),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = stringResource(Res.string.financial_split_among, totalPlayers),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Resumo visual com badges de status.
 */
@Composable
private fun PaymentStatusSummary(
    paidCount: Int,
    partialCount: Int,
    pendingCount: Int
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        StatusBadge(
            count = paidCount,
            label = stringResource(Res.string.owner_paid),
            color = BrandColors.WhatsApp
        )
        StatusBadge(
            count = partialCount,
            label = stringResource(Res.string.owner_partial),
            color = MaterialTheme.colorScheme.tertiary
        )
        StatusBadge(
            count = pendingCount,
            label = stringResource(Res.string.owner_pending_short),
            color = MaterialTheme.colorScheme.error
        )
    }
}

@Composable
private fun StatusBadge(
    count: Int,
    label: String,
    color: Color
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = color
        )
    }
}

/**
 * Card individual de pagamento do jogador.
 */
@Composable
private fun PlayerPaymentCard(
    player: GameConfirmation,
    pricePerPlayer: Double,
    currencyFormat: NumberFormat,
    onTogglePaid: () -> Unit,
    onMarkPartial: () -> Unit
) {
    val isPaid = player.paymentStatus == PaymentStatus.PAID.name
    val isPartial = player.hasPartialPayment()
    val remainingAmount = player.getRemainingPayment(pricePerPlayer)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when {
                isPaid -> BrandColors.WhatsApp.copy(alpha = 0.1f)
                isPartial -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.1f)
                else -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CachedProfileImage(
                photoUrl = player.userPhoto,
                userName = player.userName,
                size = 40.dp
            )
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.getDisplayName(),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                when {
                    isPaid -> {
                        Text(
                            text = stringResource(Res.string.financial_paid, currencyFormat.format(pricePerPlayer)),
                            style = MaterialTheme.typography.bodySmall,
                            color = BrandColors.WhatsApp
                        )
                    }
                    isPartial -> {
                        Text(
                            text = stringResource(
                                Res.string.owner_paid_partial_amount,
                                currencyFormat.format(player.partialPayment)
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                        Text(
                            text = stringResource(Res.string.financial_remaining, currencyFormat.format(remainingAmount)),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    else -> {
                        Text(
                            text = stringResource(Res.string.financial_owes, currencyFormat.format(pricePerPlayer)),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // Botao de pagamento parcial (apenas para nao pagos)
            if (!isPaid) {
                IconButton(onClick = onMarkPartial) {
                    Icon(
                        imageVector = Icons.Outlined.Payments,
                        contentDescription = stringResource(Res.string.owner_partial_payment),
                        tint = MaterialTheme.colorScheme.tertiary
                    )
                }
            }

            // Toggle de pago/nao pago
            Switch(
                checked = isPaid,
                onCheckedChange = { onTogglePaid() },
                thumbContent = if (isPaid) {
                    {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(SwitchDefaults.IconSize)
                        )
                    }
                } else null,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = BrandColors.WhatsApp,
                    checkedTrackColor = BrandColors.WhatsApp.copy(alpha = 0.5f)
                )
            )
        }
    }
}
