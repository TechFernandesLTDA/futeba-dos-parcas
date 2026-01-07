package com.futebadosparcas.ui.players

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.futebadosparcas.data.model.User
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Fragment que hospeda a tela de jogadores em Jetpack Compose
 *
 * Responsabilidades:
 * - Configurar ComposeView
 * - Observar eventos do ViewModel (Toasts, Dialogs)
 * - Navegação para PlayerCardDialog
 */
@AndroidEntryPoint
class PlayersFragment : Fragment() {

    private val viewModel: PlayersViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            // Estratégia de composição: descartar quando a view for destruída
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    PlayersScreen(
                        viewModel = viewModel,
                        onPlayerClick = { user ->
                            // Abre dialog de detalhes do jogador
                            showPlayerCard(user)
                        }
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Observa eventos de convite
        observeInviteEvents()
    }


    /**
     * Observa eventos de convite para grupos
     * Exibe toasts e dialogs de seleção de grupo
     */
    private fun observeInviteEvents() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.inviteEvent.collect { event ->
                    when (event) {
                        is InviteUiEvent.InviteSent -> {
                            Toast.makeText(
                                requireContext(),
                                "Convite enviado para ${event.userName}",
                                Toast.LENGTH_SHORT
                            ).show()
                        }

                        is InviteUiEvent.Error -> {
                            Toast.makeText(
                                requireContext(),
                                event.message,
                                Toast.LENGTH_LONG
                            ).show()
                        }

                        is InviteUiEvent.ShowGroupSelection -> {
                            showGroupSelectionDialog(event.groups, event.targetUser)
                        }
                    }
                }
            }
        }
    }

    /**
     * Exibe dialog de seleção de grupo para convite
     */
    private fun showGroupSelectionDialog(
        groups: List<com.futebadosparcas.data.model.UserGroup>,
        user: User
    ) {
        val groupNames = groups.map { it.groupName }.toTypedArray()

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Convidar ${user.getDisplayName()} para:")
            .setItems(groupNames) { _, which ->
                val selectedGroup = groups[which]
                viewModel.sendInvite(selectedGroup.groupId, user)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    /**
     * Exibe dialog com detalhes do jogador
     */
    private fun showPlayerCard(user: User) {
        val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(user.id)
        playerCard.show(childFragmentManager, "PlayerCard")
    }
}
