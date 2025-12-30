package com.futebadosparcas.ui.groups

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.data.model.User
import com.futebadosparcas.databinding.FragmentInvitePlayersBinding
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Fragment para convidar jogadores para um grupo
 */
@AndroidEntryPoint
class InvitePlayersFragment : Fragment() {

    private var _binding: FragmentInvitePlayersBinding? = null
    private val binding get() = _binding!!

    private val viewModel: InviteViewModel by viewModels()
    private val args: InvitePlayersFragmentArgs by navArgs()
    private lateinit var adapter: InvitePlayersAdapter

    private var currentGroupId: String = ""
    private var pendingInviteIds = setOf<String>()
    private var memberIds = setOf<String>()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentInvitePlayersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        currentGroupId = args.groupId

        setupToolbar()
        setupRecyclerView()
        setupSearch()
        observeViewModel()
        
        // Carrega convites pendentes e membros do grupo
        viewModel.loadGroupPendingInvites(currentGroupId)
        viewModel.loadGroupMembers(currentGroupId)
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
    }

    private fun setupRecyclerView() {
        adapter = InvitePlayersAdapter { user ->
            // Convida o jogador selecionado para o grupo
            viewModel.inviteUser(currentGroupId, user.id)
        }

        binding.rvUsers.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = this@InvitePlayersFragment.adapter
        }
    }

    private fun setupSearch() {
        // Perform initial search to show some users
        viewModel.searchUsers("")

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                val text = s?.toString() ?: ""
                viewModel.searchUsers(text)
            }
        })
    }

    private fun observeViewModel() {
        // Observa estado da busca de usuários
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.searchUsersState.collect { state ->
                when (state) {
                    is SearchUsersState.Idle -> {
                        binding.progressBar.visibility = View.GONE
                        binding.tvEmptySearch.visibility = View.VISIBLE
                        binding.tvNoResults.visibility = View.GONE
                    }
                    is SearchUsersState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.tvEmptySearch.visibility = View.GONE
                        binding.tvNoResults.visibility = View.GONE
                    }
                    is SearchUsersState.Empty -> {
                        binding.progressBar.visibility = View.GONE
                        binding.tvEmptySearch.visibility = View.GONE
                        binding.tvNoResults.visibility = View.VISIBLE
                        binding.rvUsers.visibility = View.GONE
                    }
                    is SearchUsersState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.tvEmptySearch.visibility = View.GONE
                        binding.tvNoResults.visibility = View.GONE
                        binding.rvUsers.visibility = View.VISIBLE
                        adapter.submitList(state.users)
                        // Atualiza IDs de convites pendentes e membros
                        adapter.setAlreadyInvited(pendingInviteIds)
                        adapter.setAlreadyMembers(memberIds)
                    }
                    is SearchUsersState.Error -> {
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Observa estado das ações de convite
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.inviteActionState.collect { state ->
                when (state) {
                    is InviteActionState.Loading -> {
                        // Mostrar loading no botão
                    }
                    is InviteActionState.InviteSent -> {
                        showSnackbar(state.message)
                        // Recarrega convites pendentes para atualizar UI
                        viewModel.loadGroupPendingInvites(currentGroupId)
                        viewModel.resetActionState()
                    }
                    is InviteActionState.InviteAccepted -> {
                        showSnackbar(state.message)
                        viewModel.resetActionState()
                    }
                    is InviteActionState.InviteDeclined -> {
                        showSnackbar(state.message)
                        viewModel.resetActionState()
                    }
                    is InviteActionState.InviteCancelled -> {
                        showSnackbar(state.message)
                        viewModel.resetActionState()
                    }
                    is InviteActionState.Error -> {
                        com.google.android.material.snackbar.Snackbar.make(binding.root, state.message, com.google.android.material.snackbar.Snackbar.LENGTH_LONG).show()
                        viewModel.resetActionState()
                    }
                    is InviteActionState.Idle -> {}
                }
            }
        }
        
        // Observa convites pendentes do grupo
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.groupPendingInvitesState.collect { state ->
                when (state) {
                    is GroupPendingInvitesState.Success -> {
                        pendingInviteIds = state.invites.map { it.invitedUserId }.toSet()
                        adapter.setAlreadyInvited(pendingInviteIds)
                    }
                    else -> {}
                }
            }
        }
        
        // Observa membros do grupo
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.groupMembersState.collect { state ->
                when (state) {
                    is GroupMembersState.Success -> {
                        memberIds = state.members.map { it.userId }.toSet()
                        adapter.setAlreadyMembers(memberIds)
                    }
                    else -> {}
                }
            }
        }
    }

    private fun showSnackbar(message: String) {
        com.google.android.material.snackbar.Snackbar.make(binding.root, message, com.google.android.material.snackbar.Snackbar.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
