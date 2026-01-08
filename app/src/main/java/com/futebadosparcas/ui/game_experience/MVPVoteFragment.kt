package com.futebadosparcas.ui.game_experience

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MVPVoteFragment : Fragment() {

    private val viewModel: MVPVoteViewModel by viewModels()
    private var gameId: String = ""

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        gameId = arguments?.getString("gameId") ?: run {
            Toast.makeText(requireContext(), "Erro: Jogo não identificado", Toast.LENGTH_SHORT).show()
            findNavController().popBackStack()
            return View(requireContext())
        }

        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    MVPVoteScreen(
                        viewModel = viewModel,
                        gameId = gameId,
                        onNavigateBack = {
                            if (isAdded) {
                                findNavController().navigateUp()
                            }
                        }
                    )
                }
            }
        }
    }
}
