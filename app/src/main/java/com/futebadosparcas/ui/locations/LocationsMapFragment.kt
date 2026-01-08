package com.futebadosparcas.ui.locations

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
 * LocationsMapFragment - Wrapper para LocationsMapScreen Compose
 * Mantido para compatibilidade com navegação XML
 */
@AndroidEntryPoint
class LocationsMapFragment : Fragment() {

    private val viewModel: LocationsMapViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    LocationsMapScreen(
                        viewModel = viewModel,
                        onBackClick = {
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        }
                    )
                }
            }
        }
    }
}
