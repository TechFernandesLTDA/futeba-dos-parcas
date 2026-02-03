package com.futebadosparcas.ui.games.owner

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.ui.components.CachedProfileImage
import java.text.NumberFormat
import java.util.Locale

/**
 * Issue #61: Dashboard Financeiro do Jogo
 * Mostra resumo de pagamentos: quem pagou, quem deve, total arrecadado vs custo.
 */
@Composable
fun GameFinancialSummary(
    game: Game,
    confirmations: List<GameConfirmation>,
    onMarkPayment: (String, Boolean) -> Unit,
    onMarkPartialPayment: (String, Double) -> Unit,
    modifier: Modifier = Modifier
) {
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale("pt", "BR")) }

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

    var expanded by remember { mutableStateOf(false) }
    var showPartialPaymentDialog by remember { mutableStateOf<GameConfirmation?>(null) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header com expansao
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.AttachMoney,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.owner_financial_dashboard),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Resumo principal sempre visivel
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FinancialStatItem(
                    label = stringResource(R.string.owner_total_cost),
                    value = currencyFormat.format(game.totalCost),
                    color = MaterialTheme.colorScheme.onSurface
                )
                FinancialStatItem(
                    label = stringResource(R.string.owner_collected),
                    value = currencyFormat.format(totalCollected),
                    color = if (totalCollected >= game.totalCost)
                        com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                    else MaterialTheme.colorScheme.primary
                )
                FinancialStatItem(
                    label = if (surplus >= 0) stringResource(R.string.owner_surplus)
                           else stringResource(R.string.owner_pending),
                    value = currencyFormat.format(if (surplus >= 0) surplus else totalPending.coerceAtLeast(0.0)),
                    color = if (surplus >= 0) com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                           else MaterialTheme.colorScheme.error
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Preco por jogador
            Text(
                text = stringResource(R.string.owner_per_player, currencyFormat.format(pricePerPlayer)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Lista detalhada (expandida)
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(modifier = Modifier.padding(top = 16.dp)) {
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(12.dp))

                    // Status badges
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        PaymentStatusBadge(
                            count = paidPlayers.size,
                            label = stringResource(R.string.owner_paid),
                            color = com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                        )
                        PaymentStatusBadge(
                            count = partialPlayers.size,
                            label = stringResource(R.string.owner_partial),
                            color = MaterialTheme.colorScheme.tertiary
                        )
                        PaymentStatusBadge(
                            count = pendingPlayers.size,
                            label = stringResource(R.string.owner_pending_short),
                            color = MaterialTheme.colorScheme.error
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Lista de jogadores com status de pagamento
                    Text(
                        text = stringResource(R.string.owner_payment_list),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    confirmedPlayers.forEach { player ->
                        PlayerPaymentRow(
                            player = player,
                            pricePerPlayer = pricePerPlayer,
                            onTogglePaid = { onMarkPayment(player.userId, it) },
                            onMarkPartial = { showPartialPaymentDialog = player }
                        )
                    }
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

@Composable
private fun FinancialStatItem(
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
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PaymentStatusBadge(
    count: Int,
    label: String,
    color: Color
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 4.dp)
    ) {
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

@Composable
private fun PlayerPaymentRow(
    player: GameConfirmation,
    pricePerPlayer: Double,
    onTogglePaid: (Boolean) -> Unit,
    onMarkPartial: () -> Unit
) {
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale("pt", "BR")) }
    val isPaid = player.paymentStatus == PaymentStatus.PAID.name
    val isPartial = player.hasPartialPayment()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        CachedProfileImage(
            photoUrl = player.userPhoto,
            userName = player.userName,
            size = 32.dp
        )
        Spacer(modifier = Modifier.width(8.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = player.getDisplayName(),
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (isPartial) {
                Text(
                    text = stringResource(
                        R.string.owner_paid_partial_amount,
                        currencyFormat.format(player.partialPayment)
                    ),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }
        }

        // Botao de pagamento parcial
        if (!isPaid) {
            IconButton(onClick = onMarkPartial) {
                Icon(
                    imageVector = Icons.Outlined.Payments,
                    contentDescription = stringResource(R.string.owner_partial_payment),
                    tint = MaterialTheme.colorScheme.tertiary
                )
            }
        }

        // Checkbox de pago
        Checkbox(
            checked = isPaid,
            onCheckedChange = onTogglePaid,
            colors = CheckboxDefaults.colors(
                checkedColor = com.futebadosparcas.ui.theme.BrandColors.WhatsApp
            )
        )
    }
}

/**
 * Issue #69: Dialog para pagamento parcial
 */
@Composable
fun PartialPaymentDialog(
    playerName: String,
    currentAmount: Double,
    totalAmount: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var amount by remember { mutableStateOf(if (currentAmount > 0) currentAmount.toString() else "") }
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale("pt", "BR")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.owner_partial_payment)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.owner_partial_payment_for, playerName),
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.owner_total_due, currencyFormat.format(totalAmount)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                    label = { Text(stringResource(R.string.owner_amount_paid)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    prefix = { Text(stringResource(R.string.currency_prefix) + " ") }
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val parsedAmount = amount.replace(",", ".").toDoubleOrNull() ?: 0.0
                    onConfirm(parsedAmount)
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

/**
 * Issue #62: Dialog para enviar mensagem em massa
 */
@Composable
fun MassMessageDialog(
    game: Game,
    confirmations: List<GameConfirmation>,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var selectedTemplate by remember { mutableStateOf(0) }
    var onlyUnpaid by remember { mutableStateOf(false) }
    var customMessage by remember { mutableStateOf("") }

    val templates = listOf(
        stringResource(R.string.owner_template_confirmed),
        stringResource(R.string.owner_template_reminder),
        stringResource(R.string.owner_template_pix)
    )

    val templateMessages = listOf(
        stringResource(R.string.owner_template_confirmed_msg, game.date, game.time, game.locationName),
        stringResource(R.string.owner_template_reminder_msg, game.date, game.time),
        stringResource(R.string.owner_template_pix_msg, game.pixKey, game.dailyPrice)
    )

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.owner_mass_message),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Template selection
                Text(
                    text = stringResource(R.string.owner_select_template),
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))

                templates.forEachIndexed { index, template ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedTemplate = index }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedTemplate == index,
                            onClick = { selectedTemplate = index }
                        )
                        Text(text = template, style = MaterialTheme.typography.bodyMedium)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Filtro apenas nao pagos
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = onlyUnpaid,
                        onCheckedChange = { onlyUnpaid = it }
                    )
                    Text(
                        text = stringResource(R.string.owner_only_unpaid),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Preview da mensagem
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = templateMessages[selectedTemplate],
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(12.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Botoes
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.cancel))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val recipients = if (onlyUnpaid) {
                                confirmations.filter {
                                    it.status == ConfirmationStatus.CONFIRMED.name &&
                                    it.paymentStatus != PaymentStatus.PAID.name
                                }
                            } else {
                                confirmations.filter { it.status == ConfirmationStatus.CONFIRMED.name }
                            }

                            // Abrir WhatsApp com mensagem
                            val message = templateMessages[selectedTemplate]
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                data = Uri.parse("https://wa.me/?text=${Uri.encode(message)}")
                            }
                            context.startActivity(intent)
                            onDismiss()
                        }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(stringResource(R.string.owner_send_message))
                    }
                }
            }
        }
    }
}

