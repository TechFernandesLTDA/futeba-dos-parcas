package com.futebadosparcas.ui.components.modern

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Tipos de erro com ícones e mensagens apropriadas
 */
enum class ErrorType {
    NETWORK,        // Sem conexão
    TIMEOUT,        // Timeout
    SERVER,         // Erro do servidor
    PERMISSION,     // Sem permissão
    GENERIC         // Erro genérico
}

/**
 * Estado de erro moderno com ilustração, mensagem e ação de retry
 *
 * Segue Material 3 Design System para feedback de erros
 *
 * @param errorType Tipo do erro para selecionar ícone e mensagem
 * @param message Mensagem customizada (opcional)
 * @param onRetry Ação ao clicar em "Tentar Novamente"
 * @param actionText Texto do botão de ação (padrão: "Tentar Novamente")
 */
@Composable
fun ErrorState(
    errorType: ErrorType = ErrorType.GENERIC,
    message: String? = null,
    onRetry: (() -> Unit)? = null,
    actionText: String = stringResource(R.string.retry),
    modifier: Modifier = Modifier
) {
    val (icon, defaultMessage) = when (errorType) {
        ErrorType.NETWORK -> Icons.Default.WifiOff to
            stringResource(R.string.error_network_full)
        ErrorType.TIMEOUT -> Icons.Default.CloudOff to
            stringResource(R.string.error_timeout)
        ErrorType.SERVER -> Icons.Default.Error to
            stringResource(R.string.error_server)
        ErrorType.PERMISSION -> Icons.Default.Warning to
            stringResource(R.string.error_permission)
        ErrorType.GENERIC -> Icons.Default.Error to
            stringResource(R.string.error_generic_full)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ícone ilustrativo
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(120.dp),
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Título
        Text(
            text = stringResource(R.string.error_oops),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Mensagem
        Text(
            text = message ?: defaultMessage,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        // Botão de ação (se fornecido)
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(24.dp))

            FilledTonalButton(
                onClick = onRetry,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(48.dp)
            ) {
                Text(
                    text = actionText,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

/**
 * Variante compacta para erro em cards/seções
 */
@Composable
fun CompactErrorState(
    message: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Error,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.size(32.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
                textAlign = TextAlign.Center
            )

            if (onRetry != null) {
                Spacer(modifier = Modifier.height(12.dp))

                TextButton(onClick = onRetry) {
                    Text(
                        text = stringResource(R.string.retry),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }
    }
}

/**
 * Snackbar com erro (para feedback contextual)
 */
@Composable
fun ErrorSnackbar(
    message: String,
    onDismiss: () -> Unit,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Snackbar(
        modifier = modifier,
        action = {
            if (onRetry != null) {
                TextButton(onClick = {
                    onRetry()
                    onDismiss()
                }) {
                    Text(stringResource(R.string.retry))
                }
            }
        },
        dismissAction = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.close))
            }
        },
        containerColor = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer
    ) {
        Text(text = message)
    }
}
