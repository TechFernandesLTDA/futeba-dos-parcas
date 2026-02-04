package com.futebadosparcas.ui.payments

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import java.text.NumberFormat
import java.util.Locale

/**
 * PaymentBottomSheet - Modal bottom sheet para pagamento via Pix
 *
 * Features:
 * - Geração de código Pix
 * - QR Code para pagamento
 * - Copiar código para clipboard
 * - Confirmação de pagamento
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentBottomSheet(
    viewModel: PaymentViewModel,
    gameId: String,
    amount: Double,
    onDismiss: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Start payment generation when sheet opens
    LaunchedEffect(gameId) {
        viewModel.startPayment(gameId, amount)
    }

    // Handle success state
    LaunchedEffect(uiState) {
        if (uiState is PaymentUiState.Success) {
            showPaymentConfirmedToast(context)
            onDismiss()
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp
    ) {
        PaymentBottomSheetContent(
            uiState = uiState,
            amount = amount,
            onCopyClick = { pixCode ->
                copyToClipboard(context, pixCode, context.getString(R.string.payment_copied))
            },
            onConfirmClick = { paymentId ->
                viewModel.confirmPayment(paymentId)
            },
            onError = { message ->
                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                onDismiss()
            }
        )
    }
}

@Composable
private fun PaymentBottomSheetContent(
    uiState: PaymentUiState,
    amount: Double,
    onCopyClick: (String) -> Unit,
    onConfirmClick: (String) -> Unit,
    onError: (String) -> Unit
) {
    val currencyFormat = remember {
        NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR"))
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Text(
            text = stringResource(R.string.payment_pix_title),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        // Amount
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = stringResource(R.string.payment_amount_label),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = currencyFormat.format(amount),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        // Content based on state
        when (uiState) {
            is PaymentUiState.Loading -> {
                PaymentLoadingState()
            }
            is PaymentUiState.PixGenerated -> {
                PixGeneratedContent(
                    pixCode = uiState.pixCode,
                    paymentId = uiState.paymentId,
                    onCopyClick = onCopyClick,
                    onConfirmClick = onConfirmClick
                )
            }
            is PaymentUiState.Error -> {
                LaunchedEffect(uiState.message) {
                    onError(uiState.message)
                }
            }
            else -> {}
        }
    }
}

@Composable
private fun PaymentLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = stringResource(R.string.payment_generating),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PixGeneratedContent(
    pixCode: String,
    paymentId: String,
    onCopyClick: (String) -> Unit,
    onConfirmClick: (String) -> Unit
) {
    var isCopied by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // QR Code
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.size(250.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=$pixCode",
                    contentDescription = stringResource(R.string.payment_qr_description),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(8.dp)
                )
            }
        }

        Text(
            text = stringResource(R.string.payment_scan_instruction),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        // Pix Code
        OutlinedTextField(
            value = pixCode,
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.payment_pix_code)) },
            trailingIcon = {
                IconButton(
                    onClick = {
                        onCopyClick(pixCode)
                        isCopied = true
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.ContentCopy,
                        contentDescription = stringResource(R.string.payment_copy_code),
                        tint = if (isCopied) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
            maxLines = 3,
            shape = RoundedCornerShape(12.dp)
        )

        // Confirm Button
        Button(
            onClick = { onConfirmClick(paymentId) },
            enabled = isCopied,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(stringResource(R.string.payment_confirm_button))
        }

        if (!isCopied) {
            Text(
                text = stringResource(R.string.payment_copy_instruction),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

private fun copyToClipboard(context: Context, text: String, message: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("Pix Code", text)
    clipboard.setPrimaryClip(clip)
    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
}

private fun showPaymentConfirmedToast(context: Context) {
    Toast.makeText(context, context.getString(R.string.payment_confirmed), Toast.LENGTH_LONG).show()
}
