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
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * ManageLocationsFragment - Gerencia locais (campos de futebol)
 *
 * Migrado para Jetpack Compose com ManageLocationsScreen.kt
 */
@AndroidEntryPoint
class ManageLocationsFragment : Fragment() {

    private val viewModel: ManageLocationsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    ManageLocationsScreen(
                        viewModel = viewModel,
                        onLocationClick = { locationId ->
                            if (isAdded) {
                                val bundle = Bundle().apply {
                                    putString("locationId", locationId)
                                }
                                findNavController().navigate(
                                    R.id.locationDetailFragment,
                                    bundle
                                )
                            }
                        },
                        onCreateLocationClick = {
                            if (isAdded) {
                                findNavController().navigate(R.id.locationDetailFragment)
                            }
                        },
                        onNavigateBack = {
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
