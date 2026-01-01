package com.futebadosparcas.ui.locations

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.databinding.FragmentManageLocationsBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import androidx.core.widget.doAfterTextChanged
import kotlinx.coroutines.launch

@AndroidEntryPoint
class ManageLocationsFragment : Fragment() {

    private var _binding: FragmentManageLocationsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ManageLocationsViewModel by viewModels()
    private lateinit var adapter: ManageLocationsAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentManageLocationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupRecyclerView()
        setupListeners()
        setupSearch()
        observeViewModel()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
        
        binding.toolbar.inflateMenu(com.futebadosparcas.R.menu.manage_locations_menu)
        binding.toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                com.futebadosparcas.R.id.action_seed_database -> {
                    MaterialAlertDialogBuilder(requireContext())
                        .setTitle("Popular Banco de Dados")
                        .setMessage("Deseja importar/atualizar os 52 locais padrão? Isso pode levar alguns segundos.")
                        .setPositiveButton("Sim") { _, _ ->
                            viewModel.seedDatabase()
                        }
                        .setNegativeButton("Cancelar", null)
                        .show()
                    true
                }
                com.futebadosparcas.R.id.action_deduplicate -> {
                    MaterialAlertDialogBuilder(requireContext())
                        .setTitle("Remover Duplicatas")
                        .setMessage("Deseja analisar e remover locais duplicados? Será mantido o registro com dados mais completos (CEP preenchido).")
                        .setPositiveButton("Sim") { _, _ ->
                            viewModel.removeDuplicates()
                        }
                        .setNegativeButton("Cancelar", null)
                        .show()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = ManageLocationsAdapter(
            onEditClick = { locationWithFields ->
                // Navegar para tela de edição
                val bundle = Bundle().apply {
                    putString("locationId", locationWithFields.location.id)
                }
                findNavController().navigate(
                    com.futebadosparcas.R.id.locationDetailFragment,
                    bundle
                )
            },
            onDeleteLocationClick = { locationWithFields ->
                showDeleteLocationDialog(locationWithFields)
            },
            onDeleteFieldClick = { field ->
                showDeleteFieldDialog(field)
            }
        )

        binding.rvLocations.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@ManageLocationsFragment.adapter
        }
    }

    private fun setupListeners() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadAllLocations()
        }

        binding.fabAddLocation.setOnClickListener {
            // Navegar para tela de criar novo local
            findNavController().navigate(com.futebadosparcas.R.id.locationDetailFragment)
        }
    }

    private fun setupSearch() {
        binding.etSearch.doAfterTextChanged { text ->
            viewModel.onSearchQueryChanged(text?.toString() ?: "")
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ManageLocationsUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.swipeRefresh.isRefreshing = false
                    }
                    is ManageLocationsUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false

                        adapter.submitList(state.locations)

                        // Atualizar estatísticas
                        val totalFields = state.locations.sumOf { it.fields.size }
                        binding.tvTotalLocations.text = state.locations.size.toString()
                        binding.tvTotalFields.text = totalFields.toString()

                        // Empty state
                        if (state.locations.isEmpty()) {
                            binding.emptyState.visibility = View.VISIBLE
                            binding.rvLocations.visibility = View.GONE
                        } else {
                            binding.emptyState.visibility = View.GONE
                            binding.rvLocations.visibility = View.VISIBLE
                        }
                    }
                    is ManageLocationsUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(
                            requireContext(),
                            state.message,
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }
    }

    private fun showDeleteLocationDialog(locationWithFields: LocationWithFieldsData) {
        val location = locationWithFields.location
        val fieldsCount = locationWithFields.fields.size

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Deletar Local?")
            .setMessage(
                "Tem certeza que deseja deletar \"${location.name}\"?\n\n" +
                "Isso também deletará ${fieldsCount} quadra(s) associada(s).\n\n" +
                "Esta ação não pode ser desfeita."
            )
            .setPositiveButton("Deletar") { _, _ ->
                viewModel.deleteLocation(location.id)
                Toast.makeText(
                    requireContext(),
                    "Local deletado com sucesso",
                    Toast.LENGTH_SHORT
                ).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showDeleteFieldDialog(field: Field) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Deletar Quadra?")
            .setMessage(
                "Tem certeza que deseja deletar \"${field.name}\"?\n\n" +
                "Esta ação não pode ser desfeita."
            )
            .setPositiveButton("Deletar") { _, _ ->
                viewModel.deleteField(field.id)
                Toast.makeText(
                    requireContext(),
                    "Quadra deletada com sucesso",
                    Toast.LENGTH_SHORT
                ).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
