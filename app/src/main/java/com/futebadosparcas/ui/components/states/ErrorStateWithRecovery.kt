package com.futebadosparcas.ui.components.states

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.util.LocationError
import com.futebadosparcas.util.LocationErrorHandler
import com.futebadosparcas.util.RecoveryAction
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Estado de erro com recuperacao contextual.
 *
 * Exibe uma UI de erro adaptada ao tipo de erro com acao de recuperacao apropriada.
 * Suporta diferentes tipos de erro (rede, autenticacao, dados, validacao) e
 * fornece botoes de acao especificos para cada situacao.
 *
 * @param errorType Tipo do erro categorizado
 * @param recoveryAction Acao de recuperacao sugerida
 * @param message Mensagem de erro customizada (opcional - usa mensagem padrao se nao fornecida)
 * @param onRetry Callback para tentar novamente
 * @param onCheckInternet Callback para verificar conexao (abre configuracoes de rede)
 * @param onLogin Callback para redirecionar ao login
 * @param onGoBack Callback para voltar a tela anterior
 * @param onFixFields Callback para corrigir campos do formulario
 * @param modifier Modificador opcional
 *
 * Exemplo de uso:
 * ```kotlin
 * when (val state = uiState) {
 *     is UiState.Error -> ErrorStateWithRecovery(
 *         errorType = state.errorType,
 *         recoveryAction = state.recoveryAction,
 *         message = state.message,
 *         onRetry = { viewModel.retry() },
 *         onGoBack = { navController.popBackStack() },
 *         onLogin = { navController.navigate("login") }
 *     )
 * }
 * ```
 */
