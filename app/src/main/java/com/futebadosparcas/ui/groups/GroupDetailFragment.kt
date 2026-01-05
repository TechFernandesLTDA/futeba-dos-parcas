package com.futebadosparcas.ui.groups

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.ui.groups.dialogs.ConfirmationDialogs
import com.futebadosparcas.ui.groups.dialogs.EditGroupDialog
import com.futebadosparcas.ui.groups.dialogs.TransferOwnershipDialog
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint

/**
 * Fragment para exibir detalhes de um grupo
 *
 * Migrado para Jetpack Compose com GroupDetailScreen.kt
 */
@AndroidEntryPoint
class GroupDetailFragment : Fragment() {

    private val viewModel: GroupDetailViewModel by viewModels()
    private val args: GroupDetailFragmentArgs by navArgs()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    GroupDetailScreen(
                        viewModel = viewModel,
                        groupId = args.groupId,
                        onNavigateBack = {
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        },
                        onNavigateToInvite = {
                            if (isAdded) {
                                val action = GroupDetailFragmentDirections
                                    .actionGroupDetailFragmentToInvitePlayersFragment(args.groupId)
                                findNavController().navigate(action)
                            }
                        },
                        onNavigateToCashbox = {
                            if (isAdded) {
                                val action = GroupDetailFragmentDirections
                                    .actionGroupDetailFragmentToCashboxFragment(args.groupId)
                                findNavController().navigate(action)
                            }
                        },
                        onNavigateToCreateGame = {
                            if (isAdded) {
                                try {
                                    val action = GroupDetailFragmentDirections
                                        .actionGroupDetailFragmentToCreateGameFragment(args.groupId)
                                    findNavController().navigate(action)
                                } catch (e: Exception) {
                                    // Se a ação não existir, navega sem argumento
                                    findNavController().navigate(com.futebadosparcas.R.id.createGameFragment)
                                }
                            }
                        },
                        onMemberClick = { userId ->
                            if (isAdded) {
                                val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(userId)
                                playerCard.show(childFragmentManager, "PlayerCardDialog")
                            }
                        },
                        onShowEditDialog = { group ->
                            if (isAdded) {
                                showEditGroupDialog(group)
                            }
                        },
                        onShowTransferOwnershipDialog = { members ->
                            if (isAdded) {
                                showTransferOwnershipDialog(members)
                            }
                        }
                    )
                }
            }
        }
    }

    private fun showEditGroupDialog(group: Group) {
        val dialog = EditGroupDialog.newInstance(group)
        dialog.setOnSaveListener { name, description, photoUri ->
            viewModel.updateGroup(name, description, photoUri)
        }
        dialog.show(childFragmentManager, "EditGroupDialog")
    }

    private fun showTransferOwnershipDialog(members: List<GroupMember>) {
        if (members.size < 2) {
            // Mostrar mensagem de erro via Snackbar
            view?.let { v ->
                Snackbar.make(
                    v,
                    "O grupo precisa ter pelo menos mais um membro para transferir a propriedade",
                    Snackbar.LENGTH_LONG
                ).show()
            }
            return
        }

        val dialog = TransferOwnershipDialog.newInstance()
        dialog.setMembers(members)
        dialog.setOnMemberSelectedListener { member ->
            viewModel.transferOwnership(member)
        }
        dialog.show(childFragmentManager, "TransferOwnershipDialog")
    }
}
