package com.futebadosparcas.ui.groups

import android.content.res.Configuration
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentGroupsBinding
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@AndroidEntryPoint
class GroupsFragment : Fragment() {

    private var _binding: FragmentGroupsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: GroupsViewModel by viewModels()
    private lateinit var adapter: GroupsAdapter

    private var searchJob: Job? = null
    private var hasGroups = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGroupsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupRecyclerView()
        setupSearch()
        setupListeners()
        observeViewModel()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Reconfigura o grid quando a orientação muda
        setupAdaptiveGrid()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
    }

    private fun setupRecyclerView() {
        adapter = GroupsAdapter { group ->
            val action = GroupsFragmentDirections.actionGroupsFragmentToGroupDetailFragment(group.groupId)
            findNavController().navigate(action)
        }

        binding.rvGroups.apply {
            adapter = this@GroupsFragment.adapter
        }

        // Configura o grid adaptativo inicial
        setupAdaptiveGrid()
    }

    /**
     * Configura o GridLayoutManager com número de colunas adaptativo baseado no tamanho da tela.
     * Utiliza recursos definidos em values/dimens.xml, values-sw600dp/dimens.xml e values-sw720dp/dimens.xml
     */
    private fun setupAdaptiveGrid() {
        val columns = resources.getInteger(R.integer.grid_columns)
        binding.rvGroups.layoutManager = GridLayoutManager(requireContext(), columns)
    }

    private fun setupSearch() {
        binding.etSearch.doAfterTextChanged { text ->
            searchJob?.cancel()
            searchJob = viewLifecycleOwner.lifecycleScope.launch {
                delay(300) // Debounce de 300ms
                viewModel.searchGroups(text?.toString() ?: "")
            }
        }
    }

    private fun setupListeners() {
        binding.fabCreateGroup.setOnClickListener {
            findNavController().navigate(R.id.action_groupsFragment_to_createGroupFragment)
        }

        binding.btnCreateGroupEmpty.setOnClickListener {
            findNavController().navigate(R.id.action_groupsFragment_to_createGroupFragment)
        }

        binding.swipeRefresh.setOnRefreshListener {
            viewModel.refreshGroups()
        }
    }

    private fun observeViewModel() {
        // Observa o estado de refresh
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isRefreshing.collect { isRefreshing ->
                binding.swipeRefresh.isRefreshing = isRefreshing
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is GroupsUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.rvGroups.visibility = View.GONE
                        binding.emptyView.visibility = View.GONE
                        binding.emptySearchView.visibility = View.GONE
                        binding.tilSearch.visibility = View.GONE
                    }
                    is GroupsUiState.Empty -> {
                        binding.progressBar.visibility = View.GONE

                        val searchQuery = viewModel.searchQuery.value
                        if (searchQuery.isNotEmpty()) {
                            // Nenhum resultado na busca
                            binding.rvGroups.visibility = View.GONE
                            binding.emptyView.visibility = View.GONE
                            binding.emptySearchView.visibility = View.VISIBLE
                            binding.tilSearch.visibility = View.VISIBLE
                            binding.fabCreateGroup.visibility = View.VISIBLE
                        } else {
                            // Sem grupos
                            binding.rvGroups.visibility = View.GONE
                            binding.emptyView.visibility = View.VISIBLE
                            binding.emptySearchView.visibility = View.GONE
                            binding.tilSearch.visibility = View.GONE
                            binding.fabCreateGroup.visibility = View.GONE
                            hasGroups = false
                        }
                    }
                    is GroupsUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.emptyView.visibility = View.GONE
                        binding.fabCreateGroup.visibility = View.VISIBLE
                        hasGroups = true

                        val searchQuery = viewModel.searchQuery.value
                        if (state.groups.isEmpty() && searchQuery.isNotEmpty()) {
                            // Nenhum resultado na busca
                            binding.rvGroups.visibility = View.GONE
                            binding.emptySearchView.visibility = View.VISIBLE
                            binding.tilSearch.visibility = View.VISIBLE
                        } else {
                            binding.rvGroups.visibility = View.VISIBLE
                            binding.emptySearchView.visibility = View.GONE
                            // Mostrar campo de busca se tem mais de 3 grupos
                            binding.tilSearch.visibility = if (state.groups.size >= 3) View.VISIBLE else View.GONE
                            adapter.submitList(state.groups)
                        }
                    }
                    is GroupsUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        searchJob?.cancel()
        _binding = null
    }
}
