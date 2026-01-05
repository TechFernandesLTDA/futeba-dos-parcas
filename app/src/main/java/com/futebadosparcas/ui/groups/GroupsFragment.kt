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
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Fragment container para GroupsScreen (Jetpack Compose)
 *
 * Migrado para Compose seguindo as melhores práticas do Android moderno:
 * - Usa ComposeView para integração Fragment + Compose
 * - Mantém navegação via Navigation Component
 * - ViewModel compartilhado via Hilt
 * - Material Design 3
 */
@AndroidEntryPoint
class GroupsFragment : Fragment() {

    private val viewModel: GroupsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            // Libera a composição quando a view é destruída
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    GroupsScreen(
                        viewModel = viewModel,
                        onGroupClick = { groupId ->
                            val action = GroupsFragmentDirections
                                .actionGroupsFragmentToGroupDetailFragment(groupId)
                            findNavController().navigate(action)
                        },
                        onCreateGroupClick = {
                            findNavController().navigate(
                                R.id.action_groupsFragment_to_createGroupFragment
                            )
                        },
                        onBackClick = {
                            findNavController().popBackStack()
                        }
                    )
                }
            }
        }
    }
}
