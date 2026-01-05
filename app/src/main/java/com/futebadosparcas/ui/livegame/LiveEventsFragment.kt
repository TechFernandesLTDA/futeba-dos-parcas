package com.futebadosparcas.ui.livegame

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.databinding.FragmentLiveEventsBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class LiveEventsFragment : Fragment() {

    private var _binding: FragmentLiveEventsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: LiveEventsViewModel by viewModels()
    private val adapter = LiveEventsAdapter()

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
        _binding = FragmentLiveEventsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        observeViewModel()

        if (gameId.isNotEmpty()) {
            viewModel.observeEvents(gameId)
        }
    }

    private fun setupRecyclerView() {
        binding.rvLiveEvents.apply {
            adapter = this@LiveEventsFragment.adapter
            setHasFixedSize(true)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.events.collect { events ->
                adapter.submitList(events)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_GAME_ID = "game_id"

        fun newInstance(gameId: String) = LiveEventsFragment().apply {
            arguments = Bundle().apply {
                putString(ARG_GAME_ID, gameId)
            }
        }
    }
}
