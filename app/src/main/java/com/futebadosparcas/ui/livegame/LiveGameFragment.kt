package com.futebadosparcas.ui.livegame

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.navArgs
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.futebadosparcas.databinding.FragmentLiveGameBinding
import androidx.navigation.fragment.findNavController
import com.google.android.material.tabs.TabLayoutMediator
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class LiveGameFragment : Fragment() {

    private var _binding: FragmentLiveGameBinding? = null
    private val binding get() = _binding!!
    private val viewModel: LiveGameViewModel by viewModels()
    private val args: LiveGameFragmentArgs by navArgs()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLiveGameBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupToolbar()
        setupViewPager()
        setupButtons()
        observeViewModel()

        viewModel.loadGame(args.gameId)
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
    }

    private fun setupViewPager() {
        val adapter = LiveGamePagerAdapter(this, args.gameId)
        binding.viewPager.adapter = adapter

        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Estatísticas"
                1 -> "Eventos"
                else -> ""
            }
        }.attach()
    }

    private fun setupButtons() {
        binding.btnFinishGame.setOnClickListener {
            viewModel.finishGame()
        }

        binding.fabAddEvent.setOnClickListener {
            showAddEventDialog()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is LiveGameUiState.Loading -> {
                        // Mostrar loading
                    }
                    is LiveGameUiState.Success -> {
                        updateUI(state)
                    }
                    is LiveGameUiState.Error -> {
                        Toast.makeText(context, state.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.userMessage.collect { message ->
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.navigationEvent.collect { event ->
                when (event) {
                    is LiveGameNavigationEvent.NavigateToVote -> {
                        try {
                            val action = LiveGameFragmentDirections.actionLiveGameToMvpVote(args.gameId)
                            findNavController().navigate(action)
                        } catch (e: Exception) {
                            com.futebadosparcas.util.AppLogger.e("LiveGameFragment", "Error navigating to vote", e)
                        }
                    }
                }
            }
        }
    }

    private fun updateUI(state: LiveGameUiState.Success) {
        binding.apply {
            // Times
            tvTeam1Name.text = state.team1.name
            tvTeam2Name.text = state.team2.name

            // Placar
            tvTeam1Score.text = state.score.team1Score.toString()
            tvTeam2Score.text = state.score.team2Score.toString()

            // Info do jogo
            tvGameInfo.text = "${state.game.locationName} - ${state.game.fieldName}"
            
            // Cronometro logic
            if (state.score.startedAt != null) {
                 val startTime = state.score.startedAt!!.time
                 val elapsed = System.currentTimeMillis() - startTime
                 binding.chronometer.base = android.os.SystemClock.elapsedRealtime() - elapsed
                 binding.chronometer.start()
                 binding.chronometer.visibility = View.VISIBLE
            } else {
                 binding.chronometer.stop()
                 if (state.game.getStatusEnum() == com.futebadosparcas.data.model.GameStatus.FINISHED) {
                     binding.chronometer.text = "Fim de Jogo"
                     binding.chronometer.visibility = View.VISIBLE
                 } else {
                     binding.chronometer.visibility = View.GONE
                 }
            }

            // Botao finalizar (apenas organizador - e jogo não finalizado)
            val isFinished = state.game.getStatusEnum() == com.futebadosparcas.data.model.GameStatus.FINISHED
            
            btnFinishGame.visibility = if (state.isOwner && !isFinished) View.VISIBLE else View.GONE
            
            // FAB apenas se jogo LIVE
            fabAddEvent.visibility = if (!isFinished && state.game.getStatusEnum() == com.futebadosparcas.data.model.GameStatus.LIVE) View.VISIBLE else View.GONE
        }
    }

    private fun showAddEventDialog() {
        val currentState = viewModel.uiState.value
        if (currentState !is LiveGameUiState.Success) return

        AddEventDialog.newInstance(
            gameId = args.gameId,
            team1 = currentState.team1,
            team2 = currentState.team2
        ).show(childFragmentManager, "add_event")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private class LiveGamePagerAdapter(
        fragment: Fragment,
        private val gameId: String
    ) : FragmentStateAdapter(fragment) {

        override fun getItemCount(): Int = 2

        override fun createFragment(position: Int): Fragment {
            return when (position) {
                0 -> LiveStatsFragment.newInstance(gameId)
                1 -> LiveEventsFragment.newInstance(gameId)
                else -> throw IllegalStateException("Invalid position")
            }
        }
    }
}
