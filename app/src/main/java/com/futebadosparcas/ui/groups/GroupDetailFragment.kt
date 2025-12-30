package com.futebadosparcas.ui.groups

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.databinding.FragmentGroupDetailBinding
import com.futebadosparcas.ui.groups.dialogs.ConfirmationDialogs
import com.futebadosparcas.ui.groups.dialogs.EditGroupDialog
import com.futebadosparcas.ui.groups.dialogs.TransferOwnershipDialog
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Fragment para exibir detalhes de um grupo
 */
@AndroidEntryPoint
class GroupDetailFragment : Fragment() {

    private var _binding: FragmentGroupDetailBinding? = null
    private val binding get() = _binding!!

    private val viewModel: GroupDetailViewModel by viewModels()
    private val args: GroupDetailFragmentArgs by navArgs()
    private lateinit var membersAdapter: GroupMembersAdapter

    private var currentGroup: Group? = null
    private var currentMembers: List<GroupMember> = emptyList()
    private var currentRole: GroupMemberRole? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGroupDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupRecyclerView()
        setupListeners()
        observeViewModel()

        viewModel.loadGroup(args.groupId)
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_invite -> {
                    navigateToInvitePlayers()
                    true
                }
                R.id.action_cashbox -> {
                    navigateToCashbox()
                    true
                }
                R.id.action_create_game -> {
                    navigateToCreateGame()
                    true
                }
                R.id.action_edit -> {
                    showEditGroupDialog()
                    true
                }
                R.id.action_transfer_ownership -> {
                    showTransferOwnershipDialog()
                    true
                }
                R.id.action_leave_group -> {
                    showLeaveGroupConfirmation()
                    true
                }
                R.id.action_archive -> {
                    showArchiveGroupConfirmation()
                    true
                }
                R.id.action_delete -> {
                    showDeleteGroupConfirmation()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        membersAdapter = GroupMembersAdapter(
            onMemberClick = { member ->
                // Abre card do jogador
                val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(member.userId)
                playerCard.show(childFragmentManager, "PlayerCardDialog")
            },
            onPromoteClick = { member ->
                ConfirmationDialogs.showPromoteMemberDialog(
                    context = requireContext(),
                    memberName = member.getDisplayName()
                ) {
                    viewModel.promoteMember(member)
                }
            },
            onDemoteClick = { member ->
                ConfirmationDialogs.showDemoteMemberDialog(
                    context = requireContext(),
                    memberName = member.getDisplayName()
                ) {
                    viewModel.demoteMember(member)
                }
            },
            onRemoveClick = { member ->
                ConfirmationDialogs.showRemoveMemberDialog(
                    context = requireContext(),
                    memberName = member.getDisplayName()
                ) {
                    viewModel.removeMember(member)
                }
            }
        )

        binding.rvMembers.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = membersAdapter
        }
    }

    private fun setupListeners() {
        binding.btnInvitePlayers.setOnClickListener {
            navigateToInvitePlayers()
        }

        binding.btnCashbox.setOnClickListener {
            navigateToCashbox()
        }

        binding.btnCreateGame.setOnClickListener {
            navigateToCreateGame()
        }

        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadGroup(args.groupId)
        }
    }

    private fun showEditGroupDialog() {
        val group = currentGroup ?: return

        val dialog = EditGroupDialog.newInstance(group)
        dialog.setOnSaveListener { name, description, photoUri ->
            viewModel.updateGroup(name, description, photoUri)
        }
        dialog.show(childFragmentManager, "EditGroupDialog")
    }

    private fun showTransferOwnershipDialog() {
        if (currentMembers.size < 2) {
            Snackbar.make(
                binding.root,
                "O grupo precisa ter pelo menos mais um membro para transferir a propriedade",
                Snackbar.LENGTH_LONG
            ).show()
            return
        }

        val dialog = TransferOwnershipDialog.newInstance()
        dialog.setMembers(currentMembers)
        dialog.setOnMemberSelectedListener { member ->
            viewModel.transferOwnership(member)
        }
        dialog.show(childFragmentManager, "TransferOwnershipDialog")
    }

    private fun showLeaveGroupConfirmation() {
        val group = currentGroup ?: return

        ConfirmationDialogs.showLeaveGroupDialog(
            context = requireContext(),
            groupName = group.name
        ) {
            viewModel.leaveGroup()
        }
    }

    private fun showArchiveGroupConfirmation() {
        val group = currentGroup ?: return

        ConfirmationDialogs.showArchiveGroupDialog(
            context = requireContext(),
            groupName = group.name
        ) {
            viewModel.archiveGroup()
        }
    }

    private fun showDeleteGroupConfirmation() {
        val group = currentGroup ?: return

        ConfirmationDialogs.showDeleteGroupDialog(
            context = requireContext(),
            groupName = group.name
        ) {
            viewModel.deleteGroup()
        }
    }

    private fun navigateToInvitePlayers() {
        val action = GroupDetailFragmentDirections
            .actionGroupDetailFragmentToInvitePlayersFragment(args.groupId)
        findNavController().navigate(action)
    }

    private fun navigateToCashbox() {
        val action = GroupDetailFragmentDirections
            .actionGroupDetailFragmentToCashboxFragment(args.groupId)
        findNavController().navigate(action)
    }

    private fun navigateToCreateGame() {
        // Navega para criar jogo com contexto do grupo
        try {
            val action = GroupDetailFragmentDirections
                .actionGroupDetailFragmentToCreateGameFragment(args.groupId)
            findNavController().navigate(action)
        } catch (e: Exception) {
            // Se a ação não existir, navega sem argumento
            findNavController().navigate(R.id.createGameFragment)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                binding.swipeRefresh.isRefreshing = false

                when (state) {
                    is GroupDetailUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.contentLayout.visibility = View.GONE
                    }
                    is GroupDetailUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.contentLayout.visibility = View.VISIBLE

                        currentGroup = state.group
                        currentMembers = state.members
                        currentRole = state.myRole

                        updateUi(state.group, state.members, state.myRole)
                    }
                    is GroupDetailUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                    }
                    is GroupDetailUiState.LeftGroup -> {
                        Snackbar.make(binding.root, "Você saiu do grupo", Snackbar.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.actionState.collect { state ->
                when (state) {
                    is GroupActionState.Loading -> {
                        // Mostrar loading indicator se necessário
                    }
                    is GroupActionState.Success -> {
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_SHORT).show()
                        viewModel.resetActionState()
                    }
                    is GroupActionState.Error -> {
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                        viewModel.resetActionState()
                    }
                    is GroupActionState.GroupDeleted -> {
                        Snackbar.make(binding.root, "Grupo excluído", Snackbar.LENGTH_SHORT).show()
                        viewModel.resetActionState()
                        findNavController().popBackStack()
                    }
                    is GroupActionState.LeftGroup -> {
                        Snackbar.make(binding.root, "Você saiu do grupo", Snackbar.LENGTH_SHORT).show()
                        viewModel.resetActionState()
                        findNavController().popBackStack()
                    }
                    else -> {}
                }
            }
        }
    }

    private fun updateUi(group: Group, members: List<GroupMember>, myRole: GroupMemberRole?) {
        binding.tvGroupName.text = group.name
        binding.tvGroupDescription.text = group.description.ifEmpty { "Sem descrição" }

        // Carregar foto do grupo
        if (!group.photoUrl.isNullOrEmpty()) {
            binding.ivGroupPhoto.load(group.photoUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_groups)
                error(R.drawable.ic_groups)
                transformations(CircleCropTransformation())
            }
        } else {
            binding.ivGroupPhoto.setImageResource(R.drawable.ic_groups)
        }

        // Corrigir singular/plural para membros
        val memberCountText = when (group.memberCount) {
            1 -> "1 membro"
            else -> "${group.memberCount} membros"
        }
        binding.chipMemberCount.text = memberCountText

        // Define chip do papel do usuário
        binding.chipMyRole.text = when (myRole) {
            GroupMemberRole.OWNER -> "Dono"
            GroupMemberRole.ADMIN -> "Admin"
            GroupMemberRole.MEMBER -> "Membro"
            null -> "Visitante"
        }

        // Atualiza lista de membros (role primeiro para evitar rebind duplo)
        membersAdapter.setCurrentUserRole(myRole)
        membersAdapter.submitList(members)

        // Mostra/esconde controles admin baseado no papel
        val isOwnerOrAdmin = myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN
        val isOwner = myRole == GroupMemberRole.OWNER

        binding.btnInvitePlayers.visibility = if (isOwnerOrAdmin) View.VISIBLE else View.GONE
        binding.btnCreateGame.visibility = if (isOwnerOrAdmin) View.VISIBLE else View.GONE

        // Atualiza visibilidade de itens do menu
        val menu = binding.toolbar.menu
        menu.findItem(R.id.action_invite)?.isVisible = isOwnerOrAdmin
        menu.findItem(R.id.action_create_game)?.isVisible = isOwnerOrAdmin
        menu.findItem(R.id.action_edit)?.isVisible = isOwnerOrAdmin
        menu.findItem(R.id.action_transfer_ownership)?.isVisible = isOwner
        menu.findItem(R.id.action_archive)?.isVisible = isOwner
        menu.findItem(R.id.action_delete)?.isVisible = isOwner
        menu.findItem(R.id.action_leave_group)?.isVisible = !isOwner && myRole != null
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
