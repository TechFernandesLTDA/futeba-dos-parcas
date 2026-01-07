package com.futebadosparcas.ui.groups

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * InvitePlayersFragment - Convidar jogadores para grupo
 *
 * Migrado para Jetpack Compose com InvitePlayersScreen.kt
 */
@AndroidEntryPoint
class InvitePlayersFragment : Fragment() {

    private val viewModel: InviteViewModel by viewModels()
    private val args: InvitePlayersFragmentArgs by navArgs()

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
                    InvitePlayersScreen(
                        viewModel = viewModel,
                        groupId = args.groupId,
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