@Composable
fun ErrorStateWithRecovery(
    errorType: LocationError,
    recoveryAction: RecoveryAction,
    modifier: Modifier = Modifier,
    message: String? = null,
    onRetry: () -> Unit = {},
    onCheckInternet: () -> Unit = {},
    onLogin: () -> Unit = {},
    onGoBack: () -> Unit = {},
    onFixFields: (List<String>) -> Unit = {}
) {
    val context = LocalContext.current

    // Determina icone baseado no tipo de erro
    val icon = getErrorIcon(errorType)

    // Determina cor do icone baseado no tipo de erro
    val iconTint = getErrorIconTint(errorType)

    // Obtem mensagem de erro (usa mensagem customizada ou padrao do handler)
    val displayMessage = message ?: LocationErrorHandler.getErrorMessage(errorType, context)

    // Obtem titulo do erro
    val errorTitle = getErrorTitle(errorType)

    // Obtem texto do botao de acao
    val actionButtonText = LocationErrorHandler.getActionButtonText(recoveryAction, context)

    Column(
        modifier = modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Icone do erro
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = iconTint
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Titulo do erro
        Text(
            text = errorTitle,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Mensagem de erro
        Text(
            text = displayMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        // Campos com erro (para erros de validacao)
        if (errorType is LocationError.Validation && errorType.fields.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            ValidationFieldsList(fields = errorType.fields)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Botao de acao principal
        RecoveryActionButton(
            action = recoveryAction,
            text = actionButtonText,
            onRetry = onRetry,
            onCheckInternet = onCheckInternet,
            onLogin = onLogin,
            onGoBack = onGoBack,
            onFixFields = onFixFields
        )

        // Botao secundario (se aplicavel)
        SecondaryActionButton(
            recoveryAction = recoveryAction,
            onRetry = onRetry,
            onGoBack = onGoBack
        )
    }
}

/**
 * Versao compacta do ErrorStateWithRecovery para uso em secoes menores.
 */
@Composable
fun ErrorStateWithRecoveryCompact(
    errorType: LocationError,
    recoveryAction: RecoveryAction,
    modifier: Modifier = Modifier,
    message: String? = null,
    onRetry: () -> Unit = {},
    onCheckInternet: () -> Unit = {},
    onLogin: () -> Unit = {},
    onGoBack: () -> Unit = {},
    onFixFields: (List<String>) -> Unit = {}
) {
    val context = LocalContext.current
    val icon = getErrorIcon(errorType)
    val iconTint = getErrorIconTint(errorType)
    val displayMessage = message ?: LocationErrorHandler.getErrorMessage(errorType, context)
    val actionButtonText = LocationErrorHandler.getActionButtonText(recoveryAction, context)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = iconTint
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = displayMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        RecoveryActionButton(
            action = recoveryAction,
            text = actionButtonText,
            onRetry = onRetry,
            onCheckInternet = onCheckInternet,
            onLogin = onLogin,
            onGoBack = onGoBack,
            onFixFields = onFixFields,
            isCompact = true
        )
    }
}

/**
 * Retorna o icone apropriado para o tipo de erro.
 */
@Composable
private fun getErrorIcon(errorType: LocationError): ImageVector {
    return when (errorType) {
        is LocationError.Network -> {
            if (errorType.isTimeout) Icons.Default.HourglassEmpty
            else Icons.Default.WifiOff
        }
        is LocationError.Auth -> {
            when (errorType.reason) {
                "permission_denied" -> Icons.Default.Lock
                else -> Icons.Default.PersonOff
            }
        }
        is LocationError.Data -> {
            when {
                errorType.message.contains("not_found") ||
                errorType.message.contains("nao encontrado", ignoreCase = true) -> Icons.Default.SearchOff
                errorType.message.contains("corrompido") ||
                errorType.message.contains("corrupted", ignoreCase = true) -> Icons.Default.BrokenImage
                else -> Icons.Default.ErrorOutline
            }
        }
        is LocationError.Validation -> Icons.Default.Edit
    }
}

/**
 * Retorna a cor do icone baseada no tipo de erro.
 */
@Composable
private fun getErrorIconTint(errorType: LocationError): androidx.compose.ui.graphics.Color {
    return when (errorType) {
        is LocationError.Network -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.8f)
        is LocationError.Auth -> MaterialTheme.colorScheme.error.copy(alpha = 0.8f)
        is LocationError.Data -> MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
        is LocationError.Validation -> MaterialTheme.colorScheme.secondary.copy(alpha = 0.8f)
    }
}

/**
 * Retorna o titulo do erro baseado no tipo.
 */
@Composable
private fun getErrorTitle(errorType: LocationError): String {
    return when (errorType) {
        is LocationError.Network -> {
            if (errorType.isTimeout) stringResource(R.string.location_error_title_timeout)
            else stringResource(R.string.location_error_title_no_connection)
        }
        is LocationError.Auth -> {
            when (errorType.reason) {
                "permission_denied" -> stringResource(R.string.location_error_title_permission)
                else -> stringResource(R.string.location_error_title_auth)
            }
        }
        is LocationError.Data -> stringResource(R.string.location_error_title_data)
        is LocationError.Validation -> stringResource(R.string.location_error_title_validation)
    }
}

/**
 * Botao de acao de recuperacao.
 */
@Composable
private fun RecoveryActionButton(
    action: RecoveryAction,
    text: String,
    onRetry: () -> Unit,
    onCheckInternet: () -> Unit,
    onLogin: () -> Unit,
    onGoBack: () -> Unit,
    onFixFields: (List<String>) -> Unit,
    isCompact: Boolean = false
) {
    val buttonColors = when (action) {
        is RecoveryAction.Retry,
        is RecoveryAction.FixFields -> ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
        is RecoveryAction.CheckInternet -> ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.tertiary
        )
        is RecoveryAction.Login -> ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.secondary
        )
        is RecoveryAction.GoBack -> ButtonDefaults.outlinedButtonColors()
    }

    val icon = when (action) {
        is RecoveryAction.Retry -> Icons.Default.Refresh
        is RecoveryAction.CheckInternet -> Icons.Default.Settings
        is RecoveryAction.Login -> Icons.AutoMirrored.Filled.Login
        is RecoveryAction.GoBack -> Icons.AutoMirrored.Filled.ArrowBack
        is RecoveryAction.FixFields -> Icons.Default.Edit
    }

    val onClick: () -> Unit = when (action) {
        is RecoveryAction.Retry -> onRetry
        is RecoveryAction.CheckInternet -> onCheckInternet
        is RecoveryAction.Login -> onLogin
        is RecoveryAction.GoBack -> onGoBack
        is RecoveryAction.FixFields -> { { onFixFields(action.fields) } }
    }

    if (action is RecoveryAction.GoBack) {
        OutlinedButton(
            onClick = onClick,
            modifier = if (isCompact) Modifier else Modifier.fillMaxWidth(0.7f)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(text)
        }
    } else {
        Button(
            onClick = onClick,
            colors = buttonColors,
            modifier = if (isCompact) Modifier else Modifier.fillMaxWidth(0.7f)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(text)
        }
    }
}

/**
 * Botao secundario para acoes alternativas.
 */
@Composable
private fun SecondaryActionButton(
    recoveryAction: RecoveryAction,
    onRetry: () -> Unit,
    onGoBack: () -> Unit
) {
    // Mostra botao de voltar como secundario para erros de rede que tem "Tentar novamente" como primario
    when (recoveryAction) {
        is RecoveryAction.Retry,
        is RecoveryAction.CheckInternet -> {
            Spacer(modifier = Modifier.height(12.dp))
            TextButton(onClick = onGoBack) {
                Text(stringResource(R.string.location_error_action_go_back))
            }
        }
        // Para erros de autenticacao, oferece opcao de tentar novamente como secundario
        is RecoveryAction.Login -> {
            Spacer(modifier = Modifier.height(12.dp))
            TextButton(onClick = onRetry) {
                Text(stringResource(R.string.location_error_action_retry))
            }
        }
        // Nao mostra botao secundario para outros casos
        else -> {}
    }
}

/**
 * Lista de campos com erro de validacao.
 */
@Composable
private fun ValidationFieldsList(fields: List<String>) {
    Card(
        modifier = Modifier.fillMaxWidth(0.8f),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.location_error_fields_to_fix),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(8.dp))
            fields.forEach { field ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 2.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = field.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}
