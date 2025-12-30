package com.futebadosparcas.ui.league

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Fragment da tela de Liga/Ranking
 */
@AndroidEntryPoint
class LeagueFragment : Fragment() {

    private val viewModel: LeagueViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val uiState by viewModel.uiState.collectAsState()
                val unreadCount by viewModel.unreadCount.collectAsState()
                
                FutebaTheme {
                    LeagueScreen(
                        uiState = uiState,
                        unreadCount = unreadCount,
                        onBack = { findNavController().popBackStack() },
                        onDivisionSelected = { viewModel.filterByDivision(it) },
                        onRefresh = { viewModel.loadLeagueData() },
                        onNavigateNotifications = { findNavController().navigate(com.futebadosparcas.R.id.action_global_notifications) },
                        onNavigateGroups = { findNavController().navigate(com.futebadosparcas.R.id.action_global_groups) },
                        onNavigateMap = { findNavController().navigate(com.futebadosparcas.R.id.action_global_map) }
                    )
                }
            }
        }
    }
}
