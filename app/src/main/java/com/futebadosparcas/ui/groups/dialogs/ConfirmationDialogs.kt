package com.futebadosparcas.ui.groups.dialogs

import android.content.Context
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/**
 * Diálogos de confirmação para ações destrutivas no grupo
 */
object ConfirmationDialogs {

    /**
     * Confirmar saída do grupo
     */
    fun showLeaveGroupDialog(
        context: Context,
        groupName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Sair do Grupo")
            .setMessage("Tem certeza que deseja sair do grupo \"$groupName\"?\n\nVocê precisará de um novo convite para voltar.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Sair") { _, _ ->
                onConfirm()
            }
            .show()
    }

    /**
     * Confirmar arquivamento do grupo
     */
    fun showArchiveGroupDialog(
        context: Context,
        groupName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Arquivar Grupo")
            .setMessage("Tem certeza que deseja arquivar o grupo \"$groupName\"?\n\nO grupo ficará inativo e não será possível criar novos jogos. Você poderá restaurá-lo depois.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Arquivar") { _, _ ->
                onConfirm()
            }
            .show()
    }

    /**
     * Confirmar exclusão do grupo
     */
    fun showDeleteGroupDialog(
        context: Context,
        groupName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Excluir Grupo")
            .setMessage("Tem certeza que deseja excluir o grupo \"$groupName\"?\n\nTodos os membros serão removidos e esta ação não pode ser desfeita.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Excluir") { _, _ ->
                onConfirm()
            }
            .show()
    }

    /**
     * Confirmar remoção de membro
     */
    fun showRemoveMemberDialog(
        context: Context,
        memberName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Remover Membro")
            .setMessage("Tem certeza que deseja remover \"$memberName\" do grupo?\n\nEle precisará de um novo convite para voltar.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Remover") { _, _ ->
                onConfirm()
            }
            .show()
    }

    /**
     * Confirmar promoção a admin
     */
    fun showPromoteMemberDialog(
        context: Context,
        memberName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Promover a Administrador")
            .setMessage("Deseja promover \"$memberName\" a administrador?\n\nEle poderá convidar e remover membros, além de criar jogos.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Promover") { _, _ ->
                onConfirm()
            }
            .show()
    }

    /**
     * Confirmar rebaixamento de admin
     */
    fun showDemoteMemberDialog(
        context: Context,
        memberName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Rebaixar para Membro")
            .setMessage("Deseja rebaixar \"$memberName\" para membro comum?\n\nEle perderá as permissões de administrador.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Rebaixar") { _, _ ->
                onConfirm()
            }
            .show()
    }

    /**
     * Confirmar transferência de propriedade
     */
    fun showTransferOwnershipDialog(
        context: Context,
        memberName: String,
        onConfirm: () -> Unit
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("Transferir Propriedade")
            .setMessage("Tem certeza que deseja transferir a propriedade do grupo para \"$memberName\"?\n\nVocê se tornará administrador e não poderá reverter esta ação.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Transferir") { _, _ ->
                onConfirm()
            }
            .show()
    }
}
