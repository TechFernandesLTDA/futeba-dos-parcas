package com.futebadosparcas.ui.profile

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
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * EditProfileFragment - Wrapper para EditProfileScreen Compose
 * Mantido para compatibilidade com navegação XML
 */
@AndroidEntryPoint
class EditProfileFragment : Fragment() {

    private val viewModel: ProfileViewModel by viewModels()

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
                    EditProfileScreen(
                        viewModel = viewModel,
                        preferencesManager = preferencesManager,
                        onBackClick = {
                            if (isAdded) {
                                findNavController().navigateUp()
                            }
                        },
                        onProfileUpdated = {
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.loadProfile()
    }
}
