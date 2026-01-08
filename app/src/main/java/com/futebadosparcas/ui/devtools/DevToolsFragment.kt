package com.futebadosparcas.ui.devtools

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class DevToolsFragment : Fragment() {

    @Inject
    lateinit var preferencesManager: PreferencesManager

    @Inject
    lateinit var gameDao: GameDao

    @Inject
    lateinit var locationRepository: LocationRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    DevToolsScreen(
                        preferencesManager = preferencesManager,
                        gameDao = gameDao,
                        locationRepository = locationRepository,
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
