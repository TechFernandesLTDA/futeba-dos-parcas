package com.futebadosparcas.ui.preferences

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
import com.futebadosparcas.ui.theme.ThemeViewModel
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class PreferencesFragment : Fragment() {

    private val preferencesViewModel: PreferencesViewModel by viewModels()
    private val themeViewModel: ThemeViewModel by viewModels()

    @Inject
    lateinit var preferencesManager: PreferencesManager

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    PreferencesScreen(
                        preferencesViewModel = preferencesViewModel,
                        themeViewModel = themeViewModel,
                        preferencesManager = preferencesManager,
                        onNavigateBack = {
                            if (isAdded) {
                                findNavController().navigateUp()
                            }
                        },
                        onNavigateToThemeSettings = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_preferences_to_themeSettings)
                            }
                        },
                        onNavigateToDeveloper = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_preferences_to_developer)
                            }
                        }
                    )
                }
            }
        }
    }
}
