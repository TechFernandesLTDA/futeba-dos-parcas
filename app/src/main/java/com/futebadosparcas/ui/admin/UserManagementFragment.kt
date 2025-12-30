package com.futebadosparcas.ui.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.databinding.FragmentUserManagementBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

import androidx.core.widget.addTextChangedListener
import com.futebadosparcas.data.model.UserRole
import com.google.android.material.dialog.MaterialAlertDialogBuilder

@AndroidEntryPoint
class UserManagementFragment : Fragment() {

    private var _binding: FragmentUserManagementBinding? = null
    private val binding get() = _binding!!

    private val viewModel: UserManagementViewModel by viewModels()
    private lateinit var adapter: UserManagementAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentUserManagementBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        adapter = UserManagementAdapter { user, newRole ->
            showRoleChangeConfirmation(user, newRole)
        }
        binding.rvUsers.apply {
            layoutManager = androidx.recyclerview.widget.LinearLayoutManager(context)
            adapter = this@UserManagementFragment.adapter
        }
    }

    private fun setupListeners() {
        binding.etSearch.addTextChangedListener { text ->
            viewModel.searchUsers(text.toString())
        }
    }

    private fun showRoleChangeConfirmation(user: com.futebadosparcas.data.model.User, newRole: UserRole) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Alterar Permissão")
            .setMessage("Tem certeza que deseja alterar o nível de acesso de ${user.name} para ${newRole.displayName}?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Confirmar") { _, _ ->
                viewModel.updateUserRole(user, newRole)
            }
            .show()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is UserManagementUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.rvUsers.visibility = View.GONE
                    }
                    is UserManagementUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.rvUsers.visibility = View.VISIBLE
                        adapter.submitList(state.users)
                    }
                    is UserManagementUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        android.widget.Toast.makeText(requireContext(), state.message, android.widget.Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
