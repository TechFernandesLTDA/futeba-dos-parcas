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
 * FieldOwnerDashboardFragment - Dashboard do dono de quadra
 *
 * Migrado para Jetpack Compose com FieldOwnerDashboardScreen.kt
 */
@AndroidEntryPoint
class FieldOwnerDashboardFragment : Fragment() {

    private val viewModel: FieldOwnerDashboardViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
            )

            setContent {
                FutebaTheme {
                    FieldOwnerDashboardScreen(
                        viewModel = viewModel,
                        onNavigateBack = {
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        },
                        onNavigateToLocation = { locationId ->
                            if (isAdded) {
                                val bundle = Bundle().apply {
                                    putString("locationId", locationId)
                                }
                                findNavController().navigate(
                                    R.id.action_fieldOwnerDashboardFragment_to_locationDetailFragment,
                                    bundle
                                )
                            }
                        },
                        onNavigateToAddLocation = {
                            if (isAdded) {
                                findNavController().navigate(
                                    R.id.action_fieldOwnerDashboardFragment_to_locationDetailFragment
                                )
                            }
                        }
                    )
                }
            }
        }
    }
}
