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
import com.futebadosparcas.util.HapticManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class CreateGameFragment : Fragment() {

    private val viewModel: CreateGameViewModel by viewModels()
    private val args: CreateGameFragmentArgs by navArgs()
    
    @Inject
    lateinit var hapticManager: HapticManager

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    CreateGameScreen(
                        gameId = args.gameId, // Can be null
                        viewModel = viewModel,
                        hapticManager = hapticManager,
                        onNavigateBack = { findNavController().popBackStack() },
                        onGameCreated = { gameId ->
                            // Navigate to details or back? Usually back or to details of created game
                            // For now popping back stack or if created new, maybe go to details?
                            // Default behavior usually pop to previous
                            findNavController().popBackStack() 
                        }
                    )
                }
            }
        }
    }
}
