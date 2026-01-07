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
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * GamesFragment - Tela de listagem de jogos
 *
 * Migrado completamente para Jetpack Compose com GamesScreen.kt
 * Gerencia apenas navegação via Navigation Component
 */
@AndroidEntryPoint
class GamesFragment : Fragment() {

    private val viewModel: GamesViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    GamesScreen(
                        viewModel = viewModel,
                        onGameClick = { gameId ->
                            if (isAdded) {
                                val action = GamesFragmentDirections.actionGamesToGameDetail(gameId)
                                findNavController().navigate(action)
                            }
                        },
                        onCreateGameClick = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_games_to_createGame)
                            }
                        },
                        onNotificationsClick = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_global_notifications)
                            }
                        },
                        onGroupsClick = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_global_groups)
                            }
                        },
                        onMapClick = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_global_map)
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.loadGames()
    }

    companion object {
        private const val TAG = "GamesFragment"
    }
}
