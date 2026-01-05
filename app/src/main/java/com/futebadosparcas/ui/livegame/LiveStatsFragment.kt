package com.futebadosparcas.ui.livegame

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.databinding.FragmentLiveStatsBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class LiveStatsFragment : Fragment() {

    private var _binding: FragmentLiveStatsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: LiveStatsViewModel by viewModels()
    private val adapter = LiveStatsAdapter()

    private var gameId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        gameId = arguments?.getString(ARG_GAME_ID) ?: ""
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLiveStatsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        observeViewModel()

        if (gameId.isNotEmpty()) {
            viewModel.observeStats(gameId)
        }
    }

    private fun setupRecyclerView() {
        binding.rvLiveStats.apply {
            adapter = this@LiveStatsFragment.adapter
            setHasFixedSize(true)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.stats.collect { stats ->
                adapter.submitList(stats)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_GAME_ID = "game_id"

        fun newInstance(gameId: String) = LiveStatsFragment().apply {
            arguments = Bundle().apply {
                putString(ARG_GAME_ID, gameId)
            }
        }
    }
}
