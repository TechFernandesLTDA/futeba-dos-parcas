package com.futebadosparcas.ui.schedules

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.databinding.FragmentSchedulesBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class SchedulesFragment : Fragment() {

    private var _binding: FragmentSchedulesBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SchedulesViewModel by viewModels()
    private lateinit var adapter: SchedulesAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSchedulesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        observeViewModel()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        adapter = SchedulesAdapter(
            onEditClick = { schedule -> showEditDialog(schedule) },
            onDeleteClick = { scheduleId -> showDeleteConfirmation(scheduleId) }
        )

        binding.rvSchedules.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@SchedulesFragment.adapter
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is SchedulesUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.rvSchedules.visibility = View.GONE
                        binding.layoutEmpty.visibility = View.GONE
                    }
                    is SchedulesUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        if (state.schedules.isEmpty()) {
                            binding.rvSchedules.visibility = View.GONE
                            binding.layoutEmpty.visibility = View.VISIBLE
                        } else {
                            binding.rvSchedules.visibility = View.VISIBLE
                            binding.layoutEmpty.visibility = View.GONE
                            adapter.submitList(state.schedules)
                        }
                    }
                    is SchedulesUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        // Opcional: mostrar Snackbar de erro
                    }
                }
            }
        }
    }

    private fun showDeleteConfirmation(scheduleId: String) {
        AlertDialog.Builder(requireContext())
            .setTitle("Excluir Recorrência")
            .setMessage("Deseja interromper esta recorrência? Novos jogos não serão mais agendados automaticamente para esta série.")
            .setPositiveButton("Interromper") { _, _ ->
                viewModel.deleteSchedule(scheduleId)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showEditDialog(schedule: Schedule) {
        val dialog = EditScheduleDialogFragment.newInstance(schedule) { updatedSchedule ->
            viewModel.updateSchedule(updatedSchedule)
        }
        dialog.show(childFragmentManager, "EditScheduleDialog")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
