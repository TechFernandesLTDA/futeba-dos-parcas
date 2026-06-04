package com.futebadosparcas.ui.components.dialogs

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R

/**
 * Tipo de diálogo de confirmação
 * Define o estilo visual e comportamento do diálogo
 */
enum class ConfirmationDialogType {
    /** Ação normal (azul) */
    NORMAL,
    /** Ação destrutiva (vermelho) - deletar, remover, etc */
    DESTRUCTIVE,
    /** Ação de aviso (laranja) - arquivar, desativar, etc */
    WARNING,
    /** Ação de sucesso (verde) - promover, aprovar, etc */
    SUCCESS
}

/**
 * Diálogo genérico de confirmação reutilizável
 *
 * Usado para confirmar ações do usuário antes de executá-las.
 * Suporta diferentes tipos visuais (normal, destrutivo, aviso, sucesso).
 *
 * @param visible Se o diálogo está visível
 * @param title Título do diálogo
 * @param message Mensagem explicativa
 * @param confirmText Texto do botão de confirmação (padrão: "Confirmar")
 * @param dismissText Texto do botão de cancelar (padrão: "Cancelar")
 * @param type Tipo do diálogo (afeta cores)
 * @param icon Ícone opcional
 * @param onConfirm Callback ao confirmar
 * @param onDismiss Callback ao cancelar/fechar
 *
 * Exemplo de uso:
 * ```kotlin
 * var showDialog by remember { mutableStateOf(false) }
 *
 * ConfirmationDialog(
 *     visible = showDialog,
 *     title = "Excluir Jogo",
 *     message = "Tem certeza que deseja excluir este jogo? Esta ação não pode ser desfeita.",
 *     confirmText = "Excluir",
 *     type = ConfirmationDialogType.DESTRUCTIVE,
 *     icon = Icons.Default.Delete,
 *     onConfirm = {
 *         viewModel.deleteGame()
 *         showDialog = false
 *     },
 *     onDismiss = { showDialog = false }
 * )
 * ```
 */
@Composable
fun ConfirmationDialog(
    visible: Boolean,
    title: String,
    message: String,
    confirmText: String = stringResource(R.string.confirm_dialog_confirm),
    dismissText: String = stringResource(R.string.confirm_dialog_cancel),
    type: ConfirmationDialogType = ConfirmationDialogType.NORMAL,
    icon: ImageVector? = null,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    if (!visible) return

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = icon?.let {
            {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    tint = when (type) {
                        ConfirmationDialogType.DESTRUCTIVE -> MaterialTheme.colorScheme.error
                        ConfirmationDialogType.WARNING -> MaterialTheme.colorScheme.tertiary
                        ConfirmationDialogType.SUCCESS -> MaterialTheme.colorScheme.primary
                        ConfirmationDialogType.NORMAL -> MaterialTheme.colorScheme.primary
                    }
                )
            }
        },
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                colors = when (type) {
                    ConfirmationDialogType.DESTRUCTIVE -> ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                    ConfirmationDialogType.WARNING -> ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.tertiary
                    )
                    ConfirmationDialogType.SUCCESS -> ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.primary
                    )
                    ConfirmationDialogType.NORMAL -> ButtonDefaults.textButtonColors()
                }
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

/**
 * Variantes específicas para casos de uso comuns
 */

/**
 * Diálogo de confirmação para deletar algo
 */
@Composable
fun DeleteConfirmationDialog(
    visible: Boolean,
    itemName: String,
    itemType: String = stringResource(R.string.confirm_dialog_default_item_type),
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_delete_item_title, itemType),
        message = stringResource(R.string.confirm_dialog_delete_item_message, itemName),
        confirmText = stringResource(R.string.confirm_dialog_delete),
        type = ConfirmationDialogType.DESTRUCTIVE,
        icon = Icons.Default.Delete,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

/**
 * Diálogo de confirmação para remover membro de grupo
 */
@Composable
fun RemoveMemberDialog(
    visible: Boolean,
    memberName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_remove_member_title),
        message = stringResource(R.string.confirm_dialog_remove_member_message, memberName),
        confirmText = stringResource(R.string.confirm_dialog_remove),
        type = ConfirmationDialogType.DESTRUCTIVE,
        icon = Icons.Default.PersonRemove,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

/**
 * Diálogo de confirmação para promover membro
 */
@Composable
fun PromoteMemberDialog(
    visible: Boolean,
    memberName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_promote_member_title),
        message = stringResource(R.string.confirm_dialog_promote_member_message, memberName),
        confirmText = stringResource(R.string.confirm_dialog_promote),
        type = ConfirmationDialogType.SUCCESS,
        icon = Icons.Default.AdminPanelSettings,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

/**
 * Diálogo de confirmação para rebaixar admin
 */
@Composable
fun DemoteMemberDialog(
    visible: Boolean,
    memberName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_demote_member_title),
        message = stringResource(R.string.confirm_dialog_demote_member_message, memberName),
        confirmText = stringResource(R.string.confirm_dialog_demote),
        type = ConfirmationDialogType.WARNING,
        icon = Icons.Default.RemoveModerator,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

/**
 * Diálogo de confirmação para sair de grupo
 */
@Composable
fun LeaveGroupDialog(
    visible: Boolean,
    groupName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_leave_group_title),
        message = stringResource(R.string.confirm_dialog_leave_group_message, groupName),
        confirmText = stringResource(R.string.confirm_dialog_leave),
        type = ConfirmationDialogType.WARNING,
        icon = Icons.AutoMirrored.Filled.ExitToApp,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

/**
 * Diálogo de confirmação para arquivar grupo
 */
@Composable
fun ArchiveGroupDialog(
    visible: Boolean,
    groupName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_archive_group_title),
        message = stringResource(R.string.confirm_dialog_archive_group_message, groupName),
        confirmText = stringResource(R.string.confirm_dialog_archive),
        type = ConfirmationDialogType.WARNING,
        icon = Icons.Default.Archive,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

/**
 * Diálogo de confirmação para deletar grupo
 */
@Composable
fun DeleteGroupDialog(
    visible: Boolean,
    groupName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = visible,
        title = stringResource(R.string.confirm_dialog_delete_group_title),
        message = stringResource(R.string.confirm_dialog_delete_group_message, groupName),
        confirmText = stringResource(R.string.confirm_dialog_delete),
        type = ConfirmationDialogType.DESTRUCTIVE,
        icon = Icons.Default.Delete,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}
