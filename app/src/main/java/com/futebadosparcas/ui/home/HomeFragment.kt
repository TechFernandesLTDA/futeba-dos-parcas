package com.futebadosparcas.ui.home

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
import com.futebadosparcas.util.HapticManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * HomeFragment - Tela principal da aplicação
 *
 * Migrado completamente para Jetpack Compose com HomeScreen.kt
 * Gerencia apenas navegação via Navigation Component
 */
@AndroidEntryPoint
class HomeFragment : Fragment() {

    @Inject
    lateinit var hapticManager: HapticManager

    private val viewModel: HomeViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    HomeScreen(
                        viewModel = viewModel,
                        onGameClick = { gameId ->
                            if (isAdded) {
                                val action = HomeFragmentDirections.actionHomeToGameDetail(gameId)
                                findNavController().navigate(action)
                            }
                        },
                        onProfileClick = {
                            if (isAdded) {
                                // Abrir diálogo de perfil do usuário
                                val userId = viewModel.getCurrentUserId() ?: return@HomeScreen
                                val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(userId)
                                playerCard.show(childFragmentManager, "PlayerCard")
                            }
                        },
                        onSettingsClick = {
                            if (isAdded) {
                                findNavController().navigate(R.id.action_global_preferences)
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
                            // TODO: Navigate to map screen when available
                        },
                        hapticManager = hapticManager
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.loadHomeData()
    }
}
