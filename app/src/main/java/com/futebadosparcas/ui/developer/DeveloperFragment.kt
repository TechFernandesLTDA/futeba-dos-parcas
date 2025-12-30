package com.futebadosparcas.ui.developer

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.databinding.FragmentDeveloperBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class DeveloperFragment : Fragment() {

    private var _binding: FragmentDeveloperBinding? = null
    private val binding get() = _binding!!

    private val viewModel: DeveloperViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDeveloperBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        binding.btnGenerateData.setOnClickListener {
            viewModel.generateMockData()
        }

        binding.btnPopulateFields.setOnClickListener {
            viewModel.populateFieldsForAllLocations()
        }

        binding.btnAnalyzeFirestore.setOnClickListener {
            viewModel.analyzeFirestore()
        }

        binding.btnCleanUp.setOnClickListener {
            viewModel.cleanUpData()
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is DeveloperUiState.Idle -> {
                        binding.progressBar.visibility = View.GONE
                        binding.btnGenerateData.isEnabled = true
                    }
                    is DeveloperUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.btnGenerateData.isEnabled = false
                    }
                    is DeveloperUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.btnGenerateData.isEnabled = true
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
                    }
                    is DeveloperUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.btnGenerateData.isEnabled = true
                        binding.btnResetData.isEnabled = true
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
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
