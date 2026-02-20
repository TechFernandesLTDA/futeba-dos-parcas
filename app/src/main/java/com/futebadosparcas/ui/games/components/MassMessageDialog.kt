package com.futebadosparcas.ui.games.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.core.net.toUri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.domain.model.ConfirmationStatus
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.domain.model.PaymentStatus
import com.futebadosparcas.ui.theme.BrandColors
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Issue #62: Dialog para enviar mensagem em massa para jogadores confirmados.
 *
 * Funcionalidades:
 * - Templates de mensagem pre-definidos
 * - Filtro para enviar apenas para quem nao pagou
 * - Deep link para WhatsApp com mensagem pre-preenchida
 */
@Composable
fun MassMessageDialog(
    game: Game,
    confirmations: List<GameConfirmation>,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var selectedTemplate by remember { mutableIntStateOf(0) }
    var onlyUnpaid by remember { mutableStateOf(false) }
    var useWhatsApp by remember { mutableStateOf(true) }

    // Templates de mensagem
    val templates = listOf(
        stringResource(R.string.owner_template_confirmed),
        stringResource(R.string.owner_template_reminder),
        stringResource(R.string.owner_template_pix)
    )

    // Mensagens formatadas
    val templateMessages = listOf(
        stringResource(R.string.owner_template_confirmed_msg, game.date, game.time, game.locationName),
        stringResource(R.string.owner_template_reminder_msg, game.date, game.time),
        formatPixMessage(game.pixKey, game.dailyPrice)
    )

    // Jogadores que receberao a mensagem
    val recipients = if (onlyUnpaid) {
        confirmations.filter {
            it.status == ConfirmationStatus.CONFIRMED.name &&
            it.paymentStatus != PaymentStatus.PAID.name
        }
    } else {
        confirmations.filter { it.status == ConfirmationStatus.CONFIRMED.name }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.owner_mass_message),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(R.string.close))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Contagem de destinatarios
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Groups,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (recipients.size == 1) {
                                stringResource(R.string.player_selected_one)
                            } else {
                                stringResource(R.string.players_selected_many, recipients.size)
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Selecao de template
                Text(
                    text = stringResource(R.string.owner_select_template),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(8.dp))

                templates.forEachIndexed { index, template ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedTemplate = index }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedTemplate == index,
                            onClick = { selectedTemplate = index }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = template,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (selectedTemplate == index) FontWeight.SemiBold else FontWeight.Normal
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Filtro apenas nao pagos
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onlyUnpaid = !onlyUnpaid }
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = onlyUnpaid,
                        onCheckedChange = { onlyUnpaid = it }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.owner_only_unpaid),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Preview da mensagem
                Text(
                    text = stringResource(R.string.message_preview),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
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

                Spacer(modifier = Modifier.height(20.dp))

                // Botoes de acao
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.cancel))
                    }
                    Spacer(modifier = Modifier.width(8.dp))

                    // Botao WhatsApp
                    Button(
                        onClick = {
                            val message = templateMessages[selectedTemplate]
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                data = "https://wa.me/?text=${Uri.encode(message)}".toUri()
                            }
                            context.startActivity(intent)
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = BrandColors.WhatsApp
                        ),
                        enabled = recipients.isNotEmpty()
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_whatsapp),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(stringResource(R.string.whatsapp))
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // Botao compartilhar generico
                    FilledTonalButton(
                        onClick = {
                            val message = templateMessages[selectedTemplate]
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, message)
                            }
                            context.startActivity(Intent.createChooser(intent, context.getString(R.string.share_message)))
                            onDismiss()
                        },
                        enabled = recipients.isNotEmpty()
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
 * Formata a mensagem de Pix com valor e chave.
 */
private fun formatPixMessage(pixKey: String, dailyPrice: Double): String {
    return if (pixKey.isNotBlank()) {
        "Chave Pix para pagamento:\n$pixKey\n\nValor: R$ %.2f\n\nFaca o Pix e confirme aqui!".format(dailyPrice)
    } else {
        "Valor do jogo: R$ %.2f\n\nEntre em contato para saber como pagar!".format(dailyPrice)
    }
}
