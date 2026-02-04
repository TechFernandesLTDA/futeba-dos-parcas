package com.futebadosparcas.ui.components.states

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Estado de erro padrão com retry button
 *
 * Exibe mensagem de erro e botão para tentar novamente.
 * Use este componente para manter consistência visual em todas as telas.
 *
 * @param message Mensagem de erro a exibir
 * @param onRetry Callback ao clicar em "Tentar Novamente"
 * @param modifier Modificador para customização
 * @param retryButtonText Texto do botão de retry (padrão: "Tentar Novamente")
 * @param icon Ícone opcional (padrão: Icons.Default.Error)
 *
 * Exemplo de uso:
 * ```kotlin
 * when (uiState) {
 *     is UiState.Loading -> LoadingState()
 *     is UiState.Success -> ContentScreen(data = uiState.data)
 *     is UiState.Error -> ErrorState(
 *         message = uiState.message,
 *         onRetry = { viewModel.retry() }
 *     )
 * }
 * ```
 */
@Composable
fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    retryButtonText: String = "Tentar Novamente",
    icon: ImageVector = Icons.Default.Error
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.error_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error
            )
        ) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(retryButtonText)
        }
    }
}

/**
 * Error state compacto para seções menores
 */
@Composable
fun ErrorStateCompact(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    retryButtonText: String = "Tentar Novamente"
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onRetry) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(retryButtonText)
        }
    }
}

/**
 * Error states específicos para casos de uso comuns
 */

/**
 * Erro de conexão com internet
 */
@Composable
fun NoConnectionErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    ErrorState(
        message = "Verifique sua conexão com a internet e tente novamente",
        onRetry = onRetry,
        modifier = modifier,
        icon = Icons.Default.WifiOff
    )
}

/**
 * Erro de timeout
 */
@Composable
fun TimeoutErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    ErrorState(
        message = "A operação demorou muito tempo. Por favor, tente novamente.",
        onRetry = onRetry,
        modifier = modifier,
        icon = Icons.Default.HourglassEmpty
    )
}

/**
 * Erro de permissão negada
 */
@Composable
fun PermissionDeniedErrorState(
    modifier: Modifier = Modifier,
    message: String = "Você não tem permissão para acessar este conteúdo",
    onRetry: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.access_denied_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        if (onRetry != null) {
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(onClick = onRetry) {
                Text(stringResource(R.string.back))
            }
        }
    }
}
