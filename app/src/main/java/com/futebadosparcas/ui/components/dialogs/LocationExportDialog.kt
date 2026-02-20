package com.futebadosparcas.ui.components.dialogs

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
/**
 * Formato de exportação disponível.
 */
enum class ExportFormat(val extension: String, val mimeType: String) {
    JSON("json", "application/json"),
    CSV("csv", "text/csv")
}

/**
 * Diálogo para selecionar formato de exportação de locais.
 *
 * Permite ao usuário escolher entre JSON ou CSV antes de exportar seus dados.
 *
 * @param visible Se o diálogo está visível
 * @param locationsCount Número de locais a serem exportados
 * @param onExportJson Callback quando usuário seleciona exportar para JSON
 * @param onExportCsv Callback quando usuário seleciona exportar para CSV
 * @param onDismiss Callback ao fechar o diálogo
 *
 * Exemplo de uso:
 * ```kotlin
 * var showExportDialog by remember { mutableStateOf(false) }
 *
 * LocationExportDialog(
 *     visible = showExportDialog,
 *     locationsCount = 5,
 *     onExportJson = {
 *         viewModel.exportToJson()
 *         showExportDialog = false
 *     },
 *     onExportCsv = {
 *         viewModel.exportToCsv()
 *         showExportDialog = false
 *     },
 *     onDismiss = { showExportDialog = false }
 * )
 * ```
 */
@Composable
fun LocationExportDialog(
    visible: Boolean,
    locationsCount: Int = 0,
    onExportJson: () -> Unit,
    onExportCsv: () -> Unit,
    onDismiss: () -> Unit
) {
    if (!visible) return

    var selectedFormat by remember { mutableStateOf(ExportFormat.JSON) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.FileDownload,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(
                text = stringResource(R.string.location_export_title),
                style = MaterialTheme.typography.headlineSmall
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Informação sobre a exportação
                if (locationsCount > 0) {
                    Text(
                        text = stringResource(R.string.location_export_count, locationsCount),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(
                    text = stringResource(R.string.location_export_select_format),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Opções de formato
                Column(
                    modifier = Modifier.selectableGroup(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ExportFormatOption(
                        format = ExportFormat.JSON,
                        title = stringResource(R.string.location_export_json),
                        description = stringResource(R.string.location_export_json_description),
                        icon = Icons.Default.Code,
                        selected = selectedFormat == ExportFormat.JSON,
                        onClick = { selectedFormat = ExportFormat.JSON }
                    )

                    ExportFormatOption(
                        format = ExportFormat.CSV,
                        title = stringResource(R.string.location_export_csv),
                        description = stringResource(R.string.location_export_csv_description),
                        icon = Icons.Default.TableChart,
                        selected = selectedFormat == ExportFormat.CSV,
                        onClick = { selectedFormat = ExportFormat.CSV }
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    when (selectedFormat) {
                        ExportFormat.JSON -> onExportJson()
                        ExportFormat.CSV -> onExportCsv()
                    }
                }
            ) {
                Icon(
                    imageVector = Icons.Default.FileDownload,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.location_export_button))
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
 * Opção de formato de exportação com radio button.
 */
@Composable
private fun ExportFormatOption(
    format: ExportFormat,
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.RadioButton
            ),
        shape = MaterialTheme.shapes.medium,
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        },
        border = if (selected) {
            androidx.compose.foundation.BorderStroke(
                width = 2.dp,
                color = MaterialTheme.colorScheme.primary
            )
        } else {
            null
        }
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            RadioButton(
                selected = selected,
                onClick = null // null porque o clique é tratado pelo selectable
            )

            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (selected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    color = if (selected) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Versão simplificada do diálogo de exportação.
 *
 * Mostra apenas os botões de exportação sem seleção de formato.
 */
@Composable
fun LocationExportDialogSimple(
    onExportJson: () -> Unit,
    onExportCsv: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.FileDownload,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(stringResource(R.string.location_export_title))
        },
        text = {
            Text(stringResource(R.string.location_export_select_format))
        },
        confirmButton = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = onExportCsv) {
                    Icon(
                        imageVector = Icons.Default.TableChart,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.location_export_csv))
                }

                Button(onClick = onExportJson) {
                    Icon(
                        imageVector = Icons.Default.Code,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.location_export_json))
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
