package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Dados para exibir um Snackbar com ação de Undo
 */
data class UndoSnackbarData(
    val message: String,
    val actionLabel: String = "Desfazer",
    val duration: SnackbarDuration = SnackbarDuration.Short,
    val onUndo: () -> Unit,
    val onDismiss: (() -> Unit)? = null
)

/**
 * Estado gerenciador para Snackbar com Undo
 */
class UndoSnackbarState {
    private val _snackbarHostState = SnackbarHostState()
    val snackbarHostState: SnackbarHostState = _snackbarHostState

    suspend fun showUndoSnackbar(
        data: UndoSnackbarData
    ): SnackbarResult {
        return _snackbarHostState.showSnackbar(
            message = data.message,
            actionLabel = data.actionLabel,
            duration = data.duration
        )
    }
}

@Composable
fun rememberUndoSnackbarState(): UndoSnackbarState {
    return remember { UndoSnackbarState() }
}

/**
 * Snackbar Material 3 com ação de Undo
 * Usado para ações reversíveis como delete/remove
 */
@Composable
fun UndoSnackbar(
    snackbarData: SnackbarData,
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.inverseSurface,
    contentColor: Color = MaterialTheme.colorScheme.inverseOnSurface,
    actionColor: Color = MaterialTheme.colorScheme.inversePrimary
) {
    Snackbar(
        modifier = modifier.padding(12.dp),
        containerColor = containerColor,
        contentColor = contentColor,
        shape = MaterialTheme.shapes.medium,
        action = snackbarData.visuals.actionLabel?.let { actionLabel ->
            {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    TextButton(
                        onClick = { snackbarData.performAction() },
                        colors = ButtonDefaults.textButtonColors(
                            contentColor = actionColor
                        )
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Undo,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(actionLabel)
                    }

                    IconButton(
                        onClick = { snackbarData.dismiss() },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.cd_close),
                            modifier = Modifier.size(18.dp),
                            tint = contentColor.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    ) {
        Text(
            text = snackbarData.visuals.message,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

/**
 * SnackbarHost customizado para usar UndoSnackbar
 */
@Composable
fun UndoSnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier
) {
    SnackbarHost(
        hostState = hostState,
        modifier = modifier,
        snackbar = { snackbarData ->
            UndoSnackbar(snackbarData = snackbarData)
        }
    )
}

/**
 * Exemplo de uso em um Scaffold
 */
@Composable
fun ScaffoldWithUndoSnackbar(
    snackbarState: UndoSnackbarState = rememberUndoSnackbarState(),
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        snackbarHost = {
            UndoSnackbarHost(hostState = snackbarState.snackbarHostState)
        }
    ) { paddingValues ->
        content(paddingValues)
    }
}

/**
 * Helper function para mostrar Snackbar com Undo de forma fácil
 */
suspend fun SnackbarHostState.showUndoSnackbar(
    message: String,
    actionLabel: String = "Desfazer",
    duration: SnackbarDuration = SnackbarDuration.Short,
    onUndo: () -> Unit,
    onDismiss: (() -> Unit)? = null
): SnackbarResult {
    val result = showSnackbar(
        message = message,
        actionLabel = actionLabel,
        duration = duration
    )

    when (result) {
        SnackbarResult.ActionPerformed -> onUndo()
        SnackbarResult.Dismissed -> onDismiss?.invoke()
    }

    return result
}

/**
 * Wrapper para operações reversíveis com timer automático
 * Executa a ação apenas se o usuário não desfizer no tempo determinado
 */
@Composable
fun rememberUndoableAction(
    snackbarHostState: SnackbarHostState,
    message: String,
    actionLabel: String = "Desfazer",
    delayMs: Long = 3000L,
    onCommit: () -> Unit,
    onUndo: (() -> Unit)? = null
): () -> Unit {
    val coroutineScope = rememberCoroutineScope()

    return remember(snackbarHostState, message, delayMs) {
        {
            var committed = false

            coroutineScope.launch {
                // Mostra o Snackbar
                val result = snackbarHostState.showUndoSnackbar(
                    message = message,
                    actionLabel = actionLabel,
                    duration = SnackbarDuration.Short,
                    onUndo = {
                        committed = false
                        onUndo?.invoke()
                    }
                )

                // Se não foi desfeito, executa a ação
                if (result == SnackbarResult.Dismissed) {
                    delay(200) // Small delay para UX
                    if (!committed) {
                        committed = true
                        onCommit()
                    }
                }
            }
        }
    }
}

/**
 * Variante do Snackbar com cor de erro
 */
@Composable
fun ErrorUndoSnackbar(
    snackbarData: SnackbarData,
    modifier: Modifier = Modifier
) {
    UndoSnackbar(
        snackbarData = snackbarData,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
        actionColor = MaterialTheme.colorScheme.error
    )
}

/**
 * Variante do Snackbar com cor de sucesso
 */
@Composable
fun SuccessUndoSnackbar(
    snackbarData: SnackbarData,
    modifier: Modifier = Modifier
) {
    UndoSnackbar(
        snackbarData = snackbarData,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.9f),
        contentColor = MaterialTheme.colorScheme.onPrimary,
        actionColor = MaterialTheme.colorScheme.onPrimary
    )
}
