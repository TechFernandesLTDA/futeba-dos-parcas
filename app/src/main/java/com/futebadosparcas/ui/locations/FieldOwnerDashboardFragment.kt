package com.futebadosparcas.ui.locations

import android.os.Bundle
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.R
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.databinding.FragmentFieldOwnerDashboardBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class FieldOwnerDashboardFragment : Fragment() {

    private var _binding: FragmentFieldOwnerDashboardBinding? = null
    private val binding get() = _binding!!

    private val viewModel: FieldOwnerDashboardViewModel by viewModels()
    private lateinit var adapter: LocationDashboardAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentFieldOwnerDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupListeners()
        observeViewModel()
        viewModel.loadLocations() // Initial load
    }

    private fun setupRecyclerView() {
        adapter = LocationDashboardAdapter { location ->
             val bundle = Bundle().apply {
                 putString("locationId", location.id)
             }
             findNavController().navigate(R.id.action_fieldOwnerDashboardFragment_to_locationDetailFragment, bundle)
        }
        binding.rvLocations.apply {
            layoutManager = androidx.recyclerview.widget.LinearLayoutManager(context)
            adapter = this@FieldOwnerDashboardFragment.adapter
            setHasFixedSize(true)
        }
    }

    private fun setupListeners() {
        binding.fabAddLocation.setOnClickListener {
             findNavController().navigate(R.id.action_fieldOwnerDashboardFragment_to_locationDetailFragment)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is FieldOwnerDashboardUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.tvEmptyState.visibility = View.GONE
                        binding.rvLocations.visibility = View.GONE
                    }
                    is FieldOwnerDashboardUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        if (state.locations.isEmpty()) {
                            binding.tvEmptyState.visibility = View.VISIBLE
                            binding.rvLocations.visibility = View.GONE
                        } else {
                            binding.tvEmptyState.visibility = View.GONE
                            binding.rvLocations.visibility = View.VISIBLE
                            adapter.submitList(state.locations)
                        }
                    }
                    is FieldOwnerDashboardUiState.Error -> {
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
