package com.futebadosparcas.ui.livegame

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

/**
 * LiveGameFragment - Fragment wrapper para LiveGameScreen
 *
 * Migrado para Jetpack Compose com LiveGameScreen.kt
 * Mantido para compatibilidade com Navigation XML
 *
 * Ver: LIVEGAME_MIGRATION.md para detalhes da migração
 */
@AndroidEntryPoint
class LiveGameFragment : Fragment() {

    private val viewModel: LiveGameViewModel by viewModels()
    private val statsViewModel: LiveStatsViewModel by viewModels()
    private val eventsViewModel: LiveEventsViewModel by viewModels()
    private val args: LiveGameFragmentArgs by navArgs()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    LiveGameScreen(
                        viewModel = viewModel,
                        statsViewModel = statsViewModel,
                        eventsViewModel = eventsViewModel,
                        gameId = args.gameId,
                        onNavigateBack = {
                            findNavController().popBackStack()
                        },
                        onNavigateToVote = {
                            try {
                                val action = LiveGameFragmentDirections.actionLiveGameToMvpVote(args.gameId)
                                findNavController().navigate(action)
                            } catch (e: Exception) {
                                com.futebadosparcas.util.AppLogger.e("LiveGameFragment", "Error navigating to vote", e)
                            }
                        }
                    )
                }
            }
        }
    }
}
