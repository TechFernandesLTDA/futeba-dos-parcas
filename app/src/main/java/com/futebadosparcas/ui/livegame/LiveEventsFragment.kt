package com.futebadosparcas.ui.livegame

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * LiveEventsFragment - Exibe eventos ao vivo de um jogo
 *
 * Migrado para Jetpack Compose com LiveEventsScreen.kt
 */
@AndroidEntryPoint
class LiveEventsFragment : Fragment() {

    private val viewModel: LiveEventsViewModel by viewModels()
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
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    LiveEventsScreen(
                        viewModel = viewModel,
                        gameId = gameId,
                        onEventClick = { eventId ->
                            // Handle event click if needed
                        }
                    )
                }
            }
        }
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
