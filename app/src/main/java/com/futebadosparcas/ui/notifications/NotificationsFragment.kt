package com.futebadosparcas.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationAction
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Fragment de notificações com Jetpack Compose
 *
 * Migrado de XML para Compose seguindo as melhores práticas:
 * - ComposeView para integração com Navigation Component
 * - ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed para evitar memory leaks
 * - Navegação via NavController do Fragment
 */
@AndroidEntryPoint
class NotificationsFragment : Fragment() {

    private val viewModel: NotificationsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            // Define estratégia de lifecycle para evitar memory leaks
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    NotificationsScreen(
                        viewModel = viewModel,
                        onNotificationClick = { notification ->
                            handleNotificationClick(notification)
                        },
                        onBackClick = {
                            findNavController().popBackStack()
                        }
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        observeNavigationActions()
    }

    /**
     * Observa ações de navegação do ViewModel
     * (necessário porque navegação via NavController precisa estar no Fragment)
     */
    private fun observeNavigationActions() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.actionState.collect { state ->
                when (state) {
                    is NotificationActionState.NavigateToGame -> {
                        val action = NotificationsFragmentDirections
                            .actionNotificationsFragmentToGameDetailFragment(state.gameId)
                        findNavController().navigate(action)
                        viewModel.resetActionState()
                    }
                    else -> {
                        // Outros estados são tratados no Composable
                    }
                }
            }
        }
    }

    /**
     * Trata clique em notificação e navega para a tela apropriada
     */
    private fun handleNotificationClick(notification: AppNotification) {
        when (notification.referenceType) {
            "group" -> {
                notification.referenceId?.let { groupId ->
                    val action = NotificationsFragmentDirections
                        .actionNotificationsFragmentToGroupDetailFragment(groupId)
                    findNavController().navigate(action)
                }
            }
            "game" -> {
                notification.referenceId?.let { gameId ->
                    val action = NotificationsFragmentDirections
                        .actionNotificationsFragmentToGameDetailFragment(gameId)
                    findNavController().navigate(action)
                }
            }
            "invite" -> {
                // Action buttons são exibidos no card se for ACCEPT_DECLINE
                if (notification.getActionTypeEnum() == NotificationAction.ACCEPT_DECLINE) {
                    // Botões de aceitar/recusar já estão visíveis no card
                }
            }
        }
    }
}
