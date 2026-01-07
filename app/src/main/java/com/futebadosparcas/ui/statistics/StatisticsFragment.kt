package com.futebadosparcas.ui.statistics

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Fragment de Estatísticas migrado para Jetpack Compose
 *
 * Exibe estatísticas do jogador e rankings gerais
 */
@AndroidEntryPoint
class StatisticsFragment : Fragment() {

    private val viewModel: StatisticsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            // Define a estratégia de composição para seguir o lifecycle do viewLifecycleOwner
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    StatisticsScreen(
                        viewModel = viewModel,
                        onNavigateToRanking = {
                            findNavController().navigate(
                                StatisticsFragmentDirections.actionStatisticsToRanking()
                            )
                        },
                        onNavigateToEvolution = {
                            findNavController().navigate(
                                StatisticsFragmentDirections.actionStatisticsToEvolution()
                            )
                        },
                        onPlayerClick = { playerId ->
                            // TODO: Navegar para perfil do jogador quando a tela estiver pronta
                            // findNavController().navigate(
                            //     StatisticsFragmentDirections.actionStatisticsToPlayerProfile(playerId)
                            // )
                        }
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // Carregar estatísticas ao criar a view
        viewModel.loadStatistics()
    }
}
