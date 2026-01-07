package com.futebadosparcas.ui.badges

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
 * Fragment da tela de Badges/Conquistas
 * Migrado para Jetpack Compose
 */
@AndroidEntryPoint
class BadgesFragment : Fragment() {

    private val viewModel: BadgesViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            // Libera a composição quando o viewLifecycleOwner é destruído
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    BadgesScreen(
                        viewModel = viewModel,
                        onBackClick = null // Sem botão de voltar pois está em tab navigation
                    )
                }
            }
        }
    }
}
