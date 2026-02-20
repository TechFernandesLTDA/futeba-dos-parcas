package com.futebadosparcas.ui.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import org.jetbrains.compose.resources.stringResource
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.CheckCircle
/**
 * Dialogs
 *
 * Reusable Material 3 dialog components for common use cases.
 */

/**
 * Confirmation dialog
 */
@Composable
fun ConfirmationDialog(
    title: String,
    message: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    confirmText: String = stringResource(Res.string.confirm),
    dismissText: String = stringResource(Res.string.cancel),
    icon: ImageVector? = Icons.Default.Warning
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = icon?.let { { Icon(it, contentDescription = null) } },
        title = { Text(text = title) },
        text = { Text(text = message) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(dismissText)
            }
        }
    )
}

/**
 * Delete confirmation dialog
 */
@Composable
fun DeleteConfirmationDialog(
    itemName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        title = stringResource(Res.string.delete_item_title, itemName),
        message = stringResource(Res.string.delete_cannot_undo),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        confirmText = stringResource(Res.string.delete),
        dismissText = stringResource(Res.string.cancel),
        icon = Icons.Default.Delete
    )
}

/**
 * Information dialog
 */
@Composable
fun InfoDialog(
    title: String,
    message: String,
    onDismiss: () -> Unit,
    buttonText: String = stringResource(Res.string.ok)
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Info, contentDescription = null) },
        title = { Text(text = title) },
        text = { Text(text = message) },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(buttonText)
            }
        }
    )
}

/**
 * Success dialog
 */
@Composable
fun SuccessDialog(
    title: String,
    message: String,
    onDismiss: () -> Unit,
    buttonText: String = stringResource(Res.string.ok)
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.CheckCircle, contentDescription = null) },
        title = { Text(text = title) },
        text = { Text(text = message) },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(buttonText)
            }
        }
    )
}

/**
 * Error dialog
 */
@Composable
fun ErrorDialog(
    title: String = stringResource(Res.string.error_title),
    message: String,
    onDismiss: () -> Unit,
    onRetry: (() -> Unit)? = null
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Warning, contentDescription = null) },
        title = { Text(text = title) },
        text = { Text(text = message) },
        confirmButton = {
            if (onRetry != null) {
                TextButton(onClick = onRetry) {
                    Text(stringResource(Res.string.retry))
                }
            } else {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(Res.string.ok))
                }
            }
        },
        dismissButton = if (onRetry != null) {
            {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(Res.string.cancel))
                }
            }
        } else null
    )
}

/**
 * Loading dialog
 */
@Composable
fun LoadingDialog(
    message: String = stringResource(Res.string.loading)
) {
    AlertDialog(
        onDismissRequest = { /* Cannot dismiss */ },
        title = { Text(text = message) },
        text = {
            LinearProgressIndicator()
        },
        confirmButton = { }
    )
}

/**
 * Choice dialog with list of options
 */
@Composable
fun <T> ChoiceDialog(
    title: String,
    options: List<T>,
    optionLabel: (T) -> String,
    onOptionSelected: (T) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            androidx.compose.foundation.layout.Column {
                options.forEach { option ->
                    TextButton(
                        onClick = {
                            onOptionSelected(option)
                            onDismiss()
                        }
                    ) {
                        Text(optionLabel(option))
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.cancel))
            }
        }
    )
}

/**
 * Input dialog with text field
 */
@Composable
fun InputDialog(
    title: String,
    label: String,
    initialValue: String = "",
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    confirmText: String = stringResource(Res.string.confirm),
    dismissText: String = stringResource(Res.string.cancel)
) {
    var text = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(initialValue) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            OutlinedTextField(
                value = text.value,
                onValueChange = { text.value = it },
                label = { Text(label) },
                singleLine = true
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(text.value)
                    onDismiss()
                },
                enabled = text.value.isNotBlank()
            ) {
                Text(confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(dismissText)
            }
        }
    )
}