/**
 * Issue #63: Dialog para delegar administracao
 */
@Composable
fun DelegateAdminDialog(
    confirmations: List<GameConfirmation>,
    currentCoOrganizers: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (List<String>) -> Unit
) {
    var selectedUsers by remember { mutableStateOf(currentCoOrganizers.toSet()) }

    val eligiblePlayers = confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.owner_delegate_admin)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.owner_delegate_admin_desc),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))

                if (eligiblePlayers.isEmpty()) {
                    Text(
                        text = stringResource(R.string.owner_no_players_to_delegate),
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 300.dp)
                    ) {
                        items(eligiblePlayers, key = { it.userId }) { player ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedUsers = if (selectedUsers.contains(player.userId)) {
                                            selectedUsers - player.userId
                                        } else {
                                            selectedUsers + player.userId
                                        }
                                    }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = selectedUsers.contains(player.userId),
                                    onCheckedChange = {
                                        selectedUsers = if (it) {
                                            selectedUsers + player.userId
                                        } else {
                                            selectedUsers - player.userId
                                        }
                                    }
                                )
                                CachedProfileImage(
                                    photoUrl = player.userPhoto,
                                    userName = player.userName,
                                    size = 36.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = player.getDisplayName(),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selectedUsers.toList()) }) {
                Text(stringResource(R.string.save))
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
 * Issue #65: Dialog para configurar fechamento automatico
 */
@Composable
fun AutoCloseDialog(
    currentHours: Int?,
    onDismiss: () -> Unit,
    onConfirm: (Int?) -> Unit
) {
    var selectedOption by remember { mutableStateOf(currentHours) }

    val options = listOf(
        null to stringResource(R.string.owner_auto_close_disabled),
        1 to stringResource(R.string.owner_auto_close_1h),
        2 to stringResource(R.string.owner_auto_close_2h),
        4 to stringResource(R.string.owner_auto_close_4h),
        12 to stringResource(R.string.owner_auto_close_12h),
        24 to stringResource(R.string.owner_auto_close_24h)
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.owner_auto_close_title)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.owner_auto_close_desc),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))

                options.forEach { (hours, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedOption = hours }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedOption == hours,
                            onClick = { selectedOption = hours }
                        )
                        Text(text = label, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selectedOption) }) {
                Text(stringResource(R.string.save))
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
 * Issue #68: Dialog para editar regras do jogo
 */
@Composable
fun EditRulesDialog(
    currentRules: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var rules by remember { mutableStateOf(currentRules) }

    val templates = listOf(
        stringResource(R.string.owner_rule_template_1),
        stringResource(R.string.owner_rule_template_2),
        stringResource(R.string.owner_rule_template_3)
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.owner_edit_rules)) },
        text = {
            Column {
                OutlinedTextField(
                    value = rules,
                    onValueChange = { rules = it },
                    label = { Text(stringResource(R.string.owner_rules_label)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp),
                    maxLines = 6
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.owner_rule_templates),
                    style = MaterialTheme.typography.labelMedium
                )

                templates.forEach { template ->
                    TextButton(
                        onClick = {
                            rules = if (rules.isEmpty()) template
                                   else "$rules\n$template"
                        }
                    ) {
                        Text(
                            text = "+ $template",
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(rules) }) {
                Text(stringResource(R.string.save))
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
 * Issue #70: Dialog para transferir titularidade
 */
@Composable
fun TransferOwnershipDialog(
    confirmations: List<GameConfirmation>,
    currentOwnerId: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var selectedUser by remember { mutableStateOf<String?>(null) }

    val eligiblePlayers = confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name && it.userId != currentOwnerId
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.owner_transfer_ownership)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.owner_transfer_warning),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.height(16.dp))

                if (eligiblePlayers.isEmpty()) {
                    Text(
                        text = stringResource(R.string.owner_no_players_to_transfer),
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 300.dp)
                    ) {
                        items(eligiblePlayers) { player ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedUser = player.userId }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = selectedUser == player.userId,
                                    onClick = { selectedUser = player.userId }
                                )
                                CachedProfileImage(
                                    photoUrl = player.userPhoto,
                                    userName = player.userName,
                                    size = 36.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = player.getDisplayName(),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { selectedUser?.let { onConfirm(it) } },
                enabled = selectedUser != null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text(stringResource(R.string.owner_confirm_transfer))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
