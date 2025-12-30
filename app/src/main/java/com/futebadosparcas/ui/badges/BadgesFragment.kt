package com.futebadosparcas.ui.badges

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.GridLayoutManager
import com.futebadosparcas.databinding.FragmentBadgesBinding
import com.futebadosparcas.ui.badges.adapter.BadgesAdapter
import com.google.android.material.tabs.TabLayout
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Fragment da tela de Badges/Conquistas
 */
@AndroidEntryPoint
class BadgesFragment : Fragment() {

    private var _binding: FragmentBadgesBinding? = null
    private val binding get() = _binding!!

    private val viewModel: BadgesViewModel by viewModels()
    private lateinit var badgesAdapter: BadgesAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBadgesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupTabListener()
        observeUiState()
    }

    private fun setupRecyclerView() {
        badgesAdapter = BadgesAdapter()
        binding.rvBadges.apply {
            layoutManager = GridLayoutManager(requireContext(), 2) // 2 colunas
            adapter = badgesAdapter
        }
    }

    private fun setupTabListener() {
        binding.tabCategories.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                val category = when (tab?.position) {
                    0 -> null // Todas
                    1 -> BadgeCategory.PERFORMANCE
                    2 -> BadgeCategory.PRESENCA
                    3 -> BadgeCategory.COMUNIDADE
                    4 -> BadgeCategory.NIVEL
                    else -> null
                }
                viewModel.filterByCategory(category)
            }

            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is BadgesUiState.Loading -> showLoading()
                        is BadgesUiState.Error -> showError(state.message)
                        is BadgesUiState.Success -> showSuccess(state)
                    }
                }
            }
        }
    }

    private fun showLoading() {
        binding.progressBar.isVisible = true
        binding.rvBadges.isVisible = false
        binding.tvEmptyState.isVisible = false
        binding.tabCategories.isVisible = false
    }

    private fun showError(message: String) {
        binding.progressBar.isVisible = false
        binding.rvBadges.isVisible = false
        binding.tvEmptyState.isVisible = true
        binding.tabCategories.isVisible = false
    }

    private fun showSuccess(state: BadgesUiState.Success) {
        binding.progressBar.isVisible = false

        // Mostrar tabs apenas se houver badges
        binding.tabCategories.isVisible = state.allBadges.isNotEmpty()

        // Atualizar header com progresso
        val totalAvailable = 11 // Total de badges disponíveis (BadgeType.values())
        binding.tvBadgesProgress.text = "${state.totalUnlocked}/$totalAvailable"
        binding.progressBadges.max = totalAvailable
        binding.progressBadges.progress = state.totalUnlocked

        // Calcular porcentagem
        val percentage = if (totalAvailable > 0) {
            (state.totalUnlocked.toFloat() / totalAvailable * 100).toInt()
        } else {
            0
        }
        binding.tvBadgesPercentage.text = "$percentage%"

        // Atualizar lista de badges (usar filteredBadges ao invés de allBadges)
        if (state.filteredBadges.isEmpty() && state.allBadges.isNotEmpty()) {
            // Tem badges, mas nenhuma nesta categoria
            binding.rvBadges.isVisible = false
            binding.tvEmptyState.isVisible = true
        } else if (state.allBadges.isEmpty()) {
            // Não tem nenhuma badge ainda
            binding.rvBadges.isVisible = false
            binding.tvEmptyState.isVisible = true
        } else {
            // Tem badges para mostrar
            binding.rvBadges.isVisible = true
            binding.tvEmptyState.isVisible = false
            badgesAdapter.submitList(state.filteredBadges)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
