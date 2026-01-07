package com.futebadosparcas.ui.games

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class GameDetailFragment : Fragment() {

    private val viewModel: GameDetailViewModel by viewModels()
    private val args: GameDetailFragmentArgs by navArgs()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    GameDetailScreen(
                        viewModel = viewModel,
                        gameId = args.gameId,
                        onNavigateBack = { findNavController().popBackStack() },
                        onNavigateToCreateGame = { gameId ->
                            val action = GameDetailFragmentDirections.actionGameDetailToCreateGame(gameId = gameId)
                            findNavController().navigate(action)
                        },
                        onNavigateToMvpVote = { gameId ->
                           val action = GameDetailFragmentDirections.actionGameDetailToMvpVote(gameId)
                            findNavController().navigate(action)
                        },
                        onNavigateToTacticalBoard = {
                            val action = GameDetailFragmentDirections.actionGameDetailToTacticalBoard()
                            findNavController().navigate(action)
                        }
                    )
                }
            }
        }
    }
}
