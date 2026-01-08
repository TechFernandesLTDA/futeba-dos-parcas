package com.futebadosparcas.ui.theme

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import dagger.hilt.android.AndroidEntryPoint

/**
 * ThemeSettingsFragment - Wrapper para ThemeSettingsScreen Compose
 * Mantido para compatibilidade com navegação XML
 */
@AndroidEntryPoint
class ThemeSettingsFragment : Fragment() {

    private val viewModel: ThemeViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    ThemeSettingsScreen(
                        viewModel = viewModel,
                        onBackClick = {
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
