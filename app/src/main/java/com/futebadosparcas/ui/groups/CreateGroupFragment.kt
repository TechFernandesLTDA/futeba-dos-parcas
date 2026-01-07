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
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class CreateGroupFragment : Fragment() {

    private val viewModel: GroupsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    CreateGroupScreen(
                        viewModel = viewModel,
                        onNavigateBack = {
                            findNavController().popBackStack()
                        },
                        onGroupCreated = { groupId ->
                            // Navigate to group detail after creation
                            val action = CreateGroupFragmentDirections
                                .actionCreateGroupFragmentToGroupDetailFragment(groupId)
                            findNavController().navigate(action)
                        }
                    )
                }
            }
        }
    }
}
